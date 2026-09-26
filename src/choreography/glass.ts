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
/** The ping after a wall hit: decay (s), wobble (Hz), and squash depth along the hit axis. */
const PING_DECAY = 0.3;
const PING_HZ = 6;
const PING_SQUASH = 0.14;
/** How far back (s) the release velocity looks at pointer samples. */
const RELEASE_WINDOW = 0.08;

export interface GlassBody {
  id: number;
  /** Anchor (its first home), as viewport fractions. */
  ax: number;
  ay: number;
  /** Size (px) at a 1440 px-wide viewport. */
  w: number;
  h: number;
  radius: number;
  /** 0..1: how thick the glass is; thicker bends more. */
  depth: number;
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
  /** The latest wall hit: strength 0..1, when (s), and the axis it bounced on. */
  impact: number;
  impactAt: number;
  impactAxis: "x" | "y";
}

export interface StepInput {
  /** Seconds, at the end of this step. */
  t: number;
  /** Seconds since the last step; clamped, so a long-hidden tab can't explode anything. */
  dt: number;
  width: number;
  height: number;
  reduced: boolean;
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

/** Half the drawn width and height (px): how close the centre may come to a wall. */
export function glassHalfSize(body: GlassBody, width: number, height: number): { hw: number; hh: number } {
  const size = glassScale(body, width, height);
  return { hw: (body.w * size) / 2, hh: (body.h * size) / 2 };
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
  const { hw, hh } = glassHalfSize(body, width, height);
  const offset = reduced ? { x: 0, y: 0 } : orbitOffset(body, t, width, height);
  return {
    x: clamp(home.hx * width + offset.x, hw, width - hw),
    y: clamp(home.hy * height + offset.y, hh, height - hh),
  };
}

/** A body at rest on its drift path at time `t`, home at its anchor. */
export function initialState(body: GlassBody, t: number, width: number, height: number, reduced: boolean): GlassState {
  const home = { hx: body.ax, hy: body.ay };
  const { x, y } = driftTarget(body, home, t, width, height, reduced);
  return { x, y, vx: 0, vy: 0, ...home, mode: "drift", impact: 0, impactAt: -Infinity, impactAxis: "x" };
}

/** Exponential friction on one velocity component: frame-rate independent. */
export function applyFriction(velocity: number, dt: number): number {
  return velocity * Math.exp(-FRICTION * dt);
}

/**
 * The viewport edges are hard walls for a body's edges: clamp inside, reflect the normal velocity with restitution,
 * and record a hit fast enough to ping. Returns the same object when nothing touched a wall.
 */
export function collideWalls(
  state: GlassState,
  hw: number,
  hh: number,
  width: number,
  height: number,
  t: number,
): GlassState {
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
  if (x < hw) [x, vx] = [hw, bounce(vx, vx < 0, "x")];
  else if (x > width - hw) [x, vx] = [width - hw, bounce(vx, vx > 0, "x")];
  if (y < hh) [y, vy] = [hh, bounce(vy, vy < 0, "y")];
  else if (y > height - hh) [y, vy] = [height - hh, bounce(vy, vy > 0, "y")];
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
  const { t, width, height, reduced } = input;
  const { hw, hh } = glassHalfSize(body, width, height);
  if (state.mode === "held") {
    // the pointer places it; only a resize can move it, back inside the walls
    const x = clamp(state.x, hw, width - hw);
    const y = clamp(state.y, hh, height - hh);
    return x === state.x && y === state.y ? state : { ...state, x, y };
  }
  let next = state;
  let remaining = clamp(input.dt, 0, MAX_DT);
  const stiffness = DRIFT_OMEGA * DRIFT_OMEGA;
  const damping = 2 * DRIFT_OMEGA;
  while (remaining > 1e-9) {
    const h = Math.min(SUBSTEP, remaining);
    remaining -= h;
    let { vx, vy } = next;
    if (next.mode === "thrown") {
      vx = applyFriction(vx, h);
      vy = applyFriction(vy, h);
    } else {
      const target = driftTarget(body, next, t, width, height, reduced);
      vx += (stiffness * (target.x - next.x) - damping * vx) * h;
      vy += (stiffness * (target.y - next.y) - damping * vy) * h;
    }
    next = collideWalls({ ...next, x: next.x + vx * h, y: next.y + vy * h, vx, vy }, hw, hh, width, height, t);
    if (next.mode === "thrown" && Math.hypot(next.vx, next.vy) < REST_SPEED) {
      const offset = reduced ? { x: 0, y: 0 } : orbitOffset(body, t, width, height);
      next = { ...next, mode: "drift", hx: (next.x - offset.x) / width, hy: (next.y - offset.y) / height };
    }
  }
  return collideWalls(next, hw, hh, width, height, t);
}

/** While held, a body sits exactly where the pointer puts it (minus the grab offset), inside the walls. */
export function dragTo(
  state: GlassState,
  pointer: { x: number; y: number },
  grab: { x: number; y: number },
  hw: number,
  hh: number,
  width: number,
  height: number,
): GlassState {
  return {
    ...state,
    mode: "held",
    x: clamp(pointer.x - grab.x, hw, width - hw),
    y: clamp(pointer.y - grab.y, hh, height - hh),
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

/** The topmost body (last drawn) whose drawn rectangle contains `point`, ignoring tilt; -1 for none. */
export function hitGlass(
  bodies: readonly GlassBody[],
  states: readonly GlassState[],
  point: { x: number; y: number },
  width: number,
  height: number,
): number {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const { hw, hh } = glassHalfSize(bodies[i], width, height);
    if (Math.abs(point.x - states[i].x) <= hw && Math.abs(point.y - states[i].y) <= hh) return i;
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
  const bob = isPlaying ? beatBob(input.beatPhase) : 0;
  const x = state.x;
  const y = state.y + BOB_PX * size * bob;

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
  const rotateZ = SPIN * Math.sin((TAU * t) / (orbit.px * 1.618) + orbit.phase * 2.9);

  // the ping: a flash and a wobbling squash along the axis it hit, scaled by how hard
  const since = t - state.impactAt;
  const ring = state.impact > 0 && since >= 0 ? state.impact * Math.exp(-since / PING_DECAY) : 0;
  const wobble = ring > 0 ? ring * Math.cos(TAU * PING_HZ * since) : 0;
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
