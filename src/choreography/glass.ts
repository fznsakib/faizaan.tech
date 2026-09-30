import type { HeadOutline } from "./headShape";

export interface GlassMap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * How hard the glass bends at depth `s` into the bevel (0 at the rim … 1 in the flat middle): the slope of a
 * quarter-circle rim, so it bends gently well inside the bevel and saturates toward the edge, like a thick dome.
 */
const bend = (s: number) => {
  const x = 1 - s;
  return Math.min(1, (0.6 * x) / Math.sqrt(Math.max(1e-6, 1 - x * x)));
};

export interface Point {
  x: number;
  y: number;
}

/**
 * feDisplacementMap source for a slab of thick glass with this outline (a closed polygon in the map's pixels):
 * flat (128, 128) in the middle, and within `bevel` px of the edge each pixel samples from further inward, along
 * the outline's inward normal (from the nearest point on the outline). Outside the outline it keeps the rim's full
 * bend, so the clip edge never shows a seam. R/G = x/y sampling offset (128 = none), B = 128, A = 255.
 */
export function glassMap(outline: readonly Point[], width: number, height: number, bevel: number): GlassMap {
  const data = new Uint8ClampedArray(width * height * 4);
  const n = outline.length;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const ex = new Float64Array(n);
  const ey = new Float64Array(n);
  const el = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    ax[i] = a.x;
    ay[i] = a.y;
    ex[i] = b.x - a.x;
    ey[i] = b.y - a.y;
    el[i] = ex[i] * ex[i] + ey[i] * ey[i] || 1;
  }
  const near = new Int32Array(n);
  const crossings: number[] = [];
  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    // this row's crossings of the outline (for inside/outside), and the only edges that can be within `bevel`
    crossings.length = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const by = ay[i] + ey[i];
      if (ay[i] > py !== by > py) crossings.push(ax[i] + (ex[i] * (py - ay[i])) / ey[i]);
      if (Math.min(ay[i], by) - bevel <= py && py <= Math.max(ay[i], by) + bevel) near[count++] = i;
    }
    crossings.sort((a, b) => a - b);
    let crossed = 0;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      while (crossed < crossings.length && crossings[crossed] < px) crossed++;
      const inside = crossed % 2 === 1;
      let best = bevel * bevel;
      let qx = px;
      let qy = py;
      for (let k = 0; k < count; k++) {
        const i = near[k];
        const t = clamp(((px - ax[i]) * ex[i] + (py - ay[i]) * ey[i]) / el[i], 0, 1);
        const cx = ax[i] + t * ex[i];
        const cy = ay[i] + t * ey[i];
        const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (d2 < best) {
          best = d2;
          qx = cx;
          qy = cy;
        }
      }
      const d = Math.sqrt(best);
      // inward: away from the nearest edge point when inside, toward it when outside; flat beyond the bevel
      const sign = inside ? 1 : -1;
      const m = inside ? bend(clamp(d / bevel, 0, 1)) : 1;
      const dx = qx !== px || qy !== py ? (sign * (px - qx)) / d : 0;
      const dy = qx !== px || qy !== py ? (sign * (py - qy)) / d : 0;
      const i = (y * width + x) * 4;
      data[i] = Math.round(128 + 127 * dx * m);
      data[i + 1] = Math.round(128 + 127 * dy * m);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const TAU = 2 * Math.PI;
/** Body sizes are authored for this viewport width. */
const REF_WIDTH = 1440;
/** Tilt (deg): banking into the drift, leaning into a throw, turning toward the cursor, and the hard cap. */
const DRIFT_TILT = 7;
const MOTION_TILT = 8;
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

/** Physics steps: the most time one frame may advance (s), and the substep (s). */
const MAX_DT = 1 / 30;
const SUBSTEP = 1 / 120;
/** The drift is a critically damped spring toward the orbit target, with this angular frequency (rad/s). */
const DRIFT_OMEGA = TAU / 2.5;
/** A thrown piece: friction (1/s), the speed it counts as stopped (px/s), and the fastest throw (px/s). */
const FRICTION = 2.4;
const REST_SPEED = 14;
const MAX_THROW = 4500;
/** Walls: restitution, and the impact speeds (px/s) where a ping starts and where it's at full strength. */
const RESTITUTION = 0.8;
const PING_MIN = 90;
const PING_FULL = 1800;
/** The ping after a wall hit: decay (s), bounce rate (Hz), and squash depth across the hit axis. */
const PING_DECAY = 0.3;
const PING_HZ = 6;
const PING_SQUASH = 0.14;
/** How far back (s) the release velocity looks at pointer samples. */
const RELEASE_WINDOW = 0.08;
/**
 * The head: restitution off it, how fast a piece caught overlapping it (dropped behind it, or the head moving into
 * it) glides out (px/s), and the gap a drifting piece keeps from it (px at REF_WIDTH).
 */
