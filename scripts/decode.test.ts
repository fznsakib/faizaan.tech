import { describe, expect, it } from "vitest";

import { parseWav } from "./decode.ts";

function wav(channels: number, sampleRate: number, samples: number[]): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0, "ascii");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE(sampleRate * channels * 2, 16);
  fmt.writeUInt16LE(channels * 2, 20);
  fmt.writeUInt16LE(16, 22);
  const filler = Buffer.alloc(12);
  filler.write("FLLR", 0, "ascii");
  filler.writeUInt32LE(4, 4);
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(data.length, 4);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + fmt.length + filler.length + dataHeader.length + data.length, 4);
  header.write("WAVE", 8, "ascii");
  return Buffer.concat([header, fmt, filler, dataHeader, data]);
}

describe("parseWav", () => {
  it("reads mono 16-bit PCM", () => {
    const { pcm, sampleRate } = parseWav(wav(1, 44100, [0, 16384, -32768]));
    expect(sampleRate).toBe(44100);
    expect(Array.from(pcm)).toEqual([0, 0.5, -1]);
  });

  it("downmixes interleaved stereo and skips unknown chunks", () => {
    const { pcm, sampleRate } = parseWav(wav(2, 48000, [16384, 0, -16384, -16384]));
    expect(sampleRate).toBe(48000);
    expect(Array.from(pcm)).toEqual([0.25, -0.5]);
  });

  it("throws without a data chunk", () => {
    expect(() => parseWav(Buffer.from("RIFF\0\0\0\0WAVE"))).toThrow(/data chunk/);
  });
});
