/** One filled shape of a glyph and the colour it resolves to. */
export interface GlyphPart {
  d: string;
  color: string;
}

export interface Glyph {
  /** Where the path data came from. */
  source: string;
  viewBox: string;
  /** The mark: drawn as dots at rest, each part resolving to its own colour. */
  parts: GlyphPart[];
  /** A fill under the resolved mark only, never dotted (LinkedIn's white "in"). */
  backing?: GlyphPart;
}

const SQUARE = "0 0 24 24";

export const GLYPHS = {
  linkedin: {
    // Simple Icons 13.21.0 (CC0), the last release before LinkedIn was removed: simpleicons.org
    source: "simple-icons@13.21.0/linkedin",
    viewBox: SQUARE,
    parts: [
      {
        d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
        color: "#0A66C2",
      },
    ],
    backing: { d: "M1 1h22v22H1z", color: "#FFFFFF" },
  },
  email: {
    // Drawn for this site: a plain envelope, solid with the flap knocked out, to sit with the filled brand marks.
    source: "faizaan.tech/envelope",
    viewBox: SQUARE,
    parts: [
      {
        d: "M3.5 3.5h17A2.5 2.5 0 0 1 23 6v12a2.5 2.5 0 0 1-2.5 2.5h-17A2.5 2.5 0 0 1 1 18V6a2.5 2.5 0 0 1 2.5-2.5zM3.5 6.6v2.1l8.5 5.5 8.5-5.5V6.6L12 12.1z",
        color: "#8AB1EE",
      },
    ],
  },
  github: {
    // Simple Icons 16.32.0 (CC0): simpleicons.org
    source: "simple-icons@16.32.0/github",
    viewBox: SQUARE,
    parts: [
      {
        d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
        color: "#FFFFFF",
      },
    ],
  },
  letterboxd: {
    // Simple Icons 16.32.0 (CC0): simpleicons.org, split into its three dots
    source: "simple-icons@16.32.0/letterboxd",
    viewBox: SQUARE,
    parts: [
      {
        d: "M8.224 14.352a4.447 4.447 0 0 1-3.775 2.092C1.992 16.444 0 14.454 0 12s1.992-4.444 4.45-4.444c1.592 0 2.988.836 3.774 2.092-.427.682-.673 1.488-.673 2.352s.246 1.67.673 2.352z",
        color: "#FF8000",
      },
      {
        d: "M15.101 12c0-.864.247-1.67.674-2.352-.786-1.256-2.183-2.092-3.775-2.092s-2.989.836-3.775 2.092c.427.682.674 1.488.674 2.352s-.247 1.67-.674 2.352c.786 1.256 2.183 2.092 3.775 2.092s2.989-.836 3.775-2.092A4.42 4.42 0 0 1 15.1 12z",
        color: "#00E054",
      },
      {
        d: "M19.551 7.556a4.447 4.447 0 0 0-3.775 2.092c.427.682.673 1.488.673 2.352s-.246 1.67-.673 2.352a4.447 4.447 0 0 0 3.775 2.092C22.008 16.444 24 14.454 24 12s-1.992-4.444-4.45-4.444z",
        color: "#40BCF4",
      },
    ],
  },
  strava: {
    // Simple Icons 16.32.0 (CC0): simpleicons.org
    source: "simple-icons@16.32.0/strava",
    viewBox: SQUARE,
    parts: [
      {
        d: "M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169",
        color: "#FC4C02",
      },
    ],
  },
} as const satisfies Record<string, Glyph>;

export type GlyphKey = keyof typeof GLYPHS;
