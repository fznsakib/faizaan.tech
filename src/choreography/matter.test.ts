import { describe, expect, it } from "vitest";

import {
  AMBIENT_GAP,
  BLEND,
  chromeSweep,
  createSchedule,
  dripPose,
  dripsFor,
  isRunning,
  layerOpacity,
  MATTERS,
  matterAt,
  MAX_SWEEP,
  meltAmount,
  mulberry32,
  requestRun,
  RETRIGGER_COOLDOWN,
  RUN_LENGTH,
  runEnd,
  shardPose,
  shardsFor,
  shatterGlyph,
  sparklePose,
  sparklesFor,
  STAGES,
  sweepDelay,
  tickSchedule,
} from "./matter";
import { SHOCKWAVE_SPEED } from "./type";

import type { Matter, MatterRun, MatterSample, MatterSchedule } from "./matter";

const run: MatterRun = { start: 10, origin: 0 };
/** When stage `index` of the run begins, s. */
const stageStart = (index: number) => run.start + STAGES.slice(0, index).reduce((sum, stage) => sum + stage.duration, 0);
const stageEnd = (index: number) => stageStart(index) + STAGES[index].duration;

/** How much of the glyph each layer shows once the stack is composited (upper layers cover lower ones). */
function contributions(sample: MatterSample): Record<Matter, number> {
  const out = {} as Record<Matter, number>;
  let covered = 0;
  for (let i = MATTERS.length - 1; i >= 0; i--) {
    const opacity = layerOpacity(sample, MATTERS[i]);
    out[MATTERS[i]] = opacity * (1 - covered);
    covered += out[MATTERS[i]];
  }
  return out;
}

describe("matter timeline", () => {
  it("runs plain → chrome → molten → shatter → frost, then back to plain", () => {
    expect(STAGES.map((stage) => stage.matter)).toEqual(["plain", "chrome", "molten", "shatter", "frost"]);
    const states = STAGES.map((_, i) => matterAt(run, (stageStart(i) + stageEnd(i)) / 2).state);
    expect(states).toEqual(["plain", "chrome", "molten", "shatter", "frost"]);
    expect(matterAt(run, stageEnd(STAGES.length - 1) - 1e-6).next).toBe("plain");
  });

  it("holds each material for 0.9–1.6 s, after a lead-in no longer than one blend", () => {
    const [leadIn, ...materials] = STAGES;
    expect(leadIn.duration).toBeLessThanOrEqual(BLEND);
    for (const stage of materials) {
      expect(stage.duration).toBeGreaterThanOrEqual(0.9);
      expect(stage.duration).toBeLessThanOrEqual(1.6);
    }
    expect(RUN_LENGTH).toBeCloseTo(STAGES.reduce((sum, stage) => sum + stage.duration, 0), 9);
  });

  it("is plain and still before the run reaches a letter, after it ends, and with no run", () => {
    for (const sample of [matterAt(run, run.start - 0.5), matterAt(run, run.start + RUN_LENGTH), matterAt(null, 3)]) {
      expect(sample).toMatchObject({ state: "plain", next: "plain", blend: 0 });
    }
  });

  it("runs t from 0 to 1 within each state", () => {
    STAGES.forEach((_, i) => {
      const opening = matterAt(run, stageStart(i) + 1e-9); // just past the boundary: float sums land either side of it
      expect(opening.state).toBe(STAGES[i].matter);
      expect(opening.t).toBeCloseTo(0, 6);
      expect(matterAt(run, stageStart(i) + STAGES[i].duration / 4).t).toBeCloseTo(0.25, 6);
      expect(matterAt(run, stageEnd(i) - 1e-6).t).toBeCloseTo(1, 4);
    });
  });

  it("blends toward the next state over each state's last BLEND seconds", () => {
    STAGES.forEach((stage, i) => {
      const length = Math.min(BLEND, stage.duration);
      const blendFrom = stageEnd(i) - length;
      if (length < stage.duration) expect(matterAt(run, blendFrom - 1e-3).blend).toBe(0);
      expect(matterAt(run, blendFrom).blend).toBeCloseTo(0, 6);
      const middle = matterAt(run, blendFrom + length / 2).blend;
      expect(middle).toBeGreaterThan(0.2);
      expect(middle).toBeLessThan(0.8);
      expect(matterAt(run, stageEnd(i) - 1e-6).blend).toBeCloseTo(1, 4);
    });
    expect(matterAt(run, stageStart(1) + 0.3).blend).toBe(0); // mid-chrome: no blend yet
  });

  it("writes into the object it is given, so the per-letter loop allocates nothing", () => {
    const out: MatterSample = { state: "plain", next: "plain", t: 0, blend: 0 };
    expect(matterAt(run, stageStart(2) + 0.1, out)).toBe(out);
    expect(out.state).toBe("molten");
  });
});

