import { describe, expect, it } from "vitest";

import { buildBeatMap, DEFAULT_BEAT0_SHIFT } from "./buildBeatMap.ts";

import type { Analysis } from "./analyzeTrack.ts";

/** 20 s at 100 fps: quiet first half, loud second half, a kick spike every 0.5 s from 0.1 s. */
function syntheticAnalysis(): Analysis {
  const frames = 2000;
  const loudness = new Float32Array(frames);
  for (let i = 0; i < frames; i++) loudness[i] = i < 1000 ? 1 : 5;
  const kick = new Float32Array(frames);
  for (let i = 10; i < frames - 1; i += 50) kick[i] = 1;
  kick[65] = 0.9; // 0.15 s after the spike at frame 60 → inside the 0.2 s kick min gap
  return {
    sampleRate: 44100,
    duration: 20,
    onsetFps: 100,
    frameOffset: 0.0232,
    bpm: 120,
    phase: 0.1,
    downbeatMod: 2,
    loudness,
    env: {
      kick,
      snare: new Float32Array(frames),
      hat: new Float32Array(frames),
      full: new Float32Array(frames),
    },
  };
}

describe("buildBeatMap", () => {
  it("applies the default beat0 shift and keeps the analysis tempo and downbeat", () => {
    const map = buildBeatMap("t", syntheticAnalysis());
    expect(map).toMatchObject({ id: "t", version: 1, bpm: 120, downbeatMod: 2, beatsPerBar: 4, confidence: 1, curveFps: 10 });
    expect(map.beat0).toBeCloseTo(0.1 + DEFAULT_BEAT0_SHIFT, 4);
  });

  it("applies overrides", () => {
    const map = buildBeatMap("t", syntheticAnalysis(), { beat0Shift: 0, downbeatMod: 1, bpm: 121 });
    expect(map.beat0).toBeCloseTo(0.1, 4);
    expect(map.downbeatMod).toBe(1);
    expect(map.bpm).toBe(121);
  });

  it("peak-picks onsets at frame centres and respects the minimum gap", () => {
    const { onsets } = buildBeatMap("t", syntheticAnalysis());
    expect(onsets.kick.length / 2).toBe(40);
    expect(onsets.kick[0]).toBeCloseTo(0.1232, 3);
    expect(onsets.kick[1]).toBe(1);
    expect(onsets.kick[2]).toBeCloseTo(0.6232, 3);
    expect(onsets.kick[4]).toBeCloseTo(1.1232, 3);
    expect(onsets.snare).toEqual([]);
  });

  it("normalises energy to 0..255 at 10 fps", () => {
    const { energy } = buildBeatMap("t", syntheticAnalysis());
    expect(energy).toHaveLength(200);
    expect(energy[0]).toBe(0);
    expect(energy[199]).toBe(255);
  });

  it("derives bar levels with hysteresis: calm first, intense after the change, no flapping", () => {
    const { barLevels, section } = buildBeatMap("t", syntheticAnalysis());
    expect(section).toHaveLength(200);
    expect(barLevels).toHaveLength(10);
    expect(barLevels[0]).toBe(0);
    expect(barLevels[barLevels.length - 1]).toBe(1);
    const firstIntense = barLevels.indexOf(1);
    expect(barLevels.slice(firstIntense).every((level) => level === 1)).toBe(true);
  });
});
