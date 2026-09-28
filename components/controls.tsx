"use client";

import type { ReactNode } from "react";
import { formatDay } from "@/lib/time";
import type { DietTag } from "@/lib/types";

type SegmentOption = {
  value: string;
  label: ReactNode;
  detail?: ReactNode;
  live?: boolean;
  dim?: boolean;
};

/** iOS-style segmented control with a sliding thumb. */
export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="group"
      aria-label={label}
      className="relative grid rounded-[14px] bg-track p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-[10px] bg-thumb shadow-[0_1px_2px_rgb(0_0_0/0.08),0_2px_8px_rgb(0_0_0/0.05)] transition-transform duration-300 ease-out"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`relative z-10 flex min-w-0 flex-col items-center justify-center rounded-[10px] px-1 transition-[color,opacity] duration-200 active:opacity-70 ${
              option.detail ? "py-1.5" : "py-2"
            } ${active ? "text-fg" : "text-muted"} ${option.dim && !active ? "opacity-45" : ""}`}
          >
            <span className="flex max-w-full items-center gap-1.5 truncate text-[14px] font-semibold tracking-[-0.01em]">
              {option.live && (
                <span
                  aria-label="Serving now"
                  className="size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.18)]"
                />
              )}
              {option.label}
            </span>
            {option.detail && (
              <span className="mt-0.5 max-w-full truncate text-[11px] font-medium tabular-nums opacity-80">
                {option.detail}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function DayStrip({
  dates,
  selected,
  today,
  closed,
  onSelect,
}: {
  dates: string[];
  selected: string;
  today: string;
  closed: Set<string>;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1" role="group" aria-label="Day">
      {dates.map((date) => {
        const { weekday, day } = formatDay(date);
        const active = date === selected;
        const isToday = date === today;
        return (
          <button
            key={date}
            type="button"
            aria-pressed={active}
            aria-label={`${formatDay(date, "long").weekday} ${day}${isToday ? ", today" : ""}${closed.has(date) ? ", closed" : ""}`}
            onClick={() => onSelect(date)}
            className={`relative flex flex-col items-center rounded-2xl py-2 transition-[background-color,color,transform] duration-200 ease-out active:scale-95 ${
              active ? "bg-fg text-bg" : "hover:bg-chip"
            } ${closed.has(date) && !active ? "opacity-40" : ""}`}
          >
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${active ? "opacity-70" : "text-muted"}`}
            >
              {weekday.slice(0, 3)}
            </span>
            <span className="text-[17px] font-semibold tabular-nums leading-6">{day}</span>
            <span
              aria-hidden
              className={`mt-0.5 size-1 rounded-full ${isToday ? (active ? "bg-bg" : "bg-up") : "bg-transparent"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

const DIETS: { tag: DietTag; label: string }[] = [
  { tag: "vegan", label: "Vegan" },
  { tag: "vegetarian", label: "Vegetarian" },
  { tag: "halal", label: "Halal" },
];

export function DietFilters({ value, onChange }: { value: DietTag[]; onChange: (next: DietTag[]) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Diet filters">
      {DIETS.map(({ tag, label }) => {
        const active = value.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((t) => t !== tag) : [...value, tag])}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-95 ${
              active ? "border-transparent bg-fg text-bg" : "border-line bg-card text-fg hover:bg-chip"
            }`}
          >
            <span aria-hidden className={`size-1.5 rounded-full ${DIET_DOT[tag]}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export const DIET_DOT: Record<DietTag, string> = {
  vegan: "bg-emerald-500",
  vegetarian: "bg-lime-500",
  halal: "bg-sky-500",
};
