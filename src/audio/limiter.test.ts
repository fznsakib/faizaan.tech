import { describe, expect, it } from "vitest";

import { CLIP_RANGE, softClipCurve } from "./limiter";

/** Output of the clipper for input sample `x` (the shaper sees x / CLIP_RANGE mapped over the curve). */
function through(curve: Float32Array, x: number): number {
  const u = Math.max(-1, Math.min(1, x / CLIP_RANGE));
  const position = ((u + 1) / 2) * (curve.length - 1);
  const i = Math.floor(position);
  const frac = position - i;
  return curve[i] + (curve[Math.min(i + 1, curve.length - 1)] - curve[i]) * frac;
}

describe("softClipCurve", () => {
  const curve = softClipCurve();

  it("is transparent up to ±0.9", () => {
    for (const x of [-0.9, -0.5, 0, 0.3, 0.75, 0.9]) expect(through(curve, x)).toBeCloseTo(x, 3);
  });

  it("never exceeds ±1, even for a kick stacked on a full-scale song", () => {
    expect(through(curve, 1.53)).toBeLessThanOrEqual(1);
    expect(through(curve, 1.53)).toBeGreaterThan(0.99);
    expect(through(curve, -2)).toBeGreaterThanOrEqual(-1);
  });

  it("is monotonic", () => {
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
  });
});
