import { describe, expect, it } from "vitest";

import { smoothstep, transferWeight } from "./falloff.ts";

describe("smoothstep", () => {
  it("is 0 below the lower edge and 1 above the upper edge", () => {
    expect(smoothstep(1, 3, 0.5)).toBe(0);
    expect(smoothstep(1, 3, 1)).toBe(0);
    expect(smoothstep(1, 3, 3)).toBe(1);
    expect(smoothstep(1, 3, 7)).toBe(1);
  });

  it("is 0.5 halfway and eases in and out (zero slope at both edges)", () => {
    expect(smoothstep(1, 3, 2)).toBeCloseTo(0.5, 12);
    expect(smoothstep(0, 1, 0.01)).toBeLessThan(0.001);
    expect(1 - smoothstep(0, 1, 0.99)).toBeLessThan(0.001);
  });

  it("is monotonic", () => {
    let last = -1;
    for (let x = -0.5; x <= 1.5; x += 0.01) {
      const y = smoothstep(0, 1, x);
      expect(y).toBeGreaterThanOrEqual(last);
      last = y;
    }
  });
});

describe("transferWeight", () => {
  const params = { margin: 2, tolerance: 1 };

  it("is 1 deep inside the crop with the scan right on the surface", () => {
    expect(transferWeight(10, 0, params)).toBe(1);
  });

  it("falls to 0 at the crop boundary, smoothly over the margin", () => {
    expect(transferWeight(0, 0, params)).toBe(0);
    expect(transferWeight(1, 0, params)).toBeCloseTo(0.5, 12);
    expect(transferWeight(2, 0, params)).toBe(1);
  });

  it("falls to 0 as the hit gets as far away as the tolerance, either side of the surface", () => {
    expect(transferWeight(10, 0.5, params)).toBe(1);
    expect(transferWeight(10, 0.75, params)).toBeCloseTo(0.5, 12);
    expect(transferWeight(10, -0.75, params)).toBeCloseTo(0.5, 12);
    expect(transferWeight(10, 1, params)).toBe(0);
    expect(transferWeight(10, -3, params)).toBe(0);
  });

  it("multiplies the boundary and distance falloffs", () => {
    expect(transferWeight(1, 0.75, params)).toBeCloseTo(0.25, 12);
  });
});
