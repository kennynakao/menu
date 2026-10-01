"use client";

import { Segmented } from "@/components/controls";
import type { HallStatus, RankedDish, Serving } from "@/lib/insights";
import { whenLabel } from "@/lib/insights";
import { formatDay } from "@/lib/time";
import type { Dish, Hall } from "@/lib/types";

export const formatScore = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export type Clock = { today: string; tomorrow: string };

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={`shrink-0 rounded-sm px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
        score >= 0 ? "bg-up-soft text-up" : "bg-down-soft text-down"
      }`}
    >
      {formatScore(score)}
    </span>
  );
}

function servingLabel(row: { next?: Serving; last?: Serving }, clock: Clock, withHall = false) {
  const s = row.next ?? row.last;
  if (!s) return "";
  const where = withHall ? `${s.hallName} · ` : "";
  return row.next ? `${where}${whenLabel(s, clock.today, clock.tomorrow)}` : `${where}Last served ${formatDay(s.date).weekday}`;
}

function RankRow({
  rank,
  name,
  detail,
  score,
  onClick,
}: {
  rank: number;
  name: string;
  detail: string;
  score: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-left transition-colors hover:bg-chip active:bg-chip"
      >
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-sm text-[12px] font-bold tabular-nums ${
            rank === 1 ? "bg-gold text-brand" : "bg-chip text-muted"
          }`}
        >
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{name}</span>
          {detail && <span className="block truncate text-[12px] text-muted">{detail}</span>}
        </span>
        <ScorePill score={score} />
      </button>
    </li>
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
  compact = false,
}: {
  hall: Hall;
  rows: RankedDish[];
  status?: HallStatus;
  best: boolean;
  clock: Clock;
  onOpen: (key: string, serving?: Serving) => void;
  compact?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-line bg-card">
      <header className="flex items-center justify-between gap-3 bg-brand-2 px-4 py-2.5">
        <h3 className="text-[15px] font-bold tracking-[-0.01em] text-[#e5c44d]">
          {compact ? `Top voted at ${hall.name}` : hall.name}
        </h3>
        {status && !compact && (
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-white/75">
            <span aria-hidden className={`size-1.5 rounded-full ${status.open ? "bg-emerald-400" : "bg-white/40"}`} />
            {status.label}
          </span>
        )}
      </header>
      {rows.length ? (
        <ol className="p-1.5">
          {rows.map((row, i) => (
            <RankRow
              key={row.dish.key}
              rank={i + 1}
              name={row.dish.name}
              detail={servingLabel(row, clock)}
              score={row.score}
              onClick={() => onOpen(row.dish.key, row.next ?? row.last)}
            />
          ))}
        </ol>
      ) : (
        <p className="px-4 py-6 text-center text-[13px] text-muted">
          {hall.error
            ? "Menu unavailable right now."
            : best
              ? "No upvotes yet this week. Vote on the menu to start the leaderboard."
              : "Nothing downvoted this week."}
        </p>
      )}
    </section>
  );
}

/** Highest-rated dishes across every dining commons for the meal being viewed. */
export function CampusNow({
  meal,
  picks,
  onOpen,
}: {
  meal: string;
  picks: { dish: Dish; score: number; servings: Serving[] }[];
  onOpen: (key: string, serving?: Serving) => void;
}) {
  if (!picks.length) return null;
  return (
    <section className="anim-rise rounded-md border border-line bg-card p-1.5">
      <h2 className="px-3 pt-2 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
        Top rated on campus · {meal}
      </h2>
      <ol>
        {picks.map(({ dish, score, servings }, i) => (
          <RankRow
            key={dish.key}
            rank={i + 1}
            name={dish.name}
            detail={[...new Set(servings.map((s) => s.hallName))].join(" · ")}
            score={score}
            onClick={() => onOpen(dish.key, servings[0])}
          />
        ))}
      </ol>
    </section>
  );
}

/** Dishes this visitor upvoted that are on a menu again this week. */
export function YourUpvotes({
  rows,
  clock,
  onOpen,
}: {
  rows: { dish: Dish; score: number; next?: Serving; last?: Serving }[];
  clock: Clock;
  onOpen: (key: string, serving?: Serving) => void;
}) {
  return (
    <section className="rounded-md border border-line bg-card p-1.5">
      <h2 className="px-3 pt-2 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
        Your upvotes this week
      </h2>
      {rows.length ? (
        <ol>
          {rows.map((row, i) => (
            <RankRow
              key={row.dish.key}
              rank={i + 1}
              name={row.dish.name}
              detail={row.next || row.last ? servingLabel(row, clock, true) : ""}
              score={row.score}
              onClick={() => onOpen(row.dish.key, row.next ?? row.last)}
            />
          ))}
        </ol>
      ) : (
        <p className="px-3 pt-1 pb-3 text-[13px] text-muted">
          Upvote dishes you love and this shows when they&apos;re served next.
        </p>
      )}
    </section>
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
  yours: { dish: Dish; score: number; next?: Serving; last?: Serving }[];
  clock: Clock;
  onOpen: (key: string, serving?: Serving) => void;
}) {
  return (
    <div className="anim-rise space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-brand lg:text-[34px] dark:text-fg">
            Top voted
          </h1>
          <p className="mt-1 max-w-xl text-[14px] text-muted">
            Student votes on this week&apos;s menu at each dining commons. Votes stay with a dish, so favorites keep
            their score every time they come back.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Segmented
            label="Ranking"
            value={best ? "best" : "worst"}
            onChange={(v) => onBest(v === "best")}
            options={[
              { value: "best", label: "Most loved" },
              { value: "worst", label: "Least loved" },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {boards.map(({ hall, rows, status }) => (
          <HallBoard key={hall.id} hall={hall} rows={rows} status={status} best={best} clock={clock} onOpen={onOpen} />
        ))}
      </div>

      <YourUpvotes rows={yours} clock={clock} onOpen={onOpen} />
    </div>
  );
}
