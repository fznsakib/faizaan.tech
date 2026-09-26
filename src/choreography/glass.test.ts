import { describe, expect, it } from "vitest";

import { createBodies, glassMap, glassPose } from "./glass";

import type { GlassBody, GlassInput } from "./glass";

const px = (map: ReturnType<typeof glassMap>, x: number, y: number) => {
  const i = (y * map.width + x) * 4;
  return { r: map.data[i], g: map.data[i + 1], a: map.data[i + 3] };
};

describe("glassMap", () => {
  const map = glassMap(200, 120, 40, 24);

  it("is RGBA of the requested size, opaque", () => {
    expect(map.data.length).toBe(200 * 120 * 4);
    expect(px(map, 100, 60).a).toBe(255);
  });

  it("leaves the flat middle undisplaced", () => {
    expect(px(map, 100, 60)).toMatchObject({ r: 128, g: 128 });
  });

  it("bends hard at the rim, pulling samples inward like thick glass", () => {
    expect(px(map, 2, 60).r).toBeGreaterThan(168); // left rim samples from the right
    expect(px(map, 197, 60).r).toBeLessThan(88); // right rim samples from the left
    expect(px(map, 100, 2).g).toBeGreaterThan(168); // top rim samples from below
  });

  it("is mirror-symmetric", () => {
    for (const x of [3, 10, 20, 30]) {
      expect(px(map, x, 60).r + px(map, 199 - x, 60).r).toBeGreaterThanOrEqual(254);
      expect(px(map, x, 60).r + px(map, 199 - x, 60).r).toBeLessThanOrEqual(256);
    }
  });
});

