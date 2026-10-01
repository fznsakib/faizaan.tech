import { dripsFor, shardsFor, sparklesFor } from "../../choreography/matter";

import type { Drip, Shard, Sparkle } from "../../choreography/matter";

/** Pieces per letter on desktop, and the share phones (`LITE`) show. */
export const FULL = { shards: 6, drips: 2, sparkles: 2 };
export const LITE_COUNT = { shards: 3, drips: 1, sparkles: 1 };

export interface LetterPlan {
  shards: Shard[];
  drips: Drip[];
  sparkles: Sparkle[];
}

/** A letter's elements, filled in by ref, for the painter. */
export interface LetterPieces {
  glyph: HTMLElement | null;
  chrome: HTMLElement | null;
  molten: HTMLElement | null;
  shatter: HTMLElement | null;
  frost: HTMLElement | null;
  shards: HTMLElement[];
  drips: HTMLElement[];
  sparkles: HTMLElement[];
  /** Opacity last written to the glyph, chrome, molten, shatter and frost (thousandths; -1 before any). */
  shown: Int16Array;
  /** Whether its drips, shards and sparkles were out last frame (they're hidden once, as they stop). */
  moving: { drips: boolean; shards: boolean; sparkles: boolean };
}

/** Letter `index`'s shards, drips and sparkles: the same every load. */
export function planLetter(index: number): LetterPlan {
  return {
    shards: shardsFor(index * 3 + 1, FULL.shards),
    drips: dripsFor(index * 3 + 2, FULL.drips),
    sparkles: sparklesFor(index * 3 + 3, FULL.sparkles),
  };
}

export const emptyPieces = (): LetterPieces => ({
  glyph: null,
  chrome: null,
  molten: null,
  shatter: null,
  frost: null,
  shards: [],
  drips: [],
  sparkles: [],
  shown: new Int16Array(5).fill(-1),
  moving: { drips: false, shards: false, sparkles: false },
});
