"use client";

import type { ComponentType, SVGProps } from "react";
import { IconClose, IconMenu, IconSearch, IconTrophy, Logo } from "@/components/icons";
import { APP_NAME } from "@/lib/app";
import type { HallStatus } from "@/lib/insights";
import type { Hall } from "@/lib/types";

export type View = "menu" | "top" | "search";

const VIEWS: { id: View; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "menu", label: "Menu", Icon: IconMenu },
  { id: "top", label: "Top voted", Icon: IconTrophy },
  { id: "search", label: "Search", Icon: IconSearch },
];

export function SearchInput({
  value,
  onChange,
  autoFocus,
  className = "",
  onDark = false,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">Search dishes this week</span>
      <IconSearch
        className={`pointer-events-none absolute top-1/2 left-f8 size-4 -translate-y-1/2 ${onDark ? "text-white/60" : "text-ink-3"}`}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        autoFocus={autoFocus}
        placeholder="Search this week’s dishes"
        enterKeyHint="search"
        className={`w-full rounded-f3 pr-f34 pl-f34 text-body outline-none transition-colors [&::-webkit-search-cancel-button]:hidden ${
          onDark
            ? "h-f34 bg-white/10 text-white placeholder:text-white/55 focus:bg-white/15"
            : "h-11 border border-rule-strong bg-surface text-ink placeholder:text-ink-3 focus:border-navy dark:focus:border-gold"
        }`}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className={`absolute top-1/2 right-f5 grid size-6 -translate-y-1/2 place-items-center rounded-f3 ${onDark ? "text-white/70 hover:bg-white/10" : "text-ink-3 hover:text-ink"}`}
        >
          <IconClose className="size-3.5" />
        </button>
      )}
    </label>
  );
}

/** Aggie Blue masthead. Section links and search appear from tablet width up. */
export function AppHeader({
  view,
  onView,
  query,
  onQuery,
}: {
  view: View;
  onView: (view: View) => void;
  query: string;
  onQuery: (query: string) => void;
}) {
  return (
    <header className="relative z-30 bg-navy pt-[env(safe-area-inset-top)] text-white">
      <div className="mx-auto flex h-f55 max-w-f1042 items-center gap-f34 px-f21 desk:px-0">
        <button type="button" onClick={() => onView("menu")} className="flex shrink-0 items-center gap-f8">
          <Logo className="size-[26px]" />
          <span className="text-lead font-extrabold tracking-[-0.015em]">{APP_NAME}</span>
        </button>

        <nav className="hidden h-full items-stretch gap-f21 md:flex" aria-label="Sections">
          {VIEWS.filter((v) => v.id !== "search").map(({ id, label }) => {
            const active = view === id || (id === "menu" && view === "search");
            return (
              <button
                key={id}
                type="button"
                onClick={() => onView(id)}
                aria-current={active ? "page" : undefined}
                className={`relative text-body font-semibold transition-colors ${active ? "text-white" : "text-white/65 hover:text-white"}`}
              >
                {label}
                <span
                  aria-hidden
                  className={`absolute inset-x-0 bottom-0 h-[3px] bg-gold transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
                />
              </button>
            );
          })}
        </nav>

        <SearchInput value={query} onChange={onQuery} onDark className="ml-auto hidden w-f233 md:block" />
      </div>
    </header>
  );
}

/**
 * The dining commons as a gold bar, like the navigation on housing.ucdavis.edu.
 * The selected hall is a tab cut out in the page color.
 */
export function HallBar({
  halls,
  selected,
  statuses,
  onSelect,
}: {
  halls: Hall[];
  selected: string;
  statuses: Record<string, HallStatus>;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Dining commons" className="bg-gold">
      <div className="mx-auto grid max-w-f1042 grid-cols-4 desk:gap-f3">
        {halls.map((hall) => {
          const active = hall.id === selected;
          const status = statuses[hall.id];
          return (
            <button
              key={hall.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(hall.id)}
              className={`min-w-0 px-f8 pt-f8 pb-f8 text-left transition-colors duration-200 md:px-f13 ${
                active ? "bg-paper text-heading" : "text-navy hover:bg-[#f2b400]"
              }`}
            >
              <span className="block truncate text-body leading-tight font-bold">{hall.name}</span>
              {status && (
                <span className={`block truncate text-cap ${active ? "text-ink-2" : "text-navy/75"}`}>
                  <span className="md:hidden">{status.short}</span>
                  <span className="hidden md:inline">{status.label}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Tab bar for phones. */
export function BottomNav({ view, onView }: { view: View; onView: (view: View) => void }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-3">
        {VIEWS.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onView(id)}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-f3 pt-f8 pb-f5 text-cap font-semibold transition-colors ${
                active ? "text-heading" : "text-ink-3"
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-x-f34 top-0 h-[3px] bg-gold transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
              />
              <Icon className="size-[21px]" />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
