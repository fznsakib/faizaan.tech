import { describe, expect, it, vi } from "vitest";

import { nowPlaying } from "./now-playing.mts";

const env = { LASTFM_USER: "faiz", LASTFM_API_KEY: "key" };
const lastfm = (tracks: unknown) =>
  vi.fn(async () => new Response(JSON.stringify({ recenttracks: { track: tracks } }), { status: 200 }));

describe("nowPlaying", () => {
  it("reports unconfigured without credentials", async () => {
    expect(await nowPlaying({}, vi.fn())).toEqual({ status: 404, body: { configured: false } });
  });

  it("returns the track playing right now", async () => {
    const fetchImpl = lastfm([{ artist: { "#text": "Radiohead" }, name: "Weird Fishes", "@attr": { nowplaying: "true" } }]);
    const result = await nowPlaying(env, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("user=faiz&api_key=key"));
    expect(result).toEqual({ status: 200, body: { configured: true, artist: "Radiohead", track: "Weird Fishes", nowPlaying: true } });
  });

  it("accepts a single track object and marks it last played", async () => {
    const result = await nowPlaying(env, lastfm({ artist: { "#text": "Portishead" }, name: "Roads" }) as unknown as typeof fetch);
    expect(result.body).toEqual({ configured: true, artist: "Portishead", track: "Roads", nowPlaying: false });
  });

  it("maps Last.fm failures to 502 and empty history to 404", async () => {
    const failing = vi.fn(async () => new Response("nope", { status: 500 }));
    expect((await nowPlaying(env, failing as unknown as typeof fetch)).status).toBe(502);
    expect(await nowPlaying(env, lastfm([]) as unknown as typeof fetch)).toEqual({ status: 404, body: { configured: true } });
  });
});
