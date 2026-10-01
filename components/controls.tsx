"use client";

import type { ReactNode } from "react";
import { formatDay } from "@/lib/time";

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
      className="relative grid rounded-md bg-track p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded bg-thumb shadow-[0_1px_2px_rgb(2_40_81/0.14)] transition-transform duration-300 ease-out"
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
            className={`relative z-10 flex min-w-0 flex-col items-center justify-center rounded px-1 transition-[color,opacity] duration-200 active:opacity-70 ${
              option.detail ? "py-1.5" : "py-2"
            } ${active ? "text-brand dark:text-fg" : "text-muted"} ${option.dim && !active ? "opacity-45" : ""}`}
          >
            <span className="flex max-w-full items-center gap-1.5 truncate text-[14px] font-semibold tracking-[-0.01em]">
              {option.live && (
                <span
                  aria-label="Open now"
                  className="size-1.5 shrink-0 rounded-full bg-emerald-500"
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
            className={`relative flex flex-col items-center rounded-md py-2 transition-[background-color,color,transform] duration-200 ease-out active:scale-95 ${
              active ? "bg-primary text-on-primary" : "hover:bg-chip"
            } ${closed.has(date) && !active ? "opacity-40" : ""}`}
          >
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${active ? "opacity-75" : "text-muted"}`}
            >
              {weekday.slice(0, 3)}
            </span>
            <span className="text-[17px] font-semibold tabular-nums leading-6">{day}</span>
            <span
              aria-hidden
              className={`mt-0.5 size-1 rounded-full ${isToday ? (active ? "bg-gold dark:bg-brand" : "bg-gold") : "bg-transparent"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** A toggle pill. `tone="avoid"` marks something being excluded. */
export function Chip({
  active,
  tone = "include",
  onClick,
  children,
  dot,
}: {
  active: boolean;
  tone?: "include" | "avoid";
  onClick: () => void;
  children: ReactNode;
  dot?: string;
}) {
  const on =
    tone === "avoid"
      ? "border-transparent bg-down-soft text-down line-through decoration-1"
      : "border-transparent bg-primary text-on-primary";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded border px-3 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-95 ${
        active ? on : "border-line bg-card text-fg hover:bg-chip"
      }`}
    >
      {dot && <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />}
      {children}
    </button>
  );
}
