/**
 * The name's hover shatter: one letter bursts into the grid's plusses, away from where the pointer came in, hangs,
 * and snaps back together. Pure poses of the seconds since the burst began (`elapsed`), distances in em.
 *
 * The letter's look through a burst: it cuts to the plate (a blue copy of the glyph perforated with the grid's
 * plusses), the plate breaks into its plusses (the shards), the shards fly out and back, the plate forms again as
 * they land, and it fades back into the white glyph.
 */

/** Shards per letter on desktop, and on phones and touch-first screens. */
export const SHARD_COUNT = { full: 14, lite: 8 } as const;

/** When the shards leave and when they're fully out, s. */
export const FLIGHT_OUT: readonly [number, number] = [0.03, 0.4];
/** When the hang ends and the first shards head home (the rest within `MAX_LAG`), s. */
const HANG_END = 0.56;
/** When they land, s: the plate is whole again, and a new hover may restart the letter. */
export const HOME = 0.86;
/** How long the re-formed plate holds before it fades into the white glyph, and that fade, s. */
const PLATE_HOLD = 0.1;
const PLATE_FADE = 0.2;
/** The whole burst, s. */
export const DURATION = HOME + PLATE_HOLD + PLATE_FADE;

/** The plate breaks up over this, s, as the shards fade in over it. */
const BREAK: readonly [number, number] = [0.05, 0.11];
/** The shards fade in over their first moments, and out over the last moments of their flight home, s. */
const SHARD_IN = 0.04;
const SHARD_OUT = 0.04;
/** The plate forms again just ahead of their landing, s, so the letter is never blank between the two. */
const REFORM: readonly [number, number] = [HOME - 0.06, HOME - 0.02];
/** How far the shards keep drifting through the hang, as a share of their flight. */
const DRIFT = 0.06;
/** Extra flight away from where the pointer came in, em at a full push. */
const PUSH = 0.35;
/** The glyph is hidden from here until `GLYPH_BACK`, both moments under a fully opaque plate, s. */
const GLYPH_OUT = 0.03;
const GLYPH_BACK = HOME + PLATE_HOLD / 2;

/** Reduced motion: no burst, just the plate fading in and out over the glyph, s. */
const REDUCED_IN = 0.15;
const REDUCED_HOLD = 0.2;
const REDUCED_OUT = 0.25;
export const REDUCED_DURATION = REDUCED_IN + REDUCED_HOLD + REDUCED_OUT;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;
const easeIn = (x: number) => clamp01(x) ** 3;

/** A small seeded PRNG (mulberry32), 0..1: every letter's shards are the same each load. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Shard {
  /** Home across and down the letter box, 0..1. */
  x: number;
  y: number;
  /** Flight out from home, em. */
  dx: number;
  dy: number;
  /** Turn at full flight, degrees. */
  spin: number;
  /** Arm span, em. */
  size: number;
  /** The grid's mini-plus blue, or its big-plus grey. */
  blue: boolean;
  /** Share of the flight out it takes to get there, 0.75..1: the burst isn't one rigid ring. */
  pace: number;
  /** How much later than the first it heads home, s: they land in a quick patter, not all at once. */
  lag: number;
}

/** Most a shard heads home late, s. */
const MAX_LAG = 0.06;

export interface ShardPose {
  /** Offset from home, em. */
  x: number;
  y: number;
  rotate: number;
  scale: number;
  opacity: number;
}

/** Which way the burst blows, and how hard: a vector of length 0..1 in screen axes (y down). */
export interface Push {
  x: number;
  y: number;
}

/** A letter's shards, spread round the glyph (jittered evenly, so the burst is balanced and the push shows). */
export function shardsFor(seed: number, count: number): Shard[] {
  const random = mulberry32(seed);
  const turn = random();
  return Array.from({ length: count }, (_, i) => {
    const angle = 2 * Math.PI * ((i + turn + (random() - 0.5) * 0.5) / count);
    // Square root: even over the glyph's area, not bunched at its centre.
    const reach = Math.sqrt(0.15 + 0.85 * random());
    // Some stay close, some fly far: a cloud, not a ring.
    const distance = 0.15 + 0.5 * random();
    return {
      x: 0.5 + 0.3 * reach * Math.cos(angle),
      y: 0.55 + 0.25 * reach * Math.sin(angle),
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      spin: (random() < 0.5 ? -1 : 1) * (90 + 180 * random()),
      size: 0.13 + 0.07 * random(),
      blue: i % 5 !== 2 && i % 5 !== 4, // three blue to two grey
      pace: 0.75 + 0.25 * random(),
      lag: MAX_LAG * random(),
    };
  });
}

