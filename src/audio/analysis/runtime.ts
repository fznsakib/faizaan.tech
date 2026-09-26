import { analyzeTrack, gridConfidence } from "./analyzeTrack.ts";
import { buildBeatMap } from "./buildBeatMap.ts";

import type { BeatMap } from "../types.ts";

/** Beat map for audio decoded at runtime (a 30 s preview), with confidence from how clearly it grooves. */
export function analyseForMap(pcm: Float32Array, sampleRate: number, id: string): BeatMap {
  const analysis = analyzeTrack(pcm, sampleRate);
  return { ...buildBeatMap(id, analysis), confidence: Number(gridConfidence(analysis).toFixed(2)) };
}

/** Average channels into a new mono buffer (never the AudioBuffer's own storage: it gets transferred). */
export function downmix(channels: Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  const mono = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i++) mono[i] += channel[i] / channels.length;
  }
  return mono;
}
