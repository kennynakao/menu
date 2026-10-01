import type { DietTag, Dish } from "./types";

export type Filters = {
  diets: DietTag[];
  /** Only dishes with at least HIGH_PROTEIN grams of protein. */
  protein: boolean;
  /** Allergen group ids to leave out. */
  avoid: string[];
};

export const NO_FILTERS: Filters = { diets: [], protein: false, avoid: [] };

export const HIGH_PROTEIN = 20;

export const DIETS: { id: DietTag; label: string }[] = [
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "halal", label: "Halal" },
];

/** "Avoid" options, mapped to the labels UC Davis uses in each dish's "Contains" list. */
export const ALLERGENS: { id: string; label: string; matches: string[] }[] = [
  { id: "dairy", label: "Dairy", matches: ["Dairy"] },
  { id: "egg", label: "Egg", matches: ["Egg"] },
  { id: "gluten", label: "Gluten", matches: ["Wheat/Gluten"] },
  { id: "soy", label: "Soy", matches: ["Soy", "Soy Lecithin", "Soybean Oil"] },
  { id: "sesame", label: "Sesame", matches: ["Sesame"] },
  { id: "fish", label: "Fish", matches: ["Fish"] },
  { id: "shellfish", label: "Shellfish", matches: ["Shellfish"] },
  { id: "tree-nuts", label: "Tree nuts", matches: ["Tree Nuts"] },
  { id: "peanuts", label: "Peanuts", matches: ["Peanuts", "Peanut Oil"] },
  { id: "alcohol", label: "Alcohol", matches: ["Alcohol"] },
  { id: "shared-fryer", label: "Shared fryer", matches: ["Shared fryer"] },
];

export function matchesFilters(dish: Dish, filters: Filters): boolean {
  if (!filters.diets.every((tag) => dish.tags.includes(tag))) return false;
  if (filters.protein && (dish.protein ?? 0) < HIGH_PROTEIN) return false;
  return !filters.avoid.some((id) => {
    const group = ALLERGENS.find((a) => a.id === id);
    return group?.matches.some((label) => dish.allergens.includes(label));
  });
}

export const filterCount = (filters: Filters) =>
  filters.diets.length + (filters.protein ? 1 : 0) + filters.avoid.length;

/** Restores saved filters, dropping anything that no longer exists. */
export function parseFilters(value: unknown): Filters {
  const v = (value ?? {}) as Partial<Filters>;
  return {
    diets: Array.isArray(v.diets) ? v.diets.filter((d) => DIETS.some((x) => x.id === d)) : [],
    protein: v.protein === true,
    avoid: Array.isArray(v.avoid) ? v.avoid.filter((id) => ALLERGENS.some((a) => a.id === id)) : [],
  };
}