/** How far out a shard is: burst out, drift a little through the hang, snap home (all land at `HOME`). */
function flight(shard: Shard, elapsed: number): number {
  const leave = FLIGHT_OUT[0];
  const out = leave + (FLIGHT_OUT[1] - leave) * shard.pace;
  const back = HANG_END + shard.lag;
  if (elapsed < leave || elapsed >= HOME) return 0;
  if (elapsed < out) return easeOut((elapsed - leave) / (out - leave));
  if (elapsed < back) return 1 + (DRIFT * (elapsed - out)) / (back - out);
  return (1 + DRIFT) * (1 - easeIn((elapsed - back) / (HOME - back)));
}

/** A shard's offset from home (em), turn, scale and opacity, `elapsed` s into the burst; written into `out`. */
export function shardPose(
  shard: Shard,
  elapsed: number,
  push: Push,
  out: ShardPose = { x: 0, y: 0, rotate: 0, scale: 0, opacity: 0 }
): ShardPose {
  const f = flight(shard, elapsed);
  if (f === 0) {
    out.x = 0;
    out.y = 0;
    out.rotate = 0;
  } else {
    out.x = (shard.dx + push.x * PUSH) * f;
    out.y = (shard.dy + push.y * PUSH) * f;
    out.rotate = shard.spin * f;
  }
  out.scale = 0.6 + 0.4 * Math.min(1, f);
  out.opacity =
    elapsed < 0 || elapsed >= HOME ? 0 : smoothstep(elapsed / SHARD_IN) * (1 - smoothstep((elapsed - (HOME - SHARD_OUT)) / SHARD_OUT));
  return out;
}

/** The plate's opacity: cut in at once, broken up as the shards leave, formed again as they land, faded out. */
export function plateOpacity(elapsed: number): number {
  if (elapsed < 0 || elapsed >= DURATION) return 0;
  if (elapsed < REFORM[0]) return 1 - smoothstep((elapsed - BREAK[0]) / (BREAK[1] - BREAK[0]));
  if (elapsed < HOME) return smoothstep((elapsed - REFORM[0]) / (REFORM[1] - REFORM[0]));
  return 1 - smoothstep((elapsed - HOME - PLATE_HOLD) / PLATE_FADE);
}

/** Whether the white glyph shows: hidden only while the shards are out (it swaps under an opaque plate). */
export const glyphShown = (elapsed: number): boolean => elapsed < GLYPH_OUT || elapsed >= GLYPH_BACK;

/** Reduced motion: the plate fades in over the glyph, holds, and fades away; nothing moves. */
export function reducedPlate(elapsed: number): number {
  if (elapsed <= 0 || elapsed >= REDUCED_DURATION) return 0;
  return smoothstep(elapsed / REDUCED_IN) * (1 - smoothstep((elapsed - REDUCED_IN - REDUCED_HOLD) / REDUCED_OUT));
}

/**
 * Which way to blow a letter entered at (x, y): from the entry point through the letter's centre, full where the
 * pointer crosses its edge and none at its centre (a tap in the middle bursts evenly), never longer than 1.
 */
export function pushFrom(x: number, y: number, box: { left: number; right: number; top: number; bottom: number }): Push {
  const halfWidth = Math.max(1e-6, (box.right - box.left) / 2);
  const halfHeight = Math.max(1e-6, (box.bottom - box.top) / 2);
  let u = ((box.left + box.right) / 2 - x) / halfWidth;
  let v = ((box.top + box.bottom) / 2 - y) / halfHeight;
  const length = Math.hypot(u, v);
  if (length > 1) {
    u /= length;
    v /= length;
  }
  // `+ 0` turns a -0 into 0.
  return { x: u + 0, y: v + 0 };
}

/** One letter's burst; `start` is null until its first. */
export interface Burst {
  start: number | null;
  push: Push;
  /** Started under reduced motion: a plate fade, not a burst. */
  reduced: boolean;
}

export const createBurst = (): Burst => ({ start: null, push: { x: 0, y: 0 }, reduced: false });

/** Seconds into the letter's burst at `now`, or null when it isn't bursting. */
export function burstAt(burst: Burst, now: number): number | null {
  if (burst.start === null) return null;
  const elapsed = Math.max(0, now - burst.start);
  return elapsed < (burst.reduced ? REDUCED_DURATION : DURATION) ? elapsed : null;
}

/**
 * The pointer came into the letter: burst it, unless it's still bursting. A letter may start again once its shards
 * have landed (`HOME`), from its re-formed plate, so sweeping back over a letter that's only fading still answers.
 */
export function startBurst(burst: Burst, now: number, push: Push, reduced: boolean): boolean {
  const elapsed = burstAt(burst, now);
  if (elapsed !== null && elapsed < (burst.reduced ? REDUCED_DURATION : HOME)) return false;
  burst.start = now;
  burst.push = push;
  burst.reduced = reduced;
  return true;
}
