import { describe, expect, it } from "vitest";

import { BandNormaliser } from "./bands";

/** Feed `seconds` of a dB signal sampled at `hz`; returns [time, level] pairs. */
function run(normaliser: BandNormaliser, signal: (t: number) => number, seconds: number, hz: number, from = 0) {
  const out: [number, number][] = [];
  for (let i = 1; i <= seconds * hz; i++) {
    const t = from + i / hz;
    out.push([t, normaliser.update(signal(t), 1 / hz)]);
  }
  return out;
}

const loud = (t: number) => -8 + 4 * Math.sin(2 * Math.PI * 2 * t); // a loud passage: −12 … −4 dB, 2 Hz

describe("BandNormaliser", () => {
  it("keeps moving through a loud passage instead of pinning at 1", () => {
    const levels = run(new BandNormaliser(), loud, 10, 120).slice(-600).map(([, level]) => level);
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.5);
    expect(levels.filter((level) => level >= 0.999).length / levels.length).toBeLessThan(0.15);
  });

  it("is frame-rate independent", () => {
    const at60 = run(new BandNormaliser(), loud, 10, 60).at(-1)![1];
    const at120 = run(new BandNormaliser(), loud, 10, 120).at(-1)![1];
    expect(Math.abs(at60 - at120)).toBeLessThan(0.05);
  });

  it("reaches the top within 100 ms when a quiet intro drops into a loud section", () => {
    const normaliser = new BandNormaliser();
    run(normaliser, () => -60, 5, 120);
    const after = run(normaliser, () => -20, 0.1, 120, 5);
    expect(after.at(-1)![1]).toBeGreaterThan(0.9);
  });

  it("is 0 for silence", () => {
    const normaliser = new BandNormaliser();
    expect(normaliser.update(-Infinity, 1 / 120)).toBe(0);
    expect(normaliser.update(-140, 1 / 120)).toBe(0);
  });

  it("keeps moving in the first 2 s after a quiet-to-loud jump, not just after the floor catches up", () => {
    const normaliser = new BandNormaliser();
    run(normaliser, () => -60, 5, 120);
    const levels = run(normaliser, loud, 2, 120, 5).map(([, level]) => level);
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.3);
  });
});
