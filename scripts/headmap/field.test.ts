import { describe, expect, it } from "vitest";

import { copyToTwins, geodesicDistance, harmonicFill, smoothScalar } from "./field.ts";

/** A path graph 0 – 1 – 2 – … – (n − 1). */
function path(n: number) {
  return Array.from({ length: n }, (_, i) => new Set([i - 1, i + 1].filter((j) => j >= 0 && j < n)));
}

describe("harmonicFill", () => {
  it("interpolates linearly between two known ends of a path", () => {
    const values = new Float32Array([0, 0, 0, 0, 12]);
    const known = new Uint8Array([1, 0, 0, 0, 1]);
    const out = harmonicFill(values, known, path(5), 1, { iterations: 2000 });
    expect([...out].map((v) => Math.round(v * 100) / 100)).toEqual([0, 3, 6, 9, 12]);
  });

  it("never changes known values, and fills every component of a stride", () => {
    const values = new Float32Array([10, 20, 0, 0, 0, 0]);
    const known = new Uint8Array([1, 0, 0]);
    const out = harmonicFill(values, known, path(3), 2, { iterations: 200 });
    expect([...out]).toEqual([10, 20, 10, 20, 10, 20]);
  });

  it("gives an unknown region no known value reaches the fallback", () => {
    const rings = [new Set([1]), new Set([0]), new Set<number>()];
    const out = harmonicFill(new Float32Array([5, 0, 0]), new Uint8Array([1, 0, 0]), rings, 1, { iterations: 50, fallback: [7] });
    expect([...out]).toEqual([5, 5, 7]);
  });
});

describe("smoothScalar", () => {
  it("spreads a spike to its neighbours and conserves nothing it shouldn't create", () => {
    const out = smoothScalar(new Float32Array([0, 0, 1, 0, 0]), path(5), 1);
    expect(out[2]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(0.25);
    expect(out[0]).toBe(0);
    expect(Math.max(...out)).toBeLessThanOrEqual(1);
  });

  it("leaves a constant field constant", () => {
    expect([...smoothScalar(new Float32Array([3, 3, 3, 3]), path(4), 10)]).toEqual([3, 3, 3, 3]);
  });
});

describe("geodesicDistance", () => {
  it("measures along the mesh's edges from the nearest source", () => {
    // 0 — 1 — 2 — 3 along x, spaced 1, 2 and 3 apart
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 3, 0, 0, 6, 0, 0]);
    const d = geodesicDistance(positions, path(4), new Uint8Array([1, 0, 0, 0]));
    expect([...d]).toEqual([0, 1, 3, 6]);
    const both = geodesicDistance(positions, path(4), new Uint8Array([1, 0, 0, 1]));
    expect([...both]).toEqual([0, 1, 3, 0]);
  });

  it("goes around, not through: a detour is longer than the straight line", () => {
    // a square 0 (0,0) — 1 (1,0) — 2 (1,1) — 3 (0,1), no diagonal: from 0 to 2 is 2, not √2
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    const rings = [new Set([1, 3]), new Set([0, 2]), new Set([1, 3]), new Set([2, 0])];
    expect(geodesicDistance(positions, rings, new Uint8Array([1, 0, 0, 0]))[2]).toBeCloseTo(2);
  });

  it("leaves what no source reaches at infinity", () => {
    const rings = [new Set([1]), new Set([0]), new Set<number>()];
    expect(geodesicDistance(new Float32Array(9), rings, new Uint8Array([1, 0, 0]))[2]).toBe(Infinity);
  });
});

describe("copyToTwins", () => {
  it("gives each seam duplicate its canonical vertex's values, every component", () => {
    // vertex 2 is a twin of 0, vertex 3 of 1
    const values = new Float32Array([1, 2, 3, 4, 0, 0, 9, 9]);
    copyToTwins(values, new Uint32Array([0, 1, 0, 1]), 2);
    expect([...values]).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });
});
