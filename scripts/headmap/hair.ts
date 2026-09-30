import { smoothstep } from "./falloff.ts";

import type { Vec3 } from "./ray.ts";

/*
 * Where the skin head grows hair beyond what the photo shows: a hairline running from the forehead, down over the
 * ears, to the nape, with the ears themselves left bare.
 */

export interface Scalp {
  /** A point on the head's vertical axis (face frame: y up, face toward +z). */
  centre: Vec3;
  /** Hairline heights straight ahead, over the ears and at the nape. */
  front: number;
  side: number;
  back: number;
  /** Half-width of the feathered edge. */
  band: number;
  /** Spheres kept bare: skin inside `radius`, feathering out to 1.25 × it. */
  ears: { centre: Vec3; radius: number }[];
}

/** The hairline's height in the direction (dx, dz) from the axis: front → side over a quarter turn, side → nape over the next. */
export function hairlineHeight(scalp: Scalp, dx: number, dz: number) {
  const t = Math.atan2(Math.abs(dx), dz); // 0 ahead, π/2 at the ears, π behind
  const ease = (a: number) => (1 - Math.cos(2 * a)) / 2;
  return t <= Math.PI / 2
    ? scalp.front + (scalp.side - scalp.front) * ease(t)
    : scalp.side + (scalp.back - scalp.side) * ease(t - Math.PI / 2);
}

/** 1 where the scalp grows hair, 0 on skin (face, neck, ears), feathered in between. */
export function scalpPrior(scalp: Scalp, [x, y, z]: Vec3) {
  const h = hairlineHeight(scalp, x - scalp.centre[0], z - scalp.centre[2]);
  let hair = smoothstep(h - scalp.band, h + scalp.band, y);
  for (const ear of scalp.ears) {
    const d = Math.hypot(x - ear.centre[0], y - ear.centre[1], z - ear.centre[2]);
    hair *= smoothstep(ear.radius, 1.25 * ear.radius, d);
  }
  return hair;
}
