import { createBurst, SHARD_COUNT, shardsFor } from "../../choreography/shatter";

import type { Burst, Shard } from "../../choreography/shatter";

/** A letter's elements, filled in by ref, and its burst, for the painter. */
export interface LetterPieces {
  glyph: HTMLElement | null;
  /** Holds the plate and shards; out of the render tree unless the letter is bursting. */
  burstLayer: HTMLElement | null;
  plate: HTMLElement | null;
  shards: HTMLElement[];
  burst: Burst;
  /** Whether the painter is drawing it (it tidies the letter up once, when its burst ends). */
  live: boolean;
}

/** Letter `index`'s shards: the same every load (phones draw the first `SHARD_COUNT.lite`). */
export const shardsOf = (index: number): Shard[] => shardsFor(index * 3 + 1, SHARD_COUNT.full);

export const emptyPieces = (): LetterPieces => ({
  glyph: null,
  burstLayer: null,
  plate: null,
  shards: [],
  burst: createBurst(),
  live: false,
});
