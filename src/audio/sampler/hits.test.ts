import { describe, expect, it } from "vitest";

import { HIT_DECAY, HitLog } from "./hits";

describe("HitLog", () => {
  it("attacks instantly and decays per voice", () => {
    const log = new HitLog();
    log.record("kick", 1);
    log.record("stab", 1);
    expect(log.envelope("kick", 0.99)).toBe(0);
    expect(log.envelope("kick", 1)).toBeCloseTo(1);
    expect(log.envelope("kick", 1 + HIT_DECAY.kick)).toBeCloseTo(Math.exp(-1));
    expect(log.envelope("stab", 1.3)).toBeCloseTo(Math.exp(-1));
  });

  it("a future hit doesn't cut the current decay", () => {
    const log = new HitLog();
    log.record("kick", 1);
    log.record("kick", 1.5);
    expect(log.envelope("kick", 1.2)).toBeCloseTo(Math.exp(-0.2 / HIT_DECAY.kick));
    expect(log.envelope("kick", 1.5)).toBeCloseTo(1);
  });

  it("keeps hits ordered when recorded out of order", () => {
    const log = new HitLog();
    log.record("snare", 2);
    log.record("snare", 1);
    expect(log.envelope("snare", 1.5)).toBeCloseTo(Math.exp(-0.5 / HIT_DECAY.snare));
  });

  it("reports landings in a half-open window", () => {
    const log = new HitLog();
    log.record("stab", 2);
    expect(log.landed("stab", 1.99, 2)).toBe(true);
    expect(log.landed("stab", 2, 2.1)).toBe(false);
  });

  it("finds the latest hit of any voice and forgets old ones", () => {
    const log = new HitLog();
    log.record("hat", 3);
    log.record("kick", 5);
    expect(log.lastHitAt(2)).toBe(-Infinity);
    expect(log.lastHitAt(4)).toBe(3);
    expect(log.lastHitAt(6)).toBe(5);
    log.prune(20);
    expect(log.lastHitAt(20)).toBe(-Infinity);
    expect(log.envelope("kick", 20)).toBe(0);
  });
});
