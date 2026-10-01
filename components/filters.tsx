"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Chip } from "@/components/controls";
import { IconClose } from "@/components/icons";
import { ALLERGENS, DIETS, HIGH_PROTEIN, NO_FILTERS, filterCount, type Filters } from "@/lib/filters";
import type { DietTag } from "@/lib/types";

export const DIET_DOT: Record<DietTag, string> = {
  vegan: "bg-emerald-500",
  vegetarian: "bg-lime-500",
  halal: "bg-sky-500",
};

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-baseline justify-between text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
        {title}
        {hint && <span className="font-medium normal-case tracking-normal text-faint">{hint}</span>}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/** Diet, protein and allergen filters, shown inline in the desktop sidebar and inside the mobile sheet. */
export function FilterGroups({ filters, onChange }: { filters: Filters; onChange: (next: Filters) => void }) {
  return (
    <div className="space-y-5">
      <Group title="Diet">
        {DIETS.map(({ id, label }) => (
          <Chip
            key={id}
            active={filters.diets.includes(id)}
            dot={DIET_DOT[id]}
            onClick={() => onChange({ ...filters, diets: toggle(filters.diets, id) })}
          >
            {label}
          </Chip>
        ))}
        <Chip active={filters.protein} onClick={() => onChange({ ...filters, protein: !filters.protein })}>
          {HIGH_PROTEIN}g+ protein
        </Chip>
      </Group>
      <Group title="Avoid" hint="Hide dishes containing">
        {ALLERGENS.map(({ id, label }) => (
          <Chip
            key={id}
            tone="avoid"
            active={filters.avoid.includes(id)}
            onClick={() => onChange({ ...filters, avoid: toggle(filters.avoid, id) })}
          >
            {label}
          </Chip>
        ))}
      </Group>
      {filterCount(filters) > 0 && (
        <button
          type="button"
          onClick={() => onChange(NO_FILTERS)}
          className="text-[13px] font-semibold text-brand underline decoration-line underline-offset-4 hover:decoration-brand dark:text-gold"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

/** Bottom sheet holding the filters on phones. */
export function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (next: Filters) => void;
  resultCount: number;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="anim-fade absolute inset-0 bg-[rgb(2_20_40/0.45)] backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabIndex={-1}
        className="anim-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-lg bg-card px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl outline-none"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-brand dark:text-fg">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded bg-chip text-muted"
          >
            <IconClose className="size-4" />
          </button>
        </div>
        <FilterGroups filters={filters} onChange={onChange} />
        <button
          type="button"
          onClick={onClose}
          className="mt-6 h-12 w-full rounded-md bg-primary text-[15px] font-semibold text-on-primary transition-transform active:scale-[0.98]"
        >
          Show {resultCount} {resultCount === 1 ? "dish" : "dishes"}
        </button>
      </div>
    </div>
  );
}
