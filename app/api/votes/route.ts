import { NextResponse, type NextRequest } from "next/server";
import { DISH_KEY_PATTERN } from "@/lib/dish-key";
import type { VoteValue } from "@/lib/types";
import { allowVote, castVote, getTallies, votesArePersistent } from "@/lib/votes";

const VOTER_COOKIE = "vid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_KEYS = 3000;

const isDishKey = (key: unknown): key is string =>
  typeof key === "string" && key.length <= 120 && DISH_KEY_PATTERN.test(key);

function voterFrom(request: NextRequest): string | null {
  const id = request.cookies.get(VOTER_COOKIE)?.value;
  return id && UUID.test(id) ? id : null;
}

function rememberVoter(response: NextResponse, voter: string) {
  response.cookies.set(VOTER_COOKIE, voter, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400, // browsers cap cookie lifetime at 400 days; refreshed on every vote
  });
}

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

/** POST { keys: string[] } → vote totals for those dishes plus this visitor's own votes. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  const keys = Array.isArray(body?.keys) ? [...new Set(body.keys.filter(isDishKey))].slice(0, MAX_KEYS) : null;
  if (!keys) return NextResponse.json({ error: "Expected { keys: string[] }" }, { status: 400 });

  const tallies = await getTallies(keys, voterFrom(request));
  return NextResponse.json({ tallies, persistent: votesArePersistent }, { headers: { "cache-control": "no-store" } });
}

/** PUT { key, value: 1 | 0 | -1 } → casts, changes or clears this visitor's vote. */
export async function PUT(request: NextRequest) {
  const body = await readJson(request);
  const key = body?.key;
  const value = body?.value;
  if (!isDishKey(key) || (value !== 1 && value !== 0 && value !== -1)) {
    return NextResponse.json({ error: "Expected { key, value: 1 | 0 | -1 }" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await allowVote(ip))) {
    return NextResponse.json({ error: "Slow down a little" }, { status: 429 });
  }

  const voter = voterFrom(request) ?? crypto.randomUUID();
  const tally = await castVote(key, voter, value as VoteValue);
  const response = NextResponse.json(tally, { headers: { "cache-control": "no-store" } });
  rememberVoter(response, voter);
  return response;
}
