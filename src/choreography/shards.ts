import type { MusicFrame } from "../audio/types";

export type Random = () => number;

export interface ShardSpec {
  id: number;
  clipPath: string;
  /** Viewport percent. */
  top: number;
  left: number;
  /** Pixels. */
  width: number;
  height: number;
  scale: number;
  /** Seconds. */
  delay: number;
  duration: number;
  opacity: number;
}

export const IDLE_RECUT_MS = 4000;

const between = (random: Random, lo: number, hi: number) => lo + random() * (hi - lo);
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

function outline(points: number, random: Random): string {
  const corners = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const radius = 40 + random() * 60;
    const x = clamp(50 + radius * Math.cos(angle), 0, 100);
    const y = clamp(50 + radius * Math.sin(angle), 0, 100);
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  });
  return `polygon(${corners.join(", ")})`;
}

/** `count` glass shards with random 3–8 point outlines, placement, size and base opacity. */
export function generateShards(count: number, random: Random = Math.random): ShardSpec[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    clipPath: outline(3 + Math.floor(random() * 6), random),
    top: between(random, 20, 70),
    left: between(random, 10, 80),
    width: between(random, 200, 400),
    height: between(random, 150, 300),
    scale: between(random, 0.2, 1),
    delay: id * 0.2,
    duration: between(random, 8, 14),
    opacity: between(random, 0.5, 1),
  }));
}

/** 3–5 shards normally, 6–8 on a drop. */
export function shardCount(sectionLevel: 0 | 1, random: Random = Math.random): number {
  return (sectionLevel === 1 ? 6 : 3) + Math.floor(random() * 3);
}

/** Re-cut on downbeats: every 2 bars in calm sections, every bar in a drop; once after any jump. */
export function recutDue(
  frame: Pick<MusicFrame, "isPlaying" | "isDownbeat" | "barIndex" | "sectionLevel">,
  lastRecutBar: number | null,
  reducedMotion: boolean
): boolean {
  if (!frame.isPlaying || reducedMotion || !frame.isDownbeat) return false;
  if (lastRecutBar === null || frame.barIndex < lastRecutBar) return true;
  return frame.barIndex - lastRecutBar >= (frame.sectionLevel === 1 ? 1 : 2);
}
