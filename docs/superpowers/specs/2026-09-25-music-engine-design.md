# Music Engine & Build Fix — Design (v2 sub-project 1 of 4)

Date: 2026-09-25 · Branch: `fznsakib/v2-music-engine` (off `add-audio-analysis` @ `a73ee3b`)

## Intent

faizaan.tech v2's centrepiece is a music-reactive page: the chrome 3D head, the type and the glass shards should move like a music video, hitting on the beat. The owner's priority is making "the animations (3D head nod, font change, etc.) to the songs better."

This sub-project builds the **foundation** that makes on-beat animation possible. It also fixes the production build. Visual choreography is deliberately out of scope; it is sub-project 2 and consumes the `MusicFrame` defined here.

Roadmap (each gets its own spec → plan → build):
1. **Music engine + build fix** (this spec)
2. Choreography: chrome head + phase-locked nod, typography conductor, drop flips
3. DJ mode: sampler keys quantised to the beat grid
4. Record crate + "now spinning" (Last.fm → iTunes preview; Netlify function)

## Why (evidence from the investigation)

Measured on `a73ee3b` in Chrome at 120 Hz:

- **The live BPM detector cannot lock.**
  - Detected BPM on empty-lightning swung between 80 and 145, including 96→139 within 15 s. The true tempo is 113.01.
  - The detector's clock adds `bufferSize/sampleRate` (23.2 ms) per rAF call, so it runs 2.77× fast at 120 Hz.
  - It fires 305×/min, and only 9% of hits land within ±50 ms of a beat, which is below chance (19%).
- **The band split is about 20× off.** "Low" is 0–4.4 kHz. The low circle's scale stays in 3.2–4.6, so it has almost no dynamic range.
- **React thrash.** `setAudioData` runs every frame, giving about 118 commits/s. It also recreates `initializeAudio`, so the injected play button is removed and re-added every frame.
- **StrictMode** creates 2 AudioContexts. One leaks.
- **No transport.** A one-shot `AudioBufferSourceNode` can't pause or seek, and the first click anywhere, including a social link, starts audio with no way to stop it.
- **Ground truth: both tracks are constant-tempo** (grid refits within ±0.1 BPM).
  - empty-lightning: 113.01 BPM, beat0 0.030 s, downbeat on beat%4==0.
  - etaki: 149.98 BPM, beat0 0.385 s, downbeat on beat%4==3.
- **The prototype beat-map engine** measured beat timing 0–9.7 ms late (median 4.2 ms, one frame) and 0 React commits/s. Seek, pause and switch all verified.
- **The production build is broken.**
  - `tsc -b` fails with 2× TS6133 (unused `audioContext` in `MusicAnalyser.ts` / `MusicAnalyzer.ts`).
  - `head.obj` and the 5 social PNGs are referenced by string path, so they 404 in `dist`.

## Decisions

