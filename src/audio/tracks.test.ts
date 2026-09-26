import { describe, expect, it } from "vitest";

import { TRACKS } from "./tracks";

import type { DecodedAudio } from "./types";

/** Bundled tracks load a committed map and never read the decoded audio. */
const unread: DecodedAudio = { numberOfChannels: 0, sampleRate: 0, length: 0, getChannelData: () => new Float32Array() };

const songs = Object.keys(import.meta.glob("../assets/audio/*.mp3")).map((path) =>
  path.replace(/^.*\//, "").replace(/\.mp3$/, "")
);

describe("bundled tracks", () => {
  it("lists every song in src/assets/audio once", () => {
    expect(TRACKS.map((track) => track.id).sort()).toEqual([...songs].sort());
  });

  it("has a committed beat map for every track", async () => {
    for (const track of TRACKS) {
      const map = await track.loadBeatMap(unread);
      expect(map?.id).toBe(track.id);
      expect(map?.bpm).toBeGreaterThan(60);
    }
  });
});
