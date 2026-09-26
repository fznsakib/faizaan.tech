import { describe, expect, it } from "vitest";

import { vertexNeighbours } from "./mesh.ts";
import {
  dequantizePosition,
  quantizeNormals,
  quantizePositions,
  smoothMasked,
  smoothRim,
  vertexNormals,
} from "./surface.ts";

// A 3×3 grid of vertices in the z = 0 plane (8 triangles, counter-clockwise from +z).
const grid = new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 1, 1, 0, 2, 1, 0, 0, 2, 0, 1, 2, 0, 2, 2, 0]);
const tris = new Uint32Array([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 3, 4, 7, 3, 7, 6, 4, 5, 8, 4, 8, 7]);

describe("vertexNormals", () => {
  it("points along the winding's normal on a flat sheet", () => {
    const n = vertexNormals(grid, tris);
    for (let i = 0; i < 9; i++) expect([n[i * 3], n[i * 3 + 1], n[i * 3 + 2]]).toEqual([0, 0, 1]);
  });
});

describe("smoothMasked", () => {
  const spiked = grid.slice();
  spiked[4 * 3 + 2] = 1; // lift the centre vertex
  const rings = vertexNeighbours(tris, 9);

  it("pulls a weighted spike toward its neighbours' average", () => {
    const weights = new Float32Array(9).fill(1);
    const out = smoothMasked(spiked, rings, weights, { passes: 1, lambda: 0.5 });
    expect(out[4 * 3 + 2]).toBeCloseTo(0.5, 6);
  });

  it("leaves zero-weight vertices where they are", () => {
    const weights = new Float32Array(9);
    const out = smoothMasked(spiked, rings, weights, { passes: 3, lambda: 0.5 });
    expect([...out]).toEqual([...spiked]);
  });

  it("scales the step by the vertex's weight and flattens more with more passes", () => {
    const weights = new Float32Array(9);
    weights[4] = 0.5;
    const once = smoothMasked(spiked, rings, weights, { passes: 1, lambda: 0.5 });
    const twice = smoothMasked(spiked, rings, weights, { passes: 2, lambda: 0.5 });
    expect(once[4 * 3 + 2]).toBeCloseTo(0.75, 6);
    expect(twice[4 * 3 + 2]).toBeCloseTo(0.5625, 6);
  });
});

describe("smoothMasked with planar", () => {
  it("relaxes x and y only, leaving z for the caller to re-project", () => {
    const bumped = grid.slice();
    bumped[4 * 3] = 1.6; // push the centre vertex sideways and up
    bumped[4 * 3 + 2] = 1;
    const rings = vertexNeighbours(tris, 9);
    const out = smoothMasked(bumped, rings, new Float32Array(9).fill(1), { passes: 1, lambda: 0.5, planar: true });
    expect(out[4 * 3 + 2]).toBe(1);
    expect(out[4 * 3]).toBeLessThan(1.6);
  });
});

describe("smoothMasked with mu (Taubin)", () => {
  // A closed loop of 32 vertices on the unit circle: plain Laplacian smoothing shrinks it, Taubin barely.
  const n = 32;
  const loop = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) loop.set([Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n), 0], i * 3);
  const rings = Array.from({ length: n }, (_, i) => new Set([(i + n - 1) % n, (i + 1) % n]));
  const weights = new Float32Array(n).fill(1);
  const radius = (p: Float32Array) => Math.hypot(p[0], p[1]);

  it("shrinks much less than plain Laplacian smoothing", () => {
    const laplacian = smoothMasked(loop, rings, weights, { passes: 20, lambda: 0.5 });
    const taubin = smoothMasked(loop, rings, weights, { passes: 20, lambda: 0.5, mu: -0.53 });
    expect(radius(laplacian)).toBeLessThan(0.9);
    expect(radius(taubin)).toBeGreaterThan(0.99);
  });

  it("still removes noise", () => {
    const noisy = loop.slice();
    for (let i = 0; i < n; i += 2) {
      noisy[i * 3] *= 1.1; // every other vertex pushed out radially: pure highest-frequency noise
      noisy[i * 3 + 1] *= 1.1;
    }
    const out = smoothMasked(noisy, rings, weights, { passes: 20, lambda: 0.5, mu: -0.53 });
    const spread = (p: Float32Array) => {
      const r = Array.from({ length: n }, (_, i) => Math.hypot(p[i * 3], p[i * 3 + 1]));
      return Math.max(...r) - Math.min(...r);
    };
    expect(spread(out)).toBeLessThan(spread(noisy) / 5);
  });
});

describe("smoothRim", () => {
  it("straightens a zig-zag rim while leaving open ends in place", () => {
    // x, y per vertex; a chain 0-1-2-3-4 along x with vertex 2 kicked up.
    const points = new Float32Array([0, 0, 1, 0, 2, 1, 3, 0, 4, 0]);
    const out = smoothRim(points, [[0, 1], [1, 2], [2, 3], [3, 4]], 10);
    expect(out[5]).toBeLessThan(0.3);
    expect([out[0], out[1], out[8], out[9]]).toEqual([0, 0, 4, 0]);
  });

  it("leaves vertices that are not on the rim alone", () => {
    const points = new Float32Array([0, 0, 1, 1, 2, 0, 9, 9]);
    const out = smoothRim(points, [[0, 1], [1, 2], [2, 0]], 5);
    expect([out[6], out[7]]).toEqual([9, 9]);
  });
});

describe("quantizePositions", () => {
  it("stores positions as 14-bit integers around the bounding-box centre, with the scale in the node", () => {
    const positions = new Float32Array([-3, 1, 10, 5, 2, 12, 0.123, 1.5, 11]);
    const q = quantizePositions(positions, 14);
    expect(q.translation).toEqual([1, 1.5, 11]);
    expect(q.scale).toBeCloseTo(4 / 8191, 12);
    expect(Math.max(...q.array.map(Math.abs))).toBe(8191);
    for (let i = 0; i < 3; i++) {
      const p = dequantizePosition(q, i);
      for (let k = 0; k < 3; k++) expect(Math.abs(p[k] - positions[i * 3 + k])).toBeLessThanOrEqual(q.scale / 2 + 1e-6);
    }
  });
});

describe("quantizeNormals", () => {
  it("stores unit normals as normalised int8", () => {
    expect([...quantizeNormals(new Float32Array([0, 0, 1, 0.6, -0.8, 0]))]).toEqual([0, 0, 127, 76, -102, 0]);
  });
});
