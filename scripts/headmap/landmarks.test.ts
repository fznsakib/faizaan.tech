import { describe, expect, it } from "vitest";

import { findChinY, findNoseTip, PointGrid } from "./landmarks.ts";

/** A face-like height field z(x, y) sampled on a grid: a nose bump at (0, 0), a chin ending at y = -1. */
function face(z: (x: number, y: number) => number) {
  const out: number[] = [];
  for (let y = -1.6; y <= 1.6; y += 0.02) for (let x = -1; x <= 1; x += 0.02) out.push(x, y, z(x, y));
  return new Float32Array(out);
}
const nose = (x: number, y: number) => 0.5 * Math.exp(-(x * x + y * y) / 0.02);
const head = (x: number, y: number) => nose(x, y) - 0.2 * x * x - (y < -1 ? 3 : 0.05 * y * y);

describe("findNoseTip", () => {
  it("finds the most forward point inside the search window", () => {
    const tip = findNoseTip(face(head), { centre: [0, 0], radii: [0.5, 0.5] });
    expect(tip[0]).toBeCloseTo(0, 5);
    expect(tip[1]).toBeCloseTo(0, 5);
    expect(tip[2]).toBeCloseTo(0.5, 5);
  });

  it("ignores anything outside the window, however far forward", () => {
    const wall = face((x, y) => head(x, y) + (x > 0.8 ? 5 : 0));
    expect(findNoseTip(wall, { centre: [0, 0], radii: [0.5, 0.5] })[2]).toBeCloseTo(0.5, 5);
  });
});

describe("findChinY", () => {
  it("walks down the midline to where the surface falls away behind the depth limit", () => {
    const chin = findChinY(face(head), [0, 0, 0.5], { halfWidth: 0.05, depth: 1, step: 0.02 });
    expect(chin).toBeGreaterThan(-1.03);
    expect(chin).toBeLessThan(-0.97);
  });

  it("stops where the mesh runs out", () => {
    const cut = face(head).filter((_, i, all) => all[i - (i % 3) + 1] > -0.5);
    expect(findChinY(cut, [0, 0, 0.5], { halfWidth: 0.05, depth: 1, step: 0.02 })).toBeGreaterThan(-0.53);
  });
});

describe("PointGrid", () => {
  const points = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5, -3, 0.2, 0]);
  const grid = new PointGrid(points, 0.5);

  it("returns the index of the nearest point", () => {
    expect(grid.nearest([0.9, 0.2, 0], 10)).toBe(1);
    expect(grid.nearest([0.1, 0.1, 0.1], 10)).toBe(0);
    expect(grid.nearest([4, 4, 4], 10)).toBe(3);
    expect(grid.nearest([-2, 0, 0], 10)).toBe(4);
  });

  it("returns -1 when nothing is within the search radius", () => {
    expect(grid.nearest([20, 20, 20], 2)).toBe(-1);
  });
});
