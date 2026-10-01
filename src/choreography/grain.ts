/**
 * Paper grain for the green ground: a seamless tile of fine grain, paper "tooth" and short fibres, plus a faint
 * low-frequency mottle on a far longer period. Everything is a relative luminance change (the ground's RGB scaled by
 * `1 + delta`), so the hue and saturation of the green stay put and the average colour is the ground's own.
 *
 * Pure maths, no DOM: the Background's worker turns both into images once, shown as CSS backgrounds under the plusses.
 */

/** The tile's side in CSS px: big enough that the grain's repeats can't be picked out on a desktop window. */
export const TILE_CSS = 320;
/** Pixel density cap: crisp on a 3× phone without a bigger tile than that needs. */
export const MAX_GRAIN_DPR = 3;
/** The mottle's sample spacing (CSS px): a coarse grid, smoothly upscaled by the browser. */
export const MOTTLE_STEP = 16;
/** The mottle grid's side in samples: it repeats every `MOTTLE_CELLS · MOTTLE_STEP` (4096) CSS px, seamlessly. */
export const MOTTLE_CELLS = 256;
const MOTTLE_PERIOD = MOTTLE_STEP * MOTTLE_CELLS;

/** One octave of tileable value noise: its cell size (CSS px) and amplitude (relative luminance). */
interface Octave {
  cell: number;
  amp: number;
}

export interface GrainLook {
  /** Value-noise octaves, fine to coarse: the grain and the paper's floc. */
  octaves: readonly Octave[];
  /** Per-device-pixel speckle (relative luminance, uniform ±). */
  speckle: number;
  /** Fibres per CSS px². */
  fibreDensity: number;
  /** Fibre length range (CSS px). */
  fibreLength: readonly [number, number];
  /** Fibre width (CSS px). */
  fibreWidth: number;
  /** Peak brightening of a light fibre, darkening of a dark one (relative luminance). */
  fibreLight: number;
  fibreDark: number;
  /** Share of fibres that are dark. */
  darkShare: number;
  /** Mottle octaves (CSS px wavelength, amplitude), sampled in page space so they never tile. */
  mottle: readonly Octave[];
}

export const GRAIN: GrainLook = {
  octaves: [
    { cell: 0.9, amp: 0.11 },
    { cell: 3.2, amp: 0.035 },
    { cell: 11, amp: 0.03 },
  ],
  speckle: 0.04,
  fibreDensity: 0.0032,
  fibreLength: [4, 16],
  fibreWidth: 0.7,
  fibreLight: 0.17,
  fibreDark: 0.11,
  darkShare: 0.35,
  mottle: [
    { cell: 340, amp: 0.035 },
    { cell: 150, amp: 0.025 },
    { cell: 60, amp: 0.012 },
  ],
};

/** Small, fast, seeded PRNG (mulberry32): the same seed always makes the same paper. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A lattice point's value in −1..1, from integer coordinates and a seed: page-space noise with no table. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * A lattice turned by the integer vector (a, b): coords `(a·x + b·y, −b·x + a·y) · n / period`. Moving (x, y) by a
 * whole period moves them by whole multiples of `n`, so noise on a lattice that wraps every `n` cells stays seamless,
 * yet no lattice line runs along the screen's axes (axis-aligned lattices stack into faint lines when tiled).
 */
export interface Turn {
  a: number;
  b: number;
}

/** Each octave's turn, in order (≈ 27°, −18°, 34°, −63°, …). */
export const TURNS: readonly Turn[] = [
  { a: 2, b: 1 },
  { a: 3, b: -1 },
  { a: 3, b: 2 },
  { a: 1, b: -2 },
];

/** Lattice cells per period for a feature of `cell` on a period of `period`, turned by `turn`. */
export const turnedCells = (period: number, cell: number, { a, b }: Turn) =>
  Math.max(1, Math.round(period / (cell * Math.hypot(a, b))));

