import "server-only";
import { Redis } from "@upstash/redis";
import type { VoteTally, VoteValue } from "./types";

/*
 * Votes are keyed by dish name (see dishKey), never by date, so a dish keeps
 * its score every time it comes back.
 *
 *   {menu}:up          hash  dishKey → upvote count
 *   {menu}:down        hash  dishKey → downvote count
 *   {menu}:voter:<id>  hash  dishKey → 1 | -1   (one vote per person per dish)
 *
 * The {menu} hash tag keeps every key in one cluster slot so the vote script
 * can touch them atomically.
 */

const UP = "{menu}:up";
const DOWN = "{menu}:down";
const voterKey = (voter: string) => `{menu}:voter:${voter}`;

function redisFromEnv(): Redis | null {
  const env = process.env;
  // Vercel's Upstash integration sets KV_REST_API_*, optionally with a custom
  // prefix (e.g. MENU_KV_REST_API_URL); Upstash's own docs use UPSTASH_REDIS_REST_*.
  const urlKey =
    ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"].find((k) => env[k]) ??
    Object.keys(env).find((k) => /(KV_REST_API|UPSTASH_REDIS_REST)_URL$/.test(k) && env[k]);
  const url = urlKey && env[urlKey];
  const token = urlKey && env[urlKey.replace(/URL$/, "TOKEN")];
  return url && token ? new Redis({ url, token }) : null;
}

const redis = redisFromEnv();

/** False when no database is configured and votes only live in server memory. */
export const votesArePersistent = redis !== null;

// Swap the voter's previous vote for the new one and return the dish's totals.
const VOTE_SCRIPT = `
local prev = tonumber(redis.call('HGET', KEYS[1], ARGV[1]) or '0')
local nextv = tonumber(ARGV[2])
if prev ~= nextv then
  if prev == 1 then redis.call('HINCRBY', KEYS[2], ARGV[1], -1) end
  if prev == -1 then redis.call('HINCRBY', KEYS[3], ARGV[1], -1) end
  if nextv == 1 then redis.call('HINCRBY', KEYS[2], ARGV[1], 1) end
  if nextv == -1 then redis.call('HINCRBY', KEYS[3], ARGV[1], 1) end
  if nextv == 0 then redis.call('HDEL', KEYS[1], ARGV[1]) else redis.call('HSET', KEYS[1], ARGV[1], nextv) end
end
return { tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0'), tonumber(redis.call('HGET', KEYS[3], ARGV[1]) or '0') }
`;

type MemoryStore = {
  up: Map<string, number>;
  down: Map<string, number>;
  voters: Map<string, Map<string, VoteValue>>;
};

// Local-dev fallback. Survives hot reloads, not restarts or serverless cold starts.
const memory: MemoryStore = ((globalThis as { __menuVotes?: MemoryStore }).__menuVotes ??= {
  up: new Map(),
  down: new Map(),
  voters: new Map(),
});

if (!redis && process.env.NODE_ENV === "production") {
  console.warn(
    "[votes] No Upstash Redis configured (KV_REST_API_URL / UPSTASH_REDIS_REST_URL). Votes will not persist.",
  );
}

const asCount = (v: unknown) => Math.max(0, Number(v ?? 0) || 0);
const asVote = (v: unknown): VoteValue => (Number(v) === 1 ? 1 : Number(v) === -1 ? -1 : 0);

export async function getTallies(keys: string[], voter: string | null): Promise<Record<string, VoteTally>> {
  const result: Record<string, VoteTally> = {};
  if (!keys.length) return result;

  if (!redis) {
    const mine = voter ? memory.voters.get(voter) : undefined;
    for (const key of keys) {
      const tally = { up: memory.up.get(key) ?? 0, down: memory.down.get(key) ?? 0, mine: mine?.get(key) ?? 0 };
      if (tally.up || tally.down || tally.mine) result[key] = tally;
    }
    return result;
  }

  const pipe = redis.pipeline();
  pipe.hmget<Record<string, unknown>>(UP, ...keys);
  pipe.hmget<Record<string, unknown>>(DOWN, ...keys);
  if (voter) pipe.hmget<Record<string, unknown>>(voterKey(voter), ...keys);
  const [ups, downs, mine] = (await pipe.exec()) as (Record<string, unknown> | null)[];

  for (const key of keys) {
    const tally = { up: asCount(ups?.[key]), down: asCount(downs?.[key]), mine: asVote(mine?.[key]) };
    if (tally.up || tally.down || tally.mine) result[key] = tally;
  }
  return result;
}

export async function castVote(key: string, voter: string, value: VoteValue): Promise<VoteTally> {
  if (!redis) {
    const mine = memory.voters.get(voter) ?? new Map<string, VoteValue>();
    memory.voters.set(voter, mine);
    const prev = mine.get(key) ?? 0;
    const bump = (map: Map<string, number>, by: number) => map.set(key, Math.max(0, (map.get(key) ?? 0) + by));
    if (prev === 1) bump(memory.up, -1);
    if (prev === -1) bump(memory.down, -1);
    if (value === 1) bump(memory.up, 1);
    if (value === -1) bump(memory.down, 1);
    if (value === 0) mine.delete(key);
    else mine.set(key, value);
    return { up: memory.up.get(key) ?? 0, down: memory.down.get(key) ?? 0, mine: value };
  }

  const [up, down] = await redis.eval<string[], [number, number]>(
    VOTE_SCRIPT,
    [voterKey(voter), UP, DOWN],
    [key, String(value)],
  );
  return { up: asCount(up), down: asCount(down), mine: value };
}

/**
 * Fixed-window limit per client IP. Campus networks put many students behind
 * a few addresses, so this only stops scripted floods, not normal use.
 */
export async function allowVote(ip: string, limitPerMinute = 90): Promise<boolean> {
  if (!redis) return true;
  const window = `{menu}:rate:${ip}:${Math.floor(Date.now() / 60_000)}`;
  const pipe = redis.pipeline();
  pipe.incr(window);
  pipe.expire(window, 120);
  const [count] = (await pipe.exec()) as [number, number];
  return count <= limitPerMinute;
}