const HEAD_RESTITUTION = 0.7;
const DEPENETRATE = 900;
const HEAD_GAP = 14;
/** Every Nth outline point meets the head (40 of 160), then the deepest one's neighbours are checked too. */
const HEAD_STRIDE = 4;
/** Deeper than this (px at REF_WIDTH), the head's interior normals stop being trustworthy: leave by its spine instead. */
const GRAZE = 24;

export interface Extent {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GlassBody {
  id: number;
  /** Anchor (its first home), as viewport fractions. */
  ax: number;
  ay: number;
  /** Bounding-box size (px) at a 1440 px-wide viewport. */
  w: number;
  h: number;
  /** Closed, smooth, simple outline around the body's centre (px at 1440 wide), counter-clockwise on screen. */
  outline: Point[];
  /** How far the outline reaches from the centre each way (px at 1440 wide), with room for its spin. */
  extent: Extent;
  /** The furthest the outline reaches from the centre in any direction (px at 1440 wide). */
  radius: number;
  /** 0..1: how thick the glass is; thicker bends more. */
  depth: number;
  /** Glint colour (hue, deg). */
  hue: number;
  /** Drift around home: radii as viewport fractions, periods in seconds. */
  orbit: { rx: number; ry: number; px: number; py: number; phase: number };
}

/** A body's physical state: integrated per frame by `stepGlass`, or placed by `dragTo` while held. */
export interface GlassState {
  /** Centre (px) and velocity (px/s). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Home, the centre of its drift orbit, as viewport fractions. Moves to wherever a throw comes to rest. */
  hx: number;
  hy: number;
  mode: "drift" | "held" | "thrown";
  /** The latest wall or head hit: strength 0..1, when (s), and the axis it bounced on. */
  impact: number;
  impactAt: number;
  impactAxis: "x" | "y";
  /** The latest knock against the head (a new object per knock), or null. */
  hit: HeadHit | null;
}

/** A knock against the head: where the glass met its outline (px), the outline's outward normal there, and the approach speed along it (px/s). */
export interface HeadHit {
  x: number;
  y: number;
  nx: number;
  ny: number;
  speed: number;
  /** Seconds. */
  at: number;
}

export interface StepInput {
  /** Seconds, at the end of this step. */
  t: number;
  /** Seconds since the last step; clamped, so a long-hidden tab can't explode anything. */
  dt: number;
  width: number;
  height: number;
  reduced: boolean;
  /** The head's silhouette this frame: free pieces bounce off it and drift around it. */
  head?: HeadOutline | null;
}

export interface PointerSample {
  /** Seconds. */
  t: number;
  x: number;
  y: number;
}

export interface GlassInput {
  /** Seconds. */
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
  /** Wall-hit squash, multiplying `scale` per axis. */
  squashX: number;
  squashY: number;
  /** feDisplacementMap scale (px). */
  refraction: number;
  /** 0..1 specular flare. */
  glint: number;
}

/**
 * Where the pieces live and how big they are: over the name, beside the head, over the subtitle EQ and on the
 * right. Anchors and drift keep every centre below the top strip (top 12%, the jam pad) and above the icons (bottom 15%).
 * Radius is the size of the piece's radial profile (px at 1440 wide).
 */
const TEMPLATES = [
  { ax: 0.3, ay: 0.24, radius: 105, depth: 0.7, rx: 0.07, ry: 0.06 },
  { ax: 0.72, ay: 0.42, radius: 112, depth: 1, rx: 0.07, ry: 0.08 },
  { ax: 0.17, ay: 0.68, radius: 115, depth: 0.55, rx: 0.05, ry: 0.06 },
  { ax: 0.84, ay: 0.64, radius: 82, depth: 0.8, rx: 0.035, ry: 0.06 },
];

/**
 * Shape families, each a radial profile r(θ) = 1 + Σ aₖ·sin(kθ + φₖ) for k = 2…5 (amplitudes are maxima; each
 * piece rolls 55–100% of them), stretched by an aspect ratio and sheared. Odd harmonics make every piece lopsided;
 * strong low ones bite a soft concave notch. Σ aₖ ≤ 0.6 keeps r ≥ 0.4, so no piece gets spindly.
 */
const SHAPES = [
  { name: "pebble", aspect: [1.15, 1.5], amps: [0.09, 0.12, 0.04, 0.02], skew: 0.15 },
  { name: "blob", aspect: [0.95, 1.2], amps: [0.16, 0.15, 0.08, 0.05], skew: 0.2 },
  { name: "pill", aspect: [2, 2.6], amps: [0.05, 0.17, 0.06, 0.04], skew: 0.25 },
  { name: "lens", aspect: [1, 1.25], amps: [0.06, 0.1, 0.12, 0.09], skew: 0.15 },
  { name: "shard", aspect: [1.3, 1.7], amps: [0.22, 0.2, 0.07, 0.03], skew: 0.3 },
];
const OUTLINE_POINTS = 160;

const between = (random: () => number, lo: number, hi: number) => lo + random() * (hi - lo);

/** A smooth, lopsided outline around the origin, counter-clockwise on screen (y down). */
function makeOutline(random: () => number, radius: number, shape: (typeof SHAPES)[number]): Point[] {
  const amps = shape.amps.map((max) => max * between(random, 0.55, 1));
  const phases = amps.map(() => random() * TAU);
  const aspect = between(random, shape.aspect[0], shape.aspect[1]);
  const [sx, sy] = [Math.sqrt(aspect), 1 / Math.sqrt(aspect)];
  const skew = between(random, -shape.skew, shape.skew);
  const turn = between(random, -0.5, 0.5);
  const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
  return Array.from({ length: OUTLINE_POINTS }, (_, i) => {
    const angle = (TAU * i) / OUTLINE_POINTS;
    const r = radius * (1 + amps.reduce((sum, a, k) => sum + a * Math.sin((k + 2) * angle + phases[k]), 0));
    const x = r * Math.cos(angle) * sx + skew * r * Math.sin(angle) * sy;
    const y = r * Math.sin(angle) * sy;
    return { x: x * cos - y * sin, y: x * sin + y * cos };
  });
}

/** How far an outline reaches each way from its centre, over its whole in-plane spin. */
function reach(outline: readonly Point[]): Extent {
  const extent = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const degrees of [-SPIN, -SPIN / 2, 0, SPIN / 2, SPIN]) {
    const [cos, sin] = [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)];
    for (const { x, y } of outline) {
      const [rx, ry] = [x * cos - y * sin, x * sin + y * cos];
      extent.left = Math.max(extent.left, -rx);
      extent.right = Math.max(extent.right, rx);
      extent.top = Math.max(extent.top, -ry);
      extent.bottom = Math.max(extent.bottom, ry);
    }
  }
  return extent;
}

