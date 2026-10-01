/**
 * The head's flinch: glass knocking into it kicks a damped spring per axis (yaw, pitch, roll, squash), so the head
 * recoils away from the hit, scaled by how hard, and springs back. Each axis is solved in closed form from its
 * state at the last hit, so a sample is a pure function of time: frame rate and sampling order don't change it.
 */

const D = Math.PI / 180;
/** The largest recoil on each axis, however hard or often the head is hit. */
const YAW_MAX = 8 * D;
const ROLL_MAX = 8 * D;
const PITCH_MAX = 5 * D;
const SQUASH_MAX = 0.03;
/** Knocks slower than this (px/s, the glass's ping speed) don't move the head; at this speed they move it fully. */
const SPEED_MIN = 90;
const SPEED_FULL = 2400;
/** A knock this far from the nod pivot (world units, about the crown) gets the full roll. */
const LEVER = 3;
/** The spring: natural frequency (rad/s) and damping ratio. Peaks ~80 ms after a knock, < 0.1° by 0.6 s. */
const OMEGA = 14;
const ZETA = 0.7;
/** After this long (s) an axis is at rest. */
const QUIET = 3;

const SIGMA = ZETA * OMEGA;
const OMEGA_D = OMEGA * Math.sqrt(1 - ZETA * ZETA);
/** The peak of the response to a unit velocity kick from rest, and when it comes. */
const PEAK_AT = Math.atan2(OMEGA_D, SIGMA) / OMEGA_D;
const GAIN = (Math.exp(-SIGMA * PEAK_AT) * Math.sin(OMEGA_D * PEAK_AT)) / OMEGA_D;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** A knock, from the glass: where, which way and how hard. */
export interface Hit {
  /** Where the glass struck, from the nod pivot, in world units (screen axes: x right, y down). */
  x: number;
  y: number;
  /** The head outline's outward normal there (screen axes). */
  nx: number;
  ny: number;
  /** Approach speed along the normal (px/s). */
  speed: number;
}

/** The recoil to add to the head's pose: radians in the rig's Euler terms, and a squash fraction. */
export interface Flinch {
  yaw: number;
  pitch: number;
  roll: number;
  squash: number;
}

/** One damped axis: its value and velocity as of its last kick at `t0`. */
class Axis {
  private x0 = 0;
  private v0 = 0;
  private t0 = -Infinity;

  /** Value (and, into `out`, velocity) at time t; before the last kick it holds that kick's start. */
  at(t: number, out?: { v: number }): number {
    const tau = Math.max(0, t - this.t0);
    if (tau > QUIET) {
      if (out) out.v = 0;
      return 0;
    }
    const [a, b] = [this.x0, (this.v0 + SIGMA * this.x0) / OMEGA_D];
    const decay = Math.exp(-SIGMA * tau);
    const [cos, sin] = [Math.cos(OMEGA_D * tau), Math.sin(OMEGA_D * tau)];
    if (out) out.v = decay * (this.v0 * cos - (SIGMA * b + OMEGA_D * a) * sin);
    return decay * (a * cos + b * sin);
  }

  /**
   * Add `dv` to the velocity at time t, or as much of it as keeps the free response's peak within ±cap. Only the
   * velocity changes, so the head never jumps.
   */
  kick(t: number, dv: number, cap: number): void {
    if (dv === 0) return;
    const velocity = { v: 0 };
    const x = this.at(t, velocity);
    let share = 1;
    if (peakOf(x, velocity.v + dv) > cap) {
      // bisect for a share of the kick that fits (none always does: the state before it was within the cap)
      let [lo, hi] = [0, 1];
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (peakOf(x, velocity.v + mid * dv) > cap) hi = mid;
        else lo = mid;
      }
      share = lo;
    }
    [this.x0, this.v0, this.t0] = [x, velocity.v + share * dv, Math.max(t, this.t0)];
  }
}

/**
 * The largest |x| the spring reaches from (x0, v0): at the start, or at its first turning point (every later one
 * is smaller, the envelope decaying).
 */
function peakOf(x0: number, v0: number): number {
  const [a, b] = [x0, (v0 + SIGMA * x0) / OMEGA_D];
  const d = SIGMA * b + OMEGA_D * a; // x'(τ) ∝ v0·cos(ωτ) − d·sin(ωτ)
  let theta = d === 0 ? Math.PI / 2 : Math.atan(v0 / d);
  if (theta < 0) theta += Math.PI;
  const turn = Math.exp((-SIGMA * theta) / OMEGA_D) * (a * Math.cos(theta) + b * Math.sin(theta));
  return Math.max(Math.abs(x0), Math.abs(turn));
}

/** The flinch channel: the glass layer calls `hit`, the head adds `sample` to its pose. */
export class Impact {
  private readonly yaw = new Axis();
  private readonly pitch = new Axis();
  private readonly roll = new Axis();
  private readonly squash = new Axis();

  /**
   * A knock at time t (s): the head is pushed away from it (a hit on its left side turns it right), tips about the
   * nod pivot by the hit's leverage, and squashes, all scaled by speed.
   */
  hit(hit: Hit, t: number): void {
    const strength = clamp((hit.speed - SPEED_MIN) / (SPEED_FULL - SPEED_MIN), 0, 1);
    if (strength <= 0) return;
    const [px, py] = [-hit.nx, -hit.ny]; // the push, into the head
    // +roll is counter-clockwise on screen; a push clockwise about the pivot (y down: x·py − y·px > 0) rolls it negative
    const lever = clamp((hit.x * py - hit.y * px) / LEVER, -1, 1);
    this.yaw.kick(t, (YAW_MAX * strength * px) / GAIN, YAW_MAX);
    this.pitch.kick(t, (PITCH_MAX * strength * py) / GAIN, PITCH_MAX);
    this.roll.kick(t, (-ROLL_MAX * strength * lever) / GAIN, ROLL_MAX);
    this.squash.kick(t, (SQUASH_MAX * strength) / GAIN, SQUASH_MAX);
  }

  /** The recoil at time t (s), written into `out`. */
  sample(t: number, out: Flinch = { yaw: 0, pitch: 0, roll: 0, squash: 0 }): Flinch {
    // `|| 0` keeps a resting axis at +0, never −0
    out.yaw = this.yaw.at(t) || 0;
    out.pitch = this.pitch.at(t) || 0;
    out.roll = this.roll.at(t) || 0;
    out.squash = this.squash.at(t) || 0;
    return out;
  }
}

/** The app-wide channel: GlassPanel knocks, Head flinches. */
export const impact = new Impact();
