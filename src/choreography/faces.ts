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

interface FaceStep {
  family: string;
  /** Song time the change left the head, or null to show it everywhere at once. */
  at: number | null;
}

export interface FaceWave {
  steps: FaceStep[];
  /** Index of the next font in CYCLE_FONTS. */
  next: number;
}

export function createFaceWave(): FaceWave {
  return { steps: [{ family: GOLOS, at: null }], next: 0 };
}

function push(wave: FaceWave, family: string, at: number): void {
  wave.steps.push({ family, at });
  if (wave.steps.length > HISTORY) wave.steps.shift();
}

/**
 * Step the name's face on this frame's musical edges. Drops hit in Doto and calm returns to Golos; in between,
 * the name walks through CYCLE_FONTS: a font per bar when calm, a font per beat in a drop.
 */
export function advanceFaces(wave: FaceWave, frame: FaceFrame): void {
  const latest = wave.steps[wave.steps.length - 1];
  // Time went backwards (next track, seek back): old change times would hide the latest face.
  if (latest.at !== null && frame.time < latest.at) wave.steps = [{ family: latest.family, at: null }];
  if (!frame.isPlaying || !frame.beatCrossed) return;
  if (frame.sectionChanged) {
    push(wave, frame.sectionLevel === 1 ? DOTO : GOLOS, frame.time);
  } else if (frame.sectionLevel === 1 || frame.isDownbeat) {
    push(wave, CYCLE_FONTS[wave.next], frame.time);
    wave.next = (wave.next + 1) % CYCLE_FONTS.length;
  }
}

/** The face a letter `distance` px from the head shows at song time `time`: the newest change that has reached it. */
export function letterFace(wave: FaceWave, time: number, distance: number): string {
  for (let i = wave.steps.length - 1; i > 0; i--) {
    const { family, at } = wave.steps[i];
    if (at === null || time - at >= distance / SHOCKWAVE_SPEED) return family;
  }
  return wave.steps[0].family;
}

/** Font size (em) that gives a face the name's Golos width, so wide faces don't overlap their locked letter boxes. */
export function fitScale(golosWidth: number, faceWidth: number): number {
  if (!(golosWidth > 0) || !(faceWidth > 0)) return 1;
  return Math.min(1.15, Math.max(0.5, golosWidth / faceWidth));
}
