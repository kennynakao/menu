import "server-only";
import { scrapeMenus, type ScrapeOptions } from "./scraper";
import type { MenuData } from "./types";

/**
 * How often the live menu is re-scraped, in seconds. Pages and routes that use
 * the menu export this same number as `revalidate` (it must be a literal there).
 */
export const MENU_TTL = 900;

/**
 * Scrapes the live UC Davis menus. Called while a page regenerates in the
 * background, so visitors always get an instant cached page that is at most
 * ~15 minutes old.
 */
export async function getMenus(options: Omit<ScrapeOptions, "fetch"> = {}): Promise<MenuData> {
  const menu = await scrapeMenus({
    ingredients: false,
    ...options,
    fetch: { next: { revalidate: MENU_TTL } },
  });

  // If UC Davis is down entirely, throw once deployed so Next keeps serving the
  // last good page. A single failing hall just shows an error card for it.
  const failed = menu.halls.filter((hall) => hall.error);
  const isRuntime = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
  if (isRuntime && failed.length === menu.halls.length) {
    throw new Error(`Menu scrape failed: ${failed.map((h) => `${h.name} (${h.error})`).join(", ")}`);
  }
  return menu;
}
