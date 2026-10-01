import { davisDate, davisMinutes, parseHours } from "./time";
import type { Day, Hall, Meal, MenuData } from "./types";

export type Selection = { hall: string; date: string; meal: string };

export const dishCount = (meal: Meal | undefined) =>
  meal ? meal.zones.reduce((n, zone) => n + zone.dishes.length, 0) : 0;

export const isOpen = (day: Day | undefined) => !!day?.meals.some((meal) => dishCount(meal) > 0);

/** Earliest start and latest end across every zone's posted hours for a meal. */
export function mealWindow(meal: Meal): [number, number] | null {
  let start = Infinity;
  let end = -Infinity;
  for (const zone of meal.zones) {
    for (const [s, e] of parseHours(zone.hours)) {
      start = Math.min(start, s);
      end = Math.max(end, e);
    }
  }
  return Number.isFinite(start) ? [start, end] : null;
}

// Used when a hall doesn't post hours for a meal.
const TYPICAL_END: Record<string, number> = { breakfast: 11 * 60, brunch: 14 * 60, lunch: 17 * 60, dinner: 22 * 60 };

const mealEnd = (meal: Meal) => mealWindow(meal)?.[1] ?? TYPICAL_END[meal.name.toLowerCase()] ?? 24 * 60;

/** The meal being served at `minutes`, else the next one today, else the day's last meal. */
export function mealAt(day: Day, minutes: number): Meal | undefined {
  const served = day.meals.filter((meal) => dishCount(meal) > 0);
  return served.find((meal) => minutes < mealEnd(meal)) ?? served.at(-1);
}

export function isServingNow(meal: Meal, minutes: number): boolean {
  return (
    mealWindow(meal) !== null &&
    meal.zones.some((zone) => parseHours(zone.hours).some(([s, e]) => minutes >= s && minutes < e))
  );
}

export function findHall(menu: MenuData, id: string | null | undefined): Hall | undefined {
  return menu.halls.find((hall) => hall.id === id);
}

/** Today if the menu covers it, else the closest date it does cover. */
function closestDate(hall: Hall, today: string): string | undefined {
  const dates = hall.days.map((day) => day.date);
  if (dates.includes(today)) return today;
  return dates.find((date) => date > today) ?? dates.at(-1);
}

/**
 * What to show when the app opens: the visitor's usual hall (or the first one
 * open today), today's date, and the meal being served right now.
 */
export function pickDefaults(menu: MenuData, now: Date, preferredHall?: string | null): Selection {
  const today = davisDate(now);
  const loaded = menu.halls.filter((hall) => hall.days.length);
  const hall =
    findHall(menu, preferredHall) ??
    loaded.find((h) => isOpen(h.days.find((d) => d.date === today))) ??
    loaded[0] ??
    menu.halls[0];
  const date = (hall && closestDate(hall, today)) ?? today;
  const day = hall?.days.find((d) => d.date === date);
  const meal =
    (day && (date === today ? mealAt(day, davisMinutes(now)) : day.meals.find((m) => dishCount(m) > 0)))?.name ??
    "Lunch";
  return { hall: hall?.id ?? "", date, meal };
}

/** Keeps the date and meal when switching halls or days, falling back sensibly. */
export function reconcile(menu: MenuData, next: Selection, now: Date): Selection {
  const hall = findHall(menu, next.hall);
  if (!hall?.days.length) return next;
  const date = hall.days.some((d) => d.date === next.date)
    ? next.date
    : (closestDate(hall, davisDate(now)) ?? next.date);
  const day = hall.days.find((d) => d.date === date);
  if (!day) return { ...next, date };
  const keep = day.meals.find((m) => m.name === next.meal && dishCount(m) > 0);
  const meal =
    keep?.name ??
    (date === davisDate(now) ? mealAt(day, davisMinutes(now))?.name : day.meals.find((m) => dishCount(m) > 0)?.name) ??
    next.meal;
  return { ...next, date, meal };
}


export const score = (t: { up: number; down: number } | undefined) => (t ? t.up - t.down : 0);