describe("matter layers", () => {
  it("shows only the current state's layer outside a blend", () => {
    const sample = matterAt(run, stageStart(2) + 0.2); // molten, before its blend
    for (const matter of MATTERS) expect(layerOpacity(sample, matter)).toBe(matter === "molten" ? 1 : 0);
  });

  it("fades the upper layer of a blend over the lower one, which stays opaque", () => {
    const intoMolten = matterAt(run, stageEnd(1) - BLEND / 2); // chrome (below) → molten (above)
    expect(layerOpacity(intoMolten, "chrome")).toBe(1);
    expect(layerOpacity(intoMolten, "molten")).toBeCloseTo(intoMolten.blend, 9);
    const backToPlain = matterAt(run, stageEnd(4) - BLEND / 2); // frost (above) → plain (below)
    expect(layerOpacity(backToPlain, "frost")).toBeCloseTo(1 - backToPlain.blend, 9);
    expect(layerOpacity(backToPlain, "plain")).toBe(1);
  });

  it("always covers the whole glyph, and changes continuously through the run", () => {
    const step = 1 / 1000;
    let previous = contributions(matterAt(run, run.start - step));
    for (let now = run.start - step; now <= run.start + RUN_LENGTH + step; now += step) {
      const current = contributions(matterAt(run, now));
      expect(MATTERS.reduce((sum, matter) => sum + current[matter], 0)).toBeCloseTo(1, 9);
      for (const matter of MATTERS) expect(Math.abs(current[matter] - previous[matter])).toBeLessThan(0.02);
      previous = current;
    }
  });
});

describe("matter sweep", () => {
  it("starts at the origin and travels outward at the kick shockwave's speed", () => {
    expect(sweepDelay(700, 700)).toBe(0);
    expect(sweepDelay(700 + SHOCKWAVE_SPEED * 0.1, 700)).toBeCloseTo(0.1, 9);
    expect(sweepDelay(700 - SHOCKWAVE_SPEED * 0.1, 700)).toBeCloseTo(0.1, 9);
    expect(sweepDelay(900, 700)).toBeLessThan(sweepDelay(1100, 700));
  });

  it("reaches the far end of a desktop name, from a pointer at the other end, within MAX_SWEEP", () => {
    expect(sweepDelay(1400, 0)).toBeLessThanOrEqual(MAX_SWEEP);
    expect(sweepDelay(1e6, 0)).toBe(MAX_SWEEP);
  });

  it("keeps a whole run, sweep included, to at most 7 s", () => {
    expect(runEnd(run) - run.start).toBeCloseTo(RUN_LENGTH + MAX_SWEEP, 9);
    expect(RUN_LENGTH + MAX_SWEEP).toBeLessThanOrEqual(7);
    expect(matterAt(run, runEnd(run) - MAX_SWEEP).state).toBe("plain"); // the farthest letter is done by then
  });
});

const FRAME = 1 / 60;
const HEAD_X = 720;

/** Tick `schedule` at 60 fps from `from` to `to` s; returns the start times of the runs that began. */
function tickThrough(schedule: MatterSchedule, from: number, to: number, ambient = true): number[] {
  const starts: number[] = [];
  for (let now = from; now < to; now += FRAME) {
    const before = schedule.run;
    tickSchedule(schedule, now, ambient, HEAD_X);
    if (schedule.run !== before && schedule.run) starts.push(schedule.run.start);
  }
  return starts;
}