/** mulberry32: a small seeded PRNG so body layouts are reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const input = (over: Partial<GlassInput> = {}): GlassInput => ({
  t: 0,
  width: 1440,
  height: 900,
  pointer: null,
  energy: 0.5,
  beatPhase: 0.3,
  isPlaying: true,
  sectionLevel: 0,
  stab: 0,
  reduced: false,
  ...over,
});

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const everyBody = (fn: (body: GlassBody) => void) => {
  for (const seed of SEEDS) createBodies(seeded(seed)).forEach(fn);
};

describe("createBodies", () => {
  it("makes 3-5 bodies, deterministic for a given random", () => {
    for (const seed of SEEDS) {
      const bodies = createBodies(seeded(seed));
      expect(bodies.length).toBeGreaterThanOrEqual(3);
      expect(bodies.length).toBeLessThanOrEqual(5);
      expect(createBodies(seeded(seed))).toEqual(bodies);
    }
    expect(createBodies(seeded(1))).not.toEqual(createBodies(seeded(2)));
  });
});

describe("glassPose", () => {
  it("moves continuously: < 3 px and < 1 deg between 120 Hz frames over 30 s", () => {
    let maxMove = 0;
    let maxTurn = 0;
    everyBody((body) => {
      for (const pointer of [null, { x: 1000, y: 200 }]) {
        let prev = glassPose(body, input({ pointer }));
        for (let i = 1; i <= 30 * 120; i++) {
          const next = glassPose(body, input({ t: i / 120, pointer }));
          maxMove = Math.max(maxMove, Math.abs(next.x - prev.x), Math.abs(next.y - prev.y));
          maxTurn = Math.max(
            maxTurn,
            Math.abs(next.rotateX - prev.rotateX),
            Math.abs(next.rotateY - prev.rotateY),
            Math.abs(next.rotateZ - prev.rotateZ),
          );
          prev = next;
        }
      }
    });
    expect(maxMove).toBeLessThan(3);
    expect(maxTurn).toBeLessThan(1);
  });

  it("is a pure function of time: a huge t (tab hidden for ages) is finite and on screen", () => {
    everyBody((body) => {
      const pose = glassPose(body, input({ t: 1000 }));
      for (const value of Object.values(pose)) expect(Number.isFinite(value)).toBe(true);
      expect(pose.x).toBeGreaterThan(0);
      expect(pose.x).toBeLessThan(1440);
      expect(pose.y).toBeGreaterThan(0);
      expect(pose.y).toBeLessThan(900);
      expect(glassPose(body, input({ t: 1000 }))).toEqual(pose);
    });
  });

  it("keeps tilt, spin and centre in bounds at desktop and phone sizes", () => {
    const pointers = [null, { x: 0, y: 0 }, { x: 5000, y: 5000 }, { x: -5000, y: 300 }];
    for (const [width, height] of [
      [1440, 900],
      [500, 800],
    ]) {
      let tilt = 0;
      let spin = 0;
      let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
      everyBody((body) => {
        for (let t = 0; t < 120; t += 0.37) {
          for (const pointer of pointers) {
            for (const beatPhase of [0, 0.1, 0.2, 0.5, 0.9]) {
              const pose = glassPose(body, input({ t, width, height, pointer, beatPhase, stab: 1, energy: 1 }));
              tilt = Math.max(tilt, Math.abs(pose.rotateX), Math.abs(pose.rotateY));
              spin = Math.max(spin, Math.abs(pose.rotateZ));
              [minX, maxX] = [Math.min(minX, pose.x), Math.max(maxX, pose.x)];
              [minY, maxY] = [Math.min(minY, pose.y), Math.max(maxY, pose.y)];
            }
          }
        }
        if (width === 500) expect(glassPose(body, input({ width, height })).w).toBeLessThanOrEqual(0.6 * 500);
      });
      expect(tilt).toBeLessThanOrEqual(18);
      expect(spin).toBeLessThanOrEqual(8);
      expect(minX).toBeGreaterThanOrEqual(0.08 * width);
      expect(maxX).toBeLessThanOrEqual(0.92 * width);
      expect(minY).toBeGreaterThanOrEqual(0.08 * height);
      expect(maxY).toBeLessThanOrEqual(0.92 * height);
    }
  });

  it("turns to face the cursor", () => {
    everyBody((body) => {
      for (const t of [0, 4.2, 17]) {
        const right = glassPose(body, input({ t, pointer: { x: 1440, y: 450 } }));
        const left = glassPose(body, input({ t, pointer: { x: 0, y: 450 } }));
        expect(right.rotateY).toBeGreaterThan(left.rotateY);
      }
    });
  });

  it("refracts harder with energy and in a drop, and rests at a fixed value when stopped", () => {
    everyBody((body) => {
      const loud = glassPose(body, input({ energy: 1 })).refraction;
      const quiet = glassPose(body, input({ energy: 0 })).refraction;
      expect(loud).toBeGreaterThan(quiet);
      const drop = glassPose(body, input({ sectionLevel: 1 })).refraction;
      const calm = glassPose(body, input({ sectionLevel: 0 })).refraction;
      expect(drop).toBeGreaterThan(calm);
      const rest = glassPose(body, input({ isPlaying: false })).refraction;
      for (const over of [
        { t: 9.5, energy: 1, sectionLevel: 1 as const },
        { t: 31, stab: 1, pointer: { x: 10, y: 10 } },
        { energy: 0, beatPhase: 0 },
      ]) {
        expect(glassPose(body, input({ isPlaying: false, ...over })).refraction).toBe(rest);
      }
    });
  });

  it("glints on a DJ stab", () => {
    everyBody((body) => {
      for (const isPlaying of [true, false]) {
        const hit = glassPose(body, input({ isPlaying, stab: 1 })).glint;
        const none = glassPose(body, input({ isPlaying, stab: 0 })).glint;
        expect(hit).toBeGreaterThan(none);
        expect(hit).toBeLessThanOrEqual(1);
        expect(none).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("sits still at its anchor with reduced motion, whatever the time or pointer", () => {
    everyBody((body) => {
      for (const t of [0, 7.3, 1000]) {
        for (const pointer of [null, { x: 0, y: 0 }, { x: 1440, y: 900 }]) {
          const pose = glassPose(body, input({ t, pointer, reduced: true, stab: 1, beatPhase: 0.1 }));
          expect(pose.x).toBeCloseTo(body.ax * 1440, 6);
          expect(pose.y).toBeCloseTo(body.ay * 900, 6);
          expect(pose.rotateX).toBe(0);
          expect(pose.rotateY).toBe(0);
          expect(pose.rotateZ).toBe(0);
          expect(pose.scale).toBe(1);
          expect(pose.refraction).toBeGreaterThan(0);
        }
      }
    });
  });

  it("does not park over the transport strip or the social icons", () => {
    everyBody((body) => {
      let transport = 0;
      let icons = 0;
      let samples = 0;
      for (let t = 0; t < 60; t += 0.1) {
        const { x, y } = glassPose(body, input({ t }));
        samples++;
        if (x < 0.45 * 1440 && y < 0.12 * 900) transport++;
        if (x > 0.6 * 1440 && y > 0.85 * 900) icons++;
      }
      expect(transport / samples).toBeLessThanOrEqual(0.1);
      expect(icons / samples).toBeLessThanOrEqual(0.1);
    });
  });
});
