import { afterEach, describe, expect, it, vi } from "vitest";

import { loadNowSpinning, pickPreview, spinFromQuery, spinFromResponse } from "./nowSpinning";

const result = {
  artistName: "Radiohead",
  trackName: "Weird Fishes / Arpeggi",
  previewUrl: "https://audio-ssl.itunes.apple.com/p.m4a",
  artworkUrl100: "https://is1-ssl.mzstatic.com/a/100x100bb.jpg",
  trackViewUrl: "https://music.apple.com/t",
};

const json = (body: unknown, type = "application/json") =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": type } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("spin sources", () => {
  it("reads ?spin=Artist - Track", () => {
    expect(spinFromQuery("?spin=Radiohead%20-%20Weird%20Fishes")).toEqual({ artist: "Radiohead", track: "Weird Fishes", nowPlaying: true });
    expect(spinFromQuery("?spin=nothing")).toBeNull();
    expect(spinFromQuery("")).toBeNull();
  });

  it("reads the function's JSON", () => {
    expect(spinFromResponse({ configured: true, artist: "A", track: "T", nowPlaying: false })).toEqual({ artist: "A", track: "T", nowPlaying: false });
    expect(spinFromResponse({ configured: false })).toBeNull();
  });
});

describe("pickPreview", () => {
  it("takes the first result by the same artist with a preview, pixel-sized artwork", () => {
    const picked = pickPreview([{ ...result, artistName: "Radiohead Tribute" , previewUrl: undefined }, result], { artist: "radiohead", track: "Weird Fishes", nowPlaying: true });
    expect(picked).toEqual({
      title: "Weird Fishes / Arpeggi",
      artist: "Radiohead",
      audio: result.previewUrl,
      artwork: "https://is1-ssl.mzstatic.com/a/30x30bb.jpg",
      link: result.trackViewUrl,
    });
  });

  it("returns null when no result matches the artist", () => {
    expect(pickPreview([result], { artist: "Portishead", track: "Roads", nowPlaying: true })).toBeNull();
  });
});

describe("loadNowSpinning", () => {
  it("adds a looping now-spinning track from ?spin via iTunes", async () => {
    const addTrack = vi.fn();
    const fetchImpl = vi.fn(async () => json({ results: [result] }));
    await loadNowSpinning({ addTrack }, "?spin=Radiohead - Weird Fishes", fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("https://itunes.apple.com/search?term=Radiohead%20Weird%20Fishes"));
    expect(addTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: "now-spinning", loop: true, url: result.previewUrl, title: "now spinning · Weird Fishes / Arpeggi — Radiohead" })
    );
  });

  it("accepts iTunes' JSON even though it is served as text/javascript", async () => {
    const addTrack = vi.fn();
    const fetchImpl = vi.fn(async () => json({ results: [result] }, "text/javascript; charset=utf-8"));
    await loadNowSpinning({ addTrack }, "?spin=Radiohead - Weird Fishes", fetchImpl as unknown as typeof fetch);
    expect(addTrack).toHaveBeenCalledTimes(1);
  });

  it("uses the now-playing function when there is no ?spin", async () => {
    const addTrack = vi.fn();
    const fetchImpl = vi.fn(async (url: string) =>
      url === "/api/now-playing" ? json({ configured: true, artist: "Radiohead", track: "Weird Fishes", nowPlaying: false }) : json({ results: [result] })
    );
    await loadNowSpinning({ addTrack }, "", fetchImpl as unknown as typeof fetch);
    expect(addTrack.mock.calls[0][0].title).toMatch(/^last spun · /);
  });

  it("treats a non-JSON response as unconfigured (vite dev serves index.html)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const addTrack = vi.fn();
    const fetchImpl = vi.fn(async () => new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } }));
    await loadNowSpinning({ addTrack }, "", fetchImpl as unknown as typeof fetch);
    expect(addTrack).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("stays silent (one info line) when iTunes has no match", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const addTrack = vi.fn();
    await loadNowSpinning({ addTrack }, "?spin=Nobody - Nothing", (async () => json({ results: [] })) as unknown as typeof fetch);
    expect(addTrack).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
  });
});
