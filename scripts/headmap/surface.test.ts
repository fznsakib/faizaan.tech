import { describe, expect, it } from "vitest";

import { vertexNeighbours } from "./mesh.ts";
import { dequantizePosition, quantizeNormals, quantizePositions, smoothMasked, vertexNormals } from "./surface.ts";

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
