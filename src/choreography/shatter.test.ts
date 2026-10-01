import { describe, expect, it } from "vitest";

import {
  burstAt,
  createBurst,
  DURATION,
  FLIGHT_OUT,
  glyphShown,
  HOME,
  mulberry32,
  plateOpacity,
  pushFrom,
  REDUCED_DURATION,
  reducedPlate,
  shardPose,
  shardsFor,
  SHARD_COUNT,
  startBurst,
} from "./shatter";

import type { Push, ShardPose } from "./shatter";

/** Elapsed times through a burst, every 5 ms, a little past its end. */
const ts = Array.from({ length: Math.ceil((DURATION + 0.1) / 0.005) + 1 }, (_, i) => i * 0.005);
const right: Push = { x: 1, y: 0 };
const peak = (FLIGHT_OUT[1] + HOME) / 2 - 0.1; // in the hang, fully out
const offset = (pose: ShardPose) => Math.hypot(pose.x, pose.y);

describe("shatter timeline", () => {
  it("bursts out in 0.3–0.5 s, hangs briefly, reassembles, and is over in 1–1.5 s", () => {
    expect(FLIGHT_OUT[1] - FLIGHT_OUT[0]).toBeGreaterThanOrEqual(0.3);
    expect(FLIGHT_OUT[1]).toBeLessThanOrEqual(0.5);
    expect(HOME).toBeGreaterThan(FLIGHT_OUT[1]);
    expect(DURATION).toBeGreaterThanOrEqual(1);
    expect(DURATION).toBeLessThanOrEqual(1.5);
  });

  it("is the plain letter before a burst and once it has ended", () => {
    for (const t of [-1, -0.001, DURATION, DURATION + 5]) {
      expect(plateOpacity(t)).toBe(0);
      expect(glyphShown(t)).toBe(true);
    }
  });

  it("cuts straight to the perforated plate, so the hover answers at once", () => {
    expect(plateOpacity(0)).toBe(1);
    expect(glyphShown(0)).toBe(true); // still under the opaque plate: no flash of nothing
  });

  it("only hides or shows the glyph under a fully opaque plate, so the swap never shows", () => {
    for (let i = 1; i < ts.length; i++) {
      if (glyphShown(ts[i]) !== glyphShown(ts[i - 1])) {
        expect(plateOpacity(ts[i - 1])).toBe(1);
        expect(plateOpacity(ts[i])).toBe(1);
      }
    }
  });

  it("never leaves the letter blank: the glyph, the plate or the shards always show", () => {
    const shards = shardsFor(3, SHARD_COUNT.full);
    for (const t of ts) {
      const shown = Math.max(
        glyphShown(t) ? 1 : 0,
        plateOpacity(t),
        ...shards.map((shard) => shardPose(shard, t, right).opacity)
      );
      expect(shown).toBeGreaterThan(0.5);
    }
  });

  it("clears the plate while the shards are out, and brings it back as they land", () => {
    expect(plateOpacity(peak)).toBe(0);
    expect(glyphShown(peak)).toBe(false);
    expect(plateOpacity(HOME + 0.01)).toBe(1);
  });
});

describe("shatter shards", () => {
  it("are the same for a seed, inside the letter box, and in both of the grid's colours", () => {
    const shards = shardsFor(7, SHARD_COUNT.full);
    expect(shardsFor(7, SHARD_COUNT.full)).toEqual(shards);
    expect(shards).toHaveLength(SHARD_COUNT.full);
    for (const shard of shards) {
      expect(shard.x).toBeGreaterThan(0);
      expect(shard.x).toBeLessThan(1);
      expect(shard.y).toBeGreaterThan(0);
      expect(shard.y).toBeLessThan(1);
      expect(shard.size).toBeGreaterThan(0.1);
      expect(shard.size).toBeLessThan(0.3);
    }
    for (const count of [SHARD_COUNT.lite, SHARD_COUNT.full]) {
      const blues = shardsFor(7, count).filter((shard) => shard.blue).length;
      expect(blues).toBeGreaterThan(0);
      expect(blues).toBeLessThan(count);
    }
  });

  it("are hidden and home before the burst and from the moment they land", () => {
    for (const shard of shardsFor(2, SHARD_COUNT.full)) {
      for (const t of [-0.1, HOME, HOME + 0.1, DURATION, DURATION + 1]) {
        const pose = shardPose(shard, t, right);
        expect(pose.opacity).toBe(0);
        expect([pose.x, pose.y, pose.rotate]).toEqual([0, 0, 0]);
      }
    }
  });

  it("fly out (some near, most well clear of the letter) and spin, then come home", () => {
    const shards = shardsFor(4, SHARD_COUNT.full);
    const mean = shards.reduce((sum, shard) => sum + offset(shardPose(shard, peak, { x: 0, y: 0 })), 0) / shards.length;
    expect(mean).toBeGreaterThan(0.3); // em
    for (const shard of shards) {
      const out = shardPose(shard, peak, { x: 0, y: 0 });
      expect(out.opacity).toBe(1);
      expect(offset(out)).toBeGreaterThan(0.15); // em
      expect(Math.abs(out.rotate)).toBeGreaterThan(60);
      expect(offset(shardPose(shard, HOME - 0.002, { x: 0, y: 0 }))).toBeLessThan(0.04);
    }
  });

  it("move continuously: no jump between 5 ms steps bigger than a fast flight allows", () => {
    for (const shard of shardsFor(9, SHARD_COUNT.full)) {
      let last = shardPose(shard, 0, right);
      let lastX = last.x;
      let lastY = last.y;
      for (const t of ts) {
        last = shardPose(shard, t, right);
        expect(Math.hypot(last.x - lastX, last.y - lastY)).toBeLessThan(0.08);
        lastX = last.x;
        lastY = last.y;
      }
    }
  });

  it("blow away from where the pointer came in, for every letter's seed and either shard count", () => {
    const directions: Push[] = [right, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (let seed = 0; seed < 40; seed++) {
      for (const count of [SHARD_COUNT.lite, SHARD_COUNT.full]) {
        const shards = shardsFor(seed, count);
        for (const push of directions) {
          const mean = shards.reduce(
            (sum, shard) => {
              const pose = shardPose(shard, peak, push);
              return { x: sum.x + pose.x / count, y: sum.y + pose.y / count };
            },
            { x: 0, y: 0 }
          );
          expect(mean.x * push.x + mean.y * push.y).toBeGreaterThan(0.12);
        }
      }
    }
  });

  it("writes into the pose it is given, so the per-frame loop allocates nothing", () => {
    const out: ShardPose = { x: 0, y: 0, rotate: 0, scale: 0, opacity: 0 };
    expect(shardPose(shardsFor(1, 3)[0], peak, right, out)).toBe(out);
  });

  it("are reproducible from a seed (mulberry32)", () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    expect([a(), a()]).toEqual([b(), b()]);
  });
});

