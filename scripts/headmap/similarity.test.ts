import { describe, expect, it } from "vitest";

import { applySimilarity, composeSimilarity, similarityFromPairs } from "./similarity.ts";

import type { Vec3 } from "./ray.ts";

/** Rotation matrix (row-major) about a unit axis. */
function rotation(axis: Vec3, angle: number): number[] {
  const [x, y, z] = axis;
  const c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;
  return [
    c + x * x * k, x * y * k - z * s, x * z * k + y * s,
    y * x * k + z * s, c + y * y * k, y * z * k - x * s,
    z * x * k - y * s, z * y * k + x * s, c + z * z * k,
  ];
}

const src: Vec3[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 2, 0],
  [0, 0, 3],
  [1, 1, 1],
];

describe("similarityFromPairs", () => {
  it("recovers a known scale, rotation and translation", () => {
    const n = Math.hypot(1, 2, 3);
    const known = { scale: 2.5, rotation: rotation([1 / n, 2 / n, 3 / n], 0.7), translation: [4, -1, 2] as Vec3 };
    const dst = src.map((p) => applySimilarity(known, p));
    const fit = similarityFromPairs(src, dst);
    expect(fit.scale).toBeCloseTo(2.5, 9);
    fit.rotation.forEach((r, i) => expect(r).toBeCloseTo(known.rotation[i], 9));
    fit.translation.forEach((t, i) => expect(t).toBeCloseTo(known.translation[i], 9));
  });

  it("recovers a half turn (the quaternion's scalar part is zero)", () => {
    const known = { scale: 1, rotation: rotation([0, 1, 0], Math.PI), translation: [0, 0, 0] as Vec3 };
    const fit = similarityFromPairs(src, src.map((p) => applySimilarity(known, p)));
    fit.rotation.forEach((r, i) => expect(r).toBeCloseTo(known.rotation[i], 9));
  });

  it("keeps the scale at 1 when asked for a rigid fit", () => {
    const dst = src.map(([x, y, z]) => [2 * x, 2 * y, 2 * z] as Vec3);
    expect(similarityFromPairs(src, dst, { scale: false }).scale).toBe(1);
  });

  it("gives the least-squares fit for noisy pairs", () => {
    const dst = src.map(([x, y, z], i) => [x + 5 + (i % 2 ? 0.01 : -0.01), y, z] as Vec3);
    const fit = similarityFromPairs(src, dst);
    expect(fit.scale).toBeCloseTo(1, 2);
    expect(fit.translation[0]).toBeCloseTo(5, 1);
  });
});

describe("composeSimilarity", () => {
  it("applies the first transform, then the second", () => {
    const first = { scale: 2, rotation: rotation([0, 0, 1], Math.PI / 2), translation: [1, 0, 0] as Vec3 };
    const second = { scale: 0.5, rotation: rotation([1, 0, 0], 0.3), translation: [0, 3, 0] as Vec3 };
    const both = composeSimilarity(second, first);
    for (const p of src) {
      const expected = applySimilarity(second, applySimilarity(first, p));
      applySimilarity(both, p).forEach((v, i) => expect(v).toBeCloseTo(expected[i], 12));
    }
  });
});
