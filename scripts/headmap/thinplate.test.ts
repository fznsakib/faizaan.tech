import { describe, expect, it } from "vitest";

import { fitThinPlate } from "./thinplate.ts";

import type { Vec3 } from "./ray.ts";

/** Samples on a ring around the origin, like the stock face around the scan's footprint. */
function ring(z: (x: number, y: number) => number): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k < 40; k++) {
    for (const r of [2, 2.5]) {
      const a = (2 * Math.PI * k) / 40;
      out.push([r * Math.cos(a), r * Math.sin(a), z(r * Math.cos(a), r * Math.sin(a))]);
    }
  }
  return out;
}

describe("fitThinPlate", () => {
  it("passes through its samples", () => {
    const samples = ring((x, y) => Math.sin(x) + y * y);
    const f = fitThinPlate(samples, 0);
    for (const [x, y, z] of samples.slice(0, 10)) expect(f(x, y)).toBeCloseTo(z, 6);
  });

  it("reproduces a plane everywhere, including the hole it has no samples in", () => {
    const f = fitThinPlate(ring((x, y) => 3 + 0.5 * x - 2 * y), 0);
    expect(f(0, 0)).toBeCloseTo(3, 6);
    expect(f(1, -1)).toBeCloseTo(5.5, 6);
  });

  it("fills a hole in a smooth dome smoothly, without the bumps it never saw", () => {
    const dome = (x: number, y: number) => 10 - 0.2 * (x * x + y * y);
    const f = fitThinPlate(ring(dome), 0);
    expect(Math.abs(f(0, 0) - dome(0, 0))).toBeLessThan(0.1);
    expect(Math.abs(f(0.7, 0.4) - dome(0.7, 0.4))).toBeLessThan(0.1);
  });

  it("smooths through noisy samples with regularisation", () => {
    // ±0.05 alternating around the ring (samples come in pairs per angle, so alternate by pair).
    const noisy = ring((x) => x).map(([x, y, z], i) => [x, y, z + ((i >> 1) % 2 ? 0.05 : -0.05)] as Vec3);
    const f = fitThinPlate(noisy, 1);
    expect(Math.abs(f(0, 0))).toBeLessThan(0.02);
  });
});
