/** Hermite smoothstep: 0 at `edge0`, 1 at `edge1`, zero slope at both, clamped outside. */
export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface WeightParams {
  /** Distance inside the crop boundary over which the weight rises from 0 to 1. */
  margin: number;
  /** Hit distance at which the weight reaches 0; it starts falling at half of this. */
  tolerance: number;
}

/**
 * How far a head vertex moves toward its hit on the scan (0 = stays, 1 = lands on it).
 * Falls smoothly to 0 at the crop boundary and when the hit is further than the tolerance,
 * so the transferred face never ends in a cliff.
 */
export function transferWeight(boundaryDistance: number, hitDistance: number, { margin, tolerance }: WeightParams) {
  const inside = smoothstep(0, margin, boundaryDistance);
  const near = 1 - smoothstep(tolerance / 2, tolerance, Math.abs(hitDistance));
  return inside * near;
}
