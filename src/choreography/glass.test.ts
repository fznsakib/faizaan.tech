import { describe, expect, it } from "vitest";

import {
  applyFriction,
  collideWalls,
  createBodies,
  dragTo,
  glassExtent,
  glassMap,
  glassPose,
  glassScale,
  glassSheen,
  hitGlass,
  initialState,
  outlinePath,
  release,
  releaseVelocity,
  stepGlass,
  supportsRefraction,
} from "./glass";

import type { GlassBody, GlassInput, GlassState, Point } from "./glass";

/** mulberry32: a small seeded PRNG so body layouts are reproducible. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const px = (map: ReturnType<typeof glassMap>, x: number, y: number) => {
  const i = (y * map.width + x) * 4;
  return { r: map.data[i], g: map.data[i + 1], a: map.data[i + 3] };
};

/** An axis-aligned ellipse outline filling a width x height box: symmetric, so the map must be too. */
const ellipse = (width: number, height: number, n = 96): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return { x: width / 2 + (width / 2) * Math.cos(angle), y: height / 2 + (height / 2) * Math.sin(angle) };
  });

describe("glassMap", () => {
  const map = glassMap(ellipse(200, 120), 200, 120, 24);

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

  it("follows a weird outline: neutral in the middle, pushing inward along its normal at the rim", () => {
    for (const seed of [1, 2, 3]) {
      for (const body of createBodies(seeded(seed))) {
        const left = -Math.min(...body.outline.map((point) => point.x));
        const top = -Math.min(...body.outline.map((point) => point.y));
        const local = body.outline.map((point) => ({ x: point.x + left, y: point.y + top }));
        const map = glassMap(local, Math.ceil(body.w), Math.ceil(body.h), 20);
        const centre = px(map, Math.floor(left), Math.floor(top));
        expect(centre).toMatchObject({ r: 128, g: 128 });
        const n = local.length;
        for (let i = 0; i < n; i += 8) {
          const [before, at, after] = [local[(i - 1 + n) % n], local[i], local[(i + 1) % n]];
          // inward normal of a counter-clockwise outline (y down): the tangent turned toward the inside
          const tx = after.x - before.x;
          const ty = after.y - before.y;
          const length = Math.hypot(tx, ty);
          const inward = { x: -ty / length, y: tx / length };
          const sample = px(map, Math.floor(at.x + 3 * inward.x), Math.floor(at.y + 3 * inward.y));
          const push = { x: (sample.r - 128) / 127, y: (sample.g - 128) / 127 };
          expect(Math.hypot(push.x, push.y)).toBeGreaterThan(0.6);
          expect((push.x * inward.x + push.y * inward.y) / Math.hypot(push.x, push.y)).toBeGreaterThan(0.8);
        }
      }
    }
  });
});

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

  const segmentsCross = (a: Point, b: Point, c: Point, d: Point) => {
    const side = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  };
  const area = (outline: Point[]) =>
    outline.reduce((sum, p, i) => {
      const q = outline[(i + 1) % outline.length];
      return sum + (p.x * q.y - q.x * p.y) / 2;
    }, 0);

  it("draws smooth, simple, substantial outlines", () => {
    everyBody((body) => {
      const { outline } = body;
      const n = outline.length;
      expect(n).toBeGreaterThanOrEqual(48);
      let crossings = 0;
      let sharpest = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;
          if (segmentsCross(outline[i], outline[i + 1], outline[j], outline[(j + 1) % n])) crossings++;
        }
        // smooth: consecutive edges turn by less than 20 degrees
        const [a, b, c] = [outline[i], outline[(i + 1) % n], outline[(i + 2) % n]];
        const turn = Math.atan2((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y));
        sharpest = Math.max(sharpest, Math.abs(turn));
      }
      expect(crossings).toBe(0);
      expect(sharpest).toBeLessThan((20 * Math.PI) / 180);
      // counter-clockwise on screen (y down), and fills a good part of its bounding box
      expect(area(outline)).toBeGreaterThan(0.5 * body.w * body.h);
    });
  });

  it("is never a circle, ellipse or rounded rectangle: every outline is lopsided", () => {
    everyBody((body) => {
      const { outline } = body;
      const n = outline.length;
      let lopsided = 0;
      for (let i = 0; i < n / 2; i++) {
        const near = Math.hypot(outline[i].x, outline[i].y);
        const far = Math.hypot(outline[i + n / 2].x, outline[i + n / 2].y);
        lopsided = Math.max(lopsided, Math.abs(near - far) / ((near + far) / 2));
      }
      expect(lopsided).toBeGreaterThan(0.05);
    });
  });

  it("gives every piece on a page its own shape", () => {
    for (const seed of SEEDS) {
      const outlines = createBodies(seeded(seed)).map((body) => JSON.stringify(body.outline));
      expect(new Set(outlines).size).toBe(outlines.length);
    }
  });
});

