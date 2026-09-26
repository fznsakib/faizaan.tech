import { analyseInWorker } from "./analysis/analyseInWorker";

import type { MusicEngine } from "./MusicEngine";
import type { TrackSource } from "./types";

export const NOW_SPINNING_ID = "now-spinning";
const ENDPOINT = "/api/now-playing";

export interface Spin {
  artist: string;
  track: string;
  nowPlaying: boolean;
}

export interface Preview {
  title: string;
  artist: string;
  audio: string;
  artwork: string;
  link: string;
}

interface ITunesResult {
  artistName?: string;
  trackName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
}

/** `?spin=Artist - Track`: test the preview path without Last.fm. */
export function spinFromQuery(search: string): Spin | null {
  const value = new URLSearchParams(search).get("spin");
  if (!value) return null;
  const [artist, ...rest] = value.split(" - ");
  const track = rest.join(" - ").trim();
  return artist.trim() && track ? { artist: artist.trim(), track, nowPlaying: true } : null;
}

/** Parse the now-playing function's JSON body. */
export function spinFromResponse(body: unknown): Spin | null {
  if (!body || typeof body !== "object") return null;
  const { artist, track, nowPlaying } = body as Record<string, unknown>;
  if (typeof artist !== "string" || !artist || typeof track !== "string" || !track) return null;
  return { artist, track, nowPlaying: nowPlaying === true };
}

/** First iTunes result by the same artist that has a preview; artwork shrunk to 30 px for a pixelated sleeve. */
export function pickPreview(results: ITunesResult[], spin: Spin): Preview | null {
  const artist = spin.artist.toLowerCase();
  const match = results.find((r) => r.previewUrl && r.artistName?.toLowerCase().includes(artist));
  if (!match?.previewUrl) return null;
  return {
    title: match.trackName ?? spin.track,
    artist: match.artistName ?? spin.artist,
    audio: match.previewUrl,
    artwork: (match.artworkUrl100 ?? "").replace("100x100bb", "30x30bb"),
    link: match.trackViewUrl ?? "https://music.apple.com",
  };
}

export function previewTrack(spin: Spin, preview: Preview): TrackSource {
  return {
    id: NOW_SPINNING_ID,
    title: `${spin.nowPlaying ? "now spinning" : "last spun"} · ${preview.title} — ${preview.artist}`,
    url: preview.audio,
    loop: true,
    artwork: preview.artwork || undefined,
    credit: { label: "30 s preview · Apple Music", url: preview.link },
    loadBeatMap: (buffer) => analyseInWorker(buffer, NOW_SPINNING_ID),
  };
}

/**
 * Parse a JSON response. `strict` also requires a JSON content type: our own endpoint must be JSON (vite dev
 * serves index.html there), while iTunes returns JSON as `text/javascript`.
 */
async function readJson(response: Response, strict: boolean): Promise<unknown> {
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || (strict && !type.includes("json"))) {
    throw new Error(`${response.url || "response"} ${response.status} ${response.headers.get("content-type") ?? ""}`.trim());
  }
  return response.json();
}

/** Resolve what Faizaan is listening to into a crate track. Any failure: one console.info, no sleeve. */
export async function loadNowSpinning(
  engine: Pick<MusicEngine, "addTrack">,
  search: string = window.location.search,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  try {
    const spin = spinFromQuery(search) ?? spinFromResponse(await readJson(await fetchImpl(ENDPOINT), true));
    if (!spin) throw new Error("nothing spinning");
    const term = encodeURIComponent(`${spin.artist} ${spin.track}`);
    const found = (await readJson(await fetchImpl(`https://itunes.apple.com/search?term=${term}&entity=song&limit=5`), false)) as {
      results?: ITunesResult[];
    };
    const preview = pickPreview(found.results ?? [], spin);
    if (!preview) throw new Error(`no iTunes preview for ${spin.artist} — ${spin.track}`);
    engine.addTrack(previewTrack(spin, preview));
  } catch (err) {
    console.info("[music] no now-spinning track:", err instanceof Error ? err.message : err);
  }
}