/** Add one octave of value noise to `field` (side `size`) on a turned lattice of `cells` that wraps: seamless. */
function addValueNoise(field: Float32Array, size: number, cells: number, turn: Turn, amp: number, random: () => number): void {
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random() * 2 - 1;
  const k = cells / size;
  const { a, b } = turn;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const u = (a * px + b * py) * k;
      const v = (a * py - b * px) * k;
      const fx = Math.floor(u);
      const fy = Math.floor(v);
      const tx = smooth(u - fx);
      const ty = smooth(v - fy);
      const x0 = ((fx % cells) + cells) % cells;
      const y0 = ((fy % cells) + cells) % cells;
      const x1 = x0 + 1 === cells ? 0 : x0 + 1;
      const y1 = y0 + 1 === cells ? 0 : y0 + 1;
      const top = lattice[y0 * cells + x0] + (lattice[y0 * cells + x1] - lattice[y0 * cells + x0]) * tx;
      const bottom = lattice[y1 * cells + x0] + (lattice[y1 * cells + x1] - lattice[y1 * cells + x0]) * tx;
      field[y * size + x] += amp * (top + (bottom - top) * ty);
    }
  }
}

/** Lay short, slightly curved fibres into `field`, each wrapping round the tile's edges. */
function addFibres(field: Float32Array, size: number, scale: number, look: GrainLook, random: () => number): void {
  const area = (size / scale) ** 2;
  const count = Math.round(area * look.fibreDensity);
  const stamp = new Int32Array(size * size).fill(-1);
  const cover = new Float32Array(size * size);
  const touched: number[] = [];
  const half = Math.max(0.5, (look.fibreWidth * scale) / 2); // half-width, device px
  const reach = Math.ceil(half + 1);
  for (let f = 0; f < count; f++) {
    const dark = random() < look.darkShare;
    const amp = (dark ? -look.fibreDark : look.fibreLight) * (0.45 + 0.55 * random());
    const length = (look.fibreLength[0] + (look.fibreLength[1] - look.fibreLength[0]) * random() ** 1.6) * scale;
    let heading = random() * Math.PI;
    const bend = (random() * 2 - 1) * 0.9; // radians of turn over the fibre
    let px = random() * size;
    let py = random() * size;
    const steps = Math.max(2, Math.ceil(length / 0.5));
    const step = length / steps;
    touched.length = 0;
    for (let s = 0; s <= steps; s++) {
      const along = s / steps;
      const taper = Math.sin(Math.PI * (0.08 + 0.84 * along)); // thin, faint ends
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const cx = Math.floor(px) + dx;
          const cy = Math.floor(py) + dy;
          const dist = Math.hypot(cx + 0.5 - px, cy + 0.5 - py);
          const c = Math.min(1, Math.max(0, half + 0.5 - dist)) * taper;
          if (c <= 0) continue;
          const i = (((cy % size) + size) % size) * size + (((cx % size) + size) % size);
          if (stamp[i] !== f) {
            stamp[i] = f;
            cover[i] = c;
            touched.push(i);
          } else if (c > cover[i]) cover[i] = c;
        }
      }
      heading += (bend / steps) * (0.6 + 0.8 * random());
      px += Math.cos(heading) * step;
      py += Math.sin(heading) * step;
    }
    for (const i of touched) field[i] += amp * cover[i];
  }
}

/**
 * The grain tile's relative luminance deltas: `size`² device px at `scale` device px per CSS px, seamless on every
 * edge, zero mean.
 */
export function grainField(size: number, scale: number, seed = 1, look: GrainLook = GRAIN): Float32Array {
  const field = new Float32Array(size * size);
  const random = rng(seed);
  const sizeCss = size / scale;
  look.octaves.forEach(({ cell, amp }, i) => {
    const turn = TURNS[i % TURNS.length];
    addValueNoise(field, size, turnedCells(sizeCss, cell, turn), turn, amp, random);
  });
  for (let i = 0; i < field.length; i++) field[i] += (random() * 2 - 1) * look.speckle;
  addFibres(field, size, scale, look, random);
  let mean = 0;
  for (let i = 0; i < field.length; i++) mean += field[i];
  mean /= field.length;
  for (let i = 0; i < field.length; i++) field[i] -= mean;
  return field;
}

