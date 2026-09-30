import { describe, expect, it } from "vitest";

import { Impact } from "./impact";

import type { Flinch, Hit } from "./impact";

const D = Math.PI / 180;
/** A full-speed knock on the left of the cranium, pushing the head right. */
const LEFT: Hit = { x: -1.4, y: -2.3, nx: -1, ny: 0, speed: 2400 };
const TOP: Hit = { x: 0, y: -3.7, nx: 0, ny: -1, speed: 2400 };
const UNDER: Hit = { x: 0, y: 0.9, nx: 0, ny: 1, speed: 2400 };

/** Sample every axis at 240 Hz for `seconds` after `from`, landing each scheduled hit when its time comes. */
function trace(channel: Impact, from: number, seconds: number, hits: [Hit, number][] = []): { t: number; flinch: Flinch }[] {
  const out: { t: number; flinch: Flinch }[] = [];
  const queue = [...hits];
  for (let i = 0; i <= seconds * 240; i++) {
    const t = from + i / 240;
    while (queue.length && queue[0][1] <= t) {
      const [hit, at] = queue.shift()!;
      channel.hit(hit, at);
    }
    out.push({ t, flinch: { ...channel.sample(t) } });
  }
  return out;
}

const peak = (samples: { flinch: Flinch }[], axis: keyof Flinch) =>
  samples.reduce((best, { flinch }) => (Math.abs(flinch[axis]) > Math.abs(best) ? flinch[axis] : best), 0);

describe("impact flinch", () => {
  it("is still until something hits it", () => {
    expect(new Impact().sample(12)).toEqual({ yaw: 0, pitch: 0, roll: 0, squash: 0 });
  });

  it("recoils away from a hit on the left: turns right, tips the crown right, up to the 8° caps", () => {
    const channel = new Impact();
    channel.hit(LEFT, 10);
    const samples = trace(channel, 10, 1);
    expect(peak(samples, "yaw")).toBeGreaterThan(7.5 * D);
    expect(peak(samples, "yaw")).toBeLessThanOrEqual(8 * D + 1e-9);
    expect(peak(samples, "roll")).toBeLessThan(0); // +roll is counter-clockwise: the crown goes right
    expect(Math.abs(peak(samples, "roll"))).toBeLessThanOrEqual(8 * D + 1e-9);
    expect(Math.abs(peak(samples, "pitch"))).toBeLessThan(0.01 * D);
    expect(peak(samples, "squash")).toBeGreaterThan(0);
    const mirrored = new Impact();
    mirrored.hit({ ...LEFT, x: 1.4, nx: 1 }, 10);
    expect(mirrored.sample(10.07).yaw).toBeCloseTo(-channel.sample(10.07).yaw, 9);
    expect(mirrored.sample(10.07).roll).toBeCloseTo(-channel.sample(10.07).roll, 9);
  });

  it("nods the chin down for a knock on top and lifts it for one from below, within 5°", () => {
    const top = new Impact();
    top.hit(TOP, 0);
    const under = new Impact();
    under.hit(UNDER, 0);
    const down = peak(trace(top, 0, 1), "pitch");
    const up = peak(trace(under, 0, 1), "pitch");
    expect(down).toBeGreaterThan(4.5 * D);
    expect(down).toBeLessThanOrEqual(5 * D + 1e-9);
    expect(up).toBeLessThan(-4.5 * D);
    expect(Math.abs(peak(trace(top, 0, 1), "roll"))).toBeLessThan(0.01 * D); // straight down the spine: no roll
  });

  it("scales with how hard the glass hit, and ignores taps below the ping speed", () => {
    const soft = new Impact();
    soft.hit({ ...LEFT, speed: 600 }, 0);
    const hard = new Impact();
    hard.hit(LEFT, 0);
    const tap = new Impact();
    tap.hit({ ...LEFT, speed: 60 }, 0);
    expect(peak(trace(soft, 0, 1), "yaw")).toBeGreaterThan(0.5 * D);
    expect(peak(trace(soft, 0, 1), "yaw")).toBeLessThan(0.5 * peak(trace(hard, 0, 1), "yaw"));
    expect(tap.sample(0.08)).toEqual({ yaw: 0, pitch: 0, roll: 0, squash: 0 });
  });

  it("recoils fast and settles within ~0.6 s", () => {
    const channel = new Impact();
    channel.hit(LEFT, 3);
    const samples = trace(channel, 3, 1.5);
    const top = samples.reduce((best, sample) => (sample.flinch.yaw > best.flinch.yaw ? sample : best));
    expect(top.t - 3).toBeLessThan(0.12);
    for (const { t, flinch } of samples) {
      if (t - 3 < 0.6) continue;
      expect(Math.abs(flinch.yaw)).toBeLessThan(0.1 * D);
      expect(Math.abs(flinch.roll)).toBeLessThan(0.1 * D);
      expect(Math.abs(flinch.squash)).toBeLessThan(0.001);
    }
    expect(channel.sample(10)).toEqual({ yaw: 0, pitch: 0, roll: 0, squash: 0 });
  });

  it("moves continuously: a knock changes its speed, never its position, so it never jumps between frames", () => {
    const channel = new Impact();
    channel.hit(LEFT, 0);
    const before = { ...channel.sample(0.05) };
    channel.hit(TOP, 0.05);
    const after = channel.sample(0.05);
    for (const axis of ["yaw", "pitch", "roll", "squash"] as const) expect(after[axis]).toBeCloseTo(before[axis], 12);
    const samples = trace(channel, 0.05, 1, [[{ ...LEFT, x: 1.4, nx: 1 }, 0.09]]);
    for (let i = 1; i < samples.length; i++) {
      for (const axis of ["yaw", "pitch", "roll"] as const) {
        // an 8° recoil peaking in ~80 ms moves ~1° per 240 Hz frame at first; a jump would be the whole 8°
        expect(Math.abs(samples[i].flinch[axis] - samples[i - 1].flinch[axis])).toBeLessThan(1.5 * D);
      }
    }
  });

  it("piles rapid hits up, but never past the caps", () => {
    const one = new Impact();
    one.hit({ ...LEFT, speed: 900 }, 0);
    const hits: [Hit, number][] = [];
    for (let i = 0; i < 8; i++) hits.push([LEFT, i * 0.04]);
    for (let i = 0; i < 8; i++) hits.push([TOP, 0.4 + i * 0.03]);
    const samples = trace(new Impact(), 0, 1.5, hits);
    expect(peak(samples, "yaw")).toBeGreaterThan(peak(trace(one, 0, 1), "yaw"));
    for (const { flinch } of samples) {
      expect(Math.abs(flinch.yaw)).toBeLessThanOrEqual(8 * D + 1e-9);
      expect(Math.abs(flinch.roll)).toBeLessThanOrEqual(8 * D + 1e-9);
      expect(Math.abs(flinch.pitch)).toBeLessThanOrEqual(5 * D + 1e-9);
      expect(Math.abs(flinch.squash)).toBeLessThanOrEqual(0.03 + 1e-9);
    }
  });

  it("is a pure function of time: sampling order and rate don't change it", () => {
    const a = new Impact();
    const b = new Impact();
    a.hit(LEFT, 1);
    b.hit(LEFT, 1);
    trace(a, 1, 1); // sampled densely first
    expect(a.sample(1.23)).toEqual(b.sample(1.23));
    expect(a.sample(1.1)).toEqual(b.sample(1.1));
    const out = { yaw: 9, pitch: 9, roll: 9, squash: 9 };
    expect(a.sample(1.1, out)).toBe(out);
    expect(out).toEqual(b.sample(1.1));
  });
});
