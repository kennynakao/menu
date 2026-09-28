import { load, type CheerioAPI } from "cheerio";
import { dishKey } from "./dish-key";
import { HALLS, type HallSource } from "./halls";
import { addDays, davisDate, weekday } from "./time";
import type { DietTag, Dish, Hall, Meal, MenuData, Zone } from "./types";

/*
 * Scrapes the weekly menus published on housing.ucdavis.edu.
 *
 * Each dining commons page embeds the whole week (Sunday–Saturday) as tab panes:
 *
 *   div.tab-pane#monday
 *     h2.stickyMealHeader "Breakfast" + div.row
 *       div.col-… > h3 "Red Zone" > .panel (one per dish)
 *         .panel-title a            → name
 *         .mealDetails p            → description, "Contains", nutrition, ingredients
 *         .panel[class~=isVegan]…   → diet tags
 */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const USER_AGENT = "Mozilla/5.0 (compatible; DCMenuBot/1.0)";

export type FetchOptions = RequestInit & { timeoutMs?: number };

export async function fetchHtml(url: string, options: FetchOptions = {}) {
  const { timeoutMs = 20_000, ...init } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`${url} responded ${res.status}`);
      return await res.text();
    } catch (error) {
      if (isCertificateError(error)) return fetchWithBundledRoots(url, timeoutMs);
      lastError = error;
    }
  }
  throw lastError;
}

function isCertificateError(error: unknown): boolean {
  const code = (error as { cause?: { code?: string } })?.cause?.code ?? "";
  return /CERT|ISSUER|SELF_SIGNED/.test(code);
}

/**
 * housing.ucdavis.edu serves a chain that only verifies against Node's bundled
 * Mozilla roots. Machines that set NODE_USE_SYSTEM_CA=1 (e.g. some macOS
 * setups) reject it, so retry with the bundled roots explicitly.
 */
async function fetchWithBundledRoots(url: string, timeoutMs: number): Promise<string> {
  const [{ get }, { rootCertificates }] = await Promise.all([import("node:https"), import("node:tls")]);
  return new Promise((resolve, reject) => {
    const req = get(
      url,
      { ca: [...rootCertificates], headers: { "user-agent": USER_AGENT, accept: "text/html" }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`${url} responded ${res.statusCode}`));
          return;
        }
        res.setEncoding("utf8");
        let body = "";
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve(body));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`${url} timed out`)));
    req.on("error", reject);
  });
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

