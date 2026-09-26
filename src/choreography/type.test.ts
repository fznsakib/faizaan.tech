import { describe, expect, it } from "vitest";

import {
  createFlipState,
  eqVariation,
  eqWeight,
  headerVariation,
  headerWeight,
  idleScanWeight,
  KickHistory,
  letterFlipped,
  quantise,
  updateFlip,
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

  it("keeps only the most recent entries", () => {
    const kicks = new KickHistory(2);
    kicks.push(1, 0.1);
    kicks.push(2, 0.2);
    kicks.push(3, 0.3);
    expect(kicks.at(1.5)).toBe(0);
    expect(kicks.at(2.5)).toBeCloseTo(0.2);
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

describe("drop flip", () => {
  it("animates outward from the head when a section change fires", () => {
    const state = createFlipState();
    updateFlip(state, 1, true, 10);
    expect(letterFlipped(state, 10, 0)).toBe(true);
    expect(letterFlipped(state, 10, 440)).toBe(false);
    expect(letterFlipped(state, 10.21, 440)).toBe(true);
  });

  it("snaps without an edge (seek, track switch)", () => {
    const state = createFlipState();
    updateFlip(state, 1, false, 50);
    expect(letterFlipped(state, 50, 1000)).toBe(true);
  });

  it("flips back outward when the section calms", () => {
    const state = createFlipState();
    updateFlip(state, 1, true, 10);
    updateFlip(state, 0, true, 20);
    expect(letterFlipped(state, 20, 440)).toBe(true);
    expect(letterFlipped(state, 20.21, 440)).toBe(false);
  });

  it("forgets an old change when time goes backwards (next track, seek back)", () => {
    const state = createFlipState();
    updateFlip(state, 1, true, 21.3);
    updateFlip(state, 0, true, 112.59);
    updateFlip(state, 0, false, 0.5);
    expect(letterFlipped(state, 0.5, 20)).toBe(false);
    updateFlip(state, 1, false, 30);
    expect(letterFlipped(state, 30, 20)).toBe(true);
  });

  it("ignores updates that don't change the level", () => {
    const state = createFlipState();
    updateFlip(state, 1, true, 10);
    updateFlip(state, 1, false, 11);
    expect(state.changedAt).toBe(10);
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
