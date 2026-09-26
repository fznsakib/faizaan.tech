import { describe, expect, it } from "vitest";

import { cellCoverage, DOT_FILL, dotScreen, RIPPLE_MS } from "./dots";

/** A square RGBA raster whose alpha at (x, y) is `alpha(x, y)`. */
const raster = (size: number, alpha: (x: number, y: number) => number) => {
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) rgba[(y * size + x) * 4 + 3] = alpha(x, y);
  }
  return rgba;
};

const grid = (cells: number, value: (col: number, row: number) => number) =>
  Float32Array.from({ length: cells * cells }, (_, i) => value(i % cells, Math.floor(i / cells)));

describe("cellCoverage", () => {
  it("averages alpha over each cell, row by row", () => {
    const leftHalf = raster(4, (x) => (x < 2 ? 255 : 0));
    expect([...cellCoverage(leftHalf, 4, 2)]).toEqual([1, 0, 1, 0]);
  });

  it("reads partial cover as a fraction", () => {
    const quarter = raster(4, (x, y) => (x === 0 && y === 0 ? 255 : 0));
    expect(cellCoverage(quarter, 4, 2)[0]).toBeCloseTo(0.25, 5);
    expect(cellCoverage(raster(4, () => 128), 4, 2)[3]).toBeCloseTo(128 / 255, 5);
  });
});

describe("dotScreen", () => {
  it("puts one dot, all the same size, at the centre of every covered cell", () => {
    const dots = dotScreen([grid(3, () => 1)], 3, 24);
    expect(dots).toHaveLength(9);
    expect(dots.map((dot) => dot.cx).slice(0, 3)).toEqual([4, 12, 20]);
    expect(dots.map((dot) => dot.cy).filter((_, i) => i % 3 === 0)).toEqual([4, 12, 20]);
    for (const dot of dots) {
      expect(dot.r).toBeCloseTo(8 * DOT_FILL, 5);
      expect(dot.part).toBe(0);
    }
  });

  it("keeps a dot for a barely covered edge cell (the clip trims it), but none for an untouched one", () => {
    const dots = dotScreen([grid(2, (col) => (col === 0 ? 0 : 0.02))], 2, 24);
    expect(dots.map((dot) => dot.cx)).toEqual([18, 18]);
    for (const dot of dots) expect(dot.r).toBeCloseTo(12 * DOT_FILL, 5);
  });

  it("gives a cell straddling two parts a dot in each, to be clipped to each part's shape", () => {
    const left = grid(2, (col) => (col === 0 ? 1 : 0.3));
    const right = grid(2, (col) => (col === 0 ? 0 : 0.6));
    const dots = dotScreen([left, right], 2, 24);
    expect(dots.filter((dot) => dot.part === 0)).toHaveLength(4);
    expect(dots.filter((dot) => dot.part === 1).map((dot) => dot.cx)).toEqual([18, 18]);
  });

  it("falls back to a dot on every cell when a part's raster came back blank (blocked canvas readback)", () => {
    const dots = dotScreen([grid(3, () => 1), grid(3, () => 0)], 3, 24);
    expect(dots.filter((dot) => dot.part === 0)).toHaveLength(9);
    expect(dots.filter((dot) => dot.part === 1)).toHaveLength(9);
  });

  it("ripples the resolve out from the centre: centre first, corners last", () => {
    const dots = dotScreen([grid(5, () => 1)], 5, 24);
    const at = (col: number, row: number) => dots[row * 5 + col].delay;
    expect(at(2, 2)).toBe(0);
    expect(at(0, 0)).toBe(RIPPLE_MS);
    expect(at(4, 4)).toBe(RIPPLE_MS);
    expect(at(1, 2)).toBeGreaterThan(0);
    expect(at(1, 2)).toBeLessThan(at(0, 2));
  });
});
