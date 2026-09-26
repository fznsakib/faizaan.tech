import { describe, expect, it } from "vitest";

import { BAR_FALL, PEAK_FALL, PEAK_HOLD, stepBars, stepPeaks } from "./analyser";

/** Hit `first`, then run `seconds` of silent frames at `hz`; returns the final peaks. */
function runPeaks(hz: number, seconds: number, first: number[]) {
  const peaks = new Float32Array(first.length);
  const holds = new Float32Array(first.length);
  const silence = new Float32Array(first.length);
  stepPeaks(Float32Array.from(first), peaks, holds, 1 / hz);
  for (let i = 0; i < Math.round(hz * seconds); i++) stepPeaks(silence, peaks, holds, 1 / hz);
  return peaks;
}

describe("stepPeaks", () => {
  it("jumps a cap up to a louder bar at once", () => {
    const peaks = new Float32Array([0.2, 0.9]);
    const holds = new Float32Array(2);
    stepPeaks(Float32Array.from([0.8, 0.5]), peaks, holds, 1 / 60);
    expect(peaks[0]).toBeCloseTo(0.8);
    expect(peaks[1]).toBeLessThanOrEqual(0.9);
    expect(peaks[1]).toBeGreaterThan(0.5);
  });

  it("holds a cap, then lets it fall at a constant rate", () => {
    const held = runPeaks(60, PEAK_HOLD - 0.02, [1]);
    expect(held[0]).toBeCloseTo(1, 5);
    const fallen = runPeaks(60, PEAK_HOLD + 0.5, [1]);
    expect(fallen[0]).toBeCloseTo(1 - PEAK_FALL * 0.5, 5);
  });

  it("never lets a cap fall below zero", () => {
    expect(runPeaks(60, 5, [0.5])[0]).toBe(0);
  });

  it("falls the same distance at 60 Hz and 120 Hz", () => {
    const at60 = runPeaks(60, 0.75, [1, 0.6]);
    const at120 = runPeaks(120, 0.75, [1, 0.6]);
    expect(at60[0]).toBeLessThan(1);
    expect(at120[0]).toBeCloseTo(at60[0], 5);
    expect(at120[1]).toBeCloseTo(at60[1], 5);
  });
});

describe("stepBars", () => {
  it("rises at once and falls at a steady rate, frame-rate independent", () => {
    const shown = new Float32Array([0.1]);
    stepBars(Float32Array.from([0.9]), shown, 1 / 60);
    expect(shown[0]).toBeCloseTo(0.9);
    const at60 = Float32Array.from([1]);
    const at120 = Float32Array.from([1]);
    const zero = new Float32Array(1);
    for (let i = 0; i < 6; i++) stepBars(zero, at60, 1 / 60);
    for (let i = 0; i < 12; i++) stepBars(zero, at120, 1 / 120);
    expect(at60[0]).toBeCloseTo(1 - BAR_FALL * 0.1, 5);
    expect(at120[0]).toBeCloseTo(at60[0], 5);
  });

  it("stops at the live level rather than falling through it", () => {
    const shown = Float32Array.from([1]);
    stepBars(Float32Array.from([0.95]), shown, 1);
    expect(shown[0]).toBeCloseTo(0.95);
  });
});
