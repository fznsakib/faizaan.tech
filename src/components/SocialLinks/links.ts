import type { GlyphKey } from "./glyphs";

export interface SocialLink {
  /** Visible lowercase label, and the glyph's key. */
  label: GlyphKey;
  /** Accessible name. */
  name: string;
  href: string;
}

export const LINKS: readonly SocialLink[] = [
  { label: "linkedin", name: "LinkedIn", href: "https://www.linkedin.com/in/faizaan-sakib/" },
  { label: "email", name: "Email", href: "mailto:fznsakib@gmail.com" },
  { label: "github", name: "GitHub", href: "https://github.com/fznsakib" },
  { label: "letterboxd", name: "Letterboxd", href: "https://letterboxd.com/fznsakib/" },
  { label: "strava", name: "Strava", href: "https://strava.app.link/VhdUXhuiWRb" },
];

/** External links open in a new tab without the opener or referrer; mailto opens the mail app in place. */
export function linkTarget(href: string): { target?: "_blank"; rel?: string } {
  return /^https?:/.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}
