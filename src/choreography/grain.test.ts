import { describe, expect, it } from "vitest";

import {
  grainField,
  hash2,
  MOTTLE_CELLS,
  MOTTLE_STEP,
  mottleAt,
  mottleRange,
  paintGrain,
  paintMottle,
  parseRgb,
  rng,
  TILE_CSS,
} from "./grain";

const GROUND: [number, number, number] = [20, 61, 50];
const PERIOD = MOTTLE_CELLS * MOTTLE_STEP;

/** Mean absolute step between neighbours across the tile's seam vs inside it, along x or y. */
function seam(field: Float32Array, size: number, axis: "x" | "y") {
  const at = (x: number, y: number) => field[y * size + x];
  let edge = 0;
  let inside = 0;
  for (let i = 0; i < size; i++) {
    edge += axis === "x" ? Math.abs(at(size - 1, i) - at(0, i)) : Math.abs(at(i, size - 1) - at(i, 0));
    inside += axis === "x" ? Math.abs(at(size >> 1, i) - at((size >> 1) + 1, i)) : Math.abs(at(i, size >> 1) - at(i, (size >> 1) + 1));
  }
  return { edge: edge / size, inside: inside / size };
}

/** Lag-1 correlation along x: how many device pixels a grain spans. */
function lag1(field: Float32Array, size: number) {
  let num = 0;
  let den = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size - 1; x++) {
      num += field[y * size + x] * field[y * size + x + 1];
      den += field[y * size + x] ** 2;
    }
  }
  return num / den;
}

describe("rng / hash2", () => {
  it("is seeded, deterministic and in [0, 1)", () => {
    const [a, b] = [rng(5), rng(5)];
    const values = Array.from({ length: 1000 }, () => a());
    expect(values).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(rng(6)()).not.toBe(rng(5)());
  });

  it("hashes lattice points into −1..1, evenly", () => {
    let sum = 0;
    for (let x = 0; x < 100; x++) {
      for (let y = 0; y < 100; y++) {
        const v = hash2(x, y, 3);
        expect(Math.abs(v)).toBeLessThanOrEqual(1);
        sum += v;
      }
    }
    expect(Math.abs(sum / 10000)).toBeLessThan(0.03);
  });
});

describe("grainField", () => {
  const size = 160;
  const field = grainField(size, 1);

  it("is zero-mean and gentle: a luminance texture, not a tint", () => {
    const mean = field.reduce((s, v) => s + v, 0) / field.length;
    const sd = Math.sqrt(field.reduce((s, v) => s + v * v, 0) / field.length);
    expect(Math.abs(mean)).toBeLessThan(1e-6);
    expect(sd).toBeGreaterThan(0.03);
    expect(sd).toBeLessThan(0.1);
    expect(Math.max(...field.map(Math.abs))).toBeLessThan(0.4);
  });

  it("tiles without a seam on either axis", () => {
    for (const axis of ["x", "y"] as const) {
      const { edge, inside } = seam(field, size, axis);
      expect(edge).toBeLessThan(inside * 1.35);
    }
  });

  it("is the same paper for the same seed, and another for another", () => {
    expect(grainField(64, 1, 9)).toEqual(grainField(64, 1, 9));
    expect(grainField(64, 1, 9)).not.toEqual(grainField(64, 1, 10));
  });

  it("keeps its grain the same size in CSS px: at 2× each grain spans more device pixels", () => {
    expect(lag1(grainField(2 * size, 2), 2 * size)).toBeGreaterThan(lag1(field, size) + 0.1);
  });
});

describe("paintGrain", () => {
  const size = 128;
  const field = grainField(size, 1);
  const out = new Uint8ClampedArray(size * size * 4);
  paintGrain(out, field, GROUND, 1);
  const channel = (c: number) => {
    let sum = 0;
    for (let i = c; i < out.length; i += 4) sum += out[i];
    return sum / (size * size);
  };

  it("averages to the ground and is opaque", () => {
    GROUND.forEach((value, c) => expect(Math.abs(channel(c) - value)).toBeLessThan(0.6));
    for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255);
  });

  it("only scales the ground's RGB, so its hue holds", () => {
    expect(channel(1) / channel(0)).toBeCloseTo(GROUND[1] / GROUND[0], 1);
    expect(channel(2) / channel(1)).toBeCloseTo(GROUND[2] / GROUND[1], 1);
  });
});

describe("mottle", () => {
  const range = mottleRange();

  it("stays within its range and is smooth", () => {
    for (let i = 0; i < 2000; i++) {
      const [x, y] = [(i * 37.3) % 3000, (i * 91.7) % 2000];
      const m = mottleAt(x, y);
      expect(Math.abs(m)).toBeLessThanOrEqual(range + 1e-9);
      expect(Math.abs(mottleAt(x + 1, y) - m)).toBeLessThan(range * 0.05);
    }
  });

  it("repeats every period without a seam, on both axes", () => {
    for (const [x, y] of [
      [13, 700],
      [1200, 9],
      [3333, 2222],
    ]) {
      expect(mottleAt(x + PERIOD, y)).toBeCloseTo(mottleAt(x, y), 9);
      expect(mottleAt(x, y + PERIOD)).toBeCloseTo(mottleAt(x, y), 9);
    }
  });

  it("darkens only, and the grain's gain gives the ground back on average", () => {
    const grid = new Uint8ClampedArray(MOTTLE_CELLS * MOTTLE_CELLS * 4);
    paintMottle(grid);
    let sum = 0;
    for (let i = 0; i < grid.length; i += 4) sum += grid[i];
    const mean = sum / (MOTTLE_CELLS * MOTTLE_CELLS) / 255;
    expect(mean * (1 + range)).toBeCloseTo(1, 2);
  });
});

describe("parseRgb", () => {
  it("reads rgb() and hex", () => {
    expect(parseRgb("rgb(20, 61, 50)")).toEqual(GROUND);
    expect(parseRgb("#143d32")).toEqual(GROUND);
    expect(() => parseRgb("green")).toThrow();
  });
});

it("the tile is big enough not to repeat across a phone's width", () => {
  expect(TILE_CSS).toBeGreaterThanOrEqual(300);
});