/** The glass pieces for one page load: each a different weird shape, with sizes, orbits and glint colour rolled by `random`. */
export function createBodies(random: () => number = Math.random): GlassBody[] {
  const jitter = (amount: number) => (random() * 2 - 1) * amount;
  // a different shape family for every piece, dealt fresh each load
  const families = SHAPES.map((shape) => ({ shape, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ shape }) => shape);
  return TEMPLATES.map((template, id) => {
    const outline = makeOutline(random, template.radius * (1 + jitter(0.15)), families[id]);
    const xs = outline.map((point) => point.x);
    const ys = outline.map((point) => point.y);
    return {
      id,
      ax: template.ax + jitter(0.02),
      ay: template.ay + jitter(0.02),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
      outline,
      extent: reach(outline),
      radius: Math.max(...outline.map((point) => Math.hypot(point.x, point.y))),
      depth: template.depth,
      hue: random() * 360,
      orbit: {
        rx: template.rx * (1 + jitter(0.2)),
        ry: template.ry * (1 + jitter(0.2)),
        px: 19 + random() * 12,
        py: 23 + random() * 14,
        phase: random() * TAU,
      },
    };
  });
}

/**
 * The outline as a closed SVG path in a pane's pixels (scaled by `scale`, centre at `ox`, `oy`), with Catmull-Rom
 * curves through every point so the clip and the rim stroke are smooth, not faceted.
 */
