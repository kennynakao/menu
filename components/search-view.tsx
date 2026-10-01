"use client";

import { Fragment } from "react";
import { SearchInput } from "@/components/chrome";
import { DietMarks } from "@/components/controls";
import { formatScore, type Clock } from "@/components/top-voted";
import { isUpcoming, whenLabel, type SearchHit, type Serving } from "@/lib/insights";
import { score } from "@/lib/menu-view";
import { formatDay } from "@/lib/time";
import type { VoteTally } from "@/lib/types";

const SUGGESTIONS = ["pizza", "curry", "tofu", "burger", "pasta", "tacos"];
const MAX_UPCOMING = 6;

export function SearchView({
  query,
  onQuery,
  hits,
  filtered,
  tallies,
  clock,
  minutes,
  onOpen,
}: {
  query: string;
  onQuery: (query: string) => void;
  hits: SearchHit[];
  filtered: boolean;
  tallies: Record<string, VoteTally>;
  clock: Clock;
  minutes: number;
  onOpen: (key: string, serving: Serving) => void;
}) {
  const q = query.trim();
  return (
    <div className="anim-rise max-w-f610">
      <h1 className="font-serif text-h2 font-semibold text-heading md:text-h1">{q ? `“${q}”` : "Search"}</h1>
      {/* On tablet and desktop the search box lives in the header. */}
      <SearchInput value={query} onChange={onQuery} autoFocus className="mt-f21 md:hidden" />

      {!q ? (
        <p className="mt-f21 leading-golden text-ink-2">
          Find a dish and see every dining commons and meal serving it this week. Try{" "}
          {SUGGESTIONS.map((s, i) => (
            <Fragment key={s}>
              {i > 0 && (i === SUGGESTIONS.length - 1 ? ", or " : ", ")}
              <button
                type="button"
                onClick={() => onQuery(s)}
                className="font-semibold text-heading underline decoration-gold decoration-2 underline-offset-4"
              >
                {s}
              </button>
            </Fragment>
          ))}
          .
        </p>
      ) : !hits.length ? (
        <p className="mt-f21 leading-golden text-ink-2">
          Nothing on this week’s menus matches. Try a shorter word{filtered ? ", or clear your filters" : ""}.
        </p>
      ) : (
        <>
          <p className="mt-f8 text-cap text-ink-3">
            {hits.length} {hits.length === 1 ? "dish" : "dishes"} on this week’s menus
          </p>
          <ul className="mt-f21 border-t-2 border-heading/80">
            {hits.map(({ dish, servings }) => {
              const s = score(tallies[dish.key]);
              const upcoming = servings.filter((x) => isUpcoming(x, clock.today, minutes));
              const past = servings.filter((x) => !upcoming.includes(x));
              return (
                <li key={dish.key} className="border-b border-rule py-f13">
                  <div className="flex items-baseline justify-between gap-f13">
                    <p>
                      <span className="font-semibold text-ink">{dish.name}</span>
                      <DietMarks tags={dish.tags} />
                    </p>
                    {s !== 0 && (
                      <span className={`shrink-0 font-semibold tabular-nums ${s < 0 ? "text-down" : "text-heading"}`}>
                        {formatScore(s)}
                      </span>
                    )}
                  </div>
                  <p className="mt-f3 text-cap leading-golden text-ink-2">
                    {upcoming.slice(0, MAX_UPCOMING).map((serving, i) => (
                      <Fragment key={`${serving.hall}-${serving.date}-${serving.meal}`}>
                        {i > 0 && " · "}
                        <button
                          type="button"
                          onClick={() => onOpen(dish.key, serving)}
                          className="font-semibold text-heading underline decoration-rule-strong underline-offset-4 hover:decoration-gold"
                        >
                          {serving.hallName}, {whenLabel(serving, clock.today, clock.tomorrow, true)}
                        </button>
                      </Fragment>
                    ))}
                    {upcoming.length > MAX_UPCOMING && ` · and ${upcoming.length - MAX_UPCOMING} more`}
                    {!upcoming.length && <span className="text-ink-3">Not on the menu again this week. </span>}
                    {past.length > 0 && (
                      <span className="text-ink-3">
                        {upcoming.length ? " · " : ""}
                        Earlier: {[...new Set(past.map((x) => `${x.hallName} ${formatDay(x.date).weekday}`))].join(", ")}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