describe("matter schedule", () => {
  it("never runs by itself before the visitor has entered (or while reduced motion holds ambient runs off)", () => {
    const schedule = createSchedule(mulberry32(1));
    expect(tickThrough(schedule, 0, 300, false)).toEqual([]);
    expect(schedule.run).toBeNull();
  });

  it("runs from the head 40–70 s after entering, then every 40–70 s", () => {
    const schedule = createSchedule(mulberry32(7));
    tickThrough(schedule, 0, 5, false);
    const starts = tickThrough(schedule, 5, 1200);
    expect(starts.length).toBeGreaterThan(10);
    const gaps = starts.map((start, i) => start - (i === 0 ? 5 : starts[i - 1]));
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(AMBIENT_GAP[0]);
      expect(gap).toBeLessThanOrEqual(AMBIENT_GAP[1] + FRAME);
    }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(10); // randomised, not a metronome
    expect(schedule.run?.origin).toBe(HEAD_X);
  });

  it("is reproducible for a seed", () => {
    const times = (seed: number) => tickThrough(createSchedule(mulberry32(seed)), 0, 600);
    expect(times(3)).toEqual(times(3));
    expect(times(3)).not.toEqual(times(4));
  });

  it("never starts while the tab is hidden, and doesn't fire a missed run on return", () => {
    const schedule = createSchedule(mulberry32(2));
    tickThrough(schedule, 0, 30);
    expect(tickThrough(schedule, 30, 200, false)).toEqual([]); // hidden: ticks without ambient
    const back = tickThrough(schedule, 200, 300);
    expect(back[0] - 200).toBeGreaterThanOrEqual(AMBIENT_GAP[0]);

    // A hidden tab's rAF stops altogether: a long gap between ticks restarts the wait instead of firing at once.
    const stalled = createSchedule(mulberry32(2));
    tickThrough(stalled, 0, 30);
    const returned = tickThrough(stalled, 500, 600);
    expect(returned[0] - 500).toBeGreaterThanOrEqual(AMBIENT_GAP[0]);
  });

  it("starts a run from the pointer on hover or tap", () => {
    const schedule = createSchedule(mulberry32(1));
    expect(requestRun(schedule, 10, 300)).toBe(true);
    expect(schedule.run).toEqual({ start: 10, origin: 300 });
    expect(isRunning(schedule, 10)).toBe(true);
  });

  it("doesn't restart a run that is still going", () => {
    const schedule = createSchedule(mulberry32(1));
    requestRun(schedule, 10, 300);
    const first = schedule.run!;
    for (const now of [10.2, 13, runEnd(first) - 0.01]) {
      expect(requestRun(schedule, now, 900)).toBe(false);
      expect(schedule.run).toBe(first);
    }
  });

  it("takes a new hover once the last run has ended and a short cooldown has passed", () => {
    const schedule = createSchedule(mulberry32(1));
    requestRun(schedule, 10, 300);
    const end = runEnd(schedule.run!);
    tickThrough(schedule, 10, end + 0.1);
    expect(isRunning(schedule, end + 0.1)).toBe(false);
    expect(requestRun(schedule, end + 0.1, 900)).toBe(false);
    expect(requestRun(schedule, end + RETRIGGER_COOLDOWN + 0.01, 900)).toBe(true);
    expect(schedule.run?.origin).toBe(900);
  });

  it("pushes the next ambient run back after a hover run", () => {
    const schedule = createSchedule(mulberry32(5));
    tickThrough(schedule, 0, 1);
    const due = schedule.nextAmbient!;
    expect(tickThrough(schedule, 1, due - 1)).toEqual([]);
    expect(requestRun(schedule, due - 1, 300)).toBe(true);
    expect(tickThrough(schedule, due - 1 + FRAME, due - 1 + AMBIENT_GAP[0] - FRAME)).toEqual([]);
    expect(schedule.nextAmbient!).toBeGreaterThanOrEqual(due - 1 + AMBIENT_GAP[0]);
  });
});

