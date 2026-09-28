"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoteTally, VoteValue } from "./types";

const EMPTY: VoteTally = { up: 0, down: 0, mine: 0 };

function applyVote(tally: VoteTally = EMPTY, value: VoteValue): VoteTally {
  let { up, down } = tally;
  if (tally.mine === 1) up--;
  if (tally.mine === -1) down--;
  if (value === 1) up++;
  if (value === -1) down++;
  return { up: Math.max(0, up), down: Math.max(0, down), mine: value };
}

/**
 * Vote totals for every dish on the menu, plus this visitor's own votes.
 * Votes apply instantly and sync in the background; totals refresh whenever
 * the app comes back to the foreground.
 */
export function useVotes(keys: string[]) {
  const [tallies, setTallies] = useState<Record<string, VoteTally>>({});
  const [persistent, setPersistent] = useState(true);
  const inFlight = useRef(new Map<string, number>());
  const queues = useRef(new Map<string, Promise<unknown>>());

  const refresh = useCallback(async () => {
    if (!keys.length) return;
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) return;
      const data: { tallies: Record<string, VoteTally>; persistent: boolean } = await res.json();
      setTallies((prev) => {
        const next = { ...data.tallies };
        // Don't let a refresh overwrite a vote that's still being saved.
        for (const key of inFlight.current.keys()) if (prev[key]) next[key] = prev[key];
        return next;
      });
      setPersistent(data.persistent);
    } catch {
      // Offline: keep showing what we have.
    }
  }, [keys]);

  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const vote = useCallback((key: string, value: VoteValue) => {
    let before: VoteTally = EMPTY;
    setTallies((prev) => {
      before = prev[key] ?? EMPTY;
      return { ...prev, [key]: applyVote(prev[key], value) };
    });

    const ticket = (inFlight.current.get(key) ?? 0) + 1;
    inFlight.current.set(key, ticket);
    const isLatest = () => inFlight.current.get(key) === ticket;

    // Send votes for the same dish in order so the last tap always wins.
    const send = (queues.current.get(key) ?? Promise.resolve()).then(async () => {
      try {
        const res = await fetch("/api/votes", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const tally: VoteTally = await res.json();
        if (isLatest()) setTallies((prev) => ({ ...prev, [key]: tally }));
      } catch {
        if (isLatest()) setTallies((prev) => ({ ...prev, [key]: before }));
      } finally {
        if (isLatest()) inFlight.current.delete(key);
      }
    });
    queues.current.set(key, send);
  }, []);

  return { tallies, vote, persistent };
}
