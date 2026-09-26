import { describe, expect, it } from "vitest";

import { advanceFaces, createFaceWave, CYCLE_FONTS, DOTO, fitScale, GOLOS, letterFace } from "./faces";
import { SHOCKWAVE_SPEED } from "./type";

import type { FaceFrame } from "./faces";

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

  it("starts in Golos and steps to the next font on each calm downbeat, cycling through them all", () => {
    const wave = createFaceWave();
    expect(letterFace(wave, 0, 0)).toBe(GOLOS);
    const seen: string[] = [];
    for (let bar = 0; bar < CYCLE_FONTS.length + 1; bar++) {
      const time = 2 * bar;
      advanceFaces(wave, beat(time - 0.5)); // an off-beat: no change while calm
      advanceFaces(wave, downbeat(time));
      seen.push(letterFace(wave, time, 0));
    }
    expect(seen).toEqual([...CYCLE_FONTS, CYCLE_FONTS[0]]);
  });

  it("steps on every beat in a drop", () => {
    const wave = createFaceWave();
    advanceFaces(wave, beat(1, { sectionLevel: 1 }));
    advanceFaces(wave, beat(1.4, { sectionLevel: 1 }));
    expect(letterFace(wave, 1.4, 0)).toBe(CYCLE_FONTS[1]);
  });

  it("hits drops in Doto and returns to Golos when they end, without losing its place in the cycle", () => {
    const wave = createFaceWave();
    advanceFaces(wave, downbeat(2));
    advanceFaces(wave, downbeat(4, { sectionLevel: 1, sectionChanged: true }));
    expect(letterFace(wave, 4, 0)).toBe(DOTO);
    advanceFaces(wave, beat(4.4, { sectionLevel: 1 }));
    expect(letterFace(wave, 4.4, 0)).toBe(CYCLE_FONTS[1]);
    advanceFaces(wave, downbeat(8, { sectionChanged: true }));
    expect(letterFace(wave, 8, 0)).toBe(GOLOS);
    advanceFaces(wave, downbeat(10));
    expect(letterFace(wave, 10, 0)).toBe(CYCLE_FONTS[2]);
  });

  it("sweeps each change outward from the head", () => {
    const wave = createFaceWave();
    advanceFaces(wave, downbeat(10));
    const far = 440;
    expect(letterFace(wave, 10, 0)).toBe(CYCLE_FONTS[0]);
    expect(letterFace(wave, 10, far)).toBe(GOLOS);
    expect(letterFace(wave, 10 + far / SHOCKWAVE_SPEED + 0.01, far)).toBe(CYCLE_FONTS[0]);
  });

  it("lets a new wave start before the last one reaches the far letters", () => {
    const wave = createFaceWave();
    advanceFaces(wave, beat(10, { sectionLevel: 1 }));
    advanceFaces(wave, beat(10.3, { sectionLevel: 1 }));
    expect(letterFace(wave, 10.3, 0)).toBe(CYCLE_FONTS[1]);
    expect(letterFace(wave, 10.3, 440)).toBe(CYCLE_FONTS[0]);
    expect(letterFace(wave, 10.3, 1000)).toBe(GOLOS);
  });

  it("doesn't change while paused", () => {
    const wave = createFaceWave();
    advanceFaces(wave, downbeat(2, { isPlaying: false }));
    expect(letterFace(wave, 2, 0)).toBe(GOLOS);
  });

  it("shows the latest face everywhere when time goes backwards (next track, seek back)", () => {
    const wave = createFaceWave();
    advanceFaces(wave, downbeat(120));
    advanceFaces(wave, frame(0.5));
    expect(letterFace(wave, 0.5, 1000)).toBe(CYCLE_FONTS[0]);
    advanceFaces(wave, downbeat(2));
    expect(letterFace(wave, 2, 0)).toBe(CYCLE_FONTS[1]);
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
