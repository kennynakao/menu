"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppHeader, BottomNav, HallList, type View } from "@/components/chrome";
import { Chip, DayStrip, Segmented } from "@/components/controls";
import { DishRow } from "@/components/dish-row";
import { DIET_DOT, FilterGroups, FilterSheet } from "@/components/filters";
import { IconSliders } from "@/components/icons";
import { SearchView } from "@/components/search-view";
import { CampusNow, HallBoard, TopVotedView, YourUpvotes, type Clock } from "@/components/top-voted";
import { DIETS, NO_FILTERS, filterCount, matchesFilters, parseFilters, type Filters } from "@/lib/filters";
import {
  hallStatus,
  indexServings,
  isUpcoming,
  leaderboard,
  searchDishes,
  type HallStatus,
  type Serving,
} from "@/lib/insights";
import {
  dishCount,
  findHall,
  isOpen,
  isServingNow,
  mealWindow,
  pickDefaults,
  reconcile,
  score,
  type Selection,
} from "@/lib/menu-view";
import { DAVIS_TZ, davisDate, davisMinutes, formatDay, formatRange } from "@/lib/time";
import type { Dish, Hall, MenuData, VoteTally } from "@/lib/types";
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

type Prefs = { hall?: string; filters?: Filters };

function readPrefs(): Prefs & { diets?: unknown } {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
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
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [view, setView] = useState<View>("menu");
  const [query, setQuery] = useState("");
  const [best, setBest] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ready, setReady] = useState(false);
  // A new object per tap so tapping the same dish again re-scrolls.
  const [jump, setJump] = useState<{ key: string } | null>(null);
  const refreshAttempts = useRef(0);

  useEffect(() => {
    const prefs = readPrefs();
    const current = new Date();
    /* eslint-disable react-hooks/set-state-in-effect -- syncing with the clock and localStorage once after hydration */
    setNow(current);
    setSelection(pickDefaults(menu, current, prefs.hall));
    setFilters(parseFilters(prefs.filters ?? { diets: prefs.diets }));
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

  // Runs after the (possibly new) hall has rendered, so the row exists.
  useEffect(() => {
    if (!jump) return;
    document.getElementById(`dish-${jump.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setJump(null), 1700);
    return () => clearTimeout(timer);
  }, [jump]);

  const keys = useMemo(() => [...new Set(menu.dishes.map((d) => d.key))], [menu.dishes]);
  const { tallies, vote, persistent } = useVotes(keys);

  const today = davisDate(now);
  const minutes = davisMinutes(now);
  const clock: Clock = { today, tomorrow: davisDate(new Date(now.getTime() + 86_400_000)) };
  const servings = useMemo(() => indexServings(menu), [menu]);
  const statuses = useMemo(
    () => Object.fromEntries(menu.halls.map((h) => [h.id, hallStatus(h, today, minutes)])) as Record<string, HallStatus>,
    [menu, today, minutes],
  );

  const hall = findHall(menu, selection.hall) ?? menu.halls[0];
  const week = (hall?.days.length ? hall : menu.halls.find((h) => h.days.length))?.days ?? [];
  const day = hall?.days.find((d) => d.date === selection.date);
  const meal = day?.meals.find((m) => m.name === selection.meal);

  const select = (patch: Partial<Selection>) => {
    setSelection((s) => reconcile(menu, { ...s, ...patch }, new Date()));
    if (patch.hall) savePrefs({ hall: patch.hall });
  };

  const changeFilters = (next: Filters) => {
    setFilters(next);
    savePrefs({ filters: next });
  };

  const changeView = (next: View) => {
    setView(next);
    if (next !== "search") setQuery("");
    window.scrollTo({ top: 0 });
  };

  /** Shows a dish on the menu, at the serving the visitor picked. */
  const openDish = (key: string, serving?: Serving) => {
    setView("menu");
    setQuery("");
    if (serving) select({ hall: serving.hall, date: serving.date, meal: serving.meal });
    setJump({ key });
  };

  const zones = (meal?.zones ?? [])
    .map((zone) => ({ ...zone, items: zone.dishes.map((i) => menu.dishes[i]).filter((d) => matchesFilters(d, filters)) }))
    .filter((zone) => zone.items.length);
  const shownCount = zones.reduce((n, z) => n + z.items.length, 0);

  // Highest-rated dishes across every dining commons for the meal being viewed.
  const campusPicks = useMemo(() => {
    const byKey = new Map<string, { dish: Dish; score: number; servings: Serving[] }>();
    for (const h of menu.halls) {
      const m = h.days.find((d) => d.date === selection.date)?.meals.find((x) => x.name === selection.meal);
      for (const zone of m?.zones ?? []) {
        for (const i of zone.dishes) {
          const dish = menu.dishes[i];
          const s = score(tallies[dish.key]);
          if (s <= 0 || byKey.has(dish.key) || !matchesFilters(dish, filters)) continue;
          const here = (servings.get(dish.key) ?? []).filter(
            (x) => x.date === selection.date && x.meal === selection.meal,
          );
          byKey.set(dish.key, { dish, score: s, servings: here });
        }
      }
    }
    return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [menu, servings, selection.date, selection.meal, tallies, filters]);

  const boards = useMemo(
    () =>
      menu.halls.map((h) => ({
        hall: h,
        status: statuses[h.id],
        rows: leaderboard(menu, servings, h, tallies, filters, { best, today, minutes }),
      })),
    [menu, servings, statuses, tallies, filters, best, today, minutes],
  );
  const railBoard = useMemo(
    () => (hall ? leaderboard(menu, servings, hall, tallies, filters, { today, minutes }) : []),
    [menu, servings, hall, tallies, filters, today, minutes],
  );

  const yours = useMemo(() => upvotedThisWeek(menu, servings, tallies, today, minutes), [menu, servings, tallies, today, minutes]);
  const hits = useMemo(
    () => searchDishes(menu, servings, query, filters, { today, minutes }),
    [menu, servings, query, filters, today, minutes],
  );

  const heading = formatDay(selection.date, "long");
  const relative = selection.date === today ? "Today" : selection.date === clock.tomorrow ? "Tomorrow" : null;
  const status = hall ? statuses[hall.id] : undefined;

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-0">
      {/* Keeps the iOS status bar navy when installed to the home screen. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-brand" />

      <AppHeader
        view={view}
        onView={changeView}
        query={query}
        onQuery={(q) => {
          setQuery(q);
          setView(q.trim() ? "search" : "menu");
        }}
      />

      <div
        className={`mx-auto max-w-[1400px] px-4 pt-5 transition-opacity duration-300 lg:px-8 lg:pt-8 ${ready ? "opacity-100" : "opacity-0"}`}
      >
        <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[232px_minmax(0,1fr)_320px] xl:gap-10">
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] space-y-8">
              <section>
                <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
                  Dining commons
                </h2>
                <HallList
                  halls={menu.halls}
                  selected={hall?.id ?? ""}
                  statuses={statuses}
                  onSelect={(id) => {
                    select({ hall: id });
                    if (view !== "menu") changeView("menu");
                  }}
                />
              </section>
              <FilterGroups filters={filters} onChange={changeFilters} />
            </div>
          </aside>

          <main className={`min-w-0 ${view === "top" ? "xl:col-span-2" : ""}`}>
            {view === "top" ? (
              <TopVotedView boards={boards} best={best} onBest={setBest} yours={yours} clock={clock} onOpen={openDish} />
            ) : view === "search" ? (
              <SearchView
                query={query}
                onQuery={setQuery}
                hits={hits}
                tallies={tallies}
                clock={clock}
                minutes={minutes}
                onOpen={openDish}
              />
            ) : (
              <>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-muted">
                      {relative ? `${relative} · ` : ""}
                      {heading.weekday}, {heading.month} {heading.day}
                    </p>
                    <h1 className="mt-1 hidden text-[34px] font-bold leading-tight tracking-[-0.03em] text-brand lg:block dark:text-fg">
                      {hall?.name}
                    </h1>
                  </div>
                  {status && selection.date === today && <StatusPill status={status} />}
                </div>

                {week.length > 0 && (
                  <DayStrip
                    dates={week.map((d) => d.date)}
                    selected={selection.date}
                    today={today}
                    closed={new Set(hall?.days.filter((d) => !isOpen(d)).map((d) => d.date))}
                    onSelect={(date) => select({ date })}
                  />
                )}

                <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-4 mt-3 space-y-2 bg-bg/85 px-4 pt-2 pb-3 backdrop-blur-xl backdrop-saturate-150 lg:top-[67px] lg:mx-0 lg:px-0">
                  <div className="lg:hidden">
                    <Segmented
                      label="Dining commons"
                      value={hall?.id ?? ""}
                      onChange={(id) => select({ hall: id })}
                      options={menu.halls.map((h) => ({
                        value: h.id,
                        label: h.name,
                        live: selection.date === today && statuses[h.id]?.open,
                        dim: !isOpen(h.days.find((d) => d.date === selection.date)),
                      }))}
                    />
                  </div>
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

                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded border px-3 text-[13px] font-semibold transition-transform active:scale-95 ${
                      filterCount(filters) ? "border-transparent bg-primary text-on-primary" : "border-line bg-card"
                    }`}
                  >
                    <IconSliders className="size-4" />
                    Filters{filterCount(filters) ? ` · ${filterCount(filters)}` : ""}
                  </button>
                  {DIETS.map(({ id, label }) => (
                    <Chip
                      key={id}
                      dot={DIET_DOT[id]}
                      active={filters.diets.includes(id)}
                      onClick={() =>
                        changeFilters({
                          ...filters,
                          diets: filters.diets.includes(id) ? filters.diets.filter((d) => d !== id) : [...filters.diets, id],
                        })
                      }
                    >
                      {label}
                    </Chip>
                  ))}
                </div>

                {campusPicks.length > 0 && (
                  <div className="mt-5 xl:hidden">
                    <CampusNow meal={selection.meal} picks={campusPicks} onOpen={openDish} />
                  </div>
                )}

                <MenuZones
                  key={`${hall?.id}-${selection.date}-${selection.meal}`}
                  hall={hall}
                  zones={zones}
                  mealName={selection.meal}
                  mealHasDishes={!!meal && dishCount(meal) > 0}
                  dayOpen={isOpen(day)}
                  isToday={selection.date === today}
                  weekday={heading.weekday}
                  openElsewhere={menu.halls.filter(
                    (h) => h.id !== hall?.id && isOpen(h.days.find((d) => d.date === selection.date)),
                  )}
                  filtered={filterCount(filters) > 0}
                  onClearFilters={() => changeFilters(NO_FILTERS)}
                  onHall={(id) => select({ hall: id })}
                  tallies={tallies}
                  onVote={vote}
                  flashKey={jump?.key}
                />
              </>
            )}

            <Footer updatedAt={menu.updatedAt} persistent={persistent} />
          </main>

          {view !== "top" && (
            <aside className="hidden xl:block">
              <div className="sticky top-[92px] space-y-4">
                <CampusNow meal={selection.meal} picks={campusPicks} onOpen={openDish} />
                {hall && <HallBoard compact hall={hall} rows={railBoard} best clock={clock} onOpen={openDish} />}
                <YourUpvotes rows={yours.slice(0, 5)} clock={clock} onOpen={openDish} />
              </div>
            </aside>
          )}
        </div>
      </div>

      <BottomNav view={view} onView={changeView} />
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={changeFilters}
        resultCount={shownCount}
      />
    </div>
  );
}

