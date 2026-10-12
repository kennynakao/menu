import assert from "node:assert/strict";
import test from "node:test";
import { getHalalStatus } from "../lib/dietary";
import { matchesFilters, NO_FILTERS } from "../lib/filters";
import { parseHallPage } from "../lib/scraper";
import type { Dish } from "../lib/types";

const SOURCE = { id: "segundo", name: "Segundo", url: "https://housing.ucdavis.edu/dining/dining-commons/segundo/" };
const HALAL_ONLY = { ...NO_FILTERS, diets: ["halal" as const] };

// The same dish-level classes, icon location, and labeled fields used by the
// official UC Davis menu; unrelated navigation and nutritional details omitted.
function panel(name: string, classes = "", details = "") {
  return `<div class="panel panel-default ${classes}">
    <div class="panel-heading"><h4 class="panel-title"><a>${name}</a></h4></div>
    <div class="panel-collapse"><div class="panel-body"><div class="mealDetails">${details}</div></div></div>
  </div>`;
}

function parseDishes(panels: string, ingredients = true) {
  const dishes: Dish[] = [];
  parseHallPage(
    `<!--Date Check: 2026-10-11-->
    <img alt="Halal"><div class="tab-pane" id="monday">
      <h2 class="stickyMealHeader">Lunch</h2>
      <div class="row"><div><h3>Red Zone</h3>${panels}</div></div>
    </div>`,
    SOURCE,
    (dish) => dishes.push(dish) - 1,
    { ingredients },
  );
  return dishes;
}

test("halal filter follows either official dish class or diet icon", () => {
  const dishes = parseDishes(
    panel("Class-labeled dish", "isHalal") +
      panel("Icon-labeled dish", "", '<img alt="  HALAL  ">'),
  );
  assert.equal(dishes.length, 2);
  for (const dish of dishes) {
    assert.equal(getHalalStatus(dish), "labeled");
    assert.equal(matchesFilters(dish, HALAL_ONLY), true);
  }
});

test("halal chicken in a mixed dish does not establish a halal dish", () => {
  const [dish] = parseDishes(
    panel(
      "Chicken Bacon Ranch Sandwich",
      "filterNonHalal",
      "<p><strong>Ingredients</strong>: Fresh raw boneless skinless halal chicken thigh, pork bacon.</p>",
    ),
  );
  assert.equal(getHalalStatus(dish), "unlabeled");
  assert.equal(matchesFilters(dish, HALAL_ONLY), false);
});

test("vegan and vegetarian labels do not imply halal", () => {
  const dishes = parseDishes(
    panel("Vegetable dish", "isVegan isVegetarian filterNonHalal") +
      panel("Overnight Oats", "isVegetarian filterNonHalal"),
  );
  assert.ok(dishes.every((dish) => dish.tags.includes("vegetarian")));
  assert.ok(dishes.every((dish) => getHalalStatus(dish) === "unlabeled"));
  assert.ok(dishes.every((dish) => !matchesFilters(dish, HALAL_ONLY)));
});

test("unlabeled stays unknown even if the name mentions halal or another dish has a label", () => {
  const dishes = parseDishes(
    panel("Oatmeal", "isVegan isHalal", '<img alt="Halal">') +
      panel("Halal-style bowl", "", '<img alt="Not halal">') +
      panel("Unknown dish") +
      `<!--${panel("Commented-out dish", "isHalal")}-->`,
  );
  assert.deepEqual(dishes.map(getHalalStatus), ["labeled", "unlabeled", "unlabeled"]);
});

test("halal designation and vinegar warning survive the compact menu payload", () => {
  const [dish] = parseDishes(
    panel(
      "Sesame Bagel",
      "isVegan isVegetarian isHalal filterVinegar filterWheatGluten",
      '<img alt="Vegan"><img alt="Halal"><p><strong>Contains</strong>: Vinegar, Wheat/Gluten.</p>' +
        "<p><strong>Ingredients</strong>: Flour, vinegar.</p>",
    ),
    false,
  );
  assert.equal(getHalalStatus(dish), "labeled");
  assert.deepEqual(dish.allergens, ["Vinegar", "Wheat/Gluten"]);
  assert.equal(dish.ingredients, undefined);
});
