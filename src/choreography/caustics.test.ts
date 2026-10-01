import { describe, expect, it } from "vitest";

import { BANDS, BAND_STRIDE, causticPool, POINTS, writeCaustics } from "./caustics";

import type { CausticPose, Pool } from "./caustics";

const D = Math.PI / 180;
const POOL: Pool = { x: 690, y: 700, rx: 370, ry: 190 };
const REST: CausticPose = { yaw: 0, pitch: 0, roll: 0 };

const draw = (t: number, pose: CausticPose = REST, pool: Pool = POOL) => {
  const out = new Float32Array(BANDS * BAND_STRIDE);
  writeCaustics(out, t, pose, pool);
  return out;
};

/** Every band's points as [x, y] pairs, and its brightness. */
const bands = (out: Float32Array) =>
  Array.from({ length: BANDS }, (_, b) => ({
    intensity: out[b * BAND_STRIDE],
    points: Array.from({ length: POINTS }, (_, i) => [out[b * BAND_STRIDE + 1 + 2 * i], out[b * BAND_STRIDE + 2 + 2 * i]]),
  }));

/** Brightness-weighted centre and vertical spread of the pattern. */
function shape(out: Float32Array) {
  let [sum, sx, sy] = [0, 0, 0];
  for (const { intensity, points } of bands(out)) {
    for (const [x, y] of points) {
      sum += intensity;
      sx += intensity * x;
      sy += intensity * y;
    }
  }
  const [cx, cy] = [sx / sum, sy / sum];
  let spread = 0;
  for (const { intensity, points } of bands(out)) for (const [, y] of points) spread += intensity * (y - cy) ** 2;
  return { cx, cy, spread: Math.sqrt(spread / sum), brightness: sum / (BANDS * POINTS) };
}

/** The largest point move between two drawings (px). */
function moved(a: Float32Array, b: Float32Array): number {
  let most = 0;
  for (let band = 0; band < BANDS; band++) {
    for (let i = 0; i < POINTS; i++) {
      const k = band * BAND_STRIDE + 1 + 2 * i;
      most = Math.max(most, Math.hypot(a[k] - b[k], a[k + 1] - b[k + 1]));
    }
  }
  return most;
}

describe("caustics", () => {
  it("is deterministic", () => {
    expect(draw(12.34, { yaw: 0.1, pitch: 0.05, roll: -0.02 })).toEqual(draw(12.34, { yaw: 0.1, pitch: 0.05, roll: -0.02 }));
  });

  it("keeps its light in the pool at rest: the pool's fade has little to hide", () => {
    let [inside, total] = [0, 0];
    for (const t of [0, 7, 19, 41]) {
      for (const { points } of bands(draw(t))) {
        for (const [x, y] of points) {
          total++;
          if (((x - POOL.x) / POOL.rx) ** 2 + ((y - POOL.y) / POOL.ry) ** 2 <= 1) inside++;
        }
      }
    }
    expect(inside / total).toBeGreaterThan(0.8);
  });

  it("stays near its pool, finite, with brightness in 0..1, however the head moves", () => {
    for (const t of [0, 1.7, 33, 1000, 86_400]) {
      for (const pose of [REST, { yaw: 25 * D, pitch: 16 * D, roll: 10 * D }, { yaw: -25 * D, pitch: -12 * D, roll: -10 * D }]) {
        for (const { intensity, points } of bands(draw(t, pose))) {
          expect(intensity).toBeGreaterThan(0);
          expect(intensity).toBeLessThanOrEqual(1);
          for (const [x, y] of points) {
            expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
            // (the component fades everything past the pool's rim; this just keeps it from wandering off)
            expect(Math.abs(x - POOL.x)).toBeLessThanOrEqual(1.5 * POOL.rx);
            expect(Math.abs(y - POOL.y)).toBeLessThanOrEqual(1.5 * POOL.ry);
          }
        }
      }
    }
  });

  it("moves continuously: under 1.5 px and 0.02 brightness a 120 Hz frame, and smoothly with the pose", () => {
    for (let t = 0; t < 60; t += 0.37) {
      const [now, next] = [draw(t), draw(t + 1 / 120)];
      expect(moved(now, next)).toBeLessThan(1.5);
      for (let band = 0; band < BANDS; band++) {
        expect(Math.abs(now[band * BAND_STRIDE] - next[band * BAND_STRIDE])).toBeLessThan(0.02);
      }
      // a frame of the fastest head motion (a flinch: ~2°) moves it a little, not a lot
      expect(moved(now, draw(t, { yaw: 2 * D, pitch: 2 * D, roll: 2 * D }))).toBeLessThan(25);
    }
  });

  it("is alive: the light keeps slowly shifting", () => {
    expect(moved(draw(10), draw(13))).toBeGreaterThan(8);
  });

  it("slides the other way when the head turns", () => {
    const rest = shape(draw(5));
    const right = shape(draw(5, { ...REST, yaw: 20 * D }));
    const left = shape(draw(5, { ...REST, yaw: -20 * D }));
    expect(right.cx).toBeLessThan(rest.cx - 0.12 * POOL.rx);
    expect(left.cx).toBeGreaterThan(rest.cx + 0.12 * POOL.rx);
  });

  it("breathes with a nod: chin down focuses it taller and brighter, chin up gathers it", () => {
    const rest = shape(draw(5));
    const nod = shape(draw(5, { ...REST, pitch: 12 * D }));
    const up = shape(draw(5, { ...REST, pitch: -10 * D }));
    expect(nod.spread).toBeGreaterThan(1.1 * rest.spread);
    expect(up.spread).toBeLessThan(0.93 * rest.spread);
    expect(nod.brightness).toBeGreaterThan(rest.brightness);
  });

  it("tips with a roll", () => {
    // the pattern's tilt: slope of y against x across all points
    const tilt = (out: Float32Array) => {
      const all = bands(out).flatMap(({ points }) => points);
      const mx = all.reduce((s, [x]) => s + x, 0) / all.length;
      const my = all.reduce((s, [, y]) => s + y, 0) / all.length;
      const sxy = all.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
      const sxx = all.reduce((s, [x]) => s + (x - mx) ** 2, 0);
      return sxy / sxx;
    };
    // +roll tips the head counter-clockwise on screen; its light pool tips with it
    expect(tilt(draw(5, { ...REST, roll: 8 * D }))).toBeLessThan(tilt(draw(5)) - 0.05);
  });

  it("pools the light below and behind the head, wider than it", () => {
    const head = { bounds: { left: 527, right: 913, top: 135, bottom: 778 } };
    const pool = causticPool(head);
    expect(Math.abs(pool.x - 720)).toBeLessThan(60);
    expect(pool.y).toBeGreaterThan(135 + 0.75 * (778 - 135));
    expect(pool.y).toBeLessThan(778 + 40);
    expect(pool.rx).toBeGreaterThan(913 - 527);
    expect(pool.ry).toBeLessThan(pool.rx);
  });
});
