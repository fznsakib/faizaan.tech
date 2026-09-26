/** How fast a kick travels outward from the head across the name, px/s. */
export const SHOCKWAVE_SPEED = 2200;
/** VU-meter ballistics for the Doto EQ lines, seconds. */
export const EQ_ATTACK = 0.015;
export const EQ_RELEASE = 0.22;

export const quantise = (value: number, step: number): number => Math.round(value / step) * step;

/**
 * Recent kick values over a span of *time* (not frames), so letters far from the head can read the
 * kick "in the past" at any refresh rate. Frames closer than `minInterval` are coalesced (max).
 */
export class KickHistory {
  private readonly span: number;
  private readonly minInterval: number;
  private readonly times: Float64Array;
  private readonly values: Float32Array;
  private head = -1;
  private count = 0;

  constructor(span = 0.8, minInterval = 1 / 240) {
    this.span = span;
    this.minInterval = minInterval;
    const size = Math.ceil(span / minInterval) + 1;
    this.times = new Float64Array(size);
    this.values = new Float32Array(size);
  }

  push(time: number, value: number): void {
    if (this.count > 0) {
      const last = this.times[this.head];
      if (time < last || time - last > this.span) {
        this.clear(); // seek back, or a jump longer than the span: nothing old is still relevant
      } else if (time - last < this.minInterval) {
        this.values[this.head] = Math.max(this.values[this.head], value);
        return;
      }
    }
    this.head = (this.head + 1) % this.times.length;
    this.times[this.head] = time;
    this.values[this.head] = value;
    this.count = Math.min(this.count + 1, this.times.length);
  }

  /** Latest value at or before `time` (0 if none is that old, or it is older than the span). */
  at(time: number): number {
    if (this.count === 0) return 0;
    const oldest = this.times[this.head] - this.span;
    for (let n = 0; n < this.count; n++) {
      const i = (this.head - n + this.times.length) % this.times.length;
      if (this.times[i] <= time) return this.times[i] >= oldest ? this.values[i] : 0;
    }
    return 0;
  }

  clear(): void {
    this.head = -1;
    this.count = 0;
  }
}

export function headerWeight(section: number, energy: number, kick: number): number {
  return Math.min(900, 600 + 100 * section + 300 * (0.5 + 0.5 * energy) * kick);
}

/** One step of VU ballistics: fast attack, slow release. */
export function vuStep(current: number, target: number, dt: number): number {
  const tau = target > current ? EQ_ATTACK : EQ_RELEASE;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export function eqWeight(level: number): number {
  return 100 + 800 * level;
}

/**
 * Variation steps are deliberately coarse: each distinct font-variation value makes the browser
 * re-rasterise 6–12rem glyphs (and re-blur the glass above them). Measured at 120 Hz: step 10 dropped
 * 27% of frames; these steps drop none. The dot-matrix EQ reads as LED segments anyway.
 */
export const EQ_WEIGHT_STEP = 100;
export const HEADER_WEIGHT_STEP = 50;
export const ROND_STEP = 25;

/** `font-variation-settings` for a Doto EQ line at `level` (0..1) in a section of intensity `section`. */
export function eqVariation(level: number, section: number): string {
  return `"wght" ${quantise(eqWeight(level), EQ_WEIGHT_STEP)}, "ROND" ${quantise(100 * section, ROND_STEP)}`;
}

/** `font-variation-settings` for a header letter. */
export function headerVariation(section: number, energy: number, kick: number): string {
  return `"wght" ${quantise(headerWeight(section, energy, kick), HEADER_WEIGHT_STEP)}`;
}

/** Idle "scan": a slow top-to-bottom weight wave over the Doto lines (4 s period). */
export function idleScanWeight(seconds: number, line: number): number {
  const wave = Math.max(0, Math.sin(2 * Math.PI * (seconds / 4 - line / 8)));
  return 200 + 500 * wave * wave;
}

export interface FlipState {
  level: 0 | 1;
  /** Song time the change started animating, or null to show the level everywhere at once. */
  changedAt: number | null;
}

export function createFlipState(): FlipState {
  return { level: 0, changedAt: null };
}

/** Track the drop level: animate on the engine's downbeat-quantised edge, snap otherwise (seek, switch, pause). */
export function updateFlip(state: FlipState, level: 0 | 1, changed: boolean, time: number): void {
  // Time went backwards (next track, seek back): an old change time would invert the face below.
  if (state.changedAt !== null && time < state.changedAt) state.changedAt = null;
  if (level === state.level) return;
  state.level = level;
  state.changedAt = changed ? time : null;
}

/** Whether a letter `distance` px from the head shows the drop face at song time `time`. */
export function letterFlipped(state: FlipState, time: number, distance: number): boolean {
  if (state.changedAt === null) return state.level === 1;
  const reached = time - state.changedAt >= distance / SHOCKWAVE_SPEED;
  return state.level === 1 ? reached : !reached;
}
