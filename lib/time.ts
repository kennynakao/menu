/** UC Davis is in Pacific time; every "today" and "now" in the app means Davis time. */
export const DAVIS_TZ = "America/Los_Angeles";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: DAVIS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clockFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: DAVIS_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Today's date in Davis as yyyy-mm-dd. */
export function davisDate(now: Date = new Date()): string {
  return dateFmt.format(now);
}

/** Minutes since midnight in Davis. */
export function davisMinutes(now: Date = new Date()): number {
  const [h, m] = clockFmt.format(now).split(":").map(Number);
  return h * 60 + m;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

export function formatDay(isoDate: string, style: "short" | "long" = "short") {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" }),
    day: d.getUTCDate(),
    month: d.toLocaleDateString("en-US", { month: style, timeZone: "UTC" }),
  };
}

type Clock = { h: number; m: number; meridiem?: "am" | "pm" };

function parseClock(token: string): Clock | null {
  const t = token.trim().toLowerCase();
  if (t === "noon") return { h: 12, m: 0, meridiem: "pm" };
  if (t === "midnight") return { h: 12, m: 0, meridiem: "am" };
  const match = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!match) return null;
  const meridiem = match[3]?.startsWith("p") ? "pm" : match[3] ? "am" : undefined;
  return { h: Number(match[1]), m: Number(match[2] ?? 0), meridiem };
}

function toMinutes(c: Clock, meridiem: "am" | "pm"): number {
  return (c.h % 12) * 60 + c.m + (meridiem === "pm" ? 720 : 0);
}

/**
 * Parses posted hours like "7–11 AM", "11:30 AM–2 PM, 4–5 PM" or "Closed"
 * into [start, end) minute ranges.
 */
export function parseHours(text: string | undefined): [number, number][] {
  if (!text) return [];
  const ranges: [number, number][] = [];
  for (const part of text.split(/[,;]/)) {
    const [a, b] = part.split(/\s*[–—-]\s*|\s+to\s+/i);
    if (!a || !b) continue;
    const start = parseClock(a);
    const end = parseClock(b);
    if (!start || !end) continue;
    const endMeridiem = end.meridiem ?? "pm";
    const endMin = toMinutes(end, endMeridiem);
    let startMin = toMinutes(start, start.meridiem ?? endMeridiem);
    // "11–1 PM" means 11 AM to 1 PM
    if (!start.meridiem && startMin > endMin) startMin = toMinutes(start, "am");
    if (endMin > startMin) ranges.push([startMin, endMin]);
  }
  return ranges;
}

function formatClock(minutes: number, withMeridiem: boolean): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const clock = m ? `${h}:${String(m).padStart(2, "0")}` : `${h}`;
  return withMeridiem ? `${clock} ${h24 < 12 ? "AM" : "PM"}` : clock;
}

/** 1020 → "5 PM", 630 → "10:30 AM" */
export const formatTime = (minutes: number) => formatClock(minutes, true);

/** 420, 660 → "7–11 AM"; 660, 1020 → "11 AM–5 PM" */
export function formatRange(start: number, end: number): string {
  const sameHalf = start < 720 === end < 720;
  return `${formatClock(start, !sameHalf)}–${formatClock(end, true)}`;
}
