/**
 * Caustics: the light the head bends, landing as a few thin bright bands on the grid in a pool below and behind
 * it. Two families of gently rippling lines cross into a loose web, like light through a lens or a pool's surface.
 * The head's pose moves it: a turn slides it the other way, a nod focuses it taller and brighter, a roll tips it.
 * Pure: the same time and pose always draw the same light.
 */

/** Bands of light, and points along each. */
export const BANDS = 7;
export const POINTS = 40;
/** Floats per band in `writeCaustics`' buffer: its brightness, then x, y for each point. */
export const BAND_STRIDE = 1 + 2 * POINTS;

/** Where the light lands (px): an ellipse centred at x, y. */
export interface Pool {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/** The head's rig angles (radians): +yaw turns right, +pitch drops the chin, +roll tips it counter-clockwise. */
export interface CausticPose {
  yaw: number;
  pitch: number;
  roll: number;
}

/**
 * Each band: its family's tilt (rad), resting offset across the pool (share of ry), two ripples (wave number,
 * speed in rad/s, phase, amplitude as a share of ry) and a slow shimmer (rad/s, phase). Speeds stay well under
 * 1 rad/s: the light drifts, it never flickers.
 */
const LINES = [
  { tilt: 0.21, offset: -0.66, k1: 2.3, w1: 0.31, p1: 0.4, a1: 0.15, k2: 5.3, w2: -0.47, p2: 2.1, a2: 0.05, shimmer: 0.23, phase: 0.3 },
  { tilt: 0.19, offset: -0.2, k1: 2.9, w1: -0.26, p1: 1.9, a1: 0.13, k2: 6.1, w2: 0.52, p2: 4.4, a2: 0.04, shimmer: 0.31, phase: 2.2 },
  { tilt: 0.23, offset: 0.24, k1: 2.1, w1: 0.37, p1: 3.1, a1: 0.16, k2: 4.7, w2: -0.41, p2: 0.8, a2: 0.05, shimmer: 0.19, phase: 4.1 },
  { tilt: 0.2, offset: 0.64, k1: 3.3, w1: -0.33, p1: 5.2, a1: 0.12, k2: 5.9, w2: 0.44, p2: 3.3, a2: 0.04, shimmer: 0.27, phase: 1.1 },
  { tilt: -0.33, offset: -0.45, k1: 2.6, w1: 0.28, p1: 2.6, a1: 0.14, k2: 5.5, w2: -0.58, p2: 1.5, a2: 0.05, shimmer: 0.21, phase: 5.3 },
  { tilt: -0.3, offset: 0.05, k1: 2, w1: -0.35, p1: 4.7, a1: 0.17, k2: 4.9, w2: 0.49, p2: 5.9, a2: 0.04, shimmer: 0.29, phase: 3.7 },
  { tilt: -0.35, offset: 0.5, k1: 3, w1: 0.24, p1: 0.9, a1: 0.13, k2: 6.4, w2: -0.39, p2: 2.8, a2: 0.05, shimmer: 0.25, phase: 0.9 },
] as const;

/** A turn slides the pool this share of rx per radian, the other way, and rolls the ripples through it. */
const SLIDE = 0.55;
const SWEEP = 3;
/** Half a band's length, as a share of rx: short of the rim, so a full turn keeps it inside the pool. */
const REACH = 0.9;
/** A nod scales the pattern's height by 1 + BREATHE·pitch and its brightness by 1 + FOCUS·pitch. */
const BREATHE = 0.9;
const FOCUS = 0.8;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** The pool for a head outline's bounds (px): below the head, a little behind its jaw line, twice as wide. */
export function causticPool(head: { bounds: { left: number; right: number; top: number; bottom: number } }): Pool {
  const { left, right, top, bottom } = head.bounds;
  const [width, height] = [right - left, bottom - top];
  return { x: (left + right) / 2 - 0.06 * width, y: bottom - 0.12 * height, rx: 1.1 * width, ry: 0.3 * height };
}

/** Write every band into `out` (BANDS × BAND_STRIDE floats) for time t (s) and the head's pose, in `pool`. */
export function writeCaustics(out: Float32Array, t: number, pose: CausticPose, pool: Pool): Float32Array {
  const breathe = 1 + BREATHE * pose.pitch;
  const focus = 1 + FOCUS * pose.pitch;
  const shift = -SLIDE * pose.yaw * pool.rx;
  const sweep = SWEEP * pose.yaw;
  // +roll tips the head counter-clockwise on screen (y down): rotate the pool the same way about its centre
  const [cos, sin] = [Math.cos(-pose.roll), Math.sin(-pose.roll)];
  for (let b = 0; b < BANDS; b++) {
    const line = LINES[b];
    const base = b * BAND_STRIDE;
    out[base] = clamp(0.8 * (0.75 + 0.25 * Math.sin(line.shimmer * t + line.phase)) * focus, 0.05, 1);
    const [tc, ts] = [Math.cos(line.tilt), Math.sin(line.tilt)];
    for (let i = 0; i < POINTS; i++) {
      const u = REACH * (-1 + (2 * i) / (POINTS - 1));
      const ripple =
        line.a1 * Math.sin(line.k1 * u + line.w1 * t + line.p1 + sweep) +
        line.a2 * Math.sin(line.k2 * u + line.w2 * t + line.p2 - 1.7 * sweep);
      const across = (line.offset + ripple) * breathe;
      // the band in the pool's unit frame, tilted by its family
      const lx = u * tc - across * ts;
      const ly = u * ts + across * tc;
      const dx = shift + pool.rx * lx;
      const dy = pool.ry * ly;
      out[base + 1 + 2 * i] = pool.x + dx * cos - dy * sin;
      out[base + 2 + 2 * i] = pool.y + dx * sin + dy * cos;
    }
  }
  return out;
}
