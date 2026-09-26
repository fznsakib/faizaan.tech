import { describe, expect, it } from "vitest";

import { blurHeightField, sampleBilinear } from "./heightfield.ts";

describe("blurHeightField", () => {
  it("leaves a plane unchanged away from holes and edges, and nearly so next to a hole", () => {
    const w = 24, h = 24;
    const values = new Float32Array(w * h).map((_, i) => 2 + 0.5 * (i % w));
    const mask = new Uint8Array(w * h).fill(1);
    for (let x = 0; x < 6; x++) mask[12 * w + x] = 0; // a gap
    const out = blurHeightField(values, mask, w, h, 1.5);
    expect(out[6 * w + 14]).toBeCloseTo(values[6 * w + 14], 5);
    expect(Math.abs(out[11 * w + 7] - values[11 * w + 7])).toBeLessThan(0.05);
  });

  it("softens a step into a ramp", () => {
    const w = 20, h = 3;
    const values = new Float32Array(w * h).map((_, i) => (i % w < 10 ? 0 : 1));
    const out = blurHeightField(values, new Uint8Array(w * h).fill(1), w, h, 2);
    expect(out[w + 9]).toBeGreaterThan(0.2);
    expect(out[w + 10]).toBeLessThan(0.8);
    expect(out[w + 0]).toBeCloseTo(0, 3);
    expect(out[w + 19]).toBeCloseTo(1, 3);
  });

  it("ignores masked-out cells' values", () => {
    const w = 5, h = 1;
    const values = new Float32Array([1, 1, 1000, 1, 1]);
    const out = blurHeightField(values, new Uint8Array([1, 1, 0, 1, 1]), w, h, 1);
    expect(out[1]).toBeCloseTo(1, 6);
  });
});

describe("sampleBilinear", () => {
  const values = new Float32Array([0, 1, 2, 3]); // 2×2: row 0 = 0, 1; row 1 = 2, 3

  it("interpolates between cell centres", () => {
    expect(sampleBilinear(values, 2, 2, 0.5, 0.5)).toBeCloseTo(1.5, 6);
    expect(sampleBilinear(values, 2, 2, 1, 0)).toBeCloseTo(1, 6);
  });

  it("clamps outside the grid", () => {
    expect(sampleBilinear(values, 2, 2, -3, 9)).toBeCloseTo(2, 6);
  });
});