/** Dishes this visitor upvoted that appear on a menu this week, soonest first. */
function upvotedThisWeek(
  menu: MenuData,
  servings: Map<string, Serving[]>,
  tallies: Record<string, VoteTally>,
  today: string,
  minutes: number,
) {
  const rows: { dish: Dish; score: number; next?: Serving; last?: Serving }[] = [];
  for (const [key, tally] of Object.entries(tallies)) {
    const list = servings.get(key);
    if (tally.mine !== 1 || !list?.length) continue;
    const dish = menu.dishes.find((d) => d.key === key)!;
    rows.push({ dish, score: score(tally), next: list.find((s) => isUpcoming(s, today, minutes)), last: list.at(-1) });
  }
  // Upcoming servings in time order, then dishes that already had their last serving.
  const when = (r: (typeof rows)[number]) =>
    r.next ? `${r.next.date}-${String(r.next.end).padStart(4, "0")}` : `~${r.last?.date}`;
  return rows.sort((a, b) => when(a).localeCompare(when(b)));
}

function StatusPill({ status }: { status: HallStatus }) {
  return (
    <span
      className={`mb-1 flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-semibold ${
        status.open ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300" : "bg-chip text-muted"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${status.open ? "bg-emerald-500" : "bg-faint"}`} />
      {status.label}
    </span>
  );
}

