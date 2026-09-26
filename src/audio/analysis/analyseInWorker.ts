import { downmix } from "./runtime";

import type { BeatMap, DecodedAudio } from "../types";

/** Analyse decoded audio into a beat map in a Web Worker (rejects after `timeoutMs`). */
export function analyseInWorker(buffer: DecodedAudio, id: string, timeoutMs = 15000): Promise<BeatMap> {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const pcm = downmix(channels);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("beat analysis timed out"));
    }, timeoutMs);
    worker.onmessage = (event: MessageEvent<BeatMap>) => {
      finish();
      resolve(event.data);
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "beat analysis failed"));
    };
    worker.postMessage({ id, pcm, sampleRate: buffer.sampleRate }, [pcm.buffer]);
  });
}
