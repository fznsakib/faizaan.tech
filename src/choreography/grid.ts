/** Grid cell size, px. */
export const CELL = 40;
/** How far from the cursor plusses turn to face it, px. */
export const TURN_RADIUS = 180;
/** Extra mini-plus size on a full kick at full energy. */
export const PULSE = 0.8;
/** Time constant for plusses easing toward their target turn, s. */
export const TURN_TAU = 0.12;
/** Seconds of kick history to keep, so the shockwave can still reach a far corner on a large/ultrawide display. */
export const KICK_HISTORY_SPAN = 2.5;

const QUARTER = Math.PI / 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface GridLayout {
  columns: number;
  rows: number;
  /** Top-left of the grid in CSS px (the grid is centred). */
  originX: number;
  originY: number;
}

export function gridLayout(width: number, height: number): GridLayout {
  const columns = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  return { columns, rows, originX: (width - columns * CELL) / 2, originY: (height - rows * CELL) / 2 };
}

/**
 * At DPR 1 an odd-width stroke needs its centre on a half-pixel to land crisply on the device pixel grid;
 * `gridLayout`'s origin is a whole pixel for an even viewport dimension, a half-pixel for an odd one, so the
 * offset needed flips with it. No offset is needed above DPR 1 (the backing store already oversamples).
 */
export function crispOffset(origin: number, dpr: number): number {
  if (dpr !== 1) return 0;
  return Number.isInteger(origin) ? 0.5 : 0;
}

/** Fold an angle into (-π/4, π/4]: a plus looks identical every quarter turn. */
export function wrapQuarter(angle: number): number {
  const folded = angle - QUARTER * Math.round(angle / QUARTER);
  return folded <= -Math.PI / 4 ? folded + QUARTER : folded;
}

/** The turn that points an arm of the plus centred at (cx, cy) at the pointer, and how strongly (smooth falloff to 0 at `radius`). */
export function cursorTurn(cx: number, cy: number, px: number, py: number, radius = TURN_RADIUS) {
  const distance = Math.hypot(px - cx, py - cy);
  const t = clamp01(1 - distance / radius);
  return { angle: wrapQuarter(Math.atan2(py - cy, px - cx)), weight: t * t * (3 - 2 * t) };
}

/** Ease `current` toward `target` along the shorter way round the quarter-turn wrap; frame-rate independent. */
export function easeTurn(current: number, target: number, dt: number, tau = TURN_TAU): number {
  return wrapQuarter(current + wrapQuarter(target - current) * (1 - Math.exp(-dt / tau)));
}

/** Mini-plus scale for a kick envelope that has reached this cell (already delayed by distance) and the song's energy. */
export function miniScale(kick: number, energy: number): number {
  return 1 + PULSE * clamp01(kick) * (0.5 + 0.5 * clamp01(energy));
}
