import { describe, expect, it } from "vitest";

import { TRACKS } from "./tracks";

const songs = Object.keys(import.meta.glob("../assets/audio/*.mp3")).map((path) =>
  path.replace(/^.*\//, "").replace(/\.mp3$/, "")
);

describe("bundled tracks", () => {
  it("lists every song in src/assets/audio once", () => {
    expect(TRACKS.map((track) => track.id).sort()).toEqual([...songs].sort());
  });

  it("plays in the playlist's order, without etaki", () => {
    expect(TRACKS.map((track) => track.id)).toEqual([
      "empty-lightning",
      "bend-tiesto",
      "expression-on-your-face",
      "generate-utopia",
      "void",
      "in-my-mind",
      "i-still-see-you",
    ]);
    expect(TRACKS.some((track) => track.id === "etaki")).toBe(false);
  });

  it("carries a title, artist, album, year and artwork for every track", () => {
    for (const track of TRACKS) {
      expect(track.title.trim(), track.id).not.toBe("");
      expect(track.artist.trim(), track.id).not.toBe("");
      expect(track.album.trim(), track.id).not.toBe("");
      expect(String(track.year), track.id).toMatch(/^\d{4}$/);
      expect(track.artwork, track.id).toMatch(/artwork\/[\w-]+\.jpg$/);
    }
  });

  it("has a committed beat map for every track, whose length the playlist shows", async () => {
    for (const track of TRACKS) {
      const map = await track.loadBeatMap();
      expect(map?.id).toBe(track.id);
      expect(map?.bpm).toBeGreaterThan(60);
      expect(Math.abs(track.duration - (map?.duration ?? 0)), track.id).toBeLessThanOrEqual(0.5);
    }
  });
});
