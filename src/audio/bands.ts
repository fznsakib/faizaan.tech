/** Below this a band is silent (the analyser reports −Infinity for true silence). */
export const SILENCE_DB = -100;

/**
 * Seconds and dB. The peak attacks instantly and releases slowly; the floor follows dips fast and rises slowly.
 * `maxSpan` caps how far the floor can lag the peak, so a quiet-to-loud jump doesn't compress the first couple
 * of seconds into the top of the range while the floor's slow rise catches up.
 */
export const BAND_RANGE = { peakRelease: 2, floorRise: 4, floorFall: 0.25, minSpan: 12, maxSpan: 24 };

/**
 * Per-band automatic range, in dB: a peak follower and a floor follower define where this band has been living
 * lately, so a loud passage still spans 0..1 instead of clipping at a fixed ceiling. Time-based (dt in seconds).
 */
export class BandNormaliser {
  private peak = -Infinity;
  private floor = -Infinity;

  constructor(private readonly range = BAND_RANGE) {}

  update(db: number, dt: number): number {
    if (!Number.isFinite(db) || db < SILENCE_DB) return 0;
    const { peakRelease, floorRise, floorFall, minSpan, maxSpan } = this.range;
    if (!Number.isFinite(this.peak)) {
      this.peak = db;
      this.floor = db - minSpan;
    }
    this.peak = db > this.peak ? db : this.peak + (db - this.peak) * (1 - Math.exp(-dt / peakRelease));
    this.floor += (db - this.floor) * (1 - Math.exp(-dt / (db < this.floor ? floorFall : floorRise)));
    this.floor = Math.max(this.floor, this.peak - maxSpan);
    const span = Math.max(minSpan, this.peak - this.floor);
    return Math.min(1, Math.max(0, (db - (this.peak - span)) / span));
  }

  reset(): void {
    this.peak = -Infinity;
    this.floor = -Infinity;
  }
}
