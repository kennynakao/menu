import type { Dish } from "./types";

export const HALAL_GUIDANCE_URL =
  "https://housing.ucdavis.edu/dining/nutrition/halal-and-kosher-dining-options/";

/** Absence of UC Davis's halal label is an unknown, not a non-halal determination. */
export function getHalalStatus(dish: Pick<Dish, "tags">): "labeled" | "unlabeled" {
  return dish.tags.includes("halal") ? "labeled" : "unlabeled";
}
