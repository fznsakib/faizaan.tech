/** Seconds a peak cap hangs at its height before it starts to fall. */
export const PEAK_HOLD = 0.25;
/** Levels per second a peak cap falls. */
export const PEAK_FALL = 1.2;
/** Levels per second a bar sinks when the sound drops (it rises at once). */
export const BAR_FALL = 2.8;

/**
 * Winamp-style peak caps: a cap jumps up to a louder bar at once, hangs for PEAK_HOLD, then falls at PEAK_FALL.
 * `holds` carries each cap's remaining hang time. Frame-rate independent: the fall starts mid-frame if the hold ends there.
 */
export function stepPeaks(levels: Float32Array, peaks: Float32Array, holds: Float32Array, dt: number): void {
  for (let i = 0; i < peaks.length; i++) {
    if (levels[i] >= peaks[i]) {
      peaks[i] = levels[i];
      holds[i] = PEAK_HOLD;
      continue;
    }
    holds[i] -= dt;
    if (holds[i] < 0) {
      peaks[i] = Math.max(0, levels[i], peaks[i] + PEAK_FALL * holds[i]);
      holds[i] = 0;
    }
  }
}

/** Bars rise to the live level at once and sink at BAR_FALL, so they read as motion rather than flicker. */
export function stepBars(levels: Float32Array, shown: Float32Array, dt: number): void {
  for (let i = 0; i < shown.length; i++) {
    shown[i] = Math.max(levels[i], shown[i] - BAR_FALL * dt, 0);
  }
}
