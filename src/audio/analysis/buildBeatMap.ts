import type { BeatMap, OnsetBand } from "../types.ts";
import type { Analysis } from "./analyzeTrack.ts";

export interface BeatMapOverrides {
  beat0Shift?: number;
  downbeatMod?: number;
  bpm?: number;
}

/** Measured median offset from the STFT-frame grid to the kick transient. */
export const DEFAULT_BEAT0_SHIFT = 0.013;
export const CURVE_FPS = 10;

const BEATS_PER_BAR = 4;
const SECTION_UP = 0.6;
const SECTION_DOWN = 0.45;

interface PeakOptions {
  k: number;
  floor: number;
  minGap: number;
}

const PEAKS: Record<OnsetBand, PeakOptions> = {
  kick: { k: 4, floor: 0.3, minGap: 0.2 },
  snare: { k: 3, floor: 0.08, minGap: 0.09 },
  hat: { k: 2.5, floor: 0.08, minGap: 0.06 },
};

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function percentile(values: ArrayLike<number>, q: number): number {
  if (values.length === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.floor(q * (sorted.length - 1))];
}

/** Turn an analysis into the committed runtime beat map. */
export function buildBeatMap(
  id: string,
  analysis: Analysis,
  overrides: BeatMapOverrides = {}
): BeatMap {
  const bpm = overrides.bpm ?? analysis.bpm;
  const beat0 = analysis.phase + (overrides.beat0Shift ?? DEFAULT_BEAT0_SHIFT);
  const downbeatMod = overrides.downbeatMod ?? analysis.downbeatMod;
  const energy = energyCurve(analysis.loudness, Math.max(1, Math.round(analysis.onsetFps / CURVE_FPS)));
  const section = sectionCurve(energy, bpm);
  return {
    id,
    version: 1,
    duration: round(analysis.duration, 3),
    bpm: round(bpm, 3),
    beat0: round(beat0, 4),
    beatsPerBar: BEATS_PER_BAR,
    downbeatMod,
    confidence: 1,
    curveFps: CURVE_FPS,
    energy: energy.map((v) => Math.round(v * 255)),
    section: section.map((v) => Math.round(v * 255)),
    barLevels: barLevels(section, bpm, beat0, downbeatMod, analysis.duration),
    onsets: {
      kick: pickOnsets(analysis.env.kick, analysis, PEAKS.kick),
      snare: pickOnsets(analysis.env.snare, analysis, PEAKS.snare),
      hat: pickOnsets(analysis.env.hat, analysis, PEAKS.hat),
    },
  };
}

/** Mean loudness per `factor` frames, normalised so p2 → 0 and p98 → 1 (clamped). */
function energyCurve(loudness: Float32Array, factor: number): number[] {
  const lo = percentile(loudness, 0.02);
  const span = percentile(loudness, 0.98) - lo || 1;
  const out: number[] = [];
  for (let i = 0; i < loudness.length; i += factor) {
    let sum = 0;
    let n = 0;
    for (let j = i; j < i + factor && j < loudness.length; j++) {
      sum += loudness[j];
      n++;
    }
    out.push(clamp01((sum / n - lo) / span));
  }
  return out;
}

/** Four-bar centred moving average of energy, renormalised so p5 → 0 and p95 → 1 (span floor 0.1). */
function sectionCurve(energy: number[], bpm: number): number[] {
  const width = Math.max(1, Math.round(4 * BEATS_PER_BAR * (60 / bpm) * CURVE_FPS));
  const smooth = energy.map((_, i) => {
    let sum = 0;
    let n = 0;
    const end = Math.min(energy.length, i + Math.ceil(width / 2));
    for (let j = Math.max(0, i - Math.floor(width / 2)); j < end; j++) {
      sum += energy[j];
      n++;
    }
    return n ? sum / n : 0;
  });
  const lo = percentile(smooth, 0.05);
  const span = Math.max(percentile(smooth, 0.95) - lo, 0.1);
  return smooth.map((v) => clamp01((v - lo) / span));
}

/** Per-bar level (0 calm, 1 intense) from the bar's mean section value, with hysteresis. */
function barLevels(
  section: number[],
  bpm: number,
  beat0: number,
  downbeatMod: number,
  duration: number
): number[] {
  const barSeconds = (BEATS_PER_BAR * 60) / bpm;
  const firstBar = beat0 + downbeatMod * (60 / bpm);
  const levels: number[] = [];
  let level = 0;
  for (let bar = 0; firstBar + bar * barSeconds < duration; bar++) {
    const start = firstBar + bar * barSeconds;
    const a = Math.max(0, Math.floor(start * CURVE_FPS));
    const b = Math.min(section.length, Math.max(a + 1, Math.floor((start + barSeconds) * CURVE_FPS)));
    let sum = 0;
    for (let i = a; i < b; i++) sum += section[i];
    const mean = b > a ? sum / (b - a) : 0;
    if (level === 0 && mean > SECTION_UP) level = 1;
    else if (level === 1 && mean < SECTION_DOWN) level = 0;
    levels.push(level);
  }
  return levels;
}

/** Peak-pick an onset envelope with a moving median + k·MAD threshold. Returns flat [t, strength, …]. */
function pickOnsets(env: Float32Array, analysis: Analysis, options: PeakOptions): number[] {
  const window = 100;
  const norm = percentile(env.filter((v) => v > 0), 0.98) || 1;
  const out: number[] = [];
  let last = -Infinity;
  for (let i = 1; i < env.length - 1; i++) {
    if (!(env[i] > env[i - 1] && env[i] >= env[i + 1])) continue;
    if (env[i] < options.floor * norm) continue;
    const local = env.subarray(Math.max(0, i - window / 2), Math.min(env.length, i + window / 2));
    const median = percentile(local, 0.5);
    const mad = percentile(Array.from(local, (v) => Math.abs(v - median)), 0.5);
    if (env[i] < median + options.k * mad) continue;
    const t = i / analysis.onsetFps + analysis.frameOffset;
    if (t - last < options.minGap) continue;
    last = t;
    out.push(round(t, 3), round(Math.min(1, env[i] / norm), 2));
  }
  return out;
}
