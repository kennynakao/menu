"use client";

import type { ReactNode } from "react";
import { Tabs } from "@/components/controls";
import type { HallStatus, RankedDish, Serving } from "@/lib/insights";
import { whenLabel } from "@/lib/insights";
import { formatDay } from "@/lib/time";
import type { Dish, Hall } from "@/lib/types";

export const formatScore = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export type Clock = { today: string; tomorrow: string };

type Row = { dish: Dish; score: number; next?: Serving; last?: Serving };

function servingLabel(row: { next?: Serving; last?: Serving }, clock: Clock, withHall = false) {
  const s = row.next ?? row.last;
  if (!s) return "";
  const where = withHall ? `${s.hallName}, ` : "";
  return row.next
    ? `${where}${whenLabel(s, clock.today, clock.tomorrow)}`
    : `${where}${where ? "last" : "Last"} served ${formatDay(s.date).weekday}`;
}

/** Ranked rows with serif numerals, set like a newspaper league table. */
function RankList({
  rows,
  detail,
  onOpen,
}: {
  rows: Row[];
  detail: (row: Row) => string;
  onOpen: (key: string, serving?: Serving) => void;
}) {
  return (
    <ol>
      {rows.map((row, i) => (
        <li key={row.dish.key} className="border-t border-rule first:border-t-0">
          <button
            type="button"
            onClick={() => onOpen(row.dish.key, row.next ?? row.last)}
            className="group flex w-full items-baseline gap-f13 py-f8 text-left"
          >
            <span
              className={`w-f13 shrink-0 text-right font-serif text-lead font-semibold tabular-nums ${i === 0 ? "text-gold-deep" : "text-ink-3"}`}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink decoration-gold decoration-2 underline-offset-4 group-hover:underline">
                {row.dish.name}
              </span>
              {detail(row) && <span className="block truncate text-cap text-ink-3">{detail(row)}</span>}
            </span>
            <span
              className={`shrink-0 font-semibold tabular-nums ${row.score < 0 ? "text-down" : "text-heading"}`}
            >
              {formatScore(row.score)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

/** A plain section for the side rail: heading, one line of context, hairline list. */
function RailSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lead font-semibold text-heading">{title}</h2>
      {note && <p className="text-cap text-ink-3">{note}</p>}
      <div className="mt-f8 border-t-2 border-heading/80 pt-f3">{children}</div>
    </section>
  );
}

/** One dining commons' leaderboard, headed like the DC cards on housing.ucdavis.edu. */
export function HallBoard({
  hall,
  rows,
  status,
  best,
  clock,
  onOpen,
}: {
  hall: Hall;
  rows: RankedDish[];
  status?: HallStatus;
  best: boolean;
  clock: Clock;
  onOpen: (key: string, serving?: Serving) => void;
}) {
  return (
    <section className="min-w-0">
      <header className="flex items-baseline justify-between gap-f13 rounded-t-f3 bg-navy-2 px-f13 py-f8">
        <h3 className="shrink-0 font-bold text-[#e5c44d]">{hall.name}</h3>
        {status && <span className="min-w-0 truncate text-cap text-white/70">{status.label}</span>}
      </header>
      <div className="rounded-b-f3 border-x border-b border-rule bg-surface px-f13 pb-f5">
        {rows.length ? (
          <RankList rows={rows} detail={(row) => servingLabel(row, clock)} onOpen={onOpen} />
        ) : (
          <p className="py-f21 text-cap text-ink-3">
            {hall.error
              ? "Menu unavailable right now."
              : best
                ? "No upvotes yet this week. Vote on the menu to start this list."
                : "Nothing downvoted this week."}
          </p>
        )}
      </div>
    </section>
  );
}

/** Highest-rated dishes across every dining commons for the meal being viewed. */
export function CampusNow({
  meal,
  dayLabel,
  picks,
  onOpen,
}: {
  meal: string;
  dayLabel: string;
  picks: { dish: Dish; score: number; servings: Serving[] }[];
  onOpen: (key: string, serving?: Serving) => void;
}) {
  if (!picks.length) return null;
  return (
    <RailSection title="Best on campus" note={`${meal}, ${dayLabel.toLowerCase()} · every dining commons`}>
      <RankList
        rows={picks.map((p) => ({ dish: p.dish, score: p.score, next: p.servings[0] }))}
        detail={(row) => row.next?.hallName ?? ""}
        onOpen={onOpen}
      />
    </RailSection>
  );
}

export function HallRail({
  hall,
  rows,
  clock,
  onOpen,
  onSeeAll,
}: {
  hall: Hall;
  rows: RankedDish[];
  clock: Clock;
  onOpen: (key: string, serving?: Serving) => void;
  onSeeAll: () => void;
}) {
  return (
    <RailSection title={`Top voted at ${hall.name}`} note="This week’s menu, by student votes">
      {rows.length ? (
        <RankList rows={rows} detail={(row) => servingLabel(row, clock)} onOpen={onOpen} />
      ) : (
        <p className="py-f13 text-cap text-ink-3">No upvotes yet this week.</p>
      )}
      <button
        type="button"
        onClick={onSeeAll}
        className="mt-f8 text-cap font-semibold text-heading underline decoration-gold decoration-2 underline-offset-4"
      >
        All dining commons →
      </button>
    </RailSection>
  );
}

/** Dishes this visitor upvoted that are on a menu again this week. */
export function YourUpvotes({
  rows,
  clock,
  onOpen,
}: {
  rows: Row[];
  clock: Clock;
  onOpen: (key: string, serving?: Serving) => void;
}) {
  return (
    <RailSection title="Your upvotes" note="When the dishes you liked are served this week">
      {rows.length ? (
        <RankList rows={rows} detail={(row) => servingLabel(row, clock, true)} onOpen={onOpen} />
      ) : (
        <p className="py-f13 text-cap text-ink-3">Upvote dishes you love and they’ll show up here.</p>
      )}
    </RailSection>
  );
}

export function TopVotedView({
  boards,
  best,
  onBest,
  yours,
  clock,
  onOpen,
}: {
  boards: { hall: Hall; rows: RankedDish[]; status?: HallStatus }[];
  best: boolean;
  onBest: (best: boolean) => void;
  yours: Row[];
  clock: Clock;
  onOpen: (key: string, serving?: Serving) => void;
}) {
  return (
    <div className="anim-rise">
      <h1 className="font-serif text-h2 font-semibold text-heading md:text-h1">Top voted</h1>
      <p className="mt-f13 max-w-f610 leading-golden text-ink-2">
        What students rate highest on this week’s menu at each dining commons. Votes stay with a dish, so a favorite
        keeps its score every time it comes back.
      </p>
      <Tabs
        label="Ranking"
        className="mt-f21 max-w-f377"
        value={best ? "best" : "worst"}
        onChange={(v) => onBest(v === "best")}
        options={[
          { value: "best", label: <span className="font-semibold">Most loved</span> },
          { value: "worst", label: <span className="font-semibold">Least loved</span> },
        ]}
      />
      <div className="mt-f34 grid grid-cols-1 gap-f34 md:grid-cols-2">
        {boards.map(({ hall, rows, status }) => (
          <HallBoard key={hall.id} hall={hall} rows={rows} status={status} best={best} clock={clock} onOpen={onOpen} />
        ))}
      </div>
      <div className="mt-f55 max-w-f610">
        <YourUpvotes rows={yours} clock={clock} onOpen={onOpen} />
      </div>
    </div>
  );
}
