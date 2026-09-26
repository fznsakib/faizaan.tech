export interface GlassMap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** How hard the glass bends at depth `s` into the bevel: 0 at the rim … 1 in the flat middle. */
const bend = (s: number) => (1 - s) ** 2;

/**
 * feDisplacementMap source for a rounded slab of thick glass: flat (128, 128) in the middle, and toward the rim
 * each pixel samples from further inward, along minus the outward normal of the rounded rectangle.
 * R/G = x/y sampling offset (128 = none), B = 128, A = 255.
 */
export function glassMap(width: number, height: number, radius: number, bevel: number): GlassMap {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  const innerX = width / 2 - r;
  const innerY = height / 2 - r;
  for (let y = 0; y < height; y++) {
    const py = y + 0.5 - height / 2;
    const qy = Math.abs(py) - innerY;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - width / 2;
      const qx = Math.abs(px) - innerX;
      // signed distance to the rounded rectangle (negative inside) and its gradient, the outward normal
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const outside = Math.hypot(ox, oy);
      const sd = outside + Math.min(Math.max(qx, qy), 0) - r;
      let nx: number;
      let ny: number;
      if (outside > 0) {
        nx = ox / outside;
        ny = oy / outside;
      } else if (qx > qy) {
        nx = 1;
        ny = 0;
      } else {
        nx = 0;
        ny = 1;
      }
      const m = bend(clamp(-sd / bevel, 0, 1));
      const i = (y * width + x) * 4;
      data[i] = Math.round(128 - 127 * Math.sign(px) * nx * m);
      data[i + 1] = Math.round(128 - 127 * Math.sign(py) * ny * m);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const TAU = 2 * Math.PI;
/** Body sizes are authored for this viewport width. */
const REF_WIDTH = 1440;
/** Tilt limits (deg): banking into the drift, turning toward the cursor, and the hard cap. */
const DRIFT_TILT = 7;
const POINTER_TILT = 13;
const MAX_TILT = 18;
/** Slow in-plane spin (deg). */
const SPIN = 5;
/** Beat response: a dip (px at REF_WIDTH) and a forward nod (deg), both easing out after the beat. */
const BOB_PX = 5;
const BEAT_TILT = 2.5;
/** feDisplacementMap scale (px at REF_WIDTH): resting glass, extra for thicker glass, extra in a drop. */
const REST_REFRACTION = 22;
const DEPTH_REFRACTION = 26;
const DROP_REFRACTION = 16;
/** Brightest a plain beat can make the glint (a DJ stab reaches 1), and how much a stab swells the glass. */
const BEAT_GLINT = 0.45;
const STAB_SWELL = 0.025;

export interface GlassBody {
  id: number;
  /** Anchor, as viewport fractions. */
  ax: number;
  ay: number;
  /** Size (px) at a 1440 px-wide viewport. */
  w: number;
  h: number;
  radius: number;
  /** 0..1: how thick the glass is; thicker bends more. */
  depth: number;
  /** Drift around the anchor: radii as viewport fractions, periods in seconds. */
  orbit: { rx: number; ry: number; px: number; py: number; phase: number };
}

export interface GlassInput {
  /** Seconds; poses are a pure function of it, so a long-hidden tab never jumps or explodes. */
  t: number;
  width: number;
  height: number;
  pointer: { x: number; y: number } | null;
  energy: number;
  beatPhase: number;
  isPlaying: boolean;
  sectionLevel: 0 | 1;
  stab: number;
  reduced: boolean;
}

export interface GlassPose {
  /** Centre (px). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees; +rotateX faces up, +rotateY faces right. */
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  scale: number;
  /** feDisplacementMap scale (px). */
  refraction: number;
  /** 0..1 specular flare. */
  glint: number;
}

/**
 * The pieces, placed around the page's furniture: a pill over the name, a lens beside the head, a slab over the
 * subtitle EQ and a tile on the right. Anchors and drift keep every centre below the transport strip (top 12%)
 * and above the social icons (bottom 15%).
 */
const TEMPLATES = [
  { ax: 0.3, ay: 0.24, w: 360, h: 140, radius: 70, depth: 0.7, rx: 0.07, ry: 0.06 },
  { ax: 0.72, ay: 0.42, w: 230, h: 230, radius: 115, depth: 1, rx: 0.07, ry: 0.08 },
  { ax: 0.17, ay: 0.68, w: 190, h: 290, radius: 48, depth: 0.55, rx: 0.05, ry: 0.06 },
  { ax: 0.84, ay: 0.64, w: 170, h: 170, radius: 46, depth: 0.8, rx: 0.035, ry: 0.06 },
];

/** The glass pieces: fixed shapes, with anchors, sizes and orbits jittered by `random`. */
export function createBodies(random: () => number = Math.random): GlassBody[] {
  const jitter = (amount: number) => (random() * 2 - 1) * amount;
  return TEMPLATES.map((template, id) => {
    const size = 1 + jitter(0.08);
    return {
      id,
      ax: template.ax + jitter(0.02),
      ay: template.ay + jitter(0.02),
      w: Math.round(template.w * size),
      h: Math.round(template.h * size),
      radius: Math.round(template.radius * size),
      depth: template.depth,
      orbit: {
        rx: template.rx,
        ry: template.ry,
        px: 19 + random() * 12,
        py: 23 + random() * 14,
        phase: random() * TAU,
      },
    };
  });
}

/** Beat dip over one beat: 0 on the beat, peaks (1) ~18% in, a small rebound, back to 0 — continuous across beats. */
const BOB_PEAK = Math.sin(TAU * 0.179) * Math.exp(-3 * 0.179);
const beatBob = (phase: number) => (Math.sin(TAU * phase) * Math.exp(-3 * phase)) / BOB_PEAK;

/** How big a body is drawn at this viewport, relative to its authored size. */
export function glassScale(body: GlassBody, width: number, height: number): number {
  return Math.min(clamp(width / REF_WIDTH, 0.5, 1.25), (0.6 * width) / body.w, (0.45 * height) / body.h);
}

/** Where a body is and how it's lit at time `t`: drifting, banking, facing the cursor, bobbing to the beat. */
export function glassPose(body: GlassBody, input: GlassInput): GlassPose {
  const { width, height, isPlaying } = input;
  const size = glassScale(body, width, height);
  const w = body.w * size;
  const h = body.h * size;
  const thickness = REST_REFRACTION + DEPTH_REFRACTION * body.depth;
  const rest = size * thickness;
  const ax = body.ax * width;
  const ay = body.ay * height;
  if (input.reduced) {
    return { x: ax, y: ay, w, h, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, refraction: rest, glint: 0 };
  }

  const { orbit } = body;
  const u = (TAU * input.t) / orbit.px + orbit.phase;
  const v = (TAU * input.t) / orbit.py + orbit.phase * 1.7;
  // a Lissajous drift with an off-ratio harmonic, so the path never visibly repeats
  const ox = 0.75 * Math.sin(u) + 0.25 * Math.sin(2.3 * u + 1.1);
  const oy = 0.75 * Math.sin(v) + 0.25 * Math.sin(1.7 * v + 0.4);
  const bob = isPlaying ? beatBob(input.beatPhase) : 0;
  const x = ax + orbit.rx * width * ox;
  const y = ay + orbit.ry * height * oy + BOB_PX * size * bob;

  // bank into the drift; a cursor takes over most of the tilt
  let rotateY = DRIFT_TILT * Math.cos(u);
  let rotateX = -DRIFT_TILT * Math.cos(v);
  if (input.pointer) {
    const dx = clamp((input.pointer.x - x) / (0.5 * width), -1, 1);
    const dy = clamp((input.pointer.y - y) / (0.5 * height), -1, 1);
    rotateY = 0.35 * rotateY + POINTER_TILT * dx;
    rotateX = 0.35 * rotateX - POINTER_TILT * dy;
  }
  rotateX -= BEAT_TILT * bob;
  const rotateZ = SPIN * Math.sin((TAU * input.t) / (orbit.px * 1.618) + orbit.phase * 2.9);

  const refraction = isPlaying
    ? size * (thickness * (0.7 + 0.6 * input.energy) + DROP_REFRACTION * input.sectionLevel)
    : rest;
  const accent = isPlaying ? BEAT_GLINT * (1 - input.beatPhase) ** 6 * (0.4 + 0.6 * input.energy) : 0;

  return {
    x,
    y,
    w,
    h,
    rotateX: clamp(rotateX, -MAX_TILT, MAX_TILT),
    rotateY: clamp(rotateY, -MAX_TILT, MAX_TILT),
    rotateZ,
    scale: 1 + STAB_SWELL * input.stab,
    refraction,
    glint: clamp(Math.max(input.stab, accent), 0, 1),
  };
}
