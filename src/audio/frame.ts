import type { BeatMap, MusicFrame, OnsetBand } from "./types";

/** Onset envelope decay time constants, seconds. */
export const ONSET_DECAY: Record<OnsetBand, number> = {
  kick: 0.18,
  snare: 0.14,
  hat: 0.07,
};

export const BAND_COUNT = 6;

const ONSET_BANDS: OnsetBand[] = ["kick", "snare", "hat"];

/** Scan state for one playback run. Reset it on play, seek and track switch. */
export interface FrameCursors {
  kick: number;
  snare: number;
  hat: number;
  lastBeat: number | null;
}

export function createCursors(): FrameCursors {
  return { kick: 0, snare: 0, hat: 0, lastBeat: null };
}

export function createFrame(): MusicFrame {
  return {
    time: 0,
    isPlaying: false,
    bpm: 0,
    beat: 0,
    beatIndex: 0,
    beatPhase: 0,
    barIndex: 0,
    barPhase: 0,
    beatCrossed: false,
    isDownbeat: false,
    timeToNextBeat: 0,
    kick: 0,
    snare: 0,
    hat: 0,
    energy: 0,
    section: 0,
    sectionLevel: 0,
    sectionChanged: false,
    bands: new Float32Array(BAND_COUNT),
    stab: 0,
    stabHit: false,
    jamming: false,
    beatConfidence: 0,
  };
}

/** Zero every musical field (no beat map); keeps `time`, `isPlaying` and `bands`. */
export function clearFrame(
  frame: MusicFrame,
  time: number,
  isPlaying: boolean
): MusicFrame {
  frame.time = time;
  frame.isPlaying = isPlaying;
  frame.bpm = 0;
  frame.beat = 0;
  frame.beatIndex = 0;
  frame.beatPhase = 0;
  frame.barIndex = 0;
  frame.barPhase = 0;
  frame.beatCrossed = false;
  frame.isDownbeat = false;
  frame.timeToNextBeat = 0;
  frame.kick = 0;
  frame.snare = 0;
  frame.hat = 0;
  frame.energy = 0;
  frame.section = 0;
  frame.sectionLevel = 0;
  frame.sectionChanged = false;
  frame.beatConfidence = 0;
  return frame;
}

/** Interpolate a 0..255 curve sampled at `fps` to a 0..1 value at time `t`. */
export function sampleCurve(curve: number[], fps: number, t: number): number {
  if (curve.length === 0) return 0;
  const x = Math.max(0, t * fps);
  const i = Math.floor(x);
  const a = curve[Math.min(i, curve.length - 1)];
  const b = curve[Math.min(i + 1, curve.length - 1)];
  return (a + (b - a) * (x - i)) / 255;
}

/** Envelope for flat [t, strength, …] events: instant attack, exponential decay. Advances `cursors[band]`. */
export function onsetEnvelope(
  events: number[],
  t: number,
  cursors: FrameCursors,
  band: OnsetBand
): number {
  let c = cursors[band];
  if (c > 0 && events[c - 2] > t) c = 0; // time went backwards (seek)
  while (c < events.length && events[c] <= t) c += 2;
  cursors[band] = c;
  if (c === 0) return 0;
  return events[c - 1] * Math.exp(-(t - events[c - 2]) / ONSET_DECAY[band]);
}

const mod = (value: number, n: number) => ((value % n) + n) % n;

function levelAt(map: BeatMap, bar: number): 0 | 1 {
  if (bar < 0 || map.barLevels.length === 0) return 0;
  return map.barLevels[Math.min(bar, map.barLevels.length - 1)] === 1 ? 1 : 0;
}

/** Write every beat-map-derived field for song time `t` (everything except `bands`). */
export function writeFrame(
  frame: MusicFrame,
  map: BeatMap,
  t: number,
  playing: boolean,
  cursors: FrameCursors
): MusicFrame {
  const period = 60 / map.bpm;
  const beat = (t - map.beat0) / period;
  const beatIndex = Math.floor(beat);
  const relative = beatIndex - map.downbeatMod;
  const barIndex = Math.floor(relative / map.beatsPerBar);

  frame.time = t;
  frame.isPlaying = playing;
  frame.bpm = map.bpm;
  frame.beat = beat;
  frame.beatIndex = beatIndex;
  frame.beatPhase = beat - beatIndex;
  frame.barIndex = barIndex;
  frame.barPhase =
    (beat - map.downbeatMod - barIndex * map.beatsPerBar) / map.beatsPerBar;
  frame.timeToNextBeat = (1 - frame.beatPhase) * period;

  const crossed =
    playing &&
    cursors.lastBeat !== null &&
    beatIndex > cursors.lastBeat &&
    beatIndex >= 0;
  cursors.lastBeat = beatIndex;
  frame.beatCrossed = crossed;
  frame.isDownbeat = crossed && mod(relative, map.beatsPerBar) === 0;

  frame.energy = sampleCurve(map.energy, map.curveFps, t);
  frame.section = sampleCurve(map.section, map.curveFps, t);
  frame.sectionLevel = levelAt(map, barIndex);
  frame.sectionChanged =
    frame.isDownbeat && frame.sectionLevel !== levelAt(map, barIndex - 1);

  for (const band of ONSET_BANDS) {
    frame[band] = playing ? onsetEnvelope(map.onsets[band], t, cursors, band) : 0;
  }
  frame.beatConfidence = playing ? map.confidence : 0;
  return frame;
}
