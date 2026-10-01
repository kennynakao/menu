import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const IconMenu = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 21V3c-2.2 0-4 2.7-4 6.5S14.8 15 17 15" />
  </svg>
);

export const IconTrophy = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

export const IconSliders = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

export const IconClose = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

/** The app mark: an upvote over a bowl, drawn for the navy header. */
export const Logo = (p: IconProps) => (
  <svg viewBox="0 0 512 512" aria-hidden {...p}>
    <rect width="512" height="512" rx="56" fill="#ffffff" fillOpacity="0.08" />
    <path
      d="M184 196 L256 124 L328 196"
      fill="none"
      stroke="#FFBF00"
      strokeWidth="44"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M104 262 H408 A152 152 0 0 1 104 262 Z" fill="#ffffff" />
    <rect x="196" y="420" width="120" height="26" rx="13" fill="#ffffff" />
  </svg>
);
