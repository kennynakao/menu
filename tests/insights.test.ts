import assert from "node:assert/strict";
import test from "node:test";
import { NO_FILTERS } from "../lib/filters";
import { indexServings, leaderboard, searchDishes } from "../lib/insights";
import type { Day, Dish, Hall, MenuData, VoteTally } from "../lib/types";

const HALAL_ONLY = { ...NO_FILTERS, diets: ["halal" as const] };
const CLOCK = { today: "2026-10-12", minutes: 12 * 60 };
const KEY = "chicken-rice";

function day(date: string, dishes: number[]): Day {
  return { date, meals: [{ name: "Lunch", zones: [{ color: "Red", hours: "11 AM–2 PM", dishes }] }] };
}

function hall(id: string, days: Day[]): Hall {
  return { id, name: id, url: `https://example.com/${id}`, days };
}

function fixture(): MenuData {
  const dishes: Dish[] = [
    { key: KEY, name: "Chicken Rice", tags: [], allergens: ["Soy"], protein: 15 },
    { key: KEY, name: "Chicken Rice", tags: ["halal"], allergens: [], protein: 25 },
    { key: "vegetable-rice", name: "Vegetable Rice", tags: ["vegan", "vegetarian"], allergens: [], protein: 5 },
  ];
  return {
    updatedAt: "2026-10-12T18:00:00.000Z",
    dishes,
    halls: [
      hall("segundo", [day("2026-10-12", [0, 2]), day("2026-10-14", [1])]),
      hall("tercero", [day("2026-10-13", [1]), day("2026-10-15", [0])]),
    ],
  };
}

test("servings retain different recipes and stations under one name-based vote key", () => {
  const menu = fixture();
  menu.halls = [hall("segundo", [{
    date: "2026-10-12",
    meals: [{ name: "Lunch", zones: [
      { color: "Red", dishes: [0, 1, 1] },
      { color: "Blue", dishes: [1] },
    ] }],
  }])];
  const servings = indexServings(menu);
  assert.equal(servings.size, 1);
  assert.deepEqual(servings.get(KEY)?.map(({ zone, dishIndex }) => ({ zone, dishIndex })), [
    { zone: "Red", dishIndex: 0 },
    { zone: "Red", dishIndex: 1 },
    { zone: "Blue", dishIndex: 1 },
  ]);
});

test("halal search only points to labeled recipes at their actual hall and date", () => {
  const menu = fixture();
  const [hit] = searchDishes(menu, indexServings(menu), "chicken rice", HALAL_ONLY, CLOCK);
  assert.equal(hit.dish, menu.dishes[1]);
  assert.equal(hit.dish.key, KEY);
  assert.deepEqual(hit.servings.map(({ hall, date, dishIndex }) => ({ hall, date, dishIndex })), [
    { hall: "tercero", date: "2026-10-13", dishIndex: 1 },
    { hall: "segundo", date: "2026-10-14", dishIndex: 1 },
  ]);
  assert.deepEqual(hit.sharedTags, ["halal"]);
});

test("unfiltered search groups votes by name without extending labels to other recipes", () => {
  const menu = fixture();
  const hits = searchDishes(menu, indexServings(menu), "chicken", NO_FILTERS, { today: "2026-10-13", minutes: 0 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].dish.key, KEY);
  assert.equal(hits[0].dish, menu.dishes[1]);
  assert.equal(hits[0].servings.length, 4);
  assert.deepEqual(hits[0].sharedTags, []);
});

test("search preserves only diet labels shared by all matched recipes", () => {
  const menu = fixture();
  menu.dishes[0].tags = ["vegetarian"];
  menu.dishes[1].tags = ["vegetarian", "halal"];
  const [hit] = searchDishes(menu, indexServings(menu), "chicken", NO_FILTERS, CLOCK);
  assert.deepEqual(hit.sharedTags, ["vegetarian"]);
});

test("recipe-level filters also keep nutrition and allergen variants from leaking into search", () => {
  const menu = fixture();
  for (const filters of [{ ...NO_FILTERS, protein: true }, { ...NO_FILTERS, avoid: ["soy"] }]) {
    const [hit] = searchDishes(menu, indexServings(menu), "chicken", filters, CLOCK);
    assert.deepEqual(hit.servings.map(({ dishIndex }) => dishIndex), [1, 1]);
  }
});

test("a later halal recipe is ranked even when the first same-name recipe is unlabeled", () => {
  const menu = fixture();
  const tally: VoteTally = { up: 7, down: 2, mine: 1 };
  const rows = leaderboard(menu, indexServings(menu), menu.halls[0], { [KEY]: tally }, HALAL_ONLY, CLOCK);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].dish, menu.dishes[1]);
  assert.equal(rows[0].dish.key, KEY);
  assert.equal(rows[0].tally, tally);
  assert.equal(rows[0].score, 5);
  assert.equal(rows[0].next?.hall, "segundo");
  assert.equal(rows[0].next?.date, "2026-10-14");
  assert.equal(rows[0].next?.dishIndex, 1);
  assert.equal(rows[0].last?.dishIndex, 1);
});

test("a halal recipe at another hall does not qualify this hall's unlabeled dish", () => {
  const menu = fixture();
  menu.halls[0].days = [day("2026-10-12", [0])];
  const rows = leaderboard(menu, indexServings(menu), menu.halls[0], { [KEY]: { up: 5, down: 0, mine: 0 } }, HALAL_ONLY, CLOCK);
  assert.deepEqual(rows, []);
});

test("ranked dish details follow the next serving or the last completed serving", () => {
  const menu = fixture();
  const servings = indexServings(menu);
  const tallies: Record<string, VoteTally> = { [KEY]: { up: 1, down: 3, mine: -1 } };
  const [upcoming] = leaderboard(menu, servings, menu.halls[1], tallies, NO_FILTERS, { ...CLOCK, best: false });
  assert.equal(upcoming.dish, menu.dishes[1]);
  assert.equal(upcoming.next?.dishIndex, 1);
  const [completed] = leaderboard(menu, servings, menu.halls[1], tallies, NO_FILTERS, {
    today: "2026-10-16", minutes: 0, best: false,
  });
  assert.equal(completed.next, undefined);
  assert.equal(completed.dish, menu.dishes[0]);
  assert.equal(completed.last?.dishIndex, 0);
});

test("a same-name halal recipe in the same station remains discoverable", () => {
  const menu = fixture();
  menu.halls = [hall("segundo", [day("2026-10-12", [0, 1])])];
  const servings = indexServings(menu);
  const [hit] = searchDishes(menu, servings, "chicken", HALAL_ONLY, CLOCK);
  assert.deepEqual(hit.servings.map(({ dishIndex }) => dishIndex), [1]);
  const [row] = leaderboard(menu, servings, menu.halls[0], { [KEY]: { up: 1, down: 0, mine: 0 } }, HALAL_ONLY, CLOCK);
  assert.equal(row.next?.dishIndex, 1);
  assert.equal(row.dish, menu.dishes[1]);
});
