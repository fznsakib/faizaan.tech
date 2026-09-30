import { SHOCKWAVE_SPEED } from "./type";

/** What the name's letters are made of. Also their stacking order, bottom to top. */
export type Matter = "plain" | "chrome" | "molten" | "shatter" | "frost";
export const MATTERS: readonly Matter[] = ["plain", "chrome", "molten", "shatter", "frost"];

export interface Stage {
  matter: Matter;
  /** Seconds, including the blend into the next stage at its end. */
  duration: number;
}

/** Seconds each stage cross-fades into the next, at the end of the stage. */
export const BLEND = 0.35;

/** One run, per letter: a lead-in from plain, the four materials, and back to plain as the last one fades. */
export const STAGES: readonly Stage[] = [
  { matter: "plain", duration: BLEND },
  { matter: "chrome", duration: 1.4 },
  { matter: "molten", duration: 1.6 },
  { matter: "shatter", duration: 1.2 },
  { matter: "frost", duration: 1.5 },
];

/** Seconds from a letter's first change to its return to plain. */
export const RUN_LENGTH = STAGES.reduce((sum, stage) => sum + stage.duration, 0);

/** Longest a run takes to sweep across the name, s: a pointer at one end of a desktop name reaches the other in ≈ 0.62 s. */
export const MAX_SWEEP = 0.7;

export interface MatterRun {
  /** When the run left its origin, s. */
  start: number;
  /** Where it left from: the pointer's or the head's x, px. */
  origin: number;
}

/** Seconds a run takes to reach the letter centred at `x` from its origin: the kick shockwave's speed, capped. */
export function sweepDelay(x: number, origin: number): number {
  return Math.min(MAX_SWEEP, Math.abs(x - origin) / SHOCKWAVE_SPEED);
}

/** When the farthest letter is plain again, s. */
export const runEnd = (run: MatterRun): number => run.start + RUN_LENGTH + MAX_SWEEP;

export interface MatterSample {
  state: Matter;
  /** What the state is blending into; `plain` after the last material. */
  next: Matter;
  /** 0..1 through the state. */
  t: number;
  /** 0..1 blended into `next`. */
  blend: number;
}

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** What a letter is made of at `now` (already delayed by the letter's sweep), written into `out` if given. */
export function matterAt(
  run: MatterRun | null,
  now: number,
  out: MatterSample = { state: "plain", next: "plain", t: 0, blend: 0 }
): MatterSample {
  let elapsed = run ? now - run.start : -1;
  if (elapsed >= 0) {
    for (let i = 0; i < STAGES.length; i++) {
      const { matter, duration } = STAGES[i];
      if (elapsed < duration) {
        const length = Math.min(BLEND, duration);
        out.state = matter;
        out.next = STAGES[i + 1]?.matter ?? "plain";
        out.t = elapsed / duration;
        out.blend = smoothstep((elapsed - (duration - length)) / length);
        return out;
      }
      elapsed -= duration;
    }
  }
  out.state = "plain";
  out.next = "plain";
  out.t = 0;
  out.blend = 0;
  return out;
}

/**
 * A layer's opacity for this sample. In a blend the upper of the two layers fades over the lower one, which stays
 * opaque, so the glyph is always fully covered (a plain cross-fade dims mid-way).
 */
export function layerOpacity(sample: MatterSample, matter: Matter): number {
  const { state, next, blend } = sample;
  if (blend === 0 || state === next) return matter === state ? 1 : 0;
  if (matter !== state && matter !== next) return 0;
  const weight = matter === state ? 1 - blend : blend;
  const other = matter === state ? next : state;
  const upper = MATTERS.indexOf(matter) > MATTERS.indexOf(other);
  return upper ? weight : weight > 0 ? 1 : 0;
}

/** Seconds between ambient runs, start to start. */
export const AMBIENT_GAP: readonly [number, number] = [40, 70];
/** Seconds after a run ends before a hover or tap can start another, so a jittery pointer edge doesn't chain runs. */
export const RETRIGGER_COOLDOWN = 0.5;
/** A gap between frames longer than this, s, means the tab was hidden (rAF stops) or the page stalled. */
const STALL = 1;

export interface MatterSchedule {
  /** The latest run, finished or not; null before the first. */
  run: MatterRun | null;
  /** When the next ambient run is due, s; null while ambient runs are off. */
  nextAmbient: number | null;
  lastTick: number | null;
  random: () => number;
}

/** A small seeded PRNG (mulberry32), 0..1, for reproducible schedules in tests. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSchedule(random: () => number = Math.random): MatterSchedule {
  return { run: null, nextAmbient: null, lastTick: null, random };
}

const ambientGap = (schedule: MatterSchedule) =>
  AMBIENT_GAP[0] + (AMBIENT_GAP[1] - AMBIENT_GAP[0]) * schedule.random();

export const isRunning = (schedule: MatterSchedule, now: number): boolean =>
  schedule.run !== null && now < runEnd(schedule.run);

function startRun(schedule: MatterSchedule, now: number, origin: number): void {
  schedule.run = { start: now, origin };
  // Any run resets the ambient wait: no ambient run right after a hover.
  if (schedule.nextAmbient !== null) schedule.nextAmbient = now + ambientGap(schedule);
}

/** Hover or tap: start a run from `origin` (px) unless one is still going or has only just ended. */
export function requestRun(schedule: MatterSchedule, now: number, origin: number): boolean {
  if (schedule.run && now < runEnd(schedule.run) + RETRIGGER_COOLDOWN) return false;
  startRun(schedule, now, origin);
  return true;
}

/**
 * Every frame: start an ambient run from the head (at `headX`) when one is due. `ambient` is false before the
 * visitor has entered, while the tab is hidden and under reduced motion; turning it on (or coming back from a
 * stall) starts a fresh wait rather than firing a missed run.
 */
export function tickSchedule(schedule: MatterSchedule, now: number, ambient: boolean, headX: number): void {
  const stalled = schedule.lastTick !== null && now - schedule.lastTick > STALL;
  schedule.lastTick = now;
  if (!ambient) {
    schedule.nextAmbient = null;
  } else if (schedule.nextAmbient === null || stalled) {
    schedule.nextAmbient = now + ambientGap(schedule);
  } else if (now >= schedule.nextAmbient && !isRunning(schedule, now)) {
    startRun(schedule, now, headX);
  }
}
