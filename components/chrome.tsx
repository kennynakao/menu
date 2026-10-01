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
        className={`pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 ${onDark ? "text-white/60" : "text-muted"}`}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
        autoFocus={autoFocus}
        placeholder="Search dishes this week"
        enterKeyHint="search"
        className={`h-10 w-full rounded-md pr-9 pl-10 text-[15px] outline-none transition-[background-color,box-shadow] [&::-webkit-search-cancel-button]:hidden ${
          onDark
            ? "bg-white/10 text-white placeholder:text-white/55 focus:bg-white/15 focus:ring-2 focus:ring-gold/70"
            : "border border-line bg-card text-fg placeholder:text-faint focus:ring-2 focus:ring-gold/60"
        }`}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className={`absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded ${onDark ? "text-white/70 hover:bg-white/10" : "text-muted hover:bg-chip"}`}
        >
          <IconClose className="size-3.5" />
        </button>
      )}
    </label>
  );
}

/** Aggie Blue bar with a gold rule, like housing.ucdavis.edu. */
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
    <header className="relative z-30 border-b-[3px] border-gold bg-brand pt-[env(safe-area-inset-top)] text-white lg:sticky lg:top-0">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-8 px-4 lg:h-16 lg:px-8">
        <button type="button" onClick={() => onView("menu")} className="flex shrink-0 items-center gap-2.5">
          <Logo className="size-8" />
          <span className="text-left leading-none">
            <span className="block text-[19px] font-bold tracking-[-0.02em]">{APP_NAME}</span>
            <span className="mt-1 hidden text-[11px] font-medium tracking-wide text-gold/90 sm:block">
              Davis dining commons
            </span>
          </span>
        </button>

        {/* The current section is a gold tab sitting on the gold rule, like UC Davis's own nav. */}
        <nav className="hidden h-full items-stretch gap-1 pt-3 lg:flex" aria-label="Sections">
          {VIEWS.filter((v) => v.id !== "search").map(({ id, label }) => {
            const active = view === id || (id === "menu" && view === "search");
            return (
              <button
                key={id}
                type="button"
                onClick={() => onView(id)}
                aria-current={active ? "page" : undefined}
                className={`rounded-t px-4 text-[15px] font-bold transition-colors duration-200 ${
                  active ? "bg-gold text-brand" : "text-white/75 hover:bg-white/5 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <SearchInput value={query} onChange={onQuery} onDark className="ml-auto hidden w-80 lg:block xl:w-96" />

        <p className="ml-auto flex items-center gap-1.5 text-[12px] font-medium text-white/80 lg:ml-0">
          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
          Live
        </p>
      </div>
    </header>
  );
}

/** App-style tab bar for phones. */
export function BottomNav({ view, onView }: { view: View; onView: (view: View) => void }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <div className="mx-auto grid max-w-xl grid-cols-3">
        {VIEWS.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onView(id)}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-semibold"
            >
              <span
                className={`grid h-7 w-14 place-items-center rounded transition-colors duration-200 ${
                  active ? "bg-gold/30 text-brand dark:bg-gold/20 dark:text-gold" : "text-muted"
                }`}
              >
                <Icon className="size-[19px]" />
              </span>
              <span className={active ? "text-brand dark:text-fg" : "text-muted"}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop sidebar list of dining commons with live open/closed status. */
export function HallList({
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
    <div role="group" aria-label="Dining commons" className="space-y-1">
      {halls.map((hall) => {
        const active = hall.id === selected;
        const status = statuses[hall.id];
        return (
          <button
            key={hall.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(hall.id)}
            className={`relative w-full overflow-hidden rounded-md px-4 py-2.5 text-left transition-colors duration-200 ${
              active ? "bg-primary text-on-primary" : "hover:bg-chip"
            }`}
          >
            {active && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gold dark:bg-brand" />}
            <span className="block text-[15px] font-semibold tracking-[-0.01em]">{hall.name}</span>
            {status && (
              <span className={`mt-0.5 flex items-center gap-1.5 text-[12px] ${active ? "opacity-80" : "text-muted"}`}>
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${status.open ? "bg-emerald-500" : active ? "bg-current opacity-50" : "bg-faint"}`}
                />
                {status.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
