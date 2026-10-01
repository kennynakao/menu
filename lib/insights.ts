import { matchesFilters, type Filters } from "./filters";
import { dishCount, isOpen, mealWindow, score } from "./menu-view";
import { formatDay, formatTime, parseHours } from "./time";
import type { Dish, Hall, MenuData, VoteTally } from "./types";

/** One time and place a dish is served this week. */
export type Serving = {
  hall: string;
  hallName: string;
  date: string;
  meal: string;
  zone: string;
  /** Minutes after midnight when that meal ends, for "is it still coming up today?". */
  end: number;
};

const MEAL_ORDER = ["breakfast", "brunch", "lunch", "dinner"];
const mealRank = (meal: string) => {
  const i = MEAL_ORDER.indexOf(meal.toLowerCase());
  return i === -1 ? MEAL_ORDER.length : i;
};

/** Every serving of every dish this week, keyed by dish and sorted by time. */
export function indexServings(menu: MenuData): Map<string, Serving[]> {
  const index = new Map<string, Serving[]>();
  for (const hall of menu.halls) {
    for (const day of hall.days) {
      for (const meal of day.meals) {
        const end = mealWindow(meal)?.[1] ?? 24 * 60;
        for (const zone of meal.zones) {
          for (const i of zone.dishes) {
            const key = menu.dishes[i].key;
            const list = index.get(key) ?? [];
            if (!list.some((s) => s.hall === hall.id && s.date === day.date && s.meal === meal.name)) {
              list.push({ hall: hall.id, hallName: hall.name, date: day.date, meal: meal.name, zone: zone.color, end });
            }
            index.set(key, list);
          }
        }
      }
    }
  }
  for (const list of index.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date) || mealRank(a.meal) - mealRank(b.meal));
  }
  return index;
}

export const isUpcoming = (s: Serving, today: string, minutes: number) =>
  s.date > today || (s.date === today && minutes < s.end);

/** "Today · Dinner", "Tomorrow · Lunch", "Fri · Breakfast" */
export function whenLabel(s: Serving, today: string, tomorrow: string): string {
  const day = s.date === today ? "Today" : s.date === tomorrow ? "Tomorrow" : formatDay(s.date).weekday;
  return `${day} · ${s.meal}`;
}

export type RankedDish = { dish: Dish; tally: VoteTally; score: number; next?: Serving; last?: Serving };

/**
 * Dishes on a hall's menu this week, ranked by net votes. `best` lists dishes
 * students like most; otherwise the ones they like least.
 */
export function leaderboard(
  menu: MenuData,
  servings: Map<string, Serving[]>,
  hall: Hall,
  tallies: Record<string, VoteTally>,
  filters: Filters,
  { best = true, today, minutes, limit = 5 }: { best?: boolean; today: string; minutes: number; limit?: number },
): RankedDish[] {
  const seen = new Set<string>();
  const rows: RankedDish[] = [];
  for (const day of hall.days) {
    for (const meal of day.meals) {
      for (const zone of meal.zones) {
        for (const i of zone.dishes) {
          const dish = menu.dishes[i];
          if (seen.has(dish.key)) continue;
          seen.add(dish.key);
          const tally = tallies[dish.key];
          const s = score(tally);
          if (!tally || (best ? s <= 0 : s >= 0) || !matchesFilters(dish, filters)) continue;
          const atHall = (servings.get(dish.key) ?? []).filter((x) => x.hall === hall.id);
          rows.push({
            dish,
            tally,
            score: s,
            next: atHall.find((x) => isUpcoming(x, today, minutes)),
            last: atHall.at(-1),
          });
        }
      }
    }
  }
  return rows
    .sort((a, b) => (best ? b.score - a.score : a.score - b.score) || b.tally.up + b.tally.down - (a.tally.up + a.tally.down))
    .slice(0, limit);
}

const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export type SearchHit = { dish: Dish; servings: Serving[] };

/** Dishes on any menu this week whose name contains every word of the query. */
export function searchDishes(
  menu: MenuData,
  servings: Map<string, Serving[]>,
  query: string,
  filters: Filters,
  { today, minutes, limit = 40 }: { today: string; minutes: number; limit?: number },
): SearchHit[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>();
  const hits: (SearchHit & { rank: number })[] = [];
  for (const dish of menu.dishes) {
    if (seen.has(dish.key)) continue;
    const name = normalize(dish.name);
    if (!words.every((w) => name.includes(w)) || !matchesFilters(dish, filters)) continue;
    seen.add(dish.key);
    const list = servings.get(dish.key) ?? [];
    const upcoming = list.some((s) => isUpcoming(s, today, minutes));
    // Names that start with the query first, then dishes still coming up this week.
    hits.push({ dish, servings: list, rank: (name.startsWith(words[0]) ? 0 : 2) + (upcoming ? 0 : 1) });
  }
  return hits.sort((a, b) => a.rank - b.rank || a.dish.name.localeCompare(b.dish.name)).slice(0, limit);
}

export type HallStatus = { open: boolean; label: string };

/** Whether a dining commons is serving right now, from its posted zone hours. */
export function hallStatus(hall: Hall, today: string, minutes: number): HallStatus {
  if (hall.error) return { open: false, label: "Menu unavailable" };
  const day = hall.days.find((d) => d.date === today);
  if (!isOpen(day)) return { open: false, label: "Closed today" };

  const ranges = day!.meals
    .filter((meal) => dishCount(meal) > 0)
    .flatMap((meal) => meal.zones.filter((zone) => zone.dishes.length).flatMap((zone) => parseHours(zone.hours)))
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of ranges) {
    const last = merged.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  if (!merged.length) return { open: true, label: "Open today" };

  const current = merged.find(([s, e]) => minutes >= s && minutes < e);
  if (current) return { open: true, label: `Open until ${formatTime(current[1])}` };
  const next = merged.find(([s]) => s > minutes);
  if (next) return { open: false, label: `Opens at ${formatTime(next[0])}` };
  return { open: false, label: "Closed for the day" };
}
