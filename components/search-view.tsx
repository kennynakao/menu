"use client";

import { SearchInput } from "@/components/chrome";
import { formatScore, type Clock } from "@/components/top-voted";
import { isUpcoming, whenLabel, type SearchHit, type Serving } from "@/lib/insights";
import { score } from "@/lib/menu-view";
import type { VoteTally } from "@/lib/types";

const SUGGESTIONS = ["Pizza", "Chicken", "Tofu", "Burger", "Curry", "Pasta", "Tacos", "Salad"];
const MAX_SERVINGS = 8;

export function SearchView({
  query,
  onQuery,
  hits,
  tallies,
  clock,
  minutes,
  onOpen,
}: {
  query: string;
  onQuery: (query: string) => void;
  hits: SearchHit[];
  tallies: Record<string, VoteTally>;
  clock: Clock;
  minutes: number;
  onOpen: (key: string, serving: Serving) => void;
}) {
  return (
    <div className="anim-rise space-y-4">
      {/* On desktop the search box lives in the header. */}
      <SearchInput value={query} onChange={onQuery} autoFocus className="lg:hidden" />

      {!query.trim() ? (
        <div className="rounded-md border border-line bg-card px-5 py-8 text-center">
          <p className="text-[16px] font-semibold text-brand dark:text-fg">Find a dish</p>
          <p className="mt-1 text-[14px] text-muted">See every dining commons and meal serving it this week.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onQuery(s)}
                className="h-8 rounded border border-line bg-bg px-3 text-[13px] font-medium transition-colors hover:bg-chip"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : !hits.length ? (
        <div className="rounded-md border border-line bg-card px-5 py-8 text-center">
          <p className="text-[16px] font-semibold">No dishes match “{query.trim()}” this week</p>
          <p className="mt-1 text-[14px] text-muted">Try a shorter word, or clear your filters.</p>
        </div>
      ) : (
        <>
          <p className="px-1 text-[13px] font-medium text-muted">
            {hits.length} {hits.length === 1 ? "dish" : "dishes"} this week
          </p>
          <ul className="space-y-2.5">
            {hits.map(({ dish, servings }) => {
              const s = score(tallies[dish.key]);
              // Upcoming servings first; ones already past stay listed (struck through) after them.
              const upcoming = servings.filter((x) => isUpcoming(x, clock.today, minutes));
              const shown = [...upcoming, ...servings.filter((x) => !upcoming.includes(x))].slice(0, MAX_SERVINGS);
              return (
                <li key={dish.key} className="rounded-md border border-line bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[15px] font-semibold leading-snug">{dish.name}</p>
                    {s !== 0 && (
                      <span
                        className={`shrink-0 rounded-sm px-2 py-0.5 text-[12px] font-semibold tabular-nums ${
                          s > 0 ? "bg-up-soft text-up" : "bg-down-soft text-down"
                        }`}
                      >
                        {formatScore(s)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {shown.map((serving) => {
                      const isNext = upcoming.includes(serving);
                      return (
                        <button
                          key={`${serving.hall}-${serving.date}-${serving.meal}`}
                          type="button"
                          onClick={() => onOpen(dish.key, serving)}
                          className={`rounded-sm px-2 py-1 text-[12px] font-medium transition-colors ${
                            isNext
                              ?"bg-primary/8 text-brand hover:bg-primary/15 dark:bg-gold/12 dark:text-gold"
                              : "bg-chip text-muted line-through decoration-faint hover:bg-track"
                          }`}
                        >
                          {serving.hallName} · {whenLabel(serving, clock.today, clock.tomorrow)}
                        </button>
                      );
                    })}
                    {servings.length > shown.length && (
                      <span className="px-1 py-1 text-[12px] text-muted">+{servings.length - shown.length} more</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
