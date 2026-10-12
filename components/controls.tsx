"use client";

import type { ReactNode } from "react";
import type { DietTag } from "@/lib/types";

type TabOption = {
  value: string;
  label: ReactNode;
  detail?: ReactNode;
  muted?: boolean;
  ariaLabel?: string;
};

/** Quiet grouped controls with a filled selection and a visible baseline. */
export function Tabs({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`grid gap-f3 border-b border-rule py-f5 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-f3 px-f3 py-f8 transition-colors duration-200 ${
              active ? "bg-heading/[0.07] text-heading" : "text-ink-2 hover:bg-heading/[0.04] hover:text-ink"
            } ${option.muted && !active ? "text-ink-3" : ""}`}
          >
            {option.label}
            {option.detail}
            {active && <span aria-hidden className="absolute inset-x-f13 bottom-0 h-0.5 bg-heading" />}
          </button>
        );
      })}
    </div>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-f8 py-f5 text-body text-ink select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="grid size-[18px] shrink-0 place-items-center rounded-f3 border border-rule-strong bg-surface text-white transition-colors duration-150 peer-checked:border-navy peer-checked:bg-navy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold dark:text-navy dark:peer-checked:border-gold dark:peer-checked:bg-gold"
      >
        <svg
          viewBox="0 0 12 12"
          className={`size-3 transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M2.5 6.2 5 8.5 9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </label>
  );
}

export const DIET_MARKS: Record<DietTag, { short: string; title: string; color: string }> = {
  vegan: { short: "VG", title: "Vegan", color: "text-vegan" },
  vegetarian: { short: "V", title: "Vegetarian", color: "text-vegetarian" },
  halal: { short: "H", title: "Halal", color: "text-halal" },
};

/** Use full dietary names; vegan implies vegetarian, so show only the stronger label. */
export function DietMarks({ tags, includeHalal = true }: { tags: DietTag[]; includeHalal?: boolean }) {
  return tags
    .filter((tag) => includeHalal || tag !== "halal")
    .filter((tag) => !(tag === "vegetarian" && tags.includes("vegan")))
    .map((tag) => (
      <span
        key={tag}
        className={`ml-f8 inline-block whitespace-nowrap align-baseline text-cap font-medium ${DIET_MARKS[tag].color}`}
      >
        {DIET_MARKS[tag].title}
      </span>
    ));
}
