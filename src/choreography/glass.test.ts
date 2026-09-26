import { describe, expect, it } from "vitest";

import {
  applyFriction,
  collideWalls,
  createBodies,
  dragTo,
  glassHalfSize,
  glassMap,
  glassPose,
  glassSheen,
  hitGlass,
  initialState,
  release,
  releaseVelocity,
  stepGlass,
  supportsRefraction,
} from "./glass";

import type { GlassBody, GlassInput, GlassState } from "./glass";

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

const W = 1440;
const H = 900;
const STEP = 1 / 120;

/** Run a body's physics for `seconds` of 120 Hz frames from time t0, calling `each` after every frame. */
const simulate = (
  body: GlassBody,
  state: GlassState,
  seconds: number,
  over: { t0?: number; width?: number; height?: number; reduced?: boolean } = {},
  each?: (state: GlassState, t: number) => void,
): GlassState => {
  const { t0 = 0, width = W, height = H, reduced = false } = over;
  let current = state;
  const frames = Math.round(seconds / STEP);
  for (let i = 1; i <= frames; i++) {
    const t = t0 + i * STEP;
    current = stepGlass(body, current, { t, dt: STEP, width, height, reduced });
    each?.(current, t);
  }
  return current;
};

const inside = (body: GlassBody, state: GlassState, width = W, height = H) => {
  const { hw, hh } = glassHalfSize(body, width, height);
  return (
    state.x >= hw - 1e-6 && state.x <= width - hw + 1e-6 && state.y >= hh - 1e-6 && state.y <= height - hh + 1e-6
  );
};

