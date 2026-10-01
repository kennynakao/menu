"use client";

import { useState } from "react";
import type { Dish, VoteTally, VoteValue } from "@/lib/types";

const NO_VOTES: VoteTally = { up: 0, down: 0, mine: 0 };

function Arrow({ up, filled }: { up: boolean; filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-[18px] ${up ? "" : "rotate-180"}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 4.5 19.5 13h-4.25v6.5h-6.5V13H4.5z" />
    </svg>
  );
}

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
    <div
      className={`flex h-8 shrink-0 items-center rounded-md transition-colors duration-200 ${
        mine === 1 ? "bg-up-soft" : mine === -1 ? "bg-down-soft" : "bg-chip"
      }`}
    >
      <button
        type="button"
        aria-label={`Upvote ${name}`}
        aria-pressed={mine === 1}
        onClick={() => cast(mine === 1 ? 0 : 1)}
        className={`grid size-8 place-items-center rounded transition-[color,transform] duration-150 ease-out active:scale-85 ${
          mine === 1 ? "text-up" : "text-muted hover:text-up"
        }`}
      >
        <span key={mine === 1 ? "on" : "off"} className={mine === 1 ? "anim-pop" : ""}>
          <Arrow up filled={mine === 1} />
        </span>
      </button>
      <span className="relative min-w-[1.6rem] overflow-hidden text-center" aria-live="polite">
        <span
          key={pulse?.n ?? 0}
          className={`inline-block text-[13px] font-semibold tabular-nums ${pulse ? `anim-tick-${pulse.dir}` : ""} ${
            mine === 1 ? "text-up" : mine === -1 ? "text-down" : net ? "text-fg" : "text-faint"
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
        className={`grid size-8 place-items-center rounded transition-[color,transform] duration-150 ease-out active:scale-85 ${
          mine === -1 ? "text-down" : "text-muted hover:text-down"
        }`}
      >
        <span key={mine === -1 ? "on" : "off"} className={mine === -1 ? "anim-pop" : ""}>
          <Arrow up={false} filled={mine === -1} />
        </span>
      </button>
    </div>
  );
}

const TAG_STYLE = {
  vegan: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  vegetarian: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
  halal: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
} as const;

function Stat({ label, value, unit }: { label: string; value?: number; unit?: string }) {
  if (value === undefined) return null;
  return (
    <div className="rounded bg-chip px-2.5 py-2">
      <div className="text-[15px] font-semibold tabular-nums leading-5">
        {value}
        {unit && <span className="ml-px text-[11px] font-medium text-muted">{unit}</span>}
      </div>
      <div className="text-[11px] font-medium text-muted">{label}</div>
    </div>
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
  // Vegan implies vegetarian, so only show the stronger label.
  const tags = dish.tags.filter((t) => !(t === "vegetarian" && dish.tags.includes("vegan")));
  const allergens = dish.allergens.filter((a) => a !== "Shared fryer");
  const sharedFryer = dish.allergens.includes("Shared fryer");

  return (
    <li id={`dish-${dish.key}`} className={`scroll-mt-40 ${flash ? "anim-flash" : ""}`}>
      <div className="flex items-center gap-3 py-3 pr-3 pl-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group min-w-0 flex-1 text-left"
        >
          <span className="block text-[15px] font-medium leading-snug tracking-[-0.01em] text-fg">{dish.name}</span>
          {(tags.length > 0 || dish.calories !== undefined) && (
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-sm px-1.5 py-px text-[11px] font-semibold capitalize ${TAG_STYLE[tag]}`}
                >
                  {tag}
                </span>
              ))}
              {dish.calories !== undefined && <span className="tabular-nums">{dish.calories} cal</span>}
              <svg
                viewBox="0 0 16 16"
                className={`size-3 text-faint transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </button>
        <VoteControl name={dish.name} tally={tally} onVote={onVote} />
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 pb-4">
            {dish.description && <p className="text-[14px] leading-relaxed text-muted">{dish.description}</p>}

            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="mr-0.5 font-semibold text-muted">Contains</span>
              {allergens.length ? (
                allergens.map((a) => (
                  <span key={a} className="rounded-sm bg-chip px-1.5 py-0.5 font-medium">
                    {a}
                  </span>
                ))
              ) : (
                <span className="font-medium text-muted">No major allergens</span>
              )}
              {sharedFryer && (
                <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-800 dark:text-amber-300">
                  Shared fryer
                </span>
              )}
            </div>

            {dish.calories !== undefined && (
              <div className="grid grid-cols-4 gap-1.5">
                <Stat label="Calories" value={dish.calories} />
                <Stat label="Protein" value={dish.protein} unit="g" />
                <Stat label="Carbs" value={dish.carbs} unit="g" />
                <Stat label="Fat" value={dish.fat} unit="g" />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
              <span className="tabular-nums">
                {dish.serving && <>Serving {dish.serving} · </>}
                {tally?.up ?? 0} up · {tally?.down ?? 0} down
              </span>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-fg underline decoration-line underline-offset-2 hover:decoration-fg"
              >
                Ingredients ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