function MenuZones({
  hall,
  zones,
  mealName,
  mealHasDishes,
  dayOpen,
  isToday,
  weekday,
  openElsewhere,
  filtered,
  onClearFilters,
  onHall,
  tallies,
  onVote,
  flashKey,
}: {
  hall?: Hall;
  zones: { color: string; hours?: string; items: Dish[] }[];
  mealName: string;
  mealHasDishes: boolean;
  dayOpen: boolean;
  isToday: boolean;
  weekday: string;
  openElsewhere: Hall[];
  filtered: boolean;
  onClearFilters: () => void;
  onHall: (id: string) => void;
  tallies: Record<string, VoteTally>;
  onVote: (key: string, value: -1 | 0 | 1) => void;
  flashKey?: string;
}) {
  if (hall?.error) {
    return (
      <Notice title={`Couldn't load ${hall.name} right now`}>
        UC Davis Dining didn&apos;t respond. Check the{" "}
        <a className="font-medium text-brand underline underline-offset-2 dark:text-gold" href={hall.url} target="_blank" rel="noreferrer">
          official menu
        </a>{" "}
        or try again in a few minutes.
      </Notice>
    );
  }
  if (!dayOpen) {
    return (
      <Notice title={`${hall?.name ?? "This DC"} is closed ${isToday ? "today" : `on ${weekday}`}`}>
        {openElsewhere.length ? (
          <span className="mt-3 flex flex-wrap justify-center gap-2">
            {openElsewhere.map((h) => (
              <PrimaryButton key={h.id} onClick={() => onHall(h.id)}>
                {h.name} is open →
              </PrimaryButton>
            ))}
          </span>
        ) : (
          "No dining commons have a menu posted for this day."
        )}
      </Notice>
    );
  }
  if (!mealHasDishes) {
    return <Notice title={`No ${mealName.toLowerCase()} at ${hall?.name}`}>Try another meal or dining commons.</Notice>;
  }
  if (!zones.length) {
    return (
      <Notice title={`Nothing matches your filters this ${mealName.toLowerCase()}`}>
        {filtered && (
          <span className="mt-3 block">
            <PrimaryButton onClick={onClearFilters}>Clear filters</PrimaryButton>
          </span>
        )}
      </Notice>
    );
  }
  return (
    <div className="anim-rise">
      {zones.map((zone) => (
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
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line bg-card">
            {zone.items.map((dish, i) => (
              <DishRow
                key={`${dish.key}-${i}`}
                dish={dish}
                tally={tallies[dish.key]}
                onVote={(value) => onVote(dish.key, value)}
                sourceUrl={hall?.url ?? "https://housing.ucdavis.edu/dining/menus/"}
                flash={flashKey === dish.key}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-on-primary transition-transform active:scale-95"
    >
      {children}
    </button>
  );
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-6 rounded-md border border-line bg-card px-6 py-10 text-center">
      <p className="text-[16px] font-semibold tracking-[-0.01em] text-brand dark:text-fg">{title}</p>
      {children && <div className="mt-1.5 text-[14px] text-muted">{children}</div>}
    </div>
  );
}

function Footer({ updatedAt, persistent }: { updatedAt: string; persistent: boolean }) {
  return (
    <footer className="mt-12 space-y-1.5 border-t border-line pt-6 pb-2 text-center text-[12px] leading-relaxed text-muted lg:text-left">
      <p>
        Menus come straight from{" "}
        <a
          className="font-medium text-brand underline decoration-line underline-offset-2 hover:decoration-brand dark:text-gold"
          href="https://housing.ucdavis.edu/dining/menus/"
          target="_blank"
          rel="noreferrer"
        >
          UC Davis Dining
        </a>{" "}
        and refresh automatically · Updated {timeFmt.format(new Date(updatedAt))}
      </p>
      <p>Votes stay with a dish, so they&apos;re still there when it comes back.</p>
      <p className="text-faint">Independent student project, not affiliated with UC Davis. Confirm allergens with dining staff.</p>
      {!persistent && (
        <p className="mx-auto mt-3 max-w-sm rounded bg-amber-500/12 px-3 py-2 text-amber-800 lg:mx-0 dark:text-amber-300">
          Votes are only kept in memory. Connect Upstash Redis in Vercel to save them.
        </p>
      )}
    </footer>
  );
}
