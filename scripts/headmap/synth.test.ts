import { describe, expect, it } from "vitest";

import { sampleWrapped } from "./colour.ts";
import { splatTexture, tangentFrame } from "./synth.ts";

import type { Vec3 } from "./ray.ts";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe("tangentFrame", () => {
  it("gives two unit tangents perpendicular to the normal and each other", () => {
    for (const n of [[1, 0, 0], [0, 0, 1], [0.6, 0.8, 0], [0, -0.6, -0.8]] as Vec3[]) {
      const [t, b] = tangentFrame(n);
      expect(dot(t, t)).toBeCloseTo(1);
      expect(dot(b, b)).toBeCloseTo(1);
      expect(dot(t, n)).toBeCloseTo(0);
      expect(dot(b, n)).toBeCloseTo(0);
      expect(dot(t, b)).toBeCloseTo(0);
    }
  });

  it("points the second tangent down the head, as hair falls, and turns smoothly", () => {
    expect(tangentFrame([0, 0, -1])[1][1]).toBeCloseTo(-1); // at the back of the head
    const a = tangentFrame([0.8, 0, 0.6]), b = tangentFrame([0.79, 0.01, 0.61]);
    expect(dot(a[0], b[0])).toBeGreaterThan(0.99);
  });
});

describe("splatTexture", () => {
  // A 4×4 tile: a checker of 0 and 200 in every channel.
  const tile = new Float32Array(48).map((_, i) => ((Math.floor(i / 3) % 4) + Math.floor(i / 12)) % 2 ? 200 : 0);
  const splat = splatTexture({ rgb: tile, size: 4, tile: 1 }, { seed: 9, spacing: 1.5 });

  it("is the same for the same point, and continuous across the surface", () => {
    const n: Vec3 = [0, 0, 1];
    expect(splat([0.3, 0.7, 2], n)).toEqual(splat([0.3, 0.7, 2], n));
    for (const x of [0.1, 0.75, 1.49, 1.5, 3.2]) {
      const a = splat([x, 0.4, 2], n), b = splat([x + 1e-4, 0.4, 2], n);
      expect(Math.abs(a[0] - b[0])).toBeLessThan(2);
    }
  });

  it("keeps the tile's mean and its contrast, where a plain blend of overlapping splats would wash it out", () => {
    const stats = (values: number[]) => {
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      return { mean, sd: Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) };
    };
    const splatted = stats(Array.from({ length: 4000 }, (_, i) => splat([i * 0.137, (i % 97) * 0.21, 2 + (i % 13) * 0.05], [0, 0, 1])[0]));
    const plain = stats(Array.from({ length: 4000 }, (_, i) => sampleWrapped(tile, 4, 4, i * 0.137, (i % 97) * 0.21)[0]));
    expect(splatted.mean).toBeGreaterThan(90);
    expect(splatted.mean).toBeLessThan(110);
    expect(splatted.sd).toBeGreaterThan(0.85 * plain.sd);
  });
});