describe("shatter push", () => {
  const box = { left: 100, right: 160, top: 0, bottom: 200 };

  it("points from the pointer's entry through the letter, full at its edges", () => {
    expect(pushFrom(100, 100, box)).toEqual({ x: 1, y: 0 });
    expect(pushFrom(160, 100, box)).toEqual({ x: -1, y: 0 });
    expect(pushFrom(130, 0, box)).toEqual({ x: 0, y: 1 });
    expect(pushFrom(130, 200, box)).toEqual({ x: 0, y: -1 });
  });

  it("fades out toward the letter's centre (a tap in the middle bursts evenly)", () => {
    expect(pushFrom(130, 100, box)).toEqual({ x: 0, y: 0 });
    const push = pushFrom(115, 100, box);
    expect(push.x).toBeCloseTo(0.5);
  });

  it("is never longer than 1, even for a corner or a point outside", () => {
    for (const [x, y] of [
      [100, 0],
      [40, 300],
      [161, 210],
    ]) {
      const push = pushFrom(x, y, box);
      expect(Math.hypot(push.x, push.y)).toBeLessThanOrEqual(1 + 1e-9);
      expect(Math.hypot(push.x, push.y)).toBeGreaterThan(0.9);
    }
  });
});

describe("shatter bursts", () => {
  it("start on an idle letter, and not again until the shards have landed", () => {
    const burst = createBurst();
    expect(burstAt(burst, 10)).toBeNull();
    expect(startBurst(burst, 10, right, false)).toBe(true);
    expect(burstAt(burst, 10.2)).toBeCloseTo(0.2);
    expect(startBurst(burst, 10.2, { x: -1, y: 0 }, false)).toBe(false);
    expect(burst.push).toEqual(right);
    expect(startBurst(burst, 10 + HOME - 0.01, { x: -1, y: 0 }, false)).toBe(false);
    expect(startBurst(burst, 10 + HOME + 0.001, { x: -1, y: 0 }, false)).toBe(true);
    expect(burst.start).toBe(10 + HOME + 0.001);
    expect(burst.push).toEqual({ x: -1, y: 0 });
  });

  it("end after DURATION (the letter is plain and the painter can stop)", () => {
    const burst = createBurst();
    startBurst(burst, 3, right, false);
    expect(burstAt(burst, 3 + DURATION - 0.01)).not.toBeNull();
    expect(burstAt(burst, 3 + DURATION)).toBeNull();
    expect(startBurst(burst, 3 + DURATION + 1, right, false)).toBe(true);
  });

  it("under reduced motion are only a short plate fade, and end sooner", () => {
    const burst = createBurst();
    startBurst(burst, 0, right, true);
    expect(burst.reduced).toBe(true);
    expect(burstAt(burst, REDUCED_DURATION - 0.01)).not.toBeNull();
    expect(burstAt(burst, REDUCED_DURATION)).toBeNull();
    expect(REDUCED_DURATION).toBeLessThan(1);
    expect(reducedPlate(0)).toBe(0);
    expect(reducedPlate(REDUCED_DURATION)).toBe(0);
    const most = Math.max(...ts.map(reducedPlate));
    expect(most).toBeGreaterThan(0.5);
    expect(most).toBeLessThanOrEqual(1);
    // A fade, not a cut: no step bigger than a 60 fps frame's worth of a 0.15 s fade.
    for (let i = 1; i < ts.length; i++) expect(Math.abs(reducedPlate(ts[i]) - reducedPlate(ts[i - 1]))).toBeLessThan(0.1);
  });
});
