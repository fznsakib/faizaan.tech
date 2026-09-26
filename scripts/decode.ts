import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface DecodedAudio {
  pcm: Float32Array;
  sampleRate: number;
}

/** Parse a 16-bit PCM WAV, downmixing to mono. */
export function parseWav(buffer: Buffer): DecodedAudio {
  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
    }
    if (id === "data") {
      const count = Math.floor(size / 2 / channels);
      const pcm = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) {
          sum += buffer.readInt16LE(offset + 8 + (i * channels + c) * 2);
        }
        pcm[i] = sum / channels / 32768;
      }
      return { pcm, sampleRate };
    }
    offset += 8 + size + (size & 1);
  }
  throw new Error("WAV has no data chunk");
}

/**
 * Decode an audio file to mono PCM with macOS afconvert. afconvert matches Chrome's
 * decodeAudioData sample-for-sample (gapless trimming included), so beat maps line up with playback.
 */
export function decodeWithAfconvert(file: string): DecodedAudio {
  if (process.platform !== "darwin") {
    throw new Error("Beat-map decoding needs macOS afconvert (it matches Chrome's decodeAudioData exactly).");
  }
  const dir = mkdtempSync(join(tmpdir(), "beatmap-"));
  const wav = join(dir, "track.wav");
  try {
    execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16", "-c", "1", file, wav]);
    return parseWav(readFileSync(wav));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
