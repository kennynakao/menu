"use client";

import { Check } from "@/components/controls";
import { IconSliders } from "@/components/icons";
import { ALLERGENS, DIETS, HIGH_PROTEIN, NO_FILTERS, filterCount, type Filters } from "@/lib/filters";

const toggle = <T,>(list: T[], item: T, on: boolean) => (on ? [...list, item] : list.filter((x) => x !== item));

/** "Vegetarian · 20g+ protein · No dairy, egg" */
export function filterSummary(filters: Filters): string {
  const avoid = ALLERGENS.filter((a) => filters.avoid.includes(a.id)).map((a) => a.label.toLowerCase());
  return [
    ...DIETS.filter((d) => filters.diets.includes(d.id)).map((d) => d.label),
    filters.protein && `${HIGH_PROTEIN}g+ protein`,
    avoid.length > 0 && `No ${avoid.join(", ")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The toggle row above the menu: what's filtered, in words, and a way to change it. */
export function FilterBar({
  filters,
  onChange,
  open,
  onToggle,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const count = filterCount(filters);
  return (
    <div className="flex min-h-11 items-center gap-f13 text-cap">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex shrink-0 items-center gap-f5 font-semibold text-heading"
      >
        <IconSliders className="size-4" />
        Filters{count ? ` (${count})` : ""}
      </button>
      <span className="min-w-0 flex-1 truncate text-ink-3">{count ? filterSummary(filters) : "Showing every dish"}</span>
      {count > 0 && (
        <button
          type="button"
          onClick={() => onChange(NO_FILTERS)}
          className="shrink-0 font-semibold text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink"
        >
          Clear
        </button>
      )}
    </div>
  );
}

/** Diet and allergen checkboxes; the two groups split the width in the golden ratio. */
export function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  return (
    <div className="anim-rise grid gap-f21 border-y border-rule py-f21 sm:grid-cols-[1fr_1.618fr] sm:gap-f34">
      <fieldset>
        <legend className="mb-f5 text-cap font-semibold text-ink-2">Only show</legend>
        {DIETS.map(({ id, label }) => (
          <Check
            key={id}
            checked={filters.diets.includes(id)}
            onChange={(on) => onChange({ ...filters, diets: toggle(filters.diets, id, on) })}
          >
            {label}
          </Check>
        ))}
        <Check checked={filters.protein} onChange={(on) => onChange({ ...filters, protein: on })}>
          {HIGH_PROTEIN}g+ protein
        </Check>
      </fieldset>
      <fieldset>
        <legend className="mb-f5 text-cap font-semibold text-ink-2">Leave out dishes with</legend>
        <div className="grid grid-cols-2 gap-x-f21">
          {ALLERGENS.map(({ id, label }) => (
            <Check
              key={id}
              checked={filters.avoid.includes(id)}
              onChange={(on) => onChange({ ...filters, avoid: toggle(filters.avoid, id, on) })}
            >
              {label}
            </Check>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
