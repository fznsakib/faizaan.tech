import { describe, expect, it } from "vitest";

import { AxisRayGrid, intersectRayTriangle } from "./ray.ts";

import type { Vec3 } from "./ray.ts";

const a: Vec3 = [0, 0, 0];
const b: Vec3 = [1, 0, 0];
const c: Vec3 = [0, 1, 0];

describe("intersectRayTriangle", () => {
  it("returns the distance along the ray and the barycentric coordinates of the hit", () => {
    const hit = intersectRayTriangle([0.25, 0.25, 5], [0, 0, -1], a, b, c);
    expect(hit?.t).toBeCloseTo(5, 12);
    expect(hit?.u).toBeCloseTo(0.25, 12);
    expect(hit?.v).toBeCloseTo(0.25, 12);
  });

  it("hits triangles behind the origin with a negative distance", () => {
    expect(intersectRayTriangle([0.25, 0.25, -2], [0, 0, -1], a, b, c)?.t).toBeCloseTo(-2, 12);
  });

  it("hits both windings", () => {
    expect(intersectRayTriangle([0.25, 0.25, 1], [0, 0, -1], a, c, b)?.t).toBeCloseTo(1, 12);
  });

  it("misses outside the triangle and parallel to it", () => {
    expect(intersectRayTriangle([0.8, 0.8, 1], [0, 0, -1], a, b, c)).toBeNull();
    expect(intersectRayTriangle([-0.01, 0.5, 1], [0, 0, -1], a, b, c)).toBeNull();
    expect(intersectRayTriangle([0.25, 0.25, 1], [1, 0, 0], a, b, c)).toBeNull();
  });
});

describe("AxisRayGrid", () => {
  // Two stacked unit squares facing +z, at z = 0 and z = 3, each split into two triangles.
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 3, 1, 0, 3, 1, 1, 3, 0, 1, 3]);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const grid = new AxisRayGrid(positions, indices, 2, 0.3);

  it("finds the hit nearest the origin along the axis, either direction", () => {
    expect(grid.nearest([0.5, 0.5, 1])?.t).toBeCloseTo(-1, 12);
    expect(grid.nearest([0.5, 0.5, 2])?.t).toBeCloseTo(1, 12);
    expect(grid.nearest([0.5, 0.5, 10])?.t).toBeCloseTo(-7, 12);
  });

  it("reports which triangle was hit and where", () => {
    const hit = grid.nearest([0.75, 0.25, 2.5]);
    expect(hit?.triangle).toBe(2);
    expect(hit?.point[0]).toBeCloseTo(0.75, 12);
    expect(hit?.point[1]).toBeCloseTo(0.25, 12);
    expect(hit?.point[2]).toBeCloseTo(3, 12);
  });

  it("misses outside the mesh's footprint", () => {
    expect(grid.nearest([1.5, 0.5, 1])).toBeNull();
    expect(grid.nearest([-0.2, -0.2, 1])).toBeNull();
  });

  it("works along x as well", () => {
    const wall = new AxisRayGrid(new Float32Array([2, 0, 0, 2, 1, 0, 2, 0, 1]), new Uint32Array([0, 1, 2]), 0, 0.5);
    expect(wall.nearest([0, 0.2, 0.2])?.t).toBeCloseTo(2, 12);
  });
});
