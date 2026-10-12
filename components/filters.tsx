"use client";

import { Check } from "@/components/controls";
import { IconSliders } from "@/components/icons";
import { HALAL_GUIDANCE_URL } from "@/lib/dietary";
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
    <div className="py-f13">
      <div className="flex flex-wrap items-center gap-f5 text-cap" aria-label="Dietary filters">
        {[DIETS[2], DIETS[1], DIETS[0]].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filters.diets.includes(id)}
            onClick={() => onChange({ ...filters, diets: toggle(filters.diets, id, !filters.diets.includes(id)) })}
            className={`min-h-11 rounded-f3 border px-f8 font-semibold transition-colors ${filters.diets.includes(id) ? "border-heading bg-heading text-paper" : "border-rule-strong text-ink-2 hover:border-heading hover:text-heading"}`}
          >
            {id === "halal" ? "Halal only" : label}
          </button>
        ))}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="menu-filter-panel"
        aria-label={`Filters${count ? ` (${count} active)` : ""}`}
        className="ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-end gap-f5 px-f3 font-semibold text-heading"
      >
        <IconSliders className="size-4" />
        <span className="hidden min-[360px]:inline">Filters{count ? ` (${count})` : ""}</span>
      </button>
      </div>
      {count > 0 && (
        <div className="mt-f8 flex items-start justify-between gap-f13 text-cap" role="status">
        <span className="text-ink-2">{filterSummary(filters)}</span>
        <button
          type="button"
          onClick={() => onChange(NO_FILTERS)}
          className="shrink-0 font-semibold text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink"
        >
          Clear all
        </button>
        </div>
      )}
    </div>
  );
}

/** Diet and allergen checkboxes; the two groups split the width in the golden ratio. */
export function FilterPanel({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  return (
    <div id="menu-filter-panel" className="anim-rise grid gap-f21 rounded-f3 border border-rule bg-surface p-f21 sm:grid-cols-[1fr_1.618fr] sm:gap-f34">
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

export function HalalGuide() {
  return (
    <details className="border-b border-rule pb-f13 text-cap text-ink-2">
      <summary className="w-fit cursor-pointer py-f3 font-medium underline decoration-rule-strong underline-offset-4">How halal labels work</summary>
      <p className="mt-f8 max-w-[48em] leading-golden">
        “Halal” means UC Davis Dining labels that dish halal. “Not labeled halal” means the menu doesn’t confirm it;
        it does not mean the dish is non-halal. Confirm ingredients and preparation with dining staff.{" "}
        <a href={HALAL_GUIDANCE_URL} target="_blank" rel="noreferrer" className="font-semibold text-heading underline underline-offset-4">UC Davis halal guide ↗</a>
      </p>
    </details>
  );
}