describe("glass drift", () => {
  it("moves continuously: < 3 px and < 1 deg between 120 Hz frames over 30 s", () => {
    let maxMove = 0;
    let maxTurn = 0;
    everyBody((body) => {
      for (const pointer of [null, { x: 1000, y: 200 }]) {
        let state = initialState(body, 0, W, H, false);
        let prevPose = glassPose(body, input({ pointer }), state);
        simulate(body, state, 30, {}, (next, t) => {
          maxMove = Math.max(maxMove, Math.abs(next.x - state.x), Math.abs(next.y - state.y));
          const pose = glassPose(body, input({ t, pointer }), next);
          maxTurn = Math.max(
            maxTurn,
            Math.abs(pose.rotateX - prevPose.rotateX),
            Math.abs(pose.rotateY - prevPose.rotateY),
            Math.abs(pose.rotateZ - prevPose.rotateZ),
          );
          state = next;
          prevPose = pose;
        });
      }
    });
    expect(maxMove).toBeLessThan(3);
    expect(maxTurn).toBeLessThan(1);
  });

  it("survives a huge dt (tab hidden for ages): finite and inside the walls", () => {
    everyBody((body) => {
      for (const start of [initialState(body, 0, W, H, false), { ...initialState(body, 0, W, H, false), mode: "thrown" as const, vx: 4000, vy: -3000 }]) {
        const next = stepGlass(body, start, { t: 1000, dt: 1000, width: W, height: H, reduced: false });
        for (const value of [next.x, next.y, next.vx, next.vy]) expect(Number.isFinite(value)).toBe(true);
        expect(inside(body, next)).toBe(true);
        const pose = glassPose(body, input({ t: 1000 }), next);
        for (const value of Object.values(pose)) expect(Number.isFinite(value)).toBe(true);
      }
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
        let frame = 0;
        simulate(body, initialState(body, 0, width, height, false), 120, { width, height }, (state, t) => {
          if (frame++ % 45) return;
          for (const pointer of pointers) {
            for (const beatPhase of [0, 0.1, 0.2, 0.5, 0.9]) {
              const pose = glassPose(body, input({ t, width, height, pointer, beatPhase, stab: 1, energy: 1 }), state);
              tilt = Math.max(tilt, Math.abs(pose.rotateX), Math.abs(pose.rotateY));
              spin = Math.max(spin, Math.abs(pose.rotateZ));
              [minX, maxX] = [Math.min(minX, pose.x), Math.max(maxX, pose.x)];
              [minY, maxY] = [Math.min(minY, pose.y), Math.max(maxY, pose.y)];
            }
          }
        });
        if (width === 500) expect(glassPose(body, input({ width, height }), initialState(body, 0, width, height, false)).w).toBeLessThanOrEqual(0.6 * 500);
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
        const state = initialState(body, t, W, H, false);
        const right = glassPose(body, input({ t, pointer: { x: 1440, y: 450 } }), state);
        const left = glassPose(body, input({ t, pointer: { x: 0, y: 450 } }), state);
        expect(right.rotateY).toBeGreaterThan(left.rotateY);
      }
    });
  });

  it("refracts harder with energy and in a drop, and rests at a fixed value when stopped", () => {
    everyBody((body) => {
      const state = initialState(body, 0, W, H, false);
      const at = (over: Partial<GlassInput>) => glassPose(body, input(over), state).refraction;
      expect(at({ energy: 1 })).toBeGreaterThan(at({ energy: 0 }));
      expect(at({ sectionLevel: 1 })).toBeGreaterThan(at({ sectionLevel: 0 }));
      const rest = at({ isPlaying: false });
      for (const over of [
        { t: 9.5, energy: 1, sectionLevel: 1 as const },
        { t: 31, stab: 1, pointer: { x: 10, y: 10 } },
        { energy: 0, beatPhase: 0 },
      ]) {
        expect(at({ isPlaying: false, ...over })).toBe(rest);
      }
    });
  });

  it("glints on a DJ stab", () => {
    everyBody((body) => {
      const state = initialState(body, 0, W, H, false);
      for (const isPlaying of [true, false]) {
        const hit = glassPose(body, input({ isPlaying, stab: 1 }), state).glint;
        const none = glassPose(body, input({ isPlaying, stab: 0 }), state).glint;
        expect(hit).toBeGreaterThan(none);
        expect(hit).toBeLessThanOrEqual(1);
        expect(none).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("sits still at its anchor with reduced motion: no drift, tilt or pulses", () => {
    everyBody((body) => {
      const start = initialState(body, 5, W, H, true);
      expect(start.x).toBeCloseTo(body.ax * W, 6);
      expect(start.y).toBeCloseTo(body.ay * H, 6);
      simulate(body, start, 10, { t0: 5, reduced: true }, (state, t) => {
        expect(state.x).toBeCloseTo(body.ax * W, 6);
        expect(state.y).toBeCloseTo(body.ay * H, 6);
        if (Math.round(t * 120) % 240) return;
        for (const pointer of [null, { x: 0, y: 0 }, { x: 1440, y: 900 }]) {
          const pose = glassPose(body, input({ t, pointer, reduced: true, stab: 1, beatPhase: 0.1 }), state);
          expect(pose.x).toBeCloseTo(state.x, 6);
          expect(pose.y).toBeCloseTo(state.y, 6);
          expect([pose.rotateX, pose.rotateY, pose.rotateZ]).toEqual([0, 0, 0]);
          expect([pose.scale, pose.squashX, pose.squashY]).toEqual([1, 1, 1]);
          expect(pose.refraction).toBeGreaterThan(0);
        }
      });
    });
  });

  it("drifts clear of the transport strip and the social icons", () => {
    everyBody((body) => {
      let transport = 0;
      let icons = 0;
      let samples = 0;
      simulate(body, initialState(body, 0, W, H, false), 60, {}, ({ x, y }) => {
        samples++;
        if (x < 0.45 * W && y < 0.12 * H) transport++;
        if (x > 0.6 * W && y > 0.85 * H) icons++;
      });
      expect(transport / samples).toBeLessThanOrEqual(0.1);
      expect(icons / samples).toBeLessThanOrEqual(0.1);
    });
  });

  it("keeps every body inside the new walls when the window shrinks", () => {
    everyBody((body) => {
      const wide = { ...initialState(body, 0, W, H, false), x: W - 20, y: H - 20 };
      const next = stepGlass(body, wide, { t: STEP, dt: STEP, width: 800, height: 600, reduced: false });
      expect(inside(body, next, 800, 600)).toBe(true);
      expect(next.impact).toBe(0); // a resize nudge is not a hit: no ping
    });
  });
});

describe("releaseVelocity", () => {
  const track = (vx: number, vy: number, from: number, to: number, x0 = 500, y0 = 400) => {
    const samples = [];
    for (let t = from; t <= to + 1e-9; t += 1 / 60) samples.push({ t, x: x0 + vx * (t - from), y: y0 + vy * (t - from) });
    return samples;
  };

  it("measures a steady fling from the last ~80 ms of samples", () => {
    const samples = track(1000, -500, 0, 0.3);
    const { vx, vy } = releaseVelocity(samples, 0.3);
    expect(vx).toBeCloseTo(1000, 0);
    expect(vy).toBeCloseTo(-500, 0);
  });

  it("ignores motion older than the window", () => {
    const back = track(-2000, 0, 0, 0.2);
    const last = back[back.length - 1];
    const samples = [...back, ...track(600, 0, 0.2 + 1 / 60, 0.35, last.x, last.y)];
    expect(releaseVelocity(samples, 0.35).vx).toBeCloseTo(600, 0);
  });

  it("is zero when the pointer stopped before letting go, or with too few samples", () => {
    const samples = track(1000, 0, 0, 0.2);
    expect(releaseVelocity(samples, 0.45)).toEqual({ vx: 0, vy: 0 });
    expect(releaseVelocity(samples.slice(0, 1), 0)).toEqual({ vx: 0, vy: 0 });
    expect(releaseVelocity([], 1)).toEqual({ vx: 0, vy: 0 });
  });
});

describe("applyFriction", () => {
  it("slows exponentially, the same at any frame rate", () => {
    let fine = 1200;
    for (let i = 0; i < 12; i++) fine = applyFriction(fine, 1 / 120);
    const coarse = applyFriction(1200, 0.1);
    expect(fine).toBeCloseTo(coarse, 6);
    expect(coarse).toBeLessThan(1200);
    expect(coarse).toBeGreaterThan(0);
    expect(applyFriction(-1200, 0.1)).toBeCloseTo(-coarse, 6);
  });
});

describe("collideWalls", () => {
  const body = createBodies(seeded(3))[1];
  const { hw, hh } = glassHalfSize(body, W, H);
  const base = initialState(body, 0, W, H, false);

  it("reflects and damps the normal velocity, clamps inside, and records the hit", () => {
    const hit = collideWalls({ ...base, x: hw - 30, vx: -1000, vy: 200 }, hw, hh, W, H, 7);
    expect(hit.x).toBe(hw);
    expect(hit.vx).toBeCloseTo(800, 6);
    expect(hit.vy).toBe(200);
    expect(hit.impact).toBeGreaterThan(0);
    expect(hit.impactAt).toBe(7);
    expect(hit.impactAxis).toBe("x");
    const floor = collideWalls({ ...base, y: H - hh + 5, vx: 0, vy: 1600 }, hw, hh, W, H, 8);
    expect(floor.y).toBe(H - hh);
    expect(floor.vy).toBeCloseTo(-1280, 6);
    expect(floor.impactAxis).toBe("y");
    expect(floor.impact).toBeGreaterThan(hit.impact);
  });

  it("leaves a body inside the walls alone, and a slow touch doesn't ping", () => {
    const free = { ...base, vx: 300, vy: -300 };
    expect(collideWalls(free, hw, hh, W, H, 1)).toEqual(free);
    expect(collideWalls({ ...base, x: hw - 1, vx: -20 }, hw, hh, W, H, 1).impact).toBe(0);
  });
});

describe("throwing", () => {
  it("glides to a stop and makes that its new home, without snapping back", () => {
    everyBody((body) => {
      const thrown = release(initialState(body, 0, W, H, false), { vx: 900, vy: 300 }, W, H, false);
      expect(thrown.mode).toBe("thrown");
      let stoppedAt: { x: number; y: number; t: number } | null = null;
      let far = 0;
      simulate(body, thrown, 25, {}, (state, t) => {
        if (!stoppedAt && state.mode === "drift") stoppedAt = { x: state.x, y: state.y, t };
        if (stoppedAt) far = Math.max(far, Math.hypot(state.x - stoppedAt.x, state.y - stoppedAt.y));
      });
      expect(stoppedAt).not.toBeNull();
      expect(stoppedAt!.t).toBeLessThan(6);
      // afterwards it only wanders its gentle orbit around the new home
      const orbit = Math.hypot(body.orbit.rx * W, body.orbit.ry * H) * 2;
      expect(far).toBeLessThanOrEqual(orbit);
      expect(far).toBeGreaterThan(0);
    });
  });

  it("never ends up outside the viewport, however hard it's thrown", () => {
    const random = seeded(42);
    everyBody((body) => {
      for (let k = 0; k < 3; k++) {
        const angle = random() * 2 * Math.PI;
        const speed = 500 + random() * 9000;
        const thrown = release(initialState(body, 0, W, H, false), { vx: speed * Math.cos(angle), vy: speed * Math.sin(angle) }, W, H, false);
        let ok = true;
        simulate(body, thrown, 8, {}, (state) => {
          ok &&= inside(body, state);
        });
        expect(ok).toBe(true);
      }
    });
  });

  it("with reduced motion, lets go without momentum and stays where it was put", () => {
    everyBody((body) => {
      const dropped = release({ ...initialState(body, 0, W, H, true), x: 700, y: 420 }, { vx: 2000, vy: 0 }, W, H, true);
      expect([dropped.vx, dropped.vy]).toEqual([0, 0]);
      const later = simulate(body, dropped, 5, { reduced: true });
      expect(later.x).toBeCloseTo(700, 6);
      expect(later.y).toBeCloseTo(420, 6);
    });
  });
});

describe("dragging", () => {
  const body = createBodies(seeded(5))[0];
  const { hw, hh } = glassHalfSize(body, W, H);
  const start = initialState(body, 0, W, H, false);

  it("follows the pointer immediately, keeping the grab offset", () => {
    const held = dragTo(start, { x: 800, y: 500 }, { x: 12, y: -7 }, hw, hh, W, H);
    expect(held.mode).toBe("held");
    expect(held.x).toBe(788);
    expect(held.y).toBe(507);
    // while held, physics doesn't move it
    const next = stepGlass(body, held, { t: 1, dt: 0.05, width: W, height: H, reduced: false });
    expect([next.x, next.y]).toEqual([788, 507]);
  });

  it("stops at the walls", () => {
    const held = dragTo(start, { x: -300, y: 5000 }, { x: 0, y: 0 }, hw, hh, W, H);
    expect(held.x).toBe(hw);
    expect(held.y).toBe(H - hh);
  });
});

describe("hitGlass", () => {
  const bodies = createBodies(seeded(9));
  const states = bodies.map((body) => initialState(body, 0, W, H, false));

  it("finds the topmost piece under the pointer, by its drawn size", () => {
    const i = hitGlass(bodies, states, { x: states[2].x, y: states[2].y }, W, H);
    expect(i).toBe(2);
    const { hw } = glassHalfSize(bodies[2], W, H);
    expect(hitGlass(bodies, states, { x: states[2].x + hw - 1, y: states[2].y }, W, H)).toBe(2);
    expect(hitGlass(bodies, states, { x: -50, y: -50 }, W, H)).toBe(-1);
    const stacked = states.map((state) => ({ ...state, x: 700, y: 450 }));
    expect(hitGlass(bodies, stacked, { x: 700, y: 450 }, W, H)).toBe(bodies.length - 1);
  });
});

describe("wall ping", () => {
  it("flashes and squashes on impact, scaled by speed, then settles", () => {
    everyBody((body) => {
      const { hw, hh } = glassHalfSize(body, W, H);
      const base = initialState(body, 0, W, H, false);
      const soft = collideWalls({ ...base, x: hw - 1, vx: -400 }, hw, hh, W, H, 10);
      const hard = collideWalls({ ...base, x: hw - 1, vx: -3000 }, hw, hh, W, H, 10);
      const quiet = glassPose(body, input({ t: 10.02, stab: 0, isPlaying: false }), base);
      const softPose = glassPose(body, input({ t: 10.02, stab: 0, isPlaying: false }), soft);
      const hardPose = glassPose(body, input({ t: 10.02, stab: 0, isPlaying: false }), hard);
      expect(softPose.glint).toBeGreaterThan(quiet.glint);
      expect(hardPose.glint).toBeGreaterThanOrEqual(softPose.glint);
      expect(Math.abs(1 - hardPose.squashX)).toBeGreaterThan(Math.abs(1 - softPose.squashX));
      expect(Math.abs(1 - softPose.squashX)).toBeGreaterThan(0);
      const settled = glassPose(body, input({ t: 11.5, stab: 0, isPlaying: false }), hard);
      expect(settled.glint).toBeLessThan(0.01);
      expect(settled.squashX).toBeCloseTo(1, 2);
      expect(settled.squashY).toBeCloseTo(1, 2);
    });
  });
});

describe("supportsRefraction", () => {
  const CHROME_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
  const SAFARI_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const FIREFOX_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0";
  const IOS_CHROME_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1";

  it("trusts the brand list when there is one", () => {
    const brands = [{ brand: "Not=A?Brand" }, { brand: "Chromium" }, { brand: "Google Chrome" }];
    expect(supportsRefraction({ userAgent: SAFARI_UA, userAgentData: { brands } })).toBe(true);
    expect(supportsRefraction({ userAgent: CHROME_UA, userAgentData: { brands: [{ brand: "Other" }] } })).toBe(false);
  });

  it("falls back to the user agent when brands are missing or empty", () => {
    expect(supportsRefraction({ userAgent: CHROME_UA, userAgentData: { brands: [] } })).toBe(true);
    expect(supportsRefraction({ userAgent: CHROME_UA })).toBe(true);
    expect(supportsRefraction({ userAgent: SAFARI_UA })).toBe(false);
    expect(supportsRefraction({ userAgent: FIREFOX_UA })).toBe(false);
    expect(supportsRefraction({ userAgent: IOS_CHROME_UA })).toBe(false);
  });
});

describe("glassSheen", () => {
  it("sits up and to the right at rest, where the head's key light is", () => {
    const rest = glassSheen(0, 0);
    expect(rest.x).toBeGreaterThan(50);
    expect(rest.y).toBeLessThan(50);
  });

  it("slides against the tilt and brightens as the glass turns toward the light", () => {
    const right = glassSheen(0, 15);
    const left = glassSheen(0, -15);
    expect(right.x).toBeLessThan(left.x);
    expect(right.intensity).toBeGreaterThan(left.intensity);
    const up = glassSheen(15, 0);
    const down = glassSheen(-15, 0);
    expect(up.y).toBeGreaterThan(down.y);
    expect(up.intensity).toBeGreaterThan(down.intensity);
    for (const sheen of [right, left, up, down, glassSheen(18, 18), glassSheen(-18, -18)]) {
      expect(sheen.intensity).toBeGreaterThanOrEqual(0);
      expect(sheen.intensity).toBeLessThanOrEqual(1);
    }
  });
});
