type Env = Record<string, string | undefined>;

interface LastFmTrack {
  artist?: { "#text"?: string };
  name?: string;
  "@attr"?: { nowplaying?: string };
}

/** Faizaan's current (or last) Last.fm track; the API key stays server-side. */
export async function nowPlaying(env: Env, fetchImpl: typeof fetch): Promise<{ status: number; body: Record<string, unknown> }> {
  const user = env.LASTFM_USER;
  const key = env.LASTFM_API_KEY;
  if (!user || !key) return { status: 404, body: { configured: false } };
  const url =
    "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks" +
    `&user=${encodeURIComponent(user)}&api_key=${encodeURIComponent(key)}&format=json&limit=1`;
  const response = await fetchImpl(url);
  if (!response.ok) return { status: 502, body: { configured: true, error: `last.fm ${response.status}` } };
  const data = (await response.json()) as { recenttracks?: { track?: LastFmTrack | LastFmTrack[] } };
  const raw = data.recenttracks?.track;
  const latest = (Array.isArray(raw) ? raw : raw ? [raw] : [])[0];
  const artist = latest?.artist?.["#text"];
  if (!latest?.name || !artist) return { status: 404, body: { configured: true } };
  return {
    status: 200,
    body: { configured: true, artist, track: latest.name, nowPlaying: latest["@attr"]?.nowplaying === "true" },
  };
}

export default async (): Promise<Response> => {
  const { status, body } = await nowPlaying(process.env, fetch);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "public, s-maxage=30, max-age=0" },
  });
};

export const config = { path: "/api/now-playing" };
