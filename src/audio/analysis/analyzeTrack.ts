import { createFFT } from "./fft.ts";

export const WINDOW_SIZE = 2048;

const BAND_RANGES = {
  kick: [30, 150],
  snare: [150, 4000],
  hat: [6000, 16000],
  full: [30, 16000],
} as const;

export type AnalysisBand = keyof typeof BAND_RANGES;

export interface Analysis {
  sampleRate: number;
  duration: number;
  /** STFT frames per second (≈100). */
  onsetFps: number;
  /** Seconds from a frame's start to its centre (WINDOW_SIZE / 2 / sampleRate). */
  frameOffset: number;
  bpm: number;
  /** First grid beat in seconds, frame-start time base (before beat0Shift). */
  phase: number;
  downbeatMod: number;
  /** Mean log-magnitude over the full band, per frame. */
  loudness: Float32Array;
  /** Detrended, rectified spectral flux per band, per frame. */
  env: Record<AnalysisBand, Float32Array>;
}

interface Grid {
  bpm: number;
  phase: number;
  score: number;
}

const BANDS = Object.keys(BAND_RANGES) as AnalysisBand[];

/** Offline beat analysis: band spectral flux → ACF tempo → grid fit → downbeat vote. */
export function analyzeTrack(pcm: Float32Array, sampleRate: number): Analysis {
  const hop = Math.round(sampleRate / 100);
  const fps = sampleRate / hop;
  const duration = pcm.length / sampleRate;
  const { flux, loudness } = spectralFlux(pcm, sampleRate, hop);
  const env: Record<AnalysisBand, Float32Array> = {
    kick: detrend(flux.kick, 50),
    snare: detrend(flux.snare, 50),
    hat: detrend(flux.hat, 50),
    full: detrend(flux.full, 50),
  };
  const onset = new Float32Array(env.full.length);
  for (let i = 0; i < onset.length; i++) {
    onset[i] = env.full[i] + env.kick[i] + 0.5 * env.snare[i];
  }
  const grid = fitGrid(onset, fps, duration, estimateTempo(onset, fps));
  return {
    sampleRate,
    duration,
    onsetFps: fps,
    frameOffset: WINDOW_SIZE / 2 / sampleRate,
    bpm: grid.bpm,
    phase: grid.phase,
    downbeatMod: estimateDownbeat(env, fps, duration, grid),
    loudness,
    env,
  };
}

