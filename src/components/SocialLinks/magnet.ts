/** Pointer distance (px from an icon's centre) beyond which the icon ignores it. */
export const MAGNET_RADIUS = 48;
/** Furthest an icon leans toward the pointer, px. */
export const MAX_LEAN = 5;
/** Lean per px of pointer offset, before the clamp. */
const GAIN = 0.3;
/** Fraction of the radius inside which the pull is at full strength. */
const INNER = 0.4;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * How far an icon leans toward a pointer at (dx, dy) from its centre: grows with the offset up to MAX_LEAN, then
 * fades smoothly to nothing at MAGNET_RADIUS, so the icon under the pointer follows it and its neighbours barely stir.
 */
export function magnetLean(dx: number, dy: number, radius = MAGNET_RADIUS, max = MAX_LEAN): { x: number; y: number } {
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance >= radius) return { x: 0, y: 0 };
  const magnitude = Math.min(max, distance * GAIN) * (1 - smoothstep(radius * INNER, radius, distance));
  return { x: (dx / distance) * magnitude, y: (dy / distance) * magnitude };
}

/** Exponential ease of `current` toward `target` over `dt` seconds at `rate` (1/s): frame-rate independent. */
export function approach(current: number, target: number, dt: number, rate: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
