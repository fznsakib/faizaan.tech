import type { MusicFrame } from "../audio/types";

/** Rebound after the nod lands: decay (s) and oscillation (Hz) — ≈17% overshoot at ~190 ms. */
const REBOUND_TAU = 0.11;
const REBOUND_HZ = 2.6;
/** Anticipation lift before the beat, as a fraction of the amplitude. */
const LIFT = 0.25;
const BEATS_PER_BAR = 4;

/** Nod every other beat above this tempo. */
export const HALF_TIME_BPM = 135;
/** Sample the authored curve this far ahead to cancel the smoothing spring's lag. */
export const NOD_LEAD = 0.05;
export const DOWNBEAT_ACCENT = 1.35;

/**
 * Authored head-bob curve over one nod cycle: +1 = chin fully down, exactly on the beat (phase 0);
 * a damped rebound after it, and a small lift then an accelerating drop into the next beat.
 */
export function bob(phase: number, period: number): number {
  const seconds = phase * period;
  const rebound = Math.exp(-seconds / REBOUND_TAU) * Math.cos(2 * Math.PI * REBOUND_HZ * seconds);
  const window = Math.min(0.3 * period, 0.2);
  const toNext = period - seconds;
  if (toNext >= window) return rebound;
  const u = 1 - toNext / window;
  return rebound - LIFT * Math.sin(Math.PI * u) + u * u * u;
}

export interface NodDrive {
  /** 0..1 through the current nod cycle; 0 = the nod lands. */
  phase: number;
  /** Seconds per nod cycle (one beat, or two in half-time). */
  period: number;
  /** DOWNBEAT_ACCENT when the nearest landing is a downbeat, else 1. */
  accent: number;
}

const mod = (value: number, n: number) => ((value % n) + n) % n;

/** Where the nod is for a frame: sampled NOD_LEAD early, half-time above 135 BPM (landing on beats 1 and 3). */
export function nodDrive(frame: Pick<MusicFrame, "bpm" | "beat" | "beatIndex" | "barPhase">): NodDrive {
  const beatSeconds = 60 / frame.bpm;
  const beatsPerNod = frame.bpm > HALF_TIME_BPM ? 2 : 1;
  const beatInBar = Math.floor(frame.barPhase * BEATS_PER_BAR + 1e-6);
  const downbeat = frame.beatIndex - beatInBar;
  const cycles = (frame.beat + NOD_LEAD / beatSeconds - downbeat) / beatsPerNod;
  const cycle = Math.floor(cycles);
  const phase = cycles - cycle;
  const landing = (phase < 0.5 ? cycle : cycle + 1) * beatsPerNod;
  return {
    phase,
    period: beatSeconds * beatsPerNod,
    accent: mod(landing, BEATS_PER_BAR) === 0 ? DOWNBEAT_ACCENT : 1,
  };
}

/** Second-order spring (unit mass), sub-stepped at 240 Hz; dt is clamped so a hidden tab can't blow it up. */
export class Spring {
  value = 0;
  velocity = 0;
  private readonly stiffness: number;
  private readonly damping: number;

  constructor(stiffness: number, damping: number) {
    this.stiffness = stiffness;
    this.damping = damping;
  }

  step(target: number, dt: number): number {
    const clamped = Math.min(Math.max(dt, 0), 0.1);
    const steps = Math.max(1, Math.ceil(clamped * 240));
    const h = clamped / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (this.stiffness * (target - this.value) - this.damping * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}
