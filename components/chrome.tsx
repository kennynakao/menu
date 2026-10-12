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
            ? "h-10 border border-white/15 bg-white/5 text-white placeholder:text-white/60 focus:border-white/40 focus:bg-white/10"
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
    <header className="relative z-30 bg-navy pt-[env(safe-area-inset-top)] text-white [&_:focus-visible]:outline-gold">
      <div className="mx-auto flex h-[68px] max-w-f1042 items-center gap-f34 px-f21 desk:px-0">
        <button type="button" onClick={() => onView("menu")} aria-label={`${APP_NAME} home`} className="flex shrink-0 items-center gap-f8">
          <Logo className="size-[26px]" />
          <span className="text-lead font-bold tracking-[-0.015em]">{APP_NAME}</span>
        </button>
        <span className="ml-auto text-cap text-white/70 md:hidden">UC Davis dining</span>

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
                  className={`absolute inset-x-0 bottom-0 h-0.5 bg-gold transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
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

/** Hall selection with a persistent underline and the current service status. */
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
    <nav aria-label="Dining commons" className="border-b border-rule bg-surface">
      <div className="mx-auto grid max-w-f1042 grid-cols-4">
        {halls.map((hall) => {
          const active = hall.id === selected;
          const status = statuses[hall.id];
          return (
            <button
              key={hall.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(hall.id)}
              className={`relative min-w-0 px-f8 py-f13 text-left transition-colors duration-200 md:px-f21 ${
                active ? "bg-paper text-heading" : "text-ink-2 hover:bg-paper/60 hover:text-ink"
              }`}
            >
              <span className="block truncate text-[14px] leading-tight font-semibold md:text-body">{hall.name}</span>
              {status && (
                <span className="mt-f5 flex min-w-0 items-center gap-f5 text-[11px] text-ink-3 md:text-cap">
                  <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${status.open ? "bg-vegan" : "bg-ink-3/40"}`} />
                  <span className="truncate md:hidden">{status.short}</span>
                  <span className="hidden truncate md:inline">{status.label}</span>
                </span>
              )}
              <span aria-hidden className={`absolute inset-x-f8 -bottom-px h-0.5 bg-heading transition-opacity duration-200 md:inset-x-f21 ${active ? "opacity-100" : "opacity-0"}`} />
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
                className={`absolute inset-x-f34 top-0 h-0.5 bg-heading transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
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
