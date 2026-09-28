/**
 * Stable identity for a dish, derived from its name only. "Mac & Cheese" and
 * "Mac and Cheese" share a key, so votes carry over whenever a dish returns —
 * on another day or at another dining commons.
 */
export function dishKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export const DISH_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