/** Parse `rgb(r, g, b)` or `#rrggbb` into 0..255 channels. */
export function parseRgb(colour: string): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(colour);
  if (!rgb) throw new Error(`grain: can't read colour ${colour}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

/**
 * Paint the tile: each pixel the ground scaled by `gain · (1 + delta)`, opaque, into `out` (RGBA). `gain` lifts the
 * tile to make room for the mottle, which can only darken (it is laid on with a multiply).
 */
export function paintGrain(out: Uint8ClampedArray, field: Float32Array, ground: readonly [number, number, number], gain = 1): void {
  const [r, g, b] = ground;
  for (let i = 0, o = 0; i < field.length; i++, o += 4) {
    const k = gain * (1 + field[i]);
    out[o] = r * k;
    out[o + 1] = g * k;
    out[o + 2] = b * k;
    out[o + 3] = 255;
  }
}

/** The mottle's largest swing either way: the sum of its octaves' amplitudes. */
export function mottleRange(look: GrainLook = GRAIN): number {
  return look.mottle.reduce((sum, { amp }) => sum + amp, 0);
}

const quintic = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Gradient (Perlin) noise at lattice coords (u, v), the lattice wrapping every `n` cells; roughly −1..1. */
function gradientNoise(u: number, v: number, n: number, seed: number): number {
  const fx = Math.floor(u);
  const fy = Math.floor(v);
  const dx = u - fx;
  const dy = v - fy;
  const wrap = (i: number) => ((i % n) + n) % n;
  const corner = (cx: number, cy: number, ox: number, oy: number) => {
    const angle = Math.PI * hash2(wrap(cx), wrap(cy), seed); // −π..π
    return Math.cos(angle) * ox + Math.sin(angle) * oy;
  };
  const tx = quintic(dx);
  const ty = quintic(dy);
  const top = corner(fx, fy, dx, dy) + (corner(fx + 1, fy, dx - 1, dy) - corner(fx, fy, dx, dy)) * tx;
  const bottom = corner(fx, fy + 1, dx, dy - 1) + (corner(fx + 1, fy + 1, dx - 1, dy - 1) - corner(fx, fy + 1, dx, dy - 1)) * tx;
  return Math.SQRT2 * (top + (bottom - top) * ty);
}

/**
 * Smooth noise at CSS px (x, y): the mottle's relative luminance there, within ±`mottleRange`. Gradient noise (no
 * value noise's square blotches) on turned lattices that wrap every `MOTTLE_PERIOD` px, so the mottle tiles without
 * a seam or any axis-aligned banding.
 */
export function mottleAt(x: number, y: number, seed = 7, look: GrainLook = GRAIN): number {
  let total = 0;
  look.mottle.forEach(({ cell, amp }, octave) => {
    const turn = TURNS[(octave + 1) % TURNS.length];
    const n = turnedCells(MOTTLE_PERIOD, cell, turn);
    const k = n / MOTTLE_PERIOD;
    const u = (turn.a * x + turn.b * y) * k;
    const v = (turn.a * y - turn.b * x) * k;
    total += amp * Math.max(-1, Math.min(1, gradientNoise(u, v, n, seed + 101 * octave)));
  });
  return total;
}

/**
 * The mottle as a multiply layer: a `MOTTLE_CELLS`² grid of greys (one per `MOTTLE_STEP` CSS px), each
 * `(1 + mottle) / (1 + range)` so it only darkens; `paintGrain`'s `gain` of `1 + range` restores the average.
 * Written as opaque RGBA into `out`.
 */
export function paintMottle(out: Uint8ClampedArray, seed = 7, look: GrainLook = GRAIN): void {
  const range = mottleRange(look);
  for (let r = 0; r < MOTTLE_CELLS; r++) {
    for (let c = 0; c < MOTTLE_CELLS; c++) {
      const grey = (255 * (1 + mottleAt(c * MOTTLE_STEP, r * MOTTLE_STEP, seed, look))) / (1 + range);
      const o = (r * MOTTLE_CELLS + c) * 4;
      out[o] = grey;
      out[o + 1] = grey;
      out[o + 2] = grey;
      out[o + 3] = 255;
    }
  }
}
