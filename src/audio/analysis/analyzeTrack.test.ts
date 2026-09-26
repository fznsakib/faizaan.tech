import { describe, expect, it } from "vitest";

import { analyzeTrack, WINDOW_SIZE } from "./analyzeTrack.ts";

/** A deterministic click track: decaying 60 Hz thump + noise burst on every beat. */
function clickTrack(bpm: number, firstBeat: number, seconds: number, sampleRate: number) {
  const pcm = new Float32Array(Math.round(seconds * sampleRate));
  const period = 60 / bpm;
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 1073741824 - 1;
  };
  for (let t = firstBeat; t < seconds; t += period) {
    const start = Math.round(t * sampleRate);
    for (let i = 0; i < sampleRate * 0.08 && start + i < pcm.length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.015));
      pcm[start + i] +=
        decay * (0.8 * Math.sin((2 * Math.PI * 60 * i) / sampleRate) + 0.2 * noise());
    }
  }
  return pcm;
}

describe("analyzeTrack", () => {
  // 44.1 kHz like the real tracks: the 2048-sample window is 46 ms, so the flux peak lands
  // ≤ ~40 ms before the click and the +13 ms shift brings it inside the 50 ms tolerance.
  const sampleRate = 44100;
  const analysis = analyzeTrack(clickTrack(120, 0.25, 20, sampleRate), sampleRate);

  it("finds the tempo", () => {
    expect(Math.abs(analysis.bpm - 120)).toBeLessThanOrEqual(0.1);
  });

  it("finds the beat phase (after the default +13 ms shift) within 50 ms", () => {
    const period = 60 / analysis.bpm;
    const raw = analysis.phase + 0.013 - 0.25;
    const offset = ((raw % period) + period * 1.5) % period - period / 2;
    expect(Math.abs(offset)).toBeLessThan(0.05);
  });

  it("reports frame timing and per-band envelopes", () => {
    expect(analysis.duration).toBeCloseTo(20);
    expect(analysis.onsetFps).toBeCloseTo(sampleRate / Math.round(sampleRate / 100));
    expect(analysis.frameOffset).toBeCloseTo(WINDOW_SIZE / 2 / sampleRate);
    expect(analysis.env.kick.length).toBe(analysis.loudness.length);
    expect(Math.max(...analysis.env.kick)).toBeGreaterThan(0);
    expect(analysis.downbeatMod).toBeGreaterThanOrEqual(0);
    expect(analysis.downbeatMod).toBeLessThan(4);
  });

  it("handles audio shorter than one window", () => {
    const short = analyzeTrack(new Float32Array(100), 44100);
    expect(short.loudness.length).toBe(0);
    expect(short.downbeatMod).toBe(0);
  });
});