export function outlinePath(outline: readonly Point[], scale: number, ox: number, oy: number): string {
  const n = outline.length;
  const at = (i: number) => {
    const point = outline[((i % n) + n) % n];
    return { x: point.x * scale + ox, y: point.y * scale + oy };
  };
  const f = (value: number) => value.toFixed(1);
  let d = `M${f(at(0).x)},${f(at(0).y)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d +=
      `C${f(p1.x + (p2.x - p0.x) / 6)},${f(p1.y + (p2.y - p0.y) / 6)} ` +
      `${f(p2.x - (p3.x - p1.x) / 6)},${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)},${f(p2.y)}`;
  }
  return `${d}Z`;
}

/** Beat dip over one beat: 0 on the beat, peaks (1) ~18% in, a small rebound, back to 0 — continuous across beats. */
const BOB_PEAK = Math.sin(TAU * 0.179) * Math.exp(-3 * 0.179);
const beatBob = (phase: number) => (Math.sin(TAU * phase) * Math.exp(-3 * phase)) / BOB_PEAK;

/** Smallest scale, reached on phones: a piece there covers at most ~1.5× the share of the width it does on desktop. */
const MIN_SCALE = 0.38;

/** How big a body is drawn at this viewport, relative to its authored size. */
export function glassScale(body: GlassBody, width: number, height: number): number {
  return Math.min(clamp(width / REF_WIDTH, MIN_SCALE, 1.25), (0.6 * width) / body.w, (0.45 * height) / body.h);
}

/** How far the drawn outline reaches from the centre each way (px): how close the centre may come to each wall. */
export function glassExtent(body: GlassBody, width: number, height: number): Extent {
  const size = glassScale(body, width, height);
  const { left, right, top, bottom } = body.extent;
  return { left: left * size, right: right * size, top: top * size, bottom: bottom * size };
}

/** The drift orbit's offset from home (px) at time `t`: a Lissajous with an off-ratio harmonic, so it never visibly repeats. */
function orbitOffset(body: GlassBody, t: number, width: number, height: number): { x: number; y: number } {
  const { orbit } = body;
  const u = (TAU * t) / orbit.px + orbit.phase;
  const v = (TAU * t) / orbit.py + orbit.phase * 1.7;
  return {
    x: orbit.rx * width * (0.75 * Math.sin(u) + 0.25 * Math.sin(2.3 * u + 1.1)),
    y: orbit.ry * height * (0.75 * Math.sin(v) + 0.25 * Math.sin(1.7 * v + 0.4)),
  };
}

/** Where the drift pulls a body: home plus its orbit (just home with reduced motion), inside the walls. */
function driftTarget(
  body: GlassBody,
  home: { hx: number; hy: number },
  t: number,
  width: number,
  height: number,
  reduced: boolean,
): { x: number; y: number } {
  const e = glassExtent(body, width, height);
  const offset = reduced ? { x: 0, y: 0 } : orbitOffset(body, t, width, height);
  return {
    x: clamp(home.hx * width + offset.x, e.left, width - e.right),
    y: clamp(home.hy * height + offset.y, e.top, height - e.bottom),
  };
}

/** The slow in-plane spin (deg) at time `t`. */
const spinAt = (body: GlassBody, t: number) => SPIN * Math.sin((TAU * t) / (body.orbit.px * 1.618) + body.orbit.phase * 2.9);

/** The deepest outline point `probe` found: where it is (px). */
const contact = { x: 0, y: 0 };

/**
 * How far a body's outline (drawn at `size`, spun `spin` degrees, centred at x, y) stands off the head: the least
 * signed distance of every `stride`th point and then of the deepest one's neighbours, negative when it overlaps.
 * Leaves that point in `contact`.
 */
function probe(body: GlassBody, x: number, y: number, size: number, spin: number, head: HeadOutline, stride: number): number {
  const angle = (spin * Math.PI) / 180;
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  const n = body.outline.length;
  let least = Infinity;
  let deepest = 0;
  const test = (i: number) => {
    const point = body.outline[((i % n) + n) % n];
    const px = x + (point.x * cos - point.y * sin) * size;
    const py = y + (point.x * sin + point.y * cos) * size;
    const d = head.distance(px, py);
    if (d < least) {
      least = d;
      deepest = i;
      contact.x = px;
      contact.y = py;
    }
  };
  for (let i = 0; i < n; i += stride) test(i);
  if (stride > 1 && least < Infinity) {
    const around = deepest;
    for (let i = around - stride + 1; i < around + stride; i++) if (i !== around) test(i);
  }
  return least;
}

/** Straight away from the head's spine (cranium centre to nod pivot) through (x, y): the way out from deep inside it. */
function leave(head: HeadOutline, x: number, y: number, out: Point): void {
  const [ax, ay] = [head.centre.x, head.centre.y];
  const [ex, ey] = [head.pivot.x - ax, head.pivot.y - ay];
  const t = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
  const [dx, dy] = [x - (ax + t * ex), y - (ay + t * ey)];
  const length = Math.hypot(dx, dy);
  [out.x, out.y] = length > 1e-9 ? [dx / length, dy / length] : [0, -1];
}

/** How far a body's drawn outline stands off the head (px), spun `spin` degrees: negative when they overlap. */
export function headClearance(
  body: GlassBody,
  state: GlassState,
  head: HeadOutline,
  width: number,
  height: number,
  spin: number,
): number {
  return probe(body, state.x, state.y, glassScale(body, width, height), spin, head, 1);
}

/**
 * Move a centre by (dx, dy) inside the walls. What a wall blocks turns into a slide along it, away from the head's
 * middle on the side `from` is on: a piece pinned between the head and a wall works its way round the head's
 * narrower end instead of being pushed into the wall forever.
 */
function shove(
  from: Point,
  x: number,
  y: number,
  dx: number,
  dy: number,
  e: Extent,
  width: number,
  height: number,
  head: HeadOutline,
): Point {
  let nx = clamp(x + dx, e.left, width - e.right);
  let ny = clamp(y + dy, e.top, height - e.bottom);
  const blockedX = Math.abs(x + dx - nx);
  const blockedY = Math.abs(y + dy - ny);
  const { left, right, top, bottom } = head.bounds;
  if (blockedX > 1e-9) ny = clamp(ny + (from.y >= (top + bottom) / 2 ? blockedX : -blockedX), e.top, height - e.bottom);
  if (blockedY > 1e-9) nx = clamp(nx + (from.x >= (left + right) / 2 ? blockedY : -blockedY), e.left, width - e.right);
  return { x: nx, y: ny };
}

/**
 * Where drift may pull a body with the head in the way: the target nudged out along the head's normal (and round
 * along a wall that blocks that) until the outline clears the head by HEAD_GAP. Moves continuously with the target,
 * so a piece glides round the head instead of bumping into it.
 */
function steer(
  body: GlassBody,
  target: Point,
  from: Point,
  head: HeadOutline,
  size: number,
  spin: number,
  e: Extent,
  width: number,
  height: number,
): Point {
  const gap = HEAD_GAP * size;
  if (head.distance(target.x, target.y) >= body.radius * size + gap) return target;
  let place = target;
  const n = { x: 0, y: 0 };
  for (let round = 0; round < 12; round++) {
    const clearance = probe(body, place.x, place.y, size, spin, head, HEAD_STRIDE);
    if (clearance >= gap - 0.01) break;
    if (clearance > -GRAZE * size) head.normal(contact.x, contact.y, n);
    else leave(head, place.x, place.y, n);
    place = shove(from, place.x, place.y, n.x * (gap - clearance), n.y * (gap - clearance), e, width, height, head);
  }
  return place;
}

/** A body at rest on its drift path at time `t`, home at its anchor (and clear of the head, given one). */
export function initialState(
  body: GlassBody,
  t: number,
  width: number,
  height: number,
  reduced: boolean,
  head?: HeadOutline | null,
): GlassState {
  const home = { hx: body.ax, hy: body.ay };
  let { x, y } = driftTarget(body, home, t, width, height, reduced);
  if (head) {
    const spin = reduced ? 0 : spinAt(body, t);
    const e = glassExtent(body, width, height);
    ({ x, y } = steer(body, { x, y }, { x, y }, head, glassScale(body, width, height), spin, e, width, height));
  }
  return { x, y, vx: 0, vy: 0, ...home, mode: "drift", impact: 0, impactAt: -Infinity, impactAxis: "x", hit: null };
}

/**
 * The head's silhouette is solid to a free body's outline: find the outline point deepest inside it, push the body
 * out along the head's normal there, and turn back its approach (bouncing at HEAD_RESTITUTION when thrown; a
 * drifting piece just stops pressing). A knock fast enough to ping records a `hit` for the head's flinch. Overlap
 * this step's motion didn't cause (dropped behind the head, the head moving into it) glides out at DEPENETRATE px/s
 * instead, and never pings. Returns the same object when nothing touched.
 */
export function collideHead(
  body: GlassBody,
  state: GlassState,
  head: HeadOutline,
  width: number,
  height: number,
  t: number,
  h: number,
  reduced: boolean,
): GlassState {
  if (state.mode === "held") return state;
  const size = glassScale(body, width, height);
  if (head.distance(state.x, state.y) >= body.radius * size) return state;
  const clearance = probe(body, state.x, state.y, size, reduced ? 0 : spinAt(body, t), head, HEAD_STRIDE);
  if (clearance >= 0) return state;
  const at = { x: contact.x, y: contact.y };
  const depth = -clearance;
  const n = { x: 0, y: 0 };
  head.normal(at.x, at.y, n);
  const approach = Math.max(0, -(state.vx * n.x + state.vy * n.y));
  // touching: this step's own motion made the overlap, so it's a contact at the outline, resolved at once; anything
  // deeper was already there and glides out along the way out of the head, no longer heading further in
  const touching = depth <= approach * h + 2;
  if (!touching) leave(head, state.x, state.y, n);
  const push = touching ? depth : Math.min(depth, DEPENETRATE * h);
  const moved = shove(state, state.x, state.y, n.x * push, n.y * push, glassExtent(body, width, height), width, height, head);
  let { vx, vy } = state;
  const inward = Math.max(0, -(vx * n.x + vy * n.y));
  if (inward > 0) {
    const bounce = 1 + (touching && state.mode === "thrown" ? HEAD_RESTITUTION : 0);
    vx += bounce * inward * n.x;
    vy += bounce * inward * n.y;
  }
  // only a throw knocks: drift is ambient, and a head that flinched at nobody's throw would read as a glitch
  const knock = touching && approach >= PING_MIN && state.mode === "thrown";
  return {
    ...state,
    x: moved.x,
    y: moved.y,
    vx,
    vy,
    impact: knock ? clamp(approach / PING_FULL, 0, 1) : state.impact,
    impactAt: knock ? t : state.impactAt,
    impactAxis: knock ? (Math.abs(n.x) >= Math.abs(n.y) ? "x" : "y") : state.impactAxis,
    hit: knock ? { x: at.x + n.x * depth, y: at.y + n.y * depth, nx: n.x, ny: n.y, speed: approach, at: t } : state.hit,
  };
}

/** Exponential friction on one velocity component: frame-rate independent. */
export function applyFriction(velocity: number, dt: number): number {
  return velocity * Math.exp(-FRICTION * dt);
}

/**
 * The viewport edges are hard walls for a body's outline (`extent` from glassExtent): clamp inside, reflect the
 * normal velocity with restitution, and record a hit fast enough to ping. Returns the same object when nothing
 * touched a wall.
 */
export function collideWalls(state: GlassState, extent: Extent, width: number, height: number, t: number): GlassState {
  let { x, y, vx, vy } = state;
  let hit = 0;
  let axis = state.impactAxis;
  const bounce = (v: number, into: boolean, onAxis: "x" | "y") => {
    if (!into) return v;
    if (Math.abs(v) > hit) {
      hit = Math.abs(v);
      axis = onAxis;
    }
    return -v * RESTITUTION;
  };
  const { left, right, top, bottom } = extent;
  if (x < left) [x, vx] = [left, bounce(vx, vx < 0, "x")];
  else if (x > width - right) [x, vx] = [width - right, bounce(vx, vx > 0, "x")];
  if (y < top) [y, vy] = [top, bounce(vy, vy < 0, "y")];
  else if (y > height - bottom) [y, vy] = [height - bottom, bounce(vy, vy > 0, "y")];
  if (x === state.x && y === state.y) return state;
  const ping = hit >= PING_MIN;
  return {
    ...state,
    x,
    y,
    vx,
    vy,
    impact: ping ? clamp(hit / PING_FULL, 0, 1) : state.impact,
    impactAt: ping ? t : state.impactAt,
    impactAxis: ping ? axis : state.impactAxis,
  };
}

/**
 * Advance one body by `dt` (clamped to MAX_DT, in SUBSTEP slices): a thrown body glides under friction until it
 * stops, and that spot becomes its home; otherwise a spring draws it along its drift orbit. Walls always hold.
 */
export function stepGlass(body: GlassBody, state: GlassState, input: StepInput): GlassState {
  const { t, width, height, reduced, head } = input;
  const e = glassExtent(body, width, height);
  if (state.mode === "held") {
    // the pointer places it; only a resize can move it, back inside the walls
    const x = clamp(state.x, e.left, width - e.right);
    const y = clamp(state.y, e.top, height - e.bottom);
    return x === state.x && y === state.y ? state : { ...state, x, y };
  }
  let next = state;
  let remaining = clamp(input.dt, 0, MAX_DT);
  const stiffness = DRIFT_OMEGA * DRIFT_OMEGA;
  const damping = 2 * DRIFT_OMEGA;
  // the drift target only changes within a step if a throw comes to rest (a new home), so steer it once per home
  let target: Point | null = null;
  let targetHome = { hx: NaN, hy: NaN };
  while (remaining > 1e-9) {
    const h = Math.min(SUBSTEP, remaining);
    remaining -= h;
    let { vx, vy } = next;
    if (next.mode === "thrown") {
      vx = applyFriction(vx, h);
      vy = applyFriction(vy, h);
    } else {
      if (!target || next.hx !== targetHome.hx || next.hy !== targetHome.hy) {
        targetHome = { hx: next.hx, hy: next.hy };
        target = driftTarget(body, next, t, width, height, reduced);
        if (head) {
          const spin = reduced ? 0 : spinAt(body, t);
          target = steer(body, target, next, head, glassScale(body, width, height), spin, e, width, height);
        }
      }
      vx += (stiffness * (target.x - next.x) - damping * vx) * h;
      vy += (stiffness * (target.y - next.y) - damping * vy) * h;
    }
    next = collideWalls({ ...next, x: next.x + vx * h, y: next.y + vy * h, vx, vy }, e, width, height, t);
    if (head) next = collideHead(body, next, head, width, height, t, h, reduced);
    if (next.mode === "thrown" && Math.hypot(next.vx, next.vy) < REST_SPEED) {
      const offset = reduced ? { x: 0, y: 0 } : orbitOffset(body, t, width, height);
      next = { ...next, mode: "drift", hx: (next.x - offset.x) / width, hy: (next.y - offset.y) / height };
    }
  }
  return collideWalls(next, e, width, height, t);
}

/** While held, a body sits exactly where the pointer puts it (minus the grab offset), inside the walls. */
export function dragTo(
  state: GlassState,
  pointer: Point,
  grab: Point,
  extent: Extent,
  width: number,
  height: number,
): GlassState {
  return {
    ...state,
    mode: "held",
    x: clamp(pointer.x - grab.x, extent.left, width - extent.right),
    y: clamp(pointer.y - grab.y, extent.top, height - extent.bottom),
  };
}

/** Let go of a body with a fling velocity: it glides off, or with reduced motion it stays put and lives there. */
export function release(
  state: GlassState,
  velocity: { vx: number; vy: number },
  width: number,
  height: number,
  reduced: boolean,
): GlassState {
  if (reduced) return { ...state, mode: "drift", vx: 0, vy: 0, hx: state.x / width, hy: state.y / height };
  const speed = Math.hypot(velocity.vx, velocity.vy);
  const cap = speed > MAX_THROW ? MAX_THROW / speed : 1;
  return { ...state, mode: "thrown", vx: velocity.vx * cap, vy: velocity.vy * cap };
}

/** Fling velocity (px/s): a least-squares fit to the pointer samples from the last RELEASE_WINDOW before `now` (s). */
export function releaseVelocity(samples: readonly PointerSample[], now: number): { vx: number; vy: number } {
  const recent = samples.filter((sample) => sample.t >= now - RELEASE_WINDOW - 1e-9 && sample.t <= now + 1e-9);
  if (recent.length < 2) return { vx: 0, vy: 0 };
  const n = recent.length;
  const mt = recent.reduce((sum, sample) => sum + sample.t, 0) / n;
  const mx = recent.reduce((sum, sample) => sum + sample.x, 0) / n;
  const my = recent.reduce((sum, sample) => sum + sample.y, 0) / n;
  let tt = 0;
  let tx = 0;
  let ty = 0;
  for (const sample of recent) {
    const dt = sample.t - mt;
    tt += dt * dt;
    tx += dt * (sample.x - mx);
    ty += dt * (sample.y - my);
  }
  if (tt < 1e-12) return { vx: 0, vy: 0 };
  return { vx: tx / tt, vy: ty / tt };
}

/** Even-odd point-in-polygon. */
function insideOutline(outline: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [a, b] = [outline[i], outline[j]];
    if (a.y > y !== b.y > y && x < a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

/** The topmost body (last drawn) whose drawn outline contains `point`, ignoring tilt and spin; -1 for none. */
export function hitGlass(
  bodies: readonly GlassBody[],
  states: readonly GlassState[],
  point: Point,
  width: number,
  height: number,
): number {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const size = glassScale(bodies[i], width, height);
    if (insideOutline(bodies[i].outline, (point.x - states[i].x) / size, (point.y - states[i].y) / size)) return i;
  }
  return -1;
}

/** How a body looks this frame: where physics put it, bobbing to the beat, banking, facing the cursor, pinging off walls. */
export function glassPose(body: GlassBody, input: GlassInput, state: GlassState): GlassPose {
  const { t, width, height, isPlaying } = input;
  const size = glassScale(body, width, height);
  const w = body.w * size;
  const h = body.h * size;
  const thickness = REST_REFRACTION + DEPTH_REFRACTION * body.depth;
  const rest = size * thickness;
  if (input.reduced) {
    return {
      x: state.x,
      y: state.y,
      w,
      h,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      scale: 1,
      squashX: 1,
      squashY: 1,
      refraction: rest,
      glint: 0,
    };
  }

  const { orbit } = body;
  const u = (TAU * t) / orbit.px + orbit.phase;
  const v = (TAU * t) / orbit.py + orbit.phase * 1.7;
  // a held piece stays exactly under the pointer; only a free one bobs to the beat
  const bob = isPlaying && state.mode !== "held" ? beatBob(input.beatPhase) : 0;
  const e = glassExtent(body, width, height);
  const x = state.x;
  const y = clamp(state.y + BOB_PX * size * bob, e.top, height - e.bottom);

  // bank with the drift; a cursor takes over most of that; lean into any throw or drag
  let rotateY = DRIFT_TILT * Math.cos(u);
  let rotateX = -DRIFT_TILT * Math.cos(v);
  if (input.pointer) {
    const dx = clamp((input.pointer.x - x) / (0.5 * width), -1, 1);
    const dy = clamp((input.pointer.y - y) / (0.5 * height), -1, 1);
    rotateY = 0.35 * rotateY + POINTER_TILT * dx;
    rotateX = 0.35 * rotateX - POINTER_TILT * dy;
  }
  rotateY += MOTION_TILT * clamp(state.vx / 1200, -1, 1);
  rotateX -= MOTION_TILT * clamp(state.vy / 1200, -1, 1) + BEAT_TILT * bob;
  const rotateZ = spinAt(body, t);

  // the ping: a flash and a wobbling squash along the axis it hit, scaled by how hard
  const since = t - state.impactAt;
  const ring = state.impact > 0 && since >= 0 ? state.impact * Math.exp(-since / PING_DECAY) : 0;
  // rectified, so it only ever squashes into the wall it hit and never pokes through it
  const wobble = ring > 0 ? ring * Math.max(0, Math.cos(TAU * PING_HZ * since)) : 0;
  const across = 1 - PING_SQUASH * wobble;
  const along = 1 + 0.5 * PING_SQUASH * wobble;

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
    squashX: state.impactAxis === "x" ? across : along,
    squashY: state.impactAxis === "y" ? across : along,
    refraction,
    glint: clamp(Math.max(input.stab, accent, ring), 0, 1),
  };
}

/** Specular hotspot centre (% of the pane) and strength (0..1) for a tilt, lit from the head's key light (up-right). */
export function glassSheen(rotateX: number, rotateY: number): { x: number; y: number; intensity: number } {
  const facing = (rotateX + rotateY) / (2 * MAX_TILT); // -1 turned away from the light … 1 facing it
  return {
    x: 72 - 1.5 * rotateY,
    y: 26 + 1.5 * rotateX,
    intensity: clamp(0.55 + 0.45 * facing, 0, 1),
  };
}

export interface BrowserIdentity {
  userAgent: string;
  userAgentData?: { brands?: readonly { brand: string }[] };
}

/**
 * Whether `backdrop-filter: url(#svg-filter)` refracts here: Chromium only. Trust the UA-CH brand list when it has
 * entries; an empty or missing list (seen in Chrome 154) falls back to the user-agent string. iOS browsers are all
 * WebKit, whatever their name.
 */
export function supportsRefraction(nav: BrowserIdentity): boolean {
  const brands = nav.userAgentData?.brands ?? [];
  if (brands.length > 0) return brands.some(({ brand }) => brand === "Chromium");
  return /\b(Chrome|Chromium)\/\d/.test(nav.userAgent);
}
