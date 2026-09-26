# Record Crate + "Now Spinning" — Design (v2 sub-project 4 of 4)

Date: 2026-09-26 · Branch: `fznsakib/v2-crate` (off `fznsakib/v2-music` @ `cdae6de`, containing sub-projects 1–3). Owner approved all actions.

## Intent

A small crate of record sleeves lets visitors choose which song drives the page. The top record can be live: whatever Faizaan is (or was last) listening to, via Last.fm now-playing → the iTunes 30 s preview → the same engine and choreography. "His website dances to whatever he's listening to."

The investigation verified:
- The iTunes Search API and preview audio send `access-control-allow-origin: *`.
- Last.fm `user.getRecentTracks` needs an API key, which must be hidden behind a serverless function.
- Spotify is closed to new apps.
- Strava's terms forbid showing his runs to others.

## Owner inputs needed (not blocking)

- **Last.fm:** a username and API key. Without them, the crate shows only the bundled tracks, the function answers `{ configured: false }`, and nothing breaks.
- **Hosting on Netlify:** assumed from the old README.
  - The v2 function lives at `netlify/functions/now-playing.mts` (Functions v2, `config.path = "/api/now-playing"`).
  - `netlify.toml` sets `yarn build` → `dist`.
  - Env vars: `LASTFM_USER`, `LASTFM_API_KEY`.

## Decisions

| Decision | Chosen | Rejected (why) |
|---|---|---|
| Live source | Last.fm recent tracks via a Netlify function (key server-side, `Cache-Control: s-maxage=30`) | Spotify (API closed to new apps and Premium-gated) |
| Audio for live tracks | iTunes Search `previewUrl` (30 s AAC), decoded in the browser | Proxying audio (unnecessary: CORS is open) |
| Beat map for previews | Runtime analysis in a Web Worker, reusing `src/audio/analysis` (`analyzeTrack` + `buildBeatMap`), with confidence from grid strength | No map (visuals would idle); main-thread analysis (~0.5 s jank) |
| Engine API | `TrackSource.loadBeatMap(buffer: DecodedAudio)` receives the decoded buffer (a structural type, so Node-side code needs no DOM types); `loop`, `artwork` and `credit` on TrackSource; `EngineState.tracks`; `engine.addTrack(source)` adds at the front and plays only when selected; `engine.select(id)`; natural track end skips looping tracks when auto-advancing, and a looping track restarts itself | A separate player for previews (loses shared visuals) |
| Crate UI | The transport's track name becomes a button that opens a row of sleeves under it: bundled tracks get Doto-lettered sleeves; a preview gets its pixelated artwork (PixelIcon style) | A separate floating widget (clutters corners already in use) |
| Local testing | `?spin=Artist - Track` bypasses Last.fm and resolves through iTunes | Requiring `netlify dev` for any testing |

## Behaviour (summary)

- **Crate:**
  - Opens from the transport's track label and lists sleeves in order: now-spinning (if resolved), empty lightning, etaki.
  - Selecting a sleeve switches tracks (keeps playing if playing).
  - The current track is marked, and Esc closes the crate.
- **Now spinning:**
  - At startup (not blocking), the client calls `/api/now-playing`, or uses `?spin`.
  - Any non-JSON response is treated as unconfigured. This covers `vite dev`, which serves index.html for unknown paths.
  - It searches iTunes (`entity=song&limit=5`) and picks the first result whose artist matches case-insensitively.
  - The label reads "now spinning · {track} — {artist}", or "last spun · …" when not currently playing.
  - A "30 s preview · Apple Music" credit links to `trackViewUrl`.
  - Previews loop instead of advancing.
- **Failures** (function 404, `configured:false`, no iTunes match, a decode error): no now-spinning sleeve, silently. The console gets one `console.info`.
- **Confidence:**
  - Runtime maps get `confidence` = clamp((ratio − a)/b), where ratio = mean ±1-frame onset strength at grid beats ÷ mean ±1-frame onset strength over all frames.
  - Calibrate a and b so both bundled tracks score ≥ 0.8 and seeded noise ≤ 0.2.
  - Choreography already scales its phase-locked motion by `beatConfidence`.

## Testing

- **Function:** the handler (injected `fetch`) handles configured/unconfigured, now-playing vs last-played parsing, and Last.fm errors → 502.
- **iTunes matcher:** picks the artist match, and returns null when nothing matches.
- **Worker message contract:** a pure `analyseForMap(pcm, sampleRate, id)` returns a map with confidence.
- **Engine:**
  - `addTrack`/`select` switch and play;
  - `loadBeatMap(buffer)` is called after decode;
  - previews loop.
- **Browser (`?spin`):**
  - a real preview loads and drives the nod at the analysed BPM;
  - the crate switches between all three;
  - Esc closes it;
  - the console is clean.

## Folded-in minors from earlier reviews

- **DJ M-1:** a suspended or interrupted context drops hit envelopes and `jamming`, instead of freezing them.
- **DJ M-4:** the noise LCG uses 32-bit `Math.imul` arithmetic (no precision loss or short period).
