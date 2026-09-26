import { SHOCKWAVE_SPEED } from "../../choreography/type";

/** Scale added by a full kick. */
export const PULSE = 0.045;
/** Dot opacity between kicks; a kick lifts it to 1. */
export const REST_GLOW = 0.85;
/** Touch: dot opacity flashed over the resolved glyph by a full kick. */
export const SHIMMER = 0.8;
/** Touch: how far a full kick dims the resolved glyph under its shimmer. */
export const SOLID_DIP = 0.4;
/** Touch: seconds between neighbouring icons, so each kick's shimmer ripples left to right. */
export const SHIMMER_STAGGER = 0.06;

export interface PoseInput {
  /** Kick envelope as it reaches this icon, 0..1. */
  kick: number;
  leanX: number;
  leanY: number;
  touch: boolean;
  reduced: boolean;
}

/** Per-frame inline styles for one icon: its leaning/pulsing wrapper's transform and its two layers' opacity. */
export interface Pose {
  transform: string;
  /** Opacity of the dot-matrix layer. */
  rest: string;
  /** Opacity of the resolved glyph layer. */
  solid: string;
}

/** Fixed decimals with trailing zeros (and -0) dropped, so float noise around a value writes the same string. */
const num = (value: number, digits: number): string => String(Number(value.toFixed(digits)) || 0);

export function iconPose({ kick, leanX, leanY, touch, reduced }: PoseInput): Pose {
  if (reduced) return { transform: "none", rest: touch ? "0" : String(REST_GLOW), solid: "1" };
  const x = touch ? 0 : leanX;
  const y = touch ? 0 : leanY;
  const transform = `translate(${num(x, 2)}px, ${num(y, 2)}px) scale(${num(1 + PULSE * kick, 3)})`;
  if (touch) return { transform, rest: num(SHIMMER * kick, 2), solid: num(1 - SOLID_DIP * kick, 2) };
  return { transform, rest: num(REST_GLOW + (1 - REST_GLOW) * kick, 2), solid: "1" };
}

/** Seconds for a kick to reach an icon `distance` px from the head; on touch, plus a left-to-right ripple. */
export function kickDelay(distance: number, index: number, touch: boolean): number {
  return distance / SHOCKWAVE_SPEED + (touch ? index * SHIMMER_STAGGER : 0);
}