function toNumber(value: string | undefined, digits = 0): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(n)) return undefined;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** The page's week always starts on a Sunday; it's stamped as `<!--Date Check: 2026-09-27-->`. */
function findWeekStart(html: string, now: Date): string {
  const stamped = html.match(/Date Check:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  const anchor = stamped ?? davisDate(now);
  return addDays(anchor, -weekday(anchor));
}

type HoursTable = Map<string, string>; // "1|lunch|red" → "11 AM–5 PM"

/** Reads the "Zone Hours" grid (Monday–Friday / Saturday–Sunday × meal × zone color). */
function parseZoneHours($: CheerioAPI): HoursTable {
  const table: HoursTable = new Map();
  const block = $(".zone-hours, .platform-hours").first();
  block.find("h3").each((_, h3) => {
    const days = daysInHeading($(h3).text());
    if (!days.length) return;
    $(h3)
      .nextAll(".row")
      .first()
      .find("h4")
      .each((_, h4) => {
        const meal = clean($(h4).text()).toLowerCase();
        $(h4)
          .nextAll("ul")
          .first()
          .find("li")
          .each((_, li) => {
            const color = clean($(li).find("strong").first().text()).toLowerCase();
            const hours = clean(
              $(li)
                .text()
                .replace(/^[^:]*:/, ""),
            );
            if (!color || !hours) return;
            for (const d of days) table.set(`${d}|${meal}|${color}`, hours);
          });
      });
  });
  return table;
}

/** "Monday–Friday" → [1..5], "Saturday–Sunday" → [6, 0], "Friday" → [5] */
function daysInHeading(heading: string): number[] {
  const names = heading.toLowerCase().match(/sunday|monday|tuesday|wednesday|thursday|friday|saturday/g);
  if (!names?.length) return [];
  const idx = names.map((n) => WEEKDAYS.indexOf(n as (typeof WEEKDAYS)[number]));
  if (idx.length === 1) return idx;
  const out: number[] = [];
  for (let d = idx[0]; ; d = (d + 1) % 7) {
    out.push(d);
    if (d === idx[idx.length - 1] || out.length > 7) break;
  }
  return out;
}

type DishCollector = (dish: Dish) => number;

function parseDish($: CheerioAPI, panel: Parameters<CheerioAPI>[0], withIngredients: boolean): Dish | null {
  const $panel = $(panel);
  const name = clean($panel.find(".panel-title").first().text()).replace(/\s*\|\|\s*/g, " / ");
  if (!name) return null;

  const classes = new Set(($panel.attr("class") ?? "").split(/\s+/));
  const icons = new Set(
    $panel
      .find(".mealDetails img[alt]")
      .map((_, img) => ($(img).attr("alt") ?? "").toLowerCase())
      .get(),
  );
  const tags: DietTag[] = [];
  if (classes.has("isVegan") || icons.has("vegan")) tags.push("vegan");
  if (classes.has("isVegetarian") || icons.has("vegetarian") || tags.includes("vegan")) tags.push("vegetarian");
  if (classes.has("isHalal") || icons.has("halal")) tags.push("halal");

  let description: string | undefined;
  const fields = new Map<string, string>();
  $panel.find(".mealDetails p").each((_, p) => {
    const $p = $(p);
    const label = clean($p.find("strong").first().text());
    const text = clean($p.text());
    if (label) {
      fields.set(label.toLowerCase(), clean(text.slice(text.indexOf(label) + label.length).replace(/^\s*:/, "")));
    } else if (!description && text) {
      description = text.replace(/\*?\s*Consuming raw or undercooked[\s\S]*$/i, "").trim() || undefined;
    }
  });

  // "Wheat/Gluten, Vinegar. Ingredients are prepared in a shared fryer" / "No major allergens"
  const contains = fields.get("contains") ?? "";
  const allergens = contains
    .split(/\.(?:\s+|$)/)
    .filter((sentence) => !/shared fryer|no major allergens/i.test(sentence))
    .flatMap((sentence) => sentence.split(","))
    .map((a) => a.trim())
    .filter(Boolean);
  if (classes.has("filterSharedFryer") || /shared fryer/i.test(contains)) allergens.push("Shared fryer");

  return {
    key: dishKey(name),
    name,
    description,
    tags,
    allergens,
    serving: fields.get("serving size") || undefined,
    calories: toNumber(fields.get("calories")),
    protein: toNumber(fields.get("protein (g)"), 1),
    carbs: toNumber(fields.get("carbohydrates (g)"), 1),
    fat: toNumber(fields.get("fat (g)"), 1),
    sugar: toNumber(fields.get("sugar"), 1),
    ingredients: withIngredients ? fields.get("ingredients") || undefined : undefined,
  };
}

/** Parses one dining commons page into a week of meals. */
export function parseHallPage(
  html: string,
  source: HallSource,
  collect: DishCollector,
  { now = new Date(), ingredients = true }: ScrapeOptions = {},
): Hall {
  const $ = load(html);
  const weekStart = findWeekStart(html, now);
  const hours = parseZoneHours($);

  const days = WEEKDAYS.map((dayId, dayIndex) => {
    const date = addDays(weekStart, dayIndex);
    const meals: Meal[] = [];
    $(`div.tab-pane#${dayId}`)
      .first()
      .find("h2.stickyMealHeader")
      .each((_, h2) => {
        const name = clean($(h2).text());
        const zones: Zone[] = [];
        $(h2)
          .nextAll(".row")
          .first()
          .children("div")
          .each((_, col) => {
            const color = clean(
              $(col)
                .find("h3")
                .first()
                .text()
                .replace(/\bzone\b/i, ""),
            );
            if (!color) return;
            const dishes: number[] = [];
            $(col)
              .find(".panel")
              .each((_, panel) => {
                const dish = parseDish($, panel, ingredients);
                if (dish) dishes.push(collect(dish));
              });
            zones.push({
              color,
              hours: hours.get(`${dayIndex}|${name.toLowerCase()}|${color.toLowerCase()}`),
              dishes,
            });
          });
        meals.push({ name, zones });
      });
    return { date, meals };
  });

  return { id: source.id, name: source.name, url: source.url, days };
}

export type ScrapeOptions = {
  now?: Date;
  /** Ingredient lists are ~80% of the payload; skip them when rendering pages. */
  ingredients?: boolean;
  fetch?: FetchOptions;
};

/**
 * Scrapes every dining commons. A hall that fails to load is returned with an
 * `error` instead of failing the whole menu.
 */
export async function scrapeMenus(options: ScrapeOptions = {}): Promise<MenuData> {
  const now = options.now ?? new Date();
  const dishes: Dish[] = [];
  const seen = new Map<string, number>();
  const collect: DishCollector = (dish) => {
    const signature = JSON.stringify(dish);
    let index = seen.get(signature);
    if (index === undefined) {
      index = dishes.push(dish) - 1;
      seen.set(signature, index);
    }
    return index;
  };

  const pages = await Promise.allSettled(HALLS.map((hall) => fetchHtml(hall.url, options.fetch)));

  const halls = HALLS.map((source, i): Hall => {
    const page = pages[i];
    if (page.status === "rejected") {
      return { ...source, days: [], error: String(page.reason?.message ?? page.reason) };
    }
    try {
      return parseHallPage(page.value, source, collect, { ...options, now });
    } catch (error) {
      return { ...source, days: [], error: error instanceof Error ? error.message : String(error) };
    }
  });

  return { updatedAt: now.toISOString(), halls, dishes };
}
