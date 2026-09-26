import { describe, expect, it } from "vitest";

import { analyseForMap, downmix } from "./runtime.ts";

function clicks(bpm: number, seconds: number, sampleRate: number) {
  const pcm = new Float32Array(seconds * sampleRate);
  for (let t = 0.25; t < seconds; t += 60 / bpm) {
    const start = Math.round(t * sampleRate);
    for (let i = 0; i < sampleRate * 0.06 && start + i < pcm.length; i++) {
      pcm[start + i] += Math.exp(-i / (sampleRate * 0.015)) * Math.sin((2 * Math.PI * 60 * i) / sampleRate);
    }
  }
  return pcm;
}

function noise(seconds: number, sampleRate: number) {
  const pcm = new Float32Array(seconds * sampleRate);
  let seed = 7;
  for (let i = 0; i < pcm.length; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    pcm[i] = (seed / 2147483648 - 1) * 0.5;
  }
  return pcm;
}

describe("analyseForMap", () => {
  it("maps a steady beat with high confidence", () => {
    const map = analyseForMap(clicks(120, 20, 44100), 44100, "clicks");
    expect(map.id).toBe("clicks");
    expect(Math.abs(map.bpm - 120)).toBeLessThanOrEqual(0.1);
    expect(map.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("gives noise low confidence", () => {
    expect(analyseForMap(noise(20, 44100), 44100, "noise").confidence).toBeLessThanOrEqual(0.2);
  });
});

describe("downmix", () => {
  it("averages channels into a new buffer", () => {
    const left = Float32Array.from([1, 0]);
    const right = Float32Array.from([0, 1]);
    const mono = downmix([left, right]);
    expect(Array.from(mono)).toEqual([0.5, 0.5]);
    expect(downmix([left])).not.toBe(left);
  });
});
