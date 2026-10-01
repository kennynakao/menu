"use client";

import { useState, type ReactNode } from "react";
import { DietMarks } from "@/components/controls";
import type { Dish, VoteTally, VoteValue } from "@/lib/types";

const NO_VOTES: VoteTally = { up: 0, down: 0, mine: 0 };

function Triangle({ up, state }: { up: boolean; state: "idle" | "up" | "down" }) {
  const fill = state === "up" ? "var(--gold)" : state === "down" ? "var(--down)" : "none";
  const stroke = state === "up" ? "var(--gold-deep)" : state === "down" ? "var(--down)" : "currentColor";
  return (
    <svg viewBox="0 0 14 12" className={`h-3 w-[14px] ${up ? "" : "rotate-180"}`} aria-hidden>
      <path d="M7 1.2 13 10.8H1z" fill={fill} stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** ▲ count ▼ — no container, like a score printed in a menu's price column. */
export function VoteControl({
  name,
  tally = NO_VOTES,
  onVote,
}: {
  name: string;
  tally?: VoteTally;
  onVote: (value: VoteValue) => void;
}) {
  // Only animate changes the visitor makes, not totals arriving from the server.
  const [pulse, setPulse] = useState<{ n: number; dir: "up" | "down" } | null>(null);
  const net = tally.up - tally.down;
  const { mine } = tally;

  const cast = (value: VoteValue) => {
    setPulse((p) => ({ n: (p?.n ?? 0) + 1, dir: value > mine ? "up" : "down" }));
    onVote(value);
  };

  return (
    <div className="-my-f8 -mr-f8 flex shrink-0 items-center">
      <button
        type="button"
        aria-label={`Upvote ${name}`}
        aria-pressed={mine === 1}
        onClick={() => cast(mine === 1 ? 0 : 1)}
        className="grid size-11 place-items-center text-ink-3 transition-[color,transform] duration-150 ease-out hover:text-ink active:scale-90"
      >
        <span key={mine === 1 ? "on" : "off"} className={mine === 1 ? "anim-pop" : ""}>
          <Triangle up state={mine === 1 ? "up" : "idle"} />
        </span>
      </button>
      <span className="relative min-w-[2.5ch] overflow-hidden text-center" aria-live="polite">
        <span
          key={pulse?.n ?? 0}
          className={`inline-block text-body font-semibold tabular-nums ${pulse ? `anim-tick-${pulse.dir}` : ""} ${
            mine === -1 ? "text-down" : net || mine ? "text-heading" : "text-ink-3"
          }`}
        >
          {net}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Downvote ${name}`}
        aria-pressed={mine === -1}
        onClick={() => cast(mine === -1 ? 0 : -1)}
        className="grid size-11 place-items-center text-ink-3 transition-[color,transform] duration-150 ease-out hover:text-ink active:scale-90"
      >
        <span key={mine === -1 ? "on" : "off"} className={mine === -1 ? "anim-pop" : ""}>
          <Triangle up={false} state={mine === -1 ? "down" : "idle"} />
        </span>
      </button>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-ink-2">{term}</dt>
      <dd className="text-ink-2">{children}</dd>
    </>
  );
}

export function DishRow({
  dish,
  tally,
  onVote,
  sourceUrl,
  flash,
}: {
  dish: Dish;
  tally?: VoteTally;
  onVote: (value: VoteValue) => void;
  sourceUrl: string;
  flash?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allergens = dish.allergens.filter((a) => a !== "Shared fryer");
  const sharedFryer = dish.allergens.includes("Shared fryer");
  const nutrition = [
    // Non-breaking spaces keep each number with its unit when the line wraps.
    dish.calories !== undefined && `${dish.calories}\u00a0cal`,
    dish.protein !== undefined && `${dish.protein}\u00a0g\u00a0protein`,
    dish.carbs !== undefined && `${dish.carbs}\u00a0g\u00a0carbs`,
    dish.fat !== undefined && `${dish.fat}\u00a0g\u00a0fat`,
  ].filter(Boolean);

  return (
    <li id={`dish-${dish.key}`} className={`scroll-mt-f144 border-t border-rule first:border-t-0 ${flash ? "anim-flash" : ""}`}>
      <div className="flex items-start gap-f13 py-f13">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group min-w-0 flex-1 text-left"
        >
          <span className="text-body leading-snug font-semibold text-ink decoration-rule-strong underline-offset-4 group-hover:underline">
            {dish.name}
          </span>
          <DietMarks tags={dish.tags} />
          <span className="mt-f2 flex items-center gap-f5 text-cap text-ink-3 tabular-nums">
            {dish.calories !== undefined && <span>{dish.calories} cal</span>}
            <svg
              viewBox="0 0 10 10"
              className={`size-2.5 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path d="m2 3.5 3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        <VoteControl name={dish.name} tally={tally} onVote={onVote} />
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="pr-f55 pb-f21">
            {dish.description && (
              <p className="max-w-[34em] font-serif text-body leading-golden text-ink-2 italic">{dish.description}</p>
            )}
            <dl className="mt-f13 grid grid-cols-[auto_1fr] gap-x-f13 gap-y-f5 text-cap">
              <Fact term="Contains">
                {allergens.length ? allergens.join(", ") : "No major allergens"}
                {sharedFryer && " · Cooked in a shared fryer"}
              </Fact>
              {nutrition.length > 0 && <Fact term="Nutrition">{nutrition.join(" · ")}</Fact>}
              {dish.serving && <Fact term="Serving">{dish.serving}</Fact>}
              <Fact term="Votes">
                {tally?.up ?? 0} up · {tally?.down ?? 0} down
              </Fact>
            </dl>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-f13 inline-block text-cap font-semibold text-heading underline decoration-gold decoration-2 underline-offset-4"
            >
              Full ingredients on UC Davis Dining ↗
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}
