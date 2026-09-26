import { describe, expect, it } from "vitest";

import { approach, MAGNET_RADIUS, magnetLean, MAX_LEAN } from "./magnet";

const length = ({ x, y }: { x: number; y: number }) => Math.hypot(x, y);

describe("magnetLean", () => {
  it("is zero with the pointer dead centre", () => {
    expect(length(magnetLean(0, 0))).toBe(0);
  });

  it("is zero at and beyond the radius", () => {
    expect(length(magnetLean(MAGNET_RADIUS, 0))).toBe(0);
    expect(length(magnetLean(0, -MAGNET_RADIUS * 3))).toBe(0);
    expect(length(magnetLean(500, 500))).toBe(0);
  });

  it("leans toward the pointer", () => {
    const lean = magnetLean(12, -9);
    expect(lean.x).toBeGreaterThan(0);
    expect(lean.y).toBeLessThan(0);
    expect(lean.y / lean.x).toBeCloseTo(-9 / 12, 5);
  });

  it("never leans further than MAX_LEAN, which is at most 6 px", () => {
    expect(MAX_LEAN).toBeLessThanOrEqual(6);
    for (let d = 0; d <= MAGNET_RADIUS * 1.5; d += 0.5) {
      expect(length(magnetLean(d, 0))).toBeLessThanOrEqual(MAX_LEAN + 1e-9);
      expect(length(magnetLean(d * 0.6, d * 0.8))).toBeLessThanOrEqual(MAX_LEAN + 1e-9);
    }
  });

  it("fades out smoothly toward the radius (no jump when the pointer leaves the field)", () => {
    let previous = length(magnetLean(0, 0));
    let biggestStep = 0;
    for (let d = 0.25; d <= MAGNET_RADIUS; d += 0.25) {
      const current = length(magnetLean(d, 0));
      biggestStep = Math.max(biggestStep, Math.abs(current - previous));
      previous = current;
    }
    expect(biggestStep).toBeLessThan(0.3);
    expect(length(magnetLean(MAGNET_RADIUS - 0.5, 0))).toBeLessThan(0.05);
  });

  it("pulls a neighbour (one icon over) far less than the icon under the pointer", () => {
    const under = length(magnetLean(16, 0));
    const neighbour = length(magnetLean(52, 0));
    expect(neighbour).toBeLessThan(under / 2);
  });

  it("keeps the hovered icon distinct with the pointer near its edge (icons 52 px apart)", () => {
    const under = length(magnetLean(14, 0));
    const neighbour = length(magnetLean(14 - 52, 0));
    expect(neighbour).toBeLessThan(under / 3);
  });
});

describe("approach", () => {
  it("stays put with no time elapsed", () => {
    expect(approach(2, 10, 0, 20)).toBe(2);
  });

  it("moves part of the way toward the target without overshooting", () => {
    const next = approach(0, 10, 1 / 60, 20);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(10);
  });

  it("gets there after a long gap", () => {
    expect(approach(0, 10, 1, 20)).toBeCloseTo(10, 5);
  });

  it("is frame-rate independent: two half steps equal one full step", () => {
    const half = approach(approach(0, 10, 1 / 120, 20), 10, 1 / 120, 20);
    expect(half).toBeCloseTo(approach(0, 10, 1 / 60, 20), 10);
  });
});
