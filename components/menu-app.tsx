"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DayStrip, DietFilters, Segmented } from "@/components/controls";
import { DishRow } from "@/components/dish-row";
import { APP_NAME } from "@/lib/app";
import {
  dishCount,
  findHall,
  isOpen,
  isServingNow,
  matchesDiet,
  mealWindow,
  pickDefaults,
  reconcile,
  score,
  type Selection,
} from "@/lib/menu-view";
import { DAVIS_TZ, davisDate, davisMinutes, formatDay, formatRange } from "@/lib/time";
import type { DietTag, Dish, MenuData } from "@/lib/types";
import { useVotes } from "@/lib/use-votes";

const ZONE_COLORS: Record<string, string> = {
  red: "#ef4444",
  yellow: "#eab308",
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  pink: "#ec4899",
  orange: "#f97316",
};

const MEALS = ["Breakfast", "Lunch", "Dinner"];
const PREFS_KEY = "dc-menu:prefs";
// The server re-scrapes every 15 minutes; anything older means we're looking at a cached copy.
const STALE_MS = 20 * 60_000;

type Prefs = { hall?: string; diets?: DietTag[] };

function readPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}

function savePrefs(patch: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
  } catch {
    // Private mode or storage disabled — preferences just won't stick.
  }
}

const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: DAVIS_TZ, hour: "numeric", minute: "2-digit" });

