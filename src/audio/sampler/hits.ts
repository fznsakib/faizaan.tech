import type { Voice } from "../types";

/** Envelope decays for DJ-mode hits, seconds (drums match the beat-map onset decays). */
export const HIT_DECAY: Record<Voice, number> = { kick: 0.18, snare: 0.14, hat: 0.07, stab: 0.3 };
/** How long after a hit idle visuals keep responding, seconds. */
export const JAM_WINDOW = 2;

const VOICES: Voice[] = ["kick", "snare", "hat", "stab"];
/** Seconds of history kept (hits may be scheduled up to a 16th ahead). */
const KEEP = 4;

/** DJ-mode hits on the AudioContext clock, kept sorted per voice. */
export class HitLog {
  private readonly times: Record<Voice, number[]> = { kick: [], snare: [], hat: [], stab: [] };

  record(voice: Voice, time: number): void {
    const list = this.times[voice];
    let i = list.length;
    while (i > 0 && list[i - 1] > time) i--;
    list.splice(i, 0, time);
  }

  /** Instant attack at the latest hit at or before `time`, exponential decay; 0 before any hit. */
  envelope(voice: Voice, time: number): number {
    const latest = this.latestAtOrBefore(voice, time);
    return latest === null ? 0 : Math.exp(-(time - latest) / HIT_DECAY[voice]);
  }

  /** Whether `voice` already has a hit within `epsilon` seconds of `time` (presses aimed at the same 16th). */
  has(voice: Voice, time: number, epsilon = 0.001): boolean {
    return this.times[voice].some((t) => Math.abs(t - time) <= epsilon);
  }

  /** Whether a hit of `voice` falls in (from, to]. */
  landed(voice: Voice, from: number, to: number): boolean {
    return this.times[voice].some((t) => t > from && t <= to);
  }

  /** Latest hit of any voice at or before `time`, or -Infinity. */
  lastHitAt(time: number): number {
    let latest = -Infinity;
    for (const voice of VOICES) {
      const t = this.latestAtOrBefore(voice, time);
      if (t !== null && t > latest) latest = t;
    }
    return latest;
  }

  /** Forget hits more than a few seconds before `time`. */
  prune(time: number): void {
    for (const voice of VOICES) {
      const list = this.times[voice];
      while (list.length > 0 && list[0] < time - KEEP) list.shift();
    }
  }

  private latestAtOrBefore(voice: Voice, time: number): number | null {
    const list = this.times[voice];
    for (let i = list.length - 1; i >= 0; i--) if (list[i] <= time) return list[i];
    return null;
  }
}
