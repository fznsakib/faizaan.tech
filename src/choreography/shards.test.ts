import { describe, expect, it } from "vitest";

import { generateShards, recutDue, shardCount } from "./shards";

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const frame = (overrides: Partial<{ isPlaying: boolean; isDownbeat: boolean; barIndex: number; sectionLevel: 0 | 1 }>) => ({
  isPlaying: true,
  isDownbeat: true,
  barIndex: 4,
  sectionLevel: 0 as 0 | 1,
  ...overrides,
});

describe("generateShards", () => {
  it("makes in-bounds shards with valid 3–8 point polygons", () => {
    const random = seeded(7);
    for (const count of [3, 5, 8]) {
      const shards = generateShards(count, random);
      expect(shards).toHaveLength(count);
      for (const s of shards) {
        const points = s.clipPath.replace(/^polygon\(|\)$/g, "").split(", ");
        expect(points.length).toBeGreaterThanOrEqual(3);
        expect(points.length).toBeLessThanOrEqual(8);
        for (const point of points) expect(point).toMatch(/^\d+(\.\d)?% \d+(\.\d)?%$/);
        expect(s.top).toBeGreaterThanOrEqual(20);
        expect(s.top).toBeLessThanOrEqual(70);
        expect(s.left).toBeGreaterThanOrEqual(10);
        expect(s.left).toBeLessThanOrEqual(80);
        expect(s.opacity).toBeGreaterThanOrEqual(0.5);
        expect(s.opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it("cuts more shards on drops", () => {
    expect(shardCount(0, () => 0)).toBe(3);
    expect(shardCount(0, () => 0.999)).toBe(5);
    expect(shardCount(1, () => 0)).toBe(6);
    expect(shardCount(1, () => 0.999)).toBe(8);
  });
});

describe("recutDue", () => {
  it("re-cuts on downbeats every 2 bars in calm sections and every bar in drops", () => {
    expect(recutDue(frame({ barIndex: 5 }), 4, false)).toBe(false);
    expect(recutDue(frame({ barIndex: 6 }), 4, false)).toBe(true);
    expect(recutDue(frame({ barIndex: 5, sectionLevel: 1 }), 4, false)).toBe(true);
    expect(recutDue(frame({ barIndex: 4 }), null, false)).toBe(true);
  });

  it("only re-cuts on a downbeat while playing and motion is allowed", () => {
    expect(recutDue(frame({ isDownbeat: false, barIndex: 8 }), 4, false)).toBe(false);
    expect(recutDue(frame({ isPlaying: false, barIndex: 8 }), 4, false)).toBe(false);
    expect(recutDue(frame({ barIndex: 8 }), 4, true)).toBe(false);
  });

  it("re-cuts once, not once per missed bar, after a jump", () => {
    expect(recutDue(frame({ barIndex: 40 }), 4, false)).toBe(true);
    expect(recutDue(frame({ barIndex: 2 }), 40, false)).toBe(true);
  });
});