export function MenuApp({ menu }: { menu: MenuData }) {
  const router = useRouter();
  // First render uses the scrape time so server and client HTML match; real
  // "now" and saved preferences are applied right after hydration.
  const [now, setNow] = useState(() => new Date(menu.updatedAt));
  const [selection, setSelection] = useState<Selection>(() => pickDefaults(menu, new Date(menu.updatedAt)));
  const [diets, setDiets] = useState<DietTag[]>([]);
  const [ready, setReady] = useState(false);
  // A new object per tap so tapping the same pick again re-scrolls.
  const [jump, setJump] = useState<{ key: string } | null>(null);
  const refreshAttempts = useRef(0);

  useEffect(() => {
    const prefs = readPrefs();
    const current = new Date();
    /* eslint-disable react-hooks/set-state-in-effect -- syncing with the clock and localStorage once after hydration */
    setNow(current);
    setSelection(pickDefaults(menu, current, prefs.hall));
    setDiets(prefs.diets ?? []);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Only on mount; later menu refreshes keep the visitor's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep "now" current, and when the app comes back after a while (a PWA left
  // open overnight), jump to what's being served now.
  useEffect(() => {
    let hiddenAt = 0;
    const tick = setInterval(() => setNow(new Date()), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const current = new Date();
      setNow(current);
      if (hiddenAt && current.getTime() - hiddenAt > 30 * 60_000) {
        setSelection((s) => pickDefaults(menu, current, s.hall));
      }
      if (current.getTime() - Date.parse(menu.updatedAt) > STALE_MS) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [menu, router]);

  // A cached page older than the refresh window has already triggered a
  // background re-scrape on the server; pick up the fresh copy shortly after.
  useEffect(() => {
    if (Date.now() - Date.parse(menu.updatedAt) < STALE_MS || refreshAttempts.current >= 3) return;
    refreshAttempts.current += 1;
    const timer = setTimeout(() => router.refresh(), 2500 * refreshAttempts.current);
    return () => clearTimeout(timer);
  }, [menu, router]);

  const keys = useMemo(() => [...new Set(menu.dishes.map((d) => d.key))], [menu.dishes]);
  const { tallies, vote, persistent } = useVotes(keys);

  const today = davisDate(now);
  const minutes = davisMinutes(now);
  const hall = findHall(menu, selection.hall) ?? menu.halls[0];
  const week = (hall?.days.length ? hall : menu.halls.find((h) => h.days.length))?.days ?? [];
  const day = hall?.days.find((d) => d.date === selection.date);
  const meal = day?.meals.find((m) => m.name === selection.meal);

  const select = (patch: Partial<Selection>) => {
    setSelection((s) => reconcile(menu, { ...s, ...patch }, new Date()));
    if (patch.hall) savePrefs({ hall: patch.hall });
  };

  const setDietFilters = (next: DietTag[]) => {
    setDiets(next);
    savePrefs({ diets: next });
  };

  const zones = (meal?.zones ?? [])
    .map((zone) => ({ ...zone, items: zone.dishes.map((i) => menu.dishes[i]).filter((d) => matchesDiet(d, diets)) }))
    .filter((zone) => zone.items.length);

  // Best-rated dishes for this meal across every dining commons.
  const topPicks = useMemo(() => {
    const byKey = new Map<string, { dish: Dish; halls: { id: string; name: string }[] }>();
    for (const h of menu.halls) {
      const m = h.days.find((d) => d.date === selection.date)?.meals.find((x) => x.name === selection.meal);
      for (const zone of m?.zones ?? []) {
        for (const i of zone.dishes) {
          const dish = menu.dishes[i];
          if (score(tallies[dish.key]) <= 0 || !matchesDiet(dish, diets)) continue;
          const entry = byKey.get(dish.key) ?? { dish, halls: [] };
          if (!entry.halls.some((x) => x.id === h.id)) entry.halls.push({ id: h.id, name: h.name });
          byKey.set(dish.key, entry);
        }
      }
    }
    return [...byKey.values()].sort((a, b) => score(tallies[b.dish.key]) - score(tallies[a.dish.key])).slice(0, 3);
  }, [menu, selection.date, selection.meal, tallies, diets]);

  const jumpTo = (key: string, hallIds: string[]) => {
    if (!hallIds.includes(selection.hall)) select({ hall: hallIds[0] });
    setJump({ key });
  };

  // Runs after the (possibly new) hall has rendered, so the row exists.
  useEffect(() => {
    if (!jump) return;
    document.getElementById(`dish-${jump.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setJump(null), 1700);
    return () => clearTimeout(timer);
  }, [jump]);

  const heading = formatDay(selection.date, "long");
  const relative =
    selection.date === today
      ? "Today"
      : selection.date === davisDate(new Date(now.getTime() + 86_400_000))
        ? "Tomorrow"
        : null;
  const openElsewhere = menu.halls.filter(
    (h) => h.id !== hall?.id && isOpen(h.days.find((d) => d.date === selection.date)),
  );

  return (
    <main className="mx-auto w-full max-w-xl px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
      <header className="flex items-end justify-between gap-4 pt-5 pb-4">
        <div>
          <p className="text-[13px] font-semibold text-muted">
            {relative ? `${relative} · ` : ""}
            {heading.weekday}, {heading.month} {heading.day}
          </p>
          <h1 className="mt-0.5 text-[30px] font-bold leading-none tracking-[-0.03em]">{APP_NAME}</h1>
        </div>
        <p className="flex items-center gap-1.5 pb-1 text-[12px] font-medium text-muted">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live menus
        </p>
      </header>

      <div className={`transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}>
        {week.length > 0 && (
          <DayStrip
            dates={week.map((d) => d.date)}
            selected={selection.date}
            today={today}
            closed={new Set(hall?.days.filter((d) => !isOpen(d)).map((d) => d.date))}
            onSelect={(date) => select({ date })}
          />
        )}

        <div className="sticky top-0 z-20 -mx-4 mt-3 space-y-2 bg-bg/85 px-4 pt-2 pb-3 backdrop-blur-xl backdrop-saturate-150">
          <Segmented
            label="Dining commons"
            value={hall?.id ?? ""}
            onChange={(id) => select({ hall: id })}
            options={menu.halls.map((h) => ({
              value: h.id,
              label: h.name,
              dim: !isOpen(h.days.find((d) => d.date === selection.date)),
            }))}
          />
          <Segmented
            label="Meal"
            value={selection.meal}
            onChange={(name) => select({ meal: name })}
            options={(day?.meals.length ? day.meals.map((m) => m.name) : MEALS).map((name) => {
              const m = day?.meals.find((x) => x.name === name);
              const window = m && dishCount(m) ? mealWindow(m) : null;
              return {
                value: name,
                label: name,
                detail: m && dishCount(m) ? (window ? formatRange(window[0], window[1]) : "Open") : "Closed",
                dim: !m || !dishCount(m),
                live: !!m && selection.date === today && dishCount(m) > 0 && isServingNow(m, minutes),
              };
            })}
          />
        </div>

        <DietFilters value={diets} onChange={setDietFilters} />

        {topPicks.length > 0 && (
          <section className="anim-rise mt-5 rounded-2xl border border-line bg-card p-1.5">
            <h2 className="px-2.5 pt-1.5 pb-1 text-[12px] font-semibold text-muted">
              Top rated on campus · {selection.meal}
            </h2>
            <ol>
              {topPicks.map(({ dish, halls }, i) => (
                <li key={dish.key}>
                  <button
                    type="button"
                    onClick={() =>
                      jumpTo(
                        dish.key,
                        halls.map((h) => h.id),
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-chip active:bg-chip"
                  >
                    <span className="w-3 text-[13px] font-semibold tabular-nums text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{dish.name}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {halls.map((h) => h.name).join(" · ")}
                      </span>
                    </span>
                    <span className="rounded-full bg-up-soft px-2 py-0.5 text-[12px] font-semibold tabular-nums text-up">
                      +{score(tallies[dish.key])}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div key={`${hall?.id}-${selection.date}-${selection.meal}`} className="anim-rise">
          {hall?.error ? (
            <Notice title={`Couldn't load ${hall.name} right now`}>
              UC Davis Dining didn&apos;t respond. Check the{" "}
              <a
                className="font-medium text-fg underline underline-offset-2"
                href={hall.url}
                target="_blank"
                rel="noreferrer"
              >
                official menu
              </a>{" "}
              or try again in a few minutes.
            </Notice>
          ) : !isOpen(day) ? (
            <Notice
              title={`${hall?.name ?? "This DC"} is closed ${selection.date === today ? "today" : `on ${heading.weekday}`}`}
            >
              {openElsewhere.length ? (
                <span className="mt-3 flex flex-wrap justify-center gap-2">
                  {openElsewhere.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => select({ hall: h.id })}
                      className="rounded-full bg-fg px-3.5 py-1.5 text-[13px] font-semibold text-bg transition-transform active:scale-95"
                    >
                      {h.name} is open →
                    </button>
                  ))}
                </span>
              ) : (
                "No dining commons have a menu posted for this day."
              )}
            </Notice>
          ) : !meal || !dishCount(meal) ? (
            <Notice title={`No ${selection.meal.toLowerCase()} at ${hall?.name}`}>
              Try another meal or dining commons.
            </Notice>
          ) : !zones.length ? (
            <Notice title={`Nothing ${diets.join(" + ")} this ${selection.meal.toLowerCase()}`}>
              <button
                type="button"
                onClick={() => setDietFilters([])}
                className="mt-3 rounded-full bg-fg px-3.5 py-1.5 text-[13px] font-semibold text-bg transition-transform active:scale-95"
              >
                Clear filters
              </button>
            </Notice>
          ) : (
            zones.map((zone) => (
              <section key={zone.color} className="mt-6">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
                    <span
                      aria-hidden
                      className="size-2.5 translate-y-px rounded-full ring-2 ring-card"
                      style={{ background: ZONE_COLORS[zone.color.toLowerCase()] ?? "var(--faint)" }}
                    />
                    {zone.color} zone
                  </h2>
                  {zone.hours && <span className="text-[12px] font-medium tabular-nums text-muted">{zone.hours}</span>}
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                  {zone.items.map((dish, i) => (
                    <DishRow
                      key={`${dish.key}-${i}`}
                      dish={dish}
                      tally={tallies[dish.key]}
                      onVote={(value) => vote(dish.key, value)}
                      sourceUrl={hall?.url ?? "https://housing.ucdavis.edu/dining/menus/"}
                      flash={jump?.key === dish.key}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className="mt-10 space-y-1.5 px-1 text-center text-[12px] leading-relaxed text-muted">
          <p>
            Menus come straight from{" "}
            <a
              className="underline decoration-line underline-offset-2 hover:decoration-fg"
              href="https://housing.ucdavis.edu/dining/menus/"
              target="_blank"
              rel="noreferrer"
            >
              UC Davis Dining
            </a>{" "}
            and refresh automatically · Updated {timeFmt.format(new Date(menu.updatedAt))}
          </p>
          <p>Votes stick to a dish, so they&apos;re still there when it comes back.</p>
          <p className="text-faint">Unofficial student project. Confirm allergens with dining staff.</p>
          {!persistent && (
            <p className="mx-auto mt-3 max-w-sm rounded-xl bg-amber-500/12 px-3 py-2 text-amber-800 dark:text-amber-300">
              Votes are only kept in memory. Connect Upstash Redis in Vercel to save them.
            </p>
          )}
        </footer>
      </div>
    </main>
  );
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-card px-6 py-10 text-center">
      <p className="text-[16px] font-semibold tracking-[-0.01em]">{title}</p>
      {children && <div className="mt-1.5 text-[14px] text-muted">{children}</div>}
    </div>
  );
}
