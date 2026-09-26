import { describe, expect, it } from "vitest";

import { advanceFaces, createFaceWave, CYCLE_FONTS, DOTO, fitScale, GOLOS, letterFace } from "./faces";
import { SHOCKWAVE_SPEED } from "./type";

import type { FaceFrame, FaceWave } from "./faces";

const frame = (time: number, edges: Partial<FaceFrame> = {}): FaceFrame => ({
  time,
  isPlaying: true,
  beatCrossed: false,
  isDownbeat: false,
  sectionLevel: 0,
  sectionChanged: false,
  ...edges,
});
const beat = (time: number, edges: Partial<FaceFrame> = {}) => frame(time, { beatCrossed: true, ...edges });
const downbeat = (time: number, edges: Partial<FaceFrame> = {}) => beat(time, { isDownbeat: true, ...edges });

// "(faiz)aan sakib": (faiz) | aan | space | sakib
const WORDS = [0, 0, 0, 0, 0, 0, 1, 1, 1, -1, 2, 2, 2, 2, 2];
const faces = (wave: FaceWave, time: number) => WORDS.map((_, i) => letterFace(wave, time, 0, i));

describe("header faces", () => {
  it("keeps every font the old header cycled through, in its order", () => {
    expect(CYCLE_FONTS).toEqual([
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
    ]);
  });

  it("starts all Golos, then gives each word its own font per calm bar", () => {
    const wave = createFaceWave(WORDS);
    expect(new Set(faces(wave, 0))).toEqual(new Set([GOLOS]));
    advanceFaces(wave, downbeat(2));
    const now = faces(wave, 2);
    expect(new Set(now.slice(0, 6)).size).toBe(1); // (faiz) shares a font
    expect(new Set(now.slice(10)).size).toBe(1); // sakib shares a font
    expect(new Set([now[0], now[6], now[10]]).size).toBe(3); // three different fonts
  });

  it("still walks every font in order (word 0 over 13 calm bars)", () => {
    const wave = createFaceWave(WORDS);
    const seen: string[] = [];
    for (let bar = 1; bar <= CYCLE_FONTS.length; bar++) {
      advanceFaces(wave, downbeat(2 * bar));
      seen.push(letterFace(wave, 2 * bar, 0, 0));
    }
    expect(seen).toEqual([...CYCLE_FONTS]);
  });

  it("gives neighbouring letters different fonts on each beat of a drop", () => {
    const wave = createFaceWave(WORDS);
    advanceFaces(wave, beat(1, { sectionLevel: 1 }));
    const now = faces(wave, 1).filter((_, i) => WORDS[i] >= 0);
    now.slice(1).forEach((family, i) => expect(family).not.toBe(now[i]));
    expect(new Set(now).size).toBeGreaterThanOrEqual(10);
  });

  it("hits drops in Doto and returns to Golos across the whole name", () => {
    const wave = createFaceWave(WORDS);
    advanceFaces(wave, downbeat(4, { sectionLevel: 1, sectionChanged: true }));
    expect(new Set(faces(wave, 4))).toEqual(new Set([DOTO]));
    advanceFaces(wave, downbeat(8, { sectionChanged: true }));
    expect(new Set(faces(wave, 8))).toEqual(new Set([GOLOS]));
  });

  it("steps only on downbeats while calm (an off-beat leaves the face unchanged)", () => {
    const wave = createFaceWave([0]);
    advanceFaces(wave, beat(1.5));
    expect(letterFace(wave, 1.5, 0, 0)).toBe(GOLOS);
    advanceFaces(wave, downbeat(2));
    expect(letterFace(wave, 2, 0, 0)).toBe(CYCLE_FONTS[0]);
  });

  it("steps on every beat in a drop", () => {
    const wave = createFaceWave([0]);
    advanceFaces(wave, beat(1, { sectionLevel: 1 }));
    advanceFaces(wave, beat(1.4, { sectionLevel: 1 }));
    expect(letterFace(wave, 1.4, 0, 0)).toBe(CYCLE_FONTS[1]);
  });

  it("sweeps each change outward from the head", () => {
    const wave = createFaceWave([0]);
    advanceFaces(wave, downbeat(10));
    const far = 440;
    expect(letterFace(wave, 10, 0, 0)).toBe(CYCLE_FONTS[0]);
    expect(letterFace(wave, 10, far, 0)).toBe(GOLOS);
    expect(letterFace(wave, 10 + far / SHOCKWAVE_SPEED + 0.01, far, 0)).toBe(CYCLE_FONTS[0]);
  });

  it("lets a new wave start before the last one reaches the far letters", () => {
    const wave = createFaceWave([0]);
    advanceFaces(wave, beat(10, { sectionLevel: 1 }));
    advanceFaces(wave, beat(10.3, { sectionLevel: 1 }));
    expect(letterFace(wave, 10.3, 0, 0)).toBe(CYCLE_FONTS[1]);
    expect(letterFace(wave, 10.3, 440, 0)).toBe(CYCLE_FONTS[0]);
    expect(letterFace(wave, 10.3, 1000, 0)).toBe(GOLOS);
  });

  it("doesn't change while paused", () => {
    const wave = createFaceWave([0]);
    advanceFaces(wave, downbeat(2, { isPlaying: false }));
    expect(letterFace(wave, 2, 0, 0)).toBe(GOLOS);
  });

  it("shows the latest assignment everywhere when time goes backwards (next track, seek back)", () => {
    const wave = createFaceWave(WORDS);
    advanceFaces(wave, downbeat(120));
    advanceFaces(wave, frame(0.5));
    expect(letterFace(wave, 0.5, 1000, 0)).toBe(CYCLE_FONTS[0]);
    expect(letterFace(wave, 0.5, 1000, 10)).toBe(CYCLE_FONTS[10]);
    advanceFaces(wave, downbeat(2));
    expect(letterFace(wave, 2, 0, 0)).toBe(CYCLE_FONTS[1]);
  });
});

describe("fitScale", () => {
  it("sizes a face to the name's Golos width, within limits", () => {
    expect(fitScale(1000, 1250)).toBeCloseTo(0.8);
    expect(fitScale(1000, 900)).toBeCloseTo(1.111, 3);
    expect(fitScale(1000, 400)).toBe(1.15);
    expect(fitScale(1000, 5000)).toBe(0.5);
    expect(fitScale(1000, 0)).toBe(1);
  });
});
