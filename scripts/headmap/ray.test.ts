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

  it("finds the front-most hit (largest position along the axis) wherever the origin is", () => {
    expect(grid.front([0.5, 0.5, 1])?.point[2]).toBeCloseTo(3, 12);
    expect(grid.front([0.5, 0.5, -10])?.t).toBeCloseTo(13, 12);
    expect(grid.front([0.5, 0.5, 10])?.triangle).toBeGreaterThanOrEqual(2);
  });

  it("misses outside the mesh's footprint", () => {
    expect(grid.nearest([1.5, 0.5, 1])).toBeNull();
    expect(grid.nearest([-0.2, -0.2, 1])).toBeNull();
    expect(grid.front([1.5, 0.5, 1])).toBeNull();
  });

  it("works along x as well", () => {
    const wall = new AxisRayGrid(new Float32Array([2, 0, 0, 2, 1, 0, 2, 0, 1]), new Uint32Array([0, 1, 2]), 0, 0.5);
    expect(wall.nearest([0, 0.2, 0.2])?.t).toBeCloseTo(2, 12);
  });
});

describe("AxisRayGrid on shared edges", () => {
  // A fan of triangles around a centre, with coordinates that aren't round in binary.
  const n = 13;
  const centre = [0.1 / 3, 0.7 / 3, 0.3];
  const ring = Array.from({ length: n }, (_, k) => [
    centre[0] + 0.37 * Math.cos((2 * Math.PI * k) / n),
    centre[1] + 0.29 * Math.sin((2 * Math.PI * k) / n),
    0.3 + 0.01 * k,
  ]);
  const positions = new Float32Array([...centre, ...ring.flat()]);
  const indices = new Uint32Array(Array.from({ length: n }, (_, k) => [0, 1 + k, 1 + ((k + 1) % n)]).flat());
  const grid = new AxisRayGrid(positions, indices, 2, 0.05);
  const at = (i: number) => [positions[i * 3], positions[i * 3 + 1]];

  it("hits a ray passing exactly through any shared edge", () => {
    for (let k = 0; k < n; k++) {
      for (const f of [0.25, 0.5, 0.75]) {
        const [cx, cy] = at(0), [ex, ey] = at(1 + k);
        const x = cx + f * (ex - cx), y = cy + f * (ey - cy);
        expect(grid.front([x, y, 5]), `edge ${k} at ${f}`).not.toBeNull();
      }
    }
  });

  it("hits a ray running along the mirror plane through an edge on it (the stock nose bridge)", () => {
    // Two mirrored triangles sharing an edge at x = 0, from the stock head; the ray is at x = -0.
    const bridge = new Float32Array([
      0.048189982771873474, 9.905195236206055, 8.632953643798828, 0, 9.905195236206055, 8.636480331420898,
      0, 9.82526969909668, 8.70817756652832, -0.048189982771873474, 9.905195236206055, 8.632953643798828,
    ]);
    const mirrored = new AxisRayGrid(bridge, new Uint32Array([0, 1, 2, 3, 2, 1]), 2, 0.2);
    expect(mirrored.front([-0, 9.886388778686523, 9.13])?.point[2]).toBeCloseTo(8.6534, 3); // along the shared edge
  });

  it("hits a ray passing exactly through the shared centre vertex", () => {
    expect(grid.front([positions[0], positions[1], 5])).not.toBeNull();
  });
});