function spectralFlux(pcm: Float32Array, sampleRate: number, hop: number) {
  const n = WINDOW_SIZE;
  const half = n / 2;
  const frames = Math.max(0, Math.floor((pcm.length - n) / hop));
  const fft = createFFT(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const window = new Float32Array(n);
  for (let i = 0; i < n; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  const binHz = sampleRate / n;
  const ranges = BANDS.map((band) => [
    Math.ceil(BAND_RANGES[band][0] / binHz),
    Math.min(half - 1, Math.floor(BAND_RANGES[band][1] / binHz)),
  ]);
  const flux: Record<AnalysisBand, Float32Array> = {
    kick: new Float32Array(frames),
    snare: new Float32Array(frames),
    hat: new Float32Array(frames),
    full: new Float32Array(frames),
  };
  const loudness = new Float32Array(frames);
  let previous = new Float32Array(half);
  let current = new Float32Array(half);

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < n; i++) {
      re[i] = pcm[start + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < half; k++) {
      current[k] = Math.log1p(100 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
    }
    for (let b = 0; b < BANDS.length; b++) {
      const [lo, hi] = ranges[b];
      let rise = 0;
      let sum = 0;
      for (let k = lo; k <= hi; k++) {
        const d = current[k] - previous[k];
        if (d > 0) rise += d;
        sum += current[k];
      }
      flux[BANDS[b]][f] = rise / (hi - lo + 1);
      if (BANDS[b] === "full") loudness[f] = sum / (hi - lo + 1);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return { flux, loudness };
}

/** Subtract a trailing moving average of `width` frames and rectify. */
function detrend(values: Float32Array, width: number): Float32Array {
  const out = new Float32Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= width) sum -= values[i - width];
    out[i] = Math.max(0, values[i] - sum / Math.min(i + 1, width));
  }
  return out;
}

/** Autocorrelation tempo over 60–200 BPM (0.5 steps) with a log-Gaussian prior at 120 BPM. */
function estimateTempo(onset: Float32Array, fps: number): number {
  let best = 120;
  let bestScore = -Infinity;
  for (let bpm = 60; bpm <= 200; bpm += 0.5) {
    const lag = (60 * fps) / bpm;
    const whole = Math.floor(lag);
    const frac = lag - whole;
    let sum = 0;
    for (let i = 0; i + whole + 1 < onset.length; i++) {
      sum += onset[i] * (onset[i + whole] * (1 - frac) + onset[i + whole + 1] * frac);
    }
    const score = sum * Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  return best;
}

/** Mean onset strength (±1 frame) at grid lines phase + k·period within [from, to). */
function gridScore(
  onset: Float32Array,
  fps: number,
  bpm: number,
  phase: number,
  from: number,
  to: number
): number {
  const period = 60 / bpm;
  let sum = 0;
  let count = 0;
  for (let t = phase + Math.ceil((from - phase) / period) * period; t < to; t += period) {
    const i = Math.floor(t * fps);
    if (i < 1 || i + 2 >= onset.length) continue;
    sum += Math.max(onset[i - 1], onset[i], onset[i + 1]);
    count++;
  }
  return count ? sum / count : 0;
}

/**
 * Search ±2 BPM around the ACF estimate (0.01 steps) × phase (2 ms steps), then refine phase to 0.5 ms.
 * BPMs that tie on score (a plateau: short or very regular audio) resolve to the plateau's median, not its edge.
 */
function fitGrid(onset: Float32Array, fps: number, duration: number, center: number): Grid {
  let ties: Grid[] = [{ bpm: center, phase: 0, score: -1 }];
  for (let step = -200; step <= 200; step++) {
    const bpm = center + step * 0.01;
    const period = 60 / bpm;
    let bpmBest: Grid = { bpm, phase: 0, score: -1 };
    for (let phase = 0; phase < period; phase += 0.002) {
      const score = gridScore(onset, fps, bpm, phase, 0, duration);
      if (score > bpmBest.score) bpmBest = { bpm, phase, score };
    }
    if (bpmBest.score > ties[0].score) ties = [bpmBest];
    else if (bpmBest.score === ties[0].score) ties.push(bpmBest);
  }
  let best = ties[Math.floor(ties.length / 2)];
  const period = 60 / best.bpm;
  for (let phase = best.phase - 0.004; phase <= best.phase + 0.004; phase += 0.0005) {
    const wrapped = ((phase % period) + period) % period;
    const score = gridScore(onset, fps, best.bpm, wrapped, 0, duration);
    if (score > best.score) best = { ...best, phase: wrapped, score };
  }
  return best;
}

/** Vote for the beat-in-bar where the biggest 8-beat texture changes land (section changes fall on downbeats). */
function estimateDownbeat(
  env: Record<AnalysisBand, Float32Array>,
  fps: number,
  duration: number,
  grid: Grid
): number {
  const period = 60 / grid.bpm;
  const perBeat: number[] = [];
  for (let k = 0; grid.phase + (k + 1) * period < duration; k++) {
    const a = Math.round((grid.phase + k * period) * fps);
    const b = Math.round((grid.phase + (k + 1) * period) * fps);
    let sum = 0;
    for (let i = a; i < b && i < env.kick.length; i++) {
      sum += env.kick[i] + env.snare[i] + env.hat[i];
    }
    perBeat.push(sum / Math.max(1, b - a));
  }
  const width = 8;
  const novelty = perBeat.map((_, k) => {
    if (k < width || k + width > perBeat.length) return 0;
    let before = 0;
    let after = 0;
    for (let j = 1; j <= width; j++) {
      before += perBeat[k - j];
      after += perBeat[k + j - 1];
    }
    return Math.abs(after - before) / width;
  });
  const candidates = novelty
    .map((v, k) => ({ k, v }))
    .filter(({ k, v }) => v > 0 && v >= Math.max(...novelty.slice(Math.max(0, k - 4), k + 5)))
    .sort((x, y) => y.v - x.v)
    .slice(0, 12);
  const votes = [0, 0, 0, 0];
  for (const { k, v } of candidates) votes[k % 4] += v;
  return votes.indexOf(Math.max(...votes));
}
