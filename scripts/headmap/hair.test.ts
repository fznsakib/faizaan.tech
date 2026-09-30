import { describe, expect, it } from "vitest";

import { hairlineHeight, scalpPrior } from "./hair.ts";

import type { Scalp } from "./hair.ts";

// A head centred on the y axis, face toward +z: the hairline at 15 in front, 11 over the ears, 7 at the nape.
const scalp: Scalp = {
  centre: [0, 0, 0],
  front: 15,
  side: 11,
  back: 7,
  band: 0.5,
  ears: [{ centre: [-6, 9, 0], radius: 3 }, { centre: [6, 9, 0], radius: 3 }],
};

describe("hairlineHeight", () => {
  it("is the front height ahead, the side height at the ears and the nape height behind", () => {
    expect(hairlineHeight(scalp, 0, 5)).toBeCloseTo(15);
    expect(hairlineHeight(scalp, 5, 0)).toBeCloseTo(11);
    expect(hairlineHeight(scalp, -5, 0)).toBeCloseTo(11);
    expect(hairlineHeight(scalp, 0, -5)).toBeCloseTo(7);
  });

  it("changes smoothly around the head", () => {
    let last = hairlineHeight(scalp, 0, 1);
    for (let a = 0.01; a <= Math.PI; a += 0.01) {
      const h = hairlineHeight(scalp, Math.sin(a), Math.cos(a));
      expect(Math.abs(h - last)).toBeLessThan(0.2);
      last = h;
    }
  });
});

describe("scalpPrior", () => {
  it("is hair high on the back and crown, skin on the neck and face", () => {
    expect(scalpPrior(scalp, [0, 12, -5])).toBe(1);
    expect(scalpPrior(scalp, [0, 19, 0])).toBe(1);
    expect(scalpPrior(scalp, [0, 4, -4])).toBe(0);
    expect(scalpPrior(scalp, [0, 10, 6])).toBe(0);
  });

  it("keeps the ears bare, even above the side hairline", () => {
    expect(scalpPrior(scalp, [6, 11.8, 0])).toBe(0);
    expect(scalpPrior(scalp, [5, 13, 0])).toBe(1);
  });

  it("feathers across the hairline", () => {
    const mid = scalpPrior(scalp, [0, 7, -5]);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });
});
