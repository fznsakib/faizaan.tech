import { analyseForMap } from "./runtime.ts";

interface AnalyseRequest {
  id: string;
  pcm: Float32Array;
  sampleRate: number;
}

/** Off-main-thread beat analysis for runtime tracks (≈0.5 s of CPU for a 30 s preview). */
self.onmessage = (event: MessageEvent<AnalyseRequest>) => {
  const { id, pcm, sampleRate } = event.data;
  (self as unknown as { postMessage(message: unknown): void }).postMessage(analyseForMap(pcm, sampleRate, id));
};
