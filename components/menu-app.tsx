"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppHeader, BottomNav, HallBar, type View } from "@/components/chrome";
import { DIET_MARKS, Tabs } from "@/components/controls";
import { DishRow } from "@/components/dish-row";
import { FilterBar, FilterPanel } from "@/components/filters";
import { SearchView } from "@/components/search-view";
import { CampusNow, HallRail, TopVotedView, YourUpvotes, type Clock } from "@/components/top-voted";
import { NO_FILTERS, filterCount, matchesFilters, parseFilters, type Filters } from "@/lib/filters";
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
import { DAVIS_TZ, davisDate, davisMinutes, formatDay, formatRange, formatTime } from "@/lib/time";
import type { DietTag, Dish, Hall, MenuData, VoteTally } from "@/lib/types";
import { useVotes } from "@/lib/use-votes";

// The colors of the zone signs inside the dining commons.
const ZONE_COLORS: Record<string, string> = {
  red: "#d0312d",
  yellow: "#f0b400",
  blue: "#2563c9",
  green: "#2e8540",
  purple: "#7048b8",
  pink: "#d9457f",
  orange: "#e8710a",
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [query, setQuery] = useState("");
  const [best, setBest] = useState(true);
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
  const isToday = selection.date === today;

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
  const railRows = useMemo(
    () => (hall ? leaderboard(menu, servings, hall, tallies, filters, { today, minutes }) : []),
    [menu, servings, hall, tallies, filters, today, minutes],
  );
  const yours = useMemo(
    () => upvotedThisWeek(menu, servings, tallies, today, minutes),
    [menu, servings, tallies, today, minutes],
  );
  const hits = useMemo(
    () => searchDishes(menu, servings, query, filters, { today, minutes }),
    [menu, servings, query, filters, today, minutes],
  );

  const heading = formatDay(selection.date, "long");
  const dayLabel = isToday ? "Today" : selection.date === clock.tomorrow ? "Tomorrow" : heading.weekday;
  const status = hall ? statuses[hall.id] : undefined;

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+var(--spacing-f89))] md:pb-0">
      {/* Keeps the iOS status bar navy when installed to the home screen. */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-navy" />

      <AppHeader
        view={view}
        onView={changeView}
        query={query}
        onQuery={(q) => {
          setQuery(q);
          setView(q.trim() ? "search" : "menu");
        }}
      />
      {view === "menu" && hall ? (
        <HallBar halls={menu.halls} selected={hall.id} statuses={statuses} onSelect={(id) => select({ hall: id })} />
      ) : (
        <div aria-hidden className="h-[3px] bg-gold" />
      )}

      <div
        className={`mx-auto max-w-f1042 px-f21 pt-f34 transition-opacity duration-300 desk:px-0 ${ready ? "opacity-100" : "opacity-0"}`}
      >
        {view === "top" ? (
          <TopVotedView boards={boards} best={best} onBest={setBest} yours={yours} clock={clock} onOpen={openDish} />
        ) : view === "search" ? (
          <SearchView
            query={query}
            onQuery={setQuery}
            hits={hits}
            filtered={filterCount(filters) > 0}
            tallies={tallies}
            clock={clock}
            minutes={minutes}
            onOpen={openDish}
          />
        ) : (
          <div className="desk:grid desk:grid-cols-[var(--spacing-f610)_var(--spacing-f377)] desk:gap-f55">
            <main className="mx-auto min-w-0 max-w-f610 desk:mx-0">
              <h1 className="font-serif text-h2 font-semibold text-heading md:text-h1">{hall?.name}</h1>
              <p className="mt-f5 text-ink-2">
                {heading.weekday}, {heading.month} {heading.day}
                {isToday && status ? ` · ${status.label}` : ""}
              </p>

              {week.length > 0 && (
                <Tabs
                  label="Day"
                  className="mt-f21"
                  value={selection.date}
                  onChange={(date) => select({ date })}
                  options={week.map((d) => {
                    const f = formatDay(d.date);
                    const closed = !isOpen(hall?.days.find((x) => x.date === d.date));
                    return {
                      value: d.date,
                      ariaLabel: `${formatDay(d.date, "long").weekday} ${f.day}${d.date === today ? ", today" : ""}${closed ? ", closed" : ""}`,
                      muted: closed,
                      label: <span className="text-cap font-medium">{d.date === today ? "Today" : f.weekday}</span>,
                      detail: <span className="text-lead font-semibold tabular-nums">{f.day}</span>,
                    };
                  })}
                />
              )}

              <div className="sticky top-[env(safe-area-inset-top)] z-20 -mx-f21 bg-paper/95 px-f21 backdrop-blur desk:mx-0 desk:px-0">
                <Tabs
                  label="Meal"
                  value={selection.meal}
                  onChange={(name) => select({ meal: name })}
                  options={(day?.meals.length ? day.meals.map((m) => m.name) : MEALS).map((name) => {
                    const m = day?.meals.find((x) => x.name === name);
                    const served = !!m && dishCount(m) > 0;
                    const window = served ? mealWindow(m) : null;
                    const servingNow = served && isToday && isServingNow(m, minutes);
                    return {
                      value: name,
                      muted: !served,
                      label: <span className="font-semibold">{name}</span>,
                      detail: (
                        <span className={`text-cap tabular-nums ${servingNow ? "font-semibold text-gold-deep" : ""}`}>
                          {!served
                            ? "Closed"
                            : servingNow && window
                              ? `Now · until ${formatTime(window[1])}`
                              : window
                                ? formatRange(window[0], window[1])
                                : "Open"}
                        </span>
                      ),
                    };
                  })}
                />
              </div>

              <div className="mt-f5">
                <FilterBar
                  filters={filters}
                  onChange={changeFilters}
                  open={filtersOpen}
                  onToggle={() => setFiltersOpen((o) => !o)}
                />
                {filtersOpen && <FilterPanel filters={filters} onChange={changeFilters} />}
              </div>

              {campusPicks.length > 0 && (
                <div className="mt-f34 desk:hidden">
                  <CampusNow meal={selection.meal} dayLabel={dayLabel} picks={campusPicks} onOpen={openDish} />
                </div>
              )}

              <MenuZones
                key={`${hall?.id}-${selection.date}-${selection.meal}`}
                hall={hall}
                zones={zones}
                mealName={selection.meal}
                mealHasDishes={!!meal && dishCount(meal) > 0}
                dayOpen={isOpen(day)}
                isToday={isToday}
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
            </main>

            <aside className="hidden desk:block">
              <div className="sticky top-f21 space-y-f55">
                <CampusNow meal={selection.meal} dayLabel={dayLabel} picks={campusPicks} onOpen={openDish} />
                {hall && (
                  <HallRail
                    hall={hall}
                    rows={railRows}
                    clock={clock}
                    onOpen={openDish}
                    onSeeAll={() => changeView("top")}
                  />
                )}
                <YourUpvotes rows={yours.slice(0, 5)} clock={clock} onOpen={openDish} />
              </div>
            </aside>
          </div>
        )}

        <Footer updatedAt={menu.updatedAt} persistent={persistent} />
      </div>

      <BottomNav view={view} onView={changeView} />
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

function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold text-heading underline decoration-gold decoration-2 underline-offset-4"
    >
      {children}
    </button>
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
      <Notice title={`${hall.name}’s menu didn’t load`}>
        UC Davis Dining didn’t respond. Try again in a few minutes, or check the{" "}
        <a
          className="font-semibold text-heading underline decoration-gold decoration-2 underline-offset-4"
          href={hall.url}
          target="_blank"
          rel="noreferrer"
        >
          official menu
        </a>
        .
      </Notice>
    );
  }
  if (!dayOpen) {
    return (
      <Notice title={`${hall?.name ?? "This dining commons"} is closed ${isToday ? "today" : `on ${weekday}`}`}>
        {openElsewhere.length ? (
          <>
            Open instead:{" "}
            {openElsewhere.map((h, i) => (
              <span key={h.id}>
                {i > 0 && ", "}
                <TextButton onClick={() => onHall(h.id)}>{h.name}</TextButton>
              </span>
            ))}
            .
          </>
        ) : (
          "No dining commons has a menu posted for this day."
        )}
      </Notice>
    );
  }
  if (!mealHasDishes) {
    return (
      <Notice title={`No ${mealName.toLowerCase()} at ${hall?.name}`}>Pick another meal or dining commons.</Notice>
    );
  }
  if (!zones.length) {
    return (
      <Notice title="Nothing matches your filters">
        Nothing this {mealName.toLowerCase()} fits.{" "}
        {filtered && <TextButton onClick={onClearFilters}>Clear filters</TextButton>}
      </Notice>
    );
  }
  return (
    <div className="anim-rise">
      {zones.map((zone) => (
        <section key={zone.color} className="mt-f34">
          <header
            className="flex items-baseline justify-between border-t-[3px] pt-f8"
            style={{ borderColor: ZONE_COLORS[zone.color.toLowerCase()] ?? "var(--rule-strong)" }}
          >
            <h2 className="text-lead font-semibold text-heading">{zone.color} Zone</h2>
            {zone.hours && <span className="text-cap text-ink-3 tabular-nums">{zone.hours}</span>}
          </header>
          <ul className="mt-f3">
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

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mt-f34 border-t border-rule pt-f21">
      <p className="font-serif text-h3 font-semibold text-heading">{title}</p>
      {children && <div className="mt-f8 leading-golden text-ink-2">{children}</div>}
    </div>
  );
}

function Footer({ updatedAt, persistent }: { updatedAt: string; persistent: boolean }) {
  return (
    <footer className="mt-f89 max-w-f610 space-y-f5 border-t border-rule pt-f21 pb-f34 text-cap text-ink-3">
      <p>
        {(Object.keys(DIET_MARKS) as DietTag[]).map((tag, i) => (
          <span key={tag}>
            {i > 0 && " · "}
            <span className={`font-bold ${DIET_MARKS[tag].color}`}>{DIET_MARKS[tag].short}</span>{" "}
            {DIET_MARKS[tag].title.toLowerCase()}
          </span>
        ))}
      </p>
      <p>
        Menus come straight from{" "}
        <a
          className="font-semibold text-ink-2 underline decoration-rule-strong underline-offset-4 hover:decoration-gold"
          href="https://housing.ucdavis.edu/dining/menus/"
          target="_blank"
          rel="noreferrer"
        >
          UC Davis Dining
        </a>{" "}
        and refresh on their own. Last updated {timeFmt.format(new Date(updatedAt))}.
      </p>
      <p>Votes stay with a dish, so they’re still there when it comes back.</p>
      <p>Independent student project, not affiliated with UC Davis. Confirm allergens with dining staff.</p>
      {!persistent && (
        <p className="mt-f13 border-l-[3px] border-gold pl-f8 text-ink-2">
          Votes are only kept in memory. Connect Upstash Redis in Vercel to save them.
        </p>
      )}
    </footer>
  );
}
