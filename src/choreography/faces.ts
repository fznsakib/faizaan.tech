import { SHOCKWAVE_SPEED } from "./type";

import type { MusicFrame } from "../audio/types";

/** The name's own face: an empty family falls back to the header's Golos. */
export const GOLOS = "";
/** Drops hit in the site's dot-matrix face. */
export const DOTO = '"Doto", monospace';
export const DOTO_VARIATION = '"wght" 900, "ROND" 100';

/** The fonts the original header cycled through (v2 AnimatedHeader), in its order. */
export const CYCLE_FONTS: readonly string[] = [
  '"Didot", serif',
  '"SF Mono", monospace',
  '"Futura", sans-serif',
  '"Luminari", fantasy',
  '"Marker Felt", fantasy',
  '"Rubik Iso", cursive',
  '"Lacquer", cursive',
  '"Permanent Marker", cursive',
  '"Protest Guerrilla", cursive',
  '"Audiowide", cursive',
  '"Syne Mono", monospace',
  '"Bytesized", sans-serif',
  '"Kode Mono", monospace',
];

/** Every face the name can show besides Golos. */
export const HEADER_FACES: readonly string[] = [DOTO, ...CYCLE_FONTS];

/** Waves kept for letters the newer ones haven't reached yet (a beat at 200 BPM is 0.3 s; a wave crosses in ≤ 0.7 s). */
const HISTORY = 6;

export type FaceFrame = Pick<
  MusicFrame,
  "time" | "isPlaying" | "beatCrossed" | "isDownbeat" | "sectionLevel" | "sectionChanged"
>;

/** Offset between neighbouring words/letters in the cycle: 5 is coprime with 13, so neighbours never share a font. */
export const SPREAD = 5;

interface FaceStep {
  families: readonly string[];
  /** Song time the change left the head, or null to show it everywhere at once. */
  at: number | null;
}

export interface FaceWave {
  steps: FaceStep[];
  /** Index of the next font in CYCLE_FONTS. */
  next: number;
  /** `words[i]` is letter i's word index; `-1` marks a space. */
  words: readonly number[];
}

const uniform = (wave: FaceWave, family: string) => wave.words.map(() => family);
const cycleAt = (offset: number) => CYCLE_FONTS[offset % CYCLE_FONTS.length];

export function createFaceWave(words: readonly number[]): FaceWave {
  return { steps: [{ families: words.map(() => GOLOS), at: null }], next: 0, words };
}

function push(wave: FaceWave, families: readonly string[], at: number): void {
  wave.steps.push({ families, at });
  if (wave.steps.length > HISTORY) wave.steps.shift();
}

/**
 * Step the name's face assignments on this frame's musical edges. Drops hit in Doto and calm returns to Golos
 * across the whole name; in between, the name walks through CYCLE_FONTS: a font per word per bar when calm,
 * a font per letter per beat in a drop. Spaces get their neighbour's word font; nothing renders for them.
 */
export function advanceFaces(wave: FaceWave, frame: FaceFrame): void {
  const latest = wave.steps[wave.steps.length - 1];
  // Time went backwards (next track, seek back): old change times would hide the latest assignment.
  if (latest.at !== null && frame.time < latest.at) wave.steps = [{ families: latest.families, at: null }];
  if (!frame.isPlaying || !frame.beatCrossed) return;
  if (frame.sectionChanged) {
    push(wave, uniform(wave, frame.sectionLevel === 1 ? DOTO : GOLOS), frame.time);
  } else if (frame.sectionLevel === 1) {
    push(
      wave,
      wave.words.map((_, i) => cycleAt(wave.next + i * SPREAD)),
      frame.time
    );
    wave.next = (wave.next + 1) % CYCLE_FONTS.length;
  } else if (frame.isDownbeat) {
    push(
      wave,
      wave.words.map((w) => cycleAt(wave.next + Math.max(0, w) * SPREAD)),
      frame.time
    );
    wave.next = (wave.next + 1) % CYCLE_FONTS.length;
  }
}

/**
 * The face letter `index`, `distance` px from the head, shows at song time `time`: the newest assignment that
 * has reached it.
 */
export function letterFace(wave: FaceWave, time: number, distance: number, index: number): string {
  for (let i = wave.steps.length - 1; i > 0; i--) {
    const { families, at } = wave.steps[i];
    if (at === null || time - at >= distance / SHOCKWAVE_SPEED) return families[index];
  }
  return wave.steps[0].families[index];
}

/** Font size (em) that gives a face the name's Golos width, so wide faces don't overlap their locked letter boxes. */
export function fitScale(golosWidth: number, faceWidth: number): number {
  if (!(golosWidth > 0) || !(faceWidth > 0)) return 1;
  return Math.min(1.15, Math.max(0.5, golosWidth / faceWidth));
}
