import { describe, expect, it } from "vitest";

import { iconPose, kickDelay, SHIMMER_STAGGER } from "./pose";
import { SHOCKWAVE_SPEED } from "../../choreography/type";

import type { PoseInput } from "./pose";

const pose = (overrides: Partial<PoseInput>) =>
  iconPose({ kick: 0, leanX: 0, leanY: 0, touch: false, reduced: false, crisp: false, ...overrides });
const scaleOf = (transform: string) => Number(/scale\(([\d.]+)\)/.exec(transform)?.[1]);
const translateOf = (transform: string) => /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(transform)?.slice(1).map(Number);

describe("iconPose", () => {
  it("rests still: no lean, no scale, dimmed dots, solid glyph left to CSS", () => {
    const rest = pose({});
    expect(translateOf(rest.transform)).toEqual([0, 0]);
    expect(scaleOf(rest.transform)).toBe(1);
    expect(Number(rest.rest)).toBeGreaterThan(0.5);
    expect(Number(rest.rest)).toBeLessThan(1);
    expect(rest.solid).toBe("1");
  });

  it("writes identical strings for float noise around rest, so setStyle skips the write", () => {
    expect(pose({ leanX: 1e-4, leanY: -1e-4, kick: 1e-4 })).toEqual(pose({}));
  });

  it("swells 3–6% and brightens the dots on a full kick", () => {
    const kicked = pose({ kick: 1 });
    expect(scaleOf(kicked.transform)).toBeGreaterThanOrEqual(1.03);
    expect(scaleOf(kicked.transform)).toBeLessThanOrEqual(1.06);
    expect(Number(kicked.rest)).toBeGreaterThan(Number(pose({}).rest));
    expect(Number(kicked.rest)).toBeLessThanOrEqual(1);
  });

  it("carries the magnet lean", () => {
    expect(translateOf(pose({ leanX: 3.2, leanY: -1.5 }).transform)).toEqual([3.2, -1.5]);
  });

  it("on a low-density screen keeps dots on whole pixels: lean snapped, kick pulses brightness only", () => {
    const kicked = pose({ crisp: true, kick: 1, leanX: 3.4, leanY: -1.6 });
    expect(translateOf(kicked.transform)).toEqual([3, -2]);
    expect(scaleOf(kicked.transform)).toBe(1);
    expect(Number(kicked.rest)).toBeGreaterThan(Number(pose({ crisp: true }).rest));
  });

  it("on touch rests resolved: no dots, full glyph", () => {
    const rest = pose({ touch: true });
    expect(rest.rest).toBe("0");
    expect(rest.solid).toBe("1");
  });

  it("on touch shimmers on the kick: dots flash over a dimmed glyph that stays legible", () => {
    const kicked = pose({ touch: true, kick: 1 });
    expect(Number(kicked.rest)).toBeGreaterThan(0.5);
    expect(Number(kicked.solid)).toBeLessThan(1);
    expect(Number(kicked.solid)).toBeGreaterThanOrEqual(0.5);
  });

  it("on touch ignores any lean", () => {
    expect(pose({ touch: true, leanX: 4, leanY: 4 }).transform).toBe(pose({ touch: true }).transform);
  });

  it("with reduced motion never moves or pulses, on either kind of device", () => {
    for (const touch of [false, true]) {
      const still = pose({ touch, reduced: true });
      const kicked = pose({ touch, reduced: true, kick: 1, leanX: 4, leanY: -4 });
      expect(kicked).toEqual(still);
      expect(still.transform).toBe("none");
    }
    expect(pose({ touch: true, reduced: true }).rest).toBe("0");
  });
});

describe("kickDelay", () => {
  it("arrives from the head at the shockwave speed", () => {
    expect(kickDelay(SHOCKWAVE_SPEED, 0, false)).toBeCloseTo(1, 10);
    expect(kickDelay(440, 3, false)).toBeCloseTo(440 / SHOCKWAVE_SPEED, 10);
  });

  it("on touch also ripples left to right across the row", () => {
    expect(kickDelay(440, 3, true) - kickDelay(440, 2, true)).toBeCloseTo(SHIMMER_STAGGER, 10);
    expect(SHIMMER_STAGGER).toBeGreaterThan(0);
  });
});
