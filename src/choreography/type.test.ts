import { describe, expect, it } from "vitest";

import {
  eqVariation,
  eqWeight,
  headerVariation,
  jamHeaderVariation,
  headerWeight,
  idleScanWeight,
  KickHistory,
  quantise,
  SHOCKWAVE_SPEED,
  vuStep,
} from "./type";

describe("KickHistory", () => {
  it("returns the latest value at or before a time", () => {
    const kicks = new KickHistory(4);
    kicks.push(1, 0.5);
    kicks.push(2, 0.8);
    expect(kicks.at(0.5)).toBe(0);
    expect(kicks.at(1.5)).toBe(0.5);
    expect(kicks.at(2.5)).toBeCloseTo(0.8);
  });

  it("keeps only entries within its span", () => {
    const kicks = new KickHistory(1, 0.5);
    kicks.push(1, 0.1);
    kicks.push(2, 0.2);
    kicks.push(3, 0.3);
    expect(kicks.at(1.5)).toBe(0);
    expect(kicks.at(2.5)).toBeCloseTo(0.2);
  });

  it("covers its whole time span on a 240 Hz display (outer letters still pulse)", () => {
    const kicks = new KickHistory();
    for (let i = 0; i <= 240; i++) kicks.push(i / 240, 1);
    expect(kicks.at(1 - 800 / SHOCKWAVE_SPEED)).toBe(1);
  });

  it("forgets everything after a forward jump longer than its span (hidden tab, seek)", () => {
    const kicks = new KickHistory();
    kicks.push(1, 1);
    kicks.push(10, 0.5);
    expect(kicks.at(9.9)).toBe(0);
    expect(kicks.at(10)).toBeCloseTo(0.5);
  });

  it("push with an earlier time resets the history (seek backwards)", () => {
    const kicks = new KickHistory(8);
    kicks.push(10, 1);
    kicks.push(4, 0.25);
    expect(kicks.at(9)).toBeCloseTo(0.25);
    expect(kicks.at(3)).toBe(0);
  });
});

describe("weights", () => {
  it("drives the header weight from section, energy and kick, capped at 900", () => {
    expect(headerWeight(0, 0, 0)).toBe(600);
    expect(headerWeight(0, 0, 1)).toBe(750);
    expect(headerWeight(1, 1, 1)).toBe(900);
  });

  it("maps EQ levels to Doto weight and quantises", () => {
    expect(eqWeight(0)).toBe(100);
    expect(eqWeight(1)).toBe(900);
    expect(quantise(733, 10)).toBe(730);
  });

  it("attacks faster than it releases", () => {
    const up = vuStep(0, 1, 0.015);
    const down = 1 - vuStep(1, 0, 0.015);
    expect(up).toBeCloseTo(1 - Math.exp(-1));
    expect(up).toBeGreaterThan(down);
  });

  it("idle scan stays within 200–700", () => {
    for (let t = 0; t < 8; t += 0.1) {
      for (let line = 0; line < 6; line++) {
        const w = idleScanWeight(t, line);
        expect(w).toBeGreaterThanOrEqual(200);
        expect(w).toBeLessThanOrEqual(700);
      }
    }
  });
});

describe("font variation strings", () => {
  // Every distinct variation value re-rasterises 6–12rem glyphs; step 10 dropped 27% of frames at 120 Hz.
  it("limits the EQ lines to 9 weights and 5 roundness steps", () => {
    const weights = new Set<string>();
    const ronds = new Set<string>();
    for (let level = 0; level <= 1; level += 0.001) {
      for (let section = 0; section <= 1; section += 0.05) {
        const [, wght, rond] = eqVariation(level, section).match(/"wght" (\d+), "ROND" (\d+)/) ?? [];
        weights.add(wght);
        ronds.add(rond);
      }
    }
    expect(weights.size).toBeLessThanOrEqual(9);
    expect(ronds.size).toBeLessThanOrEqual(5);
  });

  it("jams the header between 700 and 900 in steps of 50", () => {
    expect(jamHeaderVariation(0)).toBe('"wght" 700');
    expect(jamHeaderVariation(0.3)).toBe('"wght" 750');
    expect(jamHeaderVariation(1)).toBe('"wght" 900');
  });

  it("limits the header to 7 weights between 600 and 900", () => {
    const values = new Set<string>();
    for (let kick = 0; kick <= 1; kick += 0.01) {
      for (let energy = 0; energy <= 1; energy += 0.1) values.add(headerVariation(1, energy, kick));
    }
    expect(values.size).toBeLessThanOrEqual(7);
    expect(headerVariation(0, 0, 0)).toBe('"wght" 600');
    expect(headerVariation(1, 1, 1)).toBe('"wght" 900');
  });
});