describe("outlinePath", () => {
  it("traces the outline as a closed, smooth SVG path in the pane's pixels", () => {
    const body = createBodies(seeded(4))[0];
    const d = outlinePath(body.outline, 0.5, 10, 20);
    expect(d.startsWith(`M${(body.outline[0].x * 0.5 + 10).toFixed(1)},${(body.outline[0].y * 0.5 + 20).toFixed(1)}`)).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d.match(/C/g)?.length).toBe(body.outline.length);
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

/** Every vertex of the drawn outline lies inside the viewport. */
const inside = (body: GlassBody, state: GlassState, width = W, height = H) => {
  const e = glassExtent(body, width, height);
  return (
    state.x - e.left >= -1e-6 &&
    state.x + e.right <= width + 1e-6 &&
    state.y - e.top >= -1e-6 &&
    state.y + e.bottom <= height + 1e-6
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
  const e = glassExtent(body, W, H);
  const base = initialState(body, 0, W, H, false);

  it("reflects and damps the normal velocity, clamps inside, and records the hit", () => {
    const hit = collideWalls({ ...base, x: e.left - 30, vx: -1000, vy: 200 }, e, W, H, 7);
    expect(hit.x).toBe(e.left);
    expect(hit.vx).toBeCloseTo(800, 6);
    expect(hit.vy).toBe(200);
    expect(hit.impact).toBeGreaterThan(0);
    expect(hit.impactAt).toBe(7);
    expect(hit.impactAxis).toBe("x");
    const floor = collideWalls({ ...base, y: H - e.bottom + 5, vx: 0, vy: 1600 }, e, W, H, 8);
    expect(floor.y).toBe(H - e.bottom);
    expect(floor.vy).toBeCloseTo(-1280, 6);
    expect(floor.impactAxis).toBe("y");
    expect(floor.impact).toBeGreaterThan(hit.impact);
  });

  it("leaves a body inside the walls alone, and a slow touch doesn't ping", () => {
    const free = { ...base, vx: 300, vy: -300 };
    expect(collideWalls(free, e, W, H, 1)).toEqual(free);
    expect(collideWalls({ ...base, x: e.left - 1, vx: -20 }, e, W, H, 1).impact).toBe(0);
  });

  it("bounces a lumpy piece when its own bump touches the wall, never letting it poke out", () => {
    everyBody((piece) => {
      const reach = glassExtent(piece, W, H);
      const size = glassScale(piece, W, H);
      const hit = collideWalls({ ...initialState(piece, 0, W, H, false), x: W, vx: 900 }, reach, W, H, 3);
      expect(hit.x).toBeCloseTo(W - reach.right, 6);
      expect(hit.vx).toBeLessThan(0);
      // what touches is the outline's own rightmost bump (plus a little room for its spin), not a symmetric box
      const rightmost = Math.max(...piece.outline.map((point) => point.x)) * size;
      const radius = Math.max(...piece.outline.map((point) => Math.hypot(point.x, point.y))) * size;
      expect(hit.x + rightmost).toBeLessThanOrEqual(W + 1e-6);
      expect(reach.right).toBeGreaterThanOrEqual(rightmost - 1e-6);
      expect(reach.right).toBeLessThanOrEqual(rightmost + 0.1 * radius);
    });
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
  const e = glassExtent(body, W, H);
  const start = initialState(body, 0, W, H, false);

  it("follows the pointer immediately, keeping the grab offset", () => {
    const held = dragTo(start, { x: 800, y: 500 }, { x: 12, y: -7 }, e, W, H);
    expect(held.mode).toBe("held");
    expect(held.x).toBe(788);
    expect(held.y).toBe(507);
    // while held, physics doesn't move it
    const next = stepGlass(body, held, { t: 1, dt: 0.05, width: W, height: H, reduced: false });
    expect([next.x, next.y]).toEqual([788, 507]);
  });

  it("stays glued to the pointer while held: no beat bob moves it off the grab point", () => {
    const held = dragTo(start, { x: 800, y: 500 }, { x: 0, y: 0 }, e, W, H);
    for (const beatPhase of [0.05, 0.18, 0.4, 0.75]) {
      const pose = glassPose(body, input({ isPlaying: true, beatPhase, energy: 1 }), held);
      expect([pose.x, pose.y]).toEqual([held.x, held.y]);
    }
  });

  it("stops at the walls", () => {
    const held = dragTo(start, { x: -300, y: 5000 }, { x: 0, y: 0 }, e, W, H);
    expect(held.x).toBe(e.left);
    expect(held.y).toBe(H - e.bottom);
  });
});

describe("hitGlass", () => {
  const bodies = createBodies(seeded(9));
  const states = bodies.map((body) => initialState(body, 0, W, H, false));

  it("finds the topmost piece under the pointer, by its actual outline", () => {
    const i = hitGlass(bodies, states, { x: states[2].x, y: states[2].y }, W, H);
    expect(i).toBe(2);
    expect(hitGlass(bodies, states, { x: -50, y: -50 }, W, H)).toBe(-1);
    // just inside and just outside the outline's rightmost point
    const size = glassScale(bodies[2], W, H);
    const tip = bodies[2].outline.reduce((a, b) => (b.x > a.x ? b : a));
    const alone = states.map((state, k) => (k === 2 ? state : { ...state, x: -9999 }));
    expect(hitGlass(bodies, alone, { x: states[2].x + tip.x * size - 2, y: states[2].y + tip.y * size }, W, H)).toBe(2);
    expect(hitGlass(bodies, alone, { x: states[2].x + tip.x * size + 2, y: states[2].y + tip.y * size }, W, H)).toBe(-1);
    const stacked = states.map((state) => ({ ...state, x: 700, y: 450 }));
    expect(hitGlass(bodies, stacked, { x: 700, y: 450 }, W, H)).toBe(bodies.length - 1);
  });

  it("misses the empty corners of a piece's own bounding box: point-in-outline, not a box test", () => {
    for (const seed of SEEDS) {
      const pieces = createBodies(seeded(seed));
      pieces.forEach((body, i) => {
        const size = glassScale(body, W, H);
        const alone = pieces.map((piece, k) => ({ ...initialState(piece, 0, W, H, false), x: k === i ? 720 : -9999, y: 450 }));
        const xs = body.outline.map((point) => point.x * size);
        const ys = body.outline.map((point) => point.y * size);
        const [left, right, top, bottom] = [Math.min(...xs) + 2, Math.max(...xs) - 2, Math.min(...ys) + 2, Math.max(...ys) - 2];
        expect(hitGlass(pieces, alone, { x: 720, y: 450 }, W, H)).toBe(i);
        for (const [x, y] of [
          [left, top],
          [right, top],
          [left, bottom],
          [right, bottom],
        ]) {
          expect(hitGlass(pieces, alone, { x: 720 + x, y: 450 + y }, W, H)).toBe(-1);
        }
      });
    }
  });
});

describe("wall ping", () => {
  it("flashes and squashes on impact, scaled by speed, then settles", () => {
    everyBody((body) => {
      const e = glassExtent(body, W, H);
      const base = initialState(body, 0, W, H, false);
      const soft = collideWalls({ ...base, x: e.left - 1, vx: -400 }, e, W, H, 10);
      const hard = collideWalls({ ...base, x: e.left - 1, vx: -3000 }, e, W, H, 10);
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