/** Where state `matter`'s blend into the next begins, as its t. */
const blendStart = (matter: Matter) => {
  const { duration } = STAGES.find((stage) => stage.matter === matter)!;
  return 1 - BLEND / duration;
};
const ts = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe("matter effects", () => {
  it("sweeps the chrome highlight across each letter once, left to right, off the letter at both ends", () => {
    // 300%-wide highlight image: 100% puts its band left of the letter, 0% right of it.
    expect(chromeSweep(0)).toBe(100);
    expect(chromeSweep(1)).toBe(0);
    for (let i = 1; i < ts.length; i++) expect(chromeSweep(ts[i])).toBeLessThanOrEqual(chromeSweep(ts[i - 1]));
  });

  it("melts in, holds, and sets again before the shatter fades in", () => {
    expect(meltAmount(0)).toBe(0);
    expect(meltAmount(0.55)).toBe(1);
    expect(meltAmount(blendStart("molten"))).toBe(0);
    expect(meltAmount(1)).toBe(0);
  });

  it("drips grow from the letter, fall away downward and are gone before the molten state ends", () => {
    const drips = dripsFor(3, 2);
    expect(dripsFor(3, 2)).toEqual(drips);
    for (const drip of drips) {
      expect(dripPose(drip, 0).opacity).toBe(0);
      expect(dripPose(drip, blendStart("molten")).opacity).toBe(0);
      let lowest = 0;
      let longest = 0;
      for (const t of ts) {
        const pose = dripPose(drip, t);
        expect(pose.y).toBeGreaterThanOrEqual(lowest);
        lowest = pose.y;
        longest = Math.max(longest, pose.stretch);
      }
      expect(lowest).toBeGreaterThan(0.5); // em: falls well clear of the letter
      expect(longest).toBeGreaterThan(1.5); // elongates before it lets go
    }
  });

  it("shatters each letter into plusses that fly out and snap back before the frost fades in", () => {
    const shards = shardsFor(5, 6);
    expect(shardsFor(5, 6)).toEqual(shards);
    for (const shard of shards) {
      for (const t of [0, blendStart("shatter"), 1]) {
        const pose = shardPose(shard, t, 1);
        expect(pose.opacity).toBe(0);
        expect([pose.x, pose.y]).toEqual([0, 0]);
      }
      const out = shardPose(shard, 0.45, 1);
      expect(Math.hypot(out.x, out.y)).toBeGreaterThan(0.15); // em
    }
    expect(shatterGlyph(0)).toBe(1);
    expect(shatterGlyph(0.3)).toBe(0);
    expect(shatterGlyph(blendStart("shatter"))).toBe(1);
  });

  it("never leaves a letter blank mid-shatter: the glyph or its shards always show", () => {
    const shards = shardsFor(5, 6);
    for (const t of ts) {
      const shown = Math.max(shatterGlyph(t), ...shards.map((shard) => shardPose(shard, t, 1).opacity));
      expect(shown).toBeGreaterThan(0.5);
    }
  });

  it("blows the shards away from the run's origin, for every letter's seed and shard count", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const count of [3, 6]) {
        const shards = shardsFor(seed, count);
        const meanX = (side: number) => shards.reduce((sum, shard) => sum + shardPose(shard, 0.45, side).x, 0) / count;
        expect(meanX(1)).toBeGreaterThan(0.05);
        expect(meanX(-1)).toBeLessThan(-0.05);
        for (const shard of shards) expect(Math.hypot(shardPose(shard, 0.45, 1).x, shardPose(shard, 0.45, 1).y)).toBeGreaterThan(0.15);
      }
    }
  });

  it("twinkles frost sparkles in the middle of the state, dark at both ends", () => {
    for (const sparkle of sparklesFor(4, 2)) {
      expect(sparklePose(sparkle, 0).opacity).toBe(0);
      expect(sparklePose(sparkle, blendStart("frost")).opacity).toBe(0);
      expect(Math.max(...ts.map((t) => sparklePose(sparkle, t).scale))).toBeGreaterThan(0.9);
    }
  });
});
