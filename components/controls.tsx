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

/**
 * Text tabs on a hairline. The selected tab gets a gold bar 61.8% of its width
 * (the golden section) that slides between tabs.
 */
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
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid border-b border-rule ${className}`}
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
            className={`flex min-w-0 flex-col items-center px-f3 pt-f8 pb-f13 transition-colors duration-200 ${
              active ? "text-heading" : "text-ink-3 hover:text-ink"
            } ${option.muted && !active ? "opacity-45" : ""}`}
          >
            {option.label}
            {option.detail}
          </button>
        );
      })}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-px left-0 h-[3px] transition-transform duration-300 ease-out"
        style={{ width: `${100 / options.length}%`, transform: `translateX(${index * 100}%)` }}
      >
        <span className="mx-auto block h-full w-[61.8%] bg-gold" />
      </span>
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

/** Printed-menu style symbols. Vegan implies vegetarian, so only the stronger mark shows. */
export function DietMarks({ tags }: { tags: DietTag[] }) {
  return tags
    .filter((tag) => !(tag === "vegetarian" && tags.includes("vegan")))
    .map((tag) => (
      <abbr
        key={tag}
        title={DIET_MARKS[tag].title}
        aria-label={DIET_MARKS[tag].title}
        className={`ml-f5 inline-grid h-[16px] min-w-[16px] -translate-y-px place-items-center rounded-f3 border border-current px-f3 align-middle text-micro font-bold tracking-[0.02em] no-underline ${DIET_MARKS[tag].color}`}
      >
        {DIET_MARKS[tag].short}
      </abbr>
    ));
}
