import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { decodeWithAfconvert } from "./decode.ts";
import { analyzeTrack, gridConfidence } from "../src/audio/analysis/analyzeTrack.ts";
import { buildBeatMap } from "../src/audio/analysis/buildBeatMap.ts";

import type { BeatMapOverrides } from "../src/audio/analysis/buildBeatMap.ts";
import type { BeatMap } from "../src/audio/types.ts";

const path = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const overrides: Record<string, BeatMapOverrides> = JSON.parse(
  readFileSync(path("src/audio/beatmaps/overrides.json"), "utf8")
);

/** Ground truth from the 2026-09-25 investigation (spectral flux + DP tracker + epoch averaging). */
const REFERENCE = [
  { id: "empty-lightning", bpm: 113.01, beat0: 0.03, downbeatMod: 0 },
  { id: "etaki", bpm: 149.98, beat0: 0.385, downbeatMod: 3 },
];

describe.skipIf(process.platform !== "darwin")("beat maps for the bundled tracks", () => {
  for (const ref of REFERENCE) {
    it(`${ref.id} matches ground truth and the committed map`, () => {
      const { pcm, sampleRate } = decodeWithAfconvert(path(`src/assets/audio/${ref.id}.mp3`));
      const analysis = analyzeTrack(pcm, sampleRate);
      const map = buildBeatMap(ref.id, analysis, overrides[ref.id]);
      expect(Math.abs(analysis.bpm - ref.bpm)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(map.beat0 - ref.beat0)).toBeLessThanOrEqual(0.01);
      expect(map.downbeatMod).toBe(ref.downbeatMod);
      expect(gridConfidence(analysis)).toBeGreaterThanOrEqual(0.8);

      const committed: BeatMap = JSON.parse(readFileSync(path(`src/audio/beatmaps/${ref.id}.json`), "utf8"));
      expect(committed).toMatchObject({ bpm: map.bpm, beat0: map.beat0, downbeatMod: map.downbeatMod });
    }, 180_000);
  }
});

describe.skipIf(process.platform !== "darwin")("30 s clips", () => {
  it("does not lock a confident 3:2 tempo error (etaki from 25 s)", () => {
    const { pcm, sampleRate } = decodeWithAfconvert(path("src/assets/audio/etaki.mp3"));
    const clip = pcm.slice(25 * sampleRate, 55 * sampleRate);
    const analysis = analyzeTrack(clip, sampleRate);
    const confidence = gridConfidence(analysis);
    const octave = [150, 75].some((bpm) => Math.abs(analysis.bpm - bpm) <= 0.5);
    expect(octave || confidence <= 0.5, `bpm ${analysis.bpm} at confidence ${confidence}`).toBe(true);
  }, 180_000);
});
