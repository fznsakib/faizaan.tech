import type { MusicEngine } from "./MusicEngine";
import type { MusicFrame } from "./types";

export type FrameListener = (frame: MusicFrame, nowMs: number) => void;

const listeners = new Set<FrameListener>();
const SAMPLE_FRAMES = 30;
let running = false;

/** Median frame interval in seconds, clamped to 30–240 Hz displays. */
export function estimateVisualLead(deltasMs: number[]): number {
  const sorted = [...deltasMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1000 / 60;
  return Math.min(1 / 30, Math.max(1 / 240, median / 1000));
}

/**
 * Start the single rAF loop that owns `engine.update`. Call once, before React renders,
 * so this callback runs before r3f's loop every frame and `engine.frame` is fresh for `useFrame`.
 */
export function startMusicTicker(engine: MusicEngine): void {
  if (running) return;
  running = true;
  const deltas: number[] = [];
  let last = 0;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (last > 0) {
      deltas.push(now - last);
      if (deltas.length === SAMPLE_FRAMES) {
        engine.visualLead = estimateVisualLead(deltas);
        deltas.length = 0;
      }
    }
    last = now;
    const frame = engine.update(now);
    listeners.forEach((listener) => listener(frame, now));
  };
  requestAnimationFrame(tick);
}

/** Subscribe to every animation frame (after `engine.update`). Returns an unsubscribe function. */
export function onMusicFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