| Decision | Chosen | Rejected (why) |
|---|---|---|
| Beat source | Build-time beat map per track + audio-clock frame | Live onset detection (misfires, can't anticipate beats, fails during silence). Load-time analysis in the browser (about 1.5 s of CPU per track, loses hand-tuned overrides). Kept for sub-project 4 previews. |
| Clock | `AudioContext` output timestamp, latency-compensated | rAF-accumulated time (drifts, freezes when the tab is hidden) |
| Per-frame data flow | Mutable `MusicFrame` read in `useFrame`/rAF | React state/context (per-frame re-renders) |
| Audio start | Click-to-enter splash (owner's choice) | Explicit play button; first-click-anywhere |
| MP3 decode for analysis | macOS `afconvert` → WAV | WASM MP3 decoders (gapless/encoder-delay handling can shift the grid by one MP3 frame ≈ 26 ms). `afconvert` matched Chrome's `decodeAudioData` sample count exactly on both tracks. |
| Analyzer location | Pure TS in `src/audio/analysis/`, run by Node 23 type-stripping for the build script | A separate script-only JS file. Sub-project 4 needs the same code in a browser Worker. |

## Architecture

```
src/audio/
  types.ts              BeatMap, MusicFrame, EngineState
  analysis/
    fft.ts              radix-2 FFT (pure)
    analyzeTrack.ts     PCM → Analysis (onset envelopes, tempo, grid, downbeat, loudness)
    buildBeatMap.ts     Analysis + overrides → BeatMap (onset events, curves, bar levels)
  frame.ts              pure: writeFrame(frame, map, songTime, cursors) — beat/bar math, envelopes, curves
  MusicEngine.ts        transport + clock + live band tap + coarse-state pub/sub
  tracks.ts             track registry (id, title, mp3 url, lazy beat-map loader)
  engine.ts             the singleton `engine` with tracks registered
  ticker.ts             the single rAF loop: engine.update(now), visualLead estimate, frame subscribers
  react.ts              useMusicState(), useMusicFrame(cb)
  beatmaps/
    empty-lightning.json, etaki.json   generated, committed
    overrides.json                     hand corrections per track
scripts/beatmap.ts      node scripts/beatmap.ts <file.mp3> [--id x]  (macOS)
src/components/
  Splash/               click-to-enter veil
  Transport/            always-visible Doto transport line
  MusicDebug/           ?debug overlay (lazy-loaded)
```

**Engine API (singleton `engine`):**
- `preload(id)`: creates the suspended context if needed, then fetches and decodes. Idempotent, because StrictMode double-invokes effects.
- `unlock()`: synchronous `resume()`; call it inside a user-gesture handler.
- `play(from?)`, `pause()`, `toggle()`, `seek(t)`, `next()`, `setMuted(b)`.
- `update(nowMs)` and `frame`.
- `subscribe(fn)` / `getSnapshot()` → `EngineState { status: 'idle'|'loading'|'ready'|'error'; unlocked; track: string|null; title: string|null; bpm: number|null; isPlaying /* playing or starting */; muted }`. The snapshot object changes identity only when a field changes.

Audio graph: `source → bus (GainNode) → analyser` and `bus → mute (GainNode) → destination`.

**Deleted:** `src/context/AudioContext.tsx`, `src/components/MusicPlayer/*` (both analyser copies), `src/components/AnimatedElement/*`, `src/assets/audio/sample.mp3` (0 bytes).

**Unit boundaries:**
- `analysis/*` and `frame.ts` are pure (no DOM, Node or Web Audio). `analysis/*` must use only erasable TS syntax (no enums, namespaces or parameter properties) and explicit `.ts` import extensions, so that Node 23 can run it directly.
- `MusicEngine` receives its dependencies through constructor options (`createContext`, `fetchArrayBuffer`, `now`), so tests can use a fake `AudioContext`.
- React components never receive per-frame data through props or state.

## Data formats

### BeatMap (JSON, ~30–37 KB raw / ~13 KB gzip per track)

```ts
interface BeatMap {
  id: string; version: 1;
  duration: number;          // seconds
  bpm: number;               // constant tempo
  beat0: number;             // seconds of beat index 0 (includes beat0Shift)
  beatsPerBar: 4;
  downbeatMod: number;       // beatIndex ≡ downbeatMod (mod beatsPerBar) → downbeat
  confidence: number;        // 0..1; committed maps = 1
  curveFps: 10;
  energy: number[];          // 0..255 loudness, p2–p98 normalised
  section: number[];         // 0..255 slow intensity (4-bar centred moving average of energy, renormalised p5→0, p95→1; span floor 0.1)
  barLevels: number[];       // per bar index ≥ 0: 0 calm, 1 intense (hysteresis: up > 0.6, down < 0.45 on bar-mean section)
  onsets: { kick: number[]; snare: number[]; hat: number[] }; // flat [t0, s0, t1, s1, …], t seconds, s 0..1
}
```

`overrides.json`: `{ [id]: { beat0Shift?: number; downbeatMod?: number; bpm?: number } }`. The default `beat0Shift` is +0.013 s: the measured median offset from the STFT-frame grid to the kick transient.

### MusicFrame (mutated in place by `engine.update(nowMs)`)

```ts
interface MusicFrame {
  time: number;            // song seconds at the moment this frame is SEEN (latency-compensated)
  isPlaying: boolean;
  bpm: number;
  beat: number;            // continuous (beatIndex + beatPhase); negative before beat0
  beatIndex: number;
  beatPhase: number;       // 0..1, 0 = on the beat
  barIndex: number;
  barPhase: number;        // 0..1, 0 = downbeat
  beatCrossed: boolean;    // true only on the frame a beat boundary was crossed
  isDownbeat: boolean;     // beatCrossed && the crossed beat is a downbeat
  timeToNextBeat: number;  // seconds
  kick: number; snare: number; hat: number; // 0..1: instant attack at onset, exp decay (0.18 / 0.14 / 0.07 s)
  energy: number;          // 0..1, interpolated from the 10 fps curve
  section: number;         // 0..1
  sectionLevel: 0 | 1;     // barLevels[barIndex] (0 before bar 0)
  sectionChanged: boolean; // isDownbeat && sectionLevel differs from the previous bar's
  bands: Float32Array;     // length 6, 0..1, live analyser (texture only, never timing)
  beatConfidence: number;  // map.confidence while playing a mapped track, else 0
}
```

`update(nowMs)` is idempotent for the same `nowMs`. One ticker (`src/audio/ticker.ts`, a rAF loop started in `main.tsx` before React renders, so it runs before r3f's loop each frame) is the only caller; it also estimates `visualLead` and notifies `useMusicFrame` subscribers. r3f `useFrame` and every other consumer only **read** `engine.frame` — a second `update` in the same frame would consume the `beatCrossed`/`isDownbeat` edges.

**Clock:**
- `audible = ts.contextTime + (nowMs − ts.performanceTime)/1000` from `getOutputTimestamp()`. Fallback: `currentTime − baseLatency − outputLatency`.
- `songTime = anchorSong + (audible + visualLead + userOffset − anchorCtx)`.
- `visualLead` is one display frame, estimated from the median rAF delta. `userOffset` defaults to 0 and is reserved for calibration.

**Bands:**
- Source: an `AnalyserNode` (fftSize 1024, smoothing 0) tapped after the master gain but before the mute. Muted playback still yields bands.
- Layout: 6 log-spaced bands, 40 Hz–16 kHz.
- Scaling: dB mapped from [−90, −20] → 0..1, then divided by a per-band running peak (decay 0.995/frame, floor 0.25). Values are unsmoothed; consumers apply their own ballistics.

## Behaviour

**Load / splash**
- The page renders fully behind a veil: dark green `rgba(20,61,50,0.82)` with an 8 px backdrop blur.
- Centre: a Doto "enter" prompt with a slow CSS pulse (the pulse is off under `prefers-reduced-motion`). Below it: a smaller "enter without sound" button.
- While the first track (empty-lightning) is fetched and decoded on a *suspended* AudioContext, the prompt reads "loading" with animated Doto dots. It becomes "enter" when ready.
- **Entering:**
  - A click or tap anywhere on the veil, or Enter/Space, calls `engine.unlock()` **synchronously inside the event handler** (this satisfies iOS). That resumes the context and plays at song time 0.
  - "Enter without sound" does the same with `muted = true`.
  - The veil fades out over 600 ms.
  - Entering before decode finishes starts playback as soon as decoding completes.
- **Accessibility:** the veil is `role="dialog"`, `aria-modal`, labelled "Enter faizaan.tech". The enter button is focused on mount.

**Transport**
- Fixed top-left, z-index 20, Doto about 1.1 rem, e.g. `❚❚ empty-lightning · 113 bpm   mute   next`.
- Controls: play/pause toggle, mute toggle (10 ms gain ramp to avoid clicks), next track. All are real `<button>`s with `aria-label`s.
- Keys: Space = play/pause, M = mute. Ignored when focus is on an input, link or button, so a focused button's own click doesn't double-toggle.
- Tracks play in registry order (empty-lightning → etaki) and loop. `onended` → next.
- The tab being hidden does not pause playback. Frames resume correctly because they derive from the audio clock.

**Errors and fallbacks**
- No `AudioContext`, or fetch/decode fails: engine state is `error`. The splash still offers "enter", which enters silently. The transport shows "audio unavailable". Frames report `isPlaying: false` and `beatConfidence: 0`.
- A missing beat map for a registered track: the track plays with `beatConfidence: 0` and all beat fields at 0.

**Debug overlay (`?debug`, lazy chunk)**
- Beat lamp, downbeat lamp, kick/snare/hat meters, energy/section/sectionLevel bars, the 6 band bars, and a readout (`t`, `bpm`, `beat`, `bar.beat`, section).
- A metronome toggle schedules clicks on the audio clock at grid beats (1760 Hz on downbeats, 880 Hz otherwise), so a human can confirm `beat0` and `downbeatMod` by ear.

**Build fix**
- Import `head.obj` via `?url` and the 5 PNGs as modules.
- Remove the dead analysers, which clears both TS6133 errors.
- Add `resolveJsonModule`.
- Get `eslint .` to 0 errors: `--fix` for import order, plus manual fixes for the rest.
- The existing header/subtitle CSS animations and the mouse-follow head are left unchanged (sub-project 2).

## Testing & acceptance

Vitest (node environment) is added as `yarn test`.

1. **`frame.ts`**, using a synthetic map (120 BPM, beat0 0.5, downbeatMod 1):
   - beatIndex/beatPhase/barIndex/barPhase at chosen times;
   - beatCrossed/isDownbeat edges, including no edge on the first frame;
   - envelope instant attack and decay (`kick(t0+0.18) ≈ s·e⁻¹`);
   - cursor reset when time goes backwards (seek);
   - energy/section interpolation;
   - sectionLevel/sectionChanged from `barLevels`.
2. **`MusicEngine`** with a fake context and a controllable output timestamp:
   - one context per engine, created on `preload()`;
   - `unlock()` resumes it;
   - `play(from)` anchors;
   - pause freezes `time`, resume continues from there;
   - seek moves `time`;
   - `next()` switches the map and loops at the end;
   - mute ramps the gain;
   - latency compensation shifts `time` by `visualLead`;
   - `update` is idempotent per `nowMs`.
3. **`buildBeatMap`** on a synthetic analysis: overrides apply (`beat0Shift`, `downbeatMod`, `bpm`); onset peak-picking obeys the minimum gap; `barLevels` hysteresis.
4. **`analyzeTrack` on the real tracks** (macOS only, `skipIf` elsewhere; decoded via `afconvert`):
   - BPM within ±0.05 of 113.01 / 149.98;
   - `beat0` (with the default shift) within ±10 ms of 0.030 / 0.385;
   - `downbeatMod` 0 / 3, unless overridden in `overrides.json` (which the test then asserts instead).

**Acceptance:**
- `yarn build`, `yarn lint` (0 errors) and `yarn test` all pass.
- `vite preview` of the build loads the head, all 5 icons and the audio with no 404s.
- In the browser (Chrome, 120 Hz):
  - Only 1 AudioContext is created under StrictMode.
  - During playback, React commits ≤ 2 in 5 s (commits come only from coarse state changes).
  - In `?debug`, the beat lamp's first-frame lateness has median ≤ 1 frame across ≥ 30 beats.
  - Splash → enter → pause → resume → mute → next → track end → loop all behave as specified.
  - "Enter without sound" plays muted while frames still advance.

## Handoff to sub-project 2

Consumers read `engine.frame` (r3f `useFrame`) or subscribe with `useMusicFrame(cb)` (DOM); they never call `engine.update` themselves. Choreography should gate phase-locked motion on `beatConfidence` and use `sectionChanged` for drop flips. `timeToNextBeat` and `beatPhase` allow anticipation.

## Open items (owner)

- Confirm `beat0` and the empty-lightning downbeat by ear with the `?debug` metronome. Adjust `overrides.json` if needed.
