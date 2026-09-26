# faizaan.tech v2

Personal audiovisual portfolio site. A 3D head nods to music while typography and UI elements react to audio frequencies in real-time.

## Dev Commands

```
yarn dev          # Vite dev server
yarn build        # tsc -b && vite build
yarn lint         # eslint .
yarn preview      # Preview production build
yarn test         # vitest run
yarn beatmap <file.mp3> [--id <id>]  # generate a beat map into src/audio/beatmaps/
```

## Audio Pipeline

```
Splash (click-to-enter) → engine.unlock() + engine.play() → MusicEngine (Web Audio clock)
  → src/audio/ticker.ts's single rAF loop calls engine.update() → engine.frame (MusicFrame)
  → components via useMusicFrame()/useMusicState(); r3f reads engine.frame directly in useFrame
```

- `engine` (`src/audio/engine.ts`) is the single app-wide `MusicEngine` instance. `startMusicTicker` (`src/audio/ticker.ts`) owns the one `requestAnimationFrame` loop that calls `engine.update`, before React or r3f's own loop runs each frame.
- Every musical field on `MusicFrame` is derived from the `AudioContext` output clock plus a precomputed beat map (`src/audio/beatmaps/*.json`), not from live analysis of the beat. See `docs/superpowers/specs/2026-09-25-music-engine-design.md`.
- `useMusicFrame` (`src/audio/react.ts`) subscribes a callback to every frame without ever triggering a React render. `useMusicState` (`useSyncExternalStore`) gives coarse state (`track`, `status`, `isPlaying`, `muted`, `volume`, `duration`, `channels`, `tracks` with each song's metadata) that does re-render when it changes.
- 6 live spectrum bands (`frame.bands`) come from a real-time `AnalyserNode` — texture only, not the timing source.
- Player operations: `next()`, `previous()` (restarts past 3 s), `stop()`, `seek()`, `select(id)`, `setMuted()`, `setVolume()` (mute multiplies with volume). `readSpectrum(out)`/`readWaveform(out)` fill the Player's visualiser from the same `AnalyserNode` (log bars 40 Hz–16 kHz, −90..−20 dB clipped); they read zeros unless playing or jamming.
- DJ mode: `engine.hit(voice)` plays a sampler hit (kick/snare/hat/stab) quantised to the nearest 16th note of the beat map, and feeds `frame.stab`/`frame.jamming` even when no track is playing.

## MusicFrame

Defined in `src/audio/types.ts`, written each frame by `src/audio/frame.ts` (`writeFrame`/`clearFrame`) and `MusicEngine.update`:

| Field | Meaning |
|-------|---------|
| `time`, `isPlaying`, `bpm` | Song position and transport state |
| `beat`, `beatIndex`, `beatPhase` | Continuous beat position; `beatPhase` 0..1, 0 = on the beat |
| `barIndex`, `barPhase` | Bar position; `barPhase` 0..1, 0 = downbeat |
| `beatCrossed`, `isDownbeat` | True only on the frame a beat/downbeat boundary was crossed |
| `kick`, `snare`, `hat` | Onset envelopes from the beat map's committed events |
| `energy`, `section`, `sectionLevel`, `sectionChanged` | Loudness/intensity curves and calm-vs-drop section state |
| `bands` | 6 live spectrum bands, 0..1, texture only |
| `stab`, `stabHit`, `jamming` | DJ-mode hit envelope and idle "jam" state |
| `beatConfidence` | 0..1, 0 with no beat map |

## Component Layers (z-index order)

| Layer            | z-index | Component(s)                       |
|-------------------|---------|------------------------------------|
| Background        | 0       | `Background` (canvas plus-grid); 0, not below, so a body background (ours or a host page's) can't paint over it |
| Header/Subtitle   | 1       | `NameHeader`, `SubtitleStack`      |
| GlassPanel        | 9       | `GlassPanel` (refractive glass, always behind the head) |
| Canvas (3D)       | 10      | Three.js `Canvas` with `Head`      |
| Social/Player     | 20      | `SocialLinks`, `Player` (+ `DjPad`) |
| MusicDebug        | 90      | `MusicDebug` (`?debug`)            |
| Splash            | 100     | `Splash`                           |

## State & Animation Patterns

- **Engine state**: `MusicEngine` is a plain class outside React. `useMusicState()` for coarse, re-rendering state; `useMusicFrame()` for per-frame callbacks that never re-render.
- **Animation state**: Always `useRef`/`useMemo` for per-frame values (never `useState` — avoids re-renders).
- **Direct DOM manipulation**: Write through `setStyle(el, prop, value)` in `src/choreography/dom.ts`, which dedupes so a redundant write never hits the DOM.
- **Choreography module** (`src/choreography/`): pure, unit-tested per-effect math, kept separate from components — `nod` (phase-locked head nod, spring physics), `type` (header weight pulse, EQ ballistics, coarse font-variation steps), `faces` (per-word/per-letter header faces and their shockwave), `grid` (cursor-facing plusses, music pulses), `glass` (glass outlines, refraction maps, drift/drag/throw/wall physics), `fit` (camera distance/height so the head suits the viewport), `tilt` (phone tilt → pointer-like look, calibration), `dom` (`setStyle`).
- **No CSS transitions** on properties written per-frame.
- **Player skins**: each skin is a set of CSS custom properties on the Player's `Shell` (`[data-skin]`) plus a few `[data-skin="…"] &` rules; the visualiser's canvas palettes live in `Player/paint.ts`. The layout is shared; skins change look only.
- **Three.js**: Use `useFrame` for animation loops (never raw `requestAnimationFrame`). `Head` reads `engine.frame` directly inside `useFrame` rather than via a hook. Use `useRef`/`useMemo` for mutable state and one-time objects (materials, springs).
- **Colour**: one palette, whatever the colour scheme or a host page's styles (`colors.site` in `src/styles/colors.ts`: white text on `rgb(20, 61, 50)`). `global.ts` sets it on `:root`, `body` and `#root` with `color-scheme: dark`, and text components set their own `color`; never rely on inherited text colour. Import `colors` directly: `styled.d.ts`'s `DefaultTheme` alias doesn't type `theme.colors`.
- **Mobile**: phones take their own layout under `(max-width: 767px)` (portrait) and `(max-height: 500px)` (landscape); desktop windows ≥ 1280 px wide and taller than 500 px are untouched by them (a desktop window ≤ 500 px tall gets the landscape-phone name and subtitles too). `viewport-fit=cover`, so every edge-fixed element insets with `max(Npx, env(safe-area-inset-*))`. The camera fit (`fitCamera`) pulls back and lowers the camera in portrait (head ≤ 65% of the width, ≤ 45% of the height, centred at 40% down) and is exactly today's z = 5, y = 0 on desktop.

## Code Conventions

- **Components**: Each component gets a directory with `index.tsx` + `*.styled.ts`
- **Styled components**: Use `styled-components` v6 with transient props (`$propName`)
- **Imports**: React/libraries first, then local (`../../App.styled`), then audio/choreography (`../../audio/react`, `../../choreography/dom`)
- **Type imports**: Use `import type { ... }` for type-only imports
- **Theme**: `src/styles/theme.ts` exports `theme` with `colors` and `spacing`
- **Testing**: Vitest (`yarn test`, node environment, `*.test.ts` only); choreography math, audio internals and the Player's pure helpers (`format`, `analyser`, `skins`, `keys`) each have a `*.test.ts` sibling. Components are checked in the browser.

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root layout, component composition, Canvas/lighting setup |
| `src/audio/MusicEngine.ts` | Web Audio playback and player operations, volume, DJ-mode hits, live bands, visualiser readers |
| `src/audio/engine.ts` | The single app-wide `MusicEngine` instance |
| `src/audio/ticker.ts` | The one rAF loop that calls `engine.update` |
| `src/audio/frame.ts` | `MusicFrame` construction and per-frame beat-map math |
| `src/audio/react.ts` | `useMusicFrame`, `useMusicState` hooks |
| `src/audio/bands.ts` | `BandNormaliser`: per-band adaptive dB range for the live bands |
| `src/audio/tracks.ts` | Bundled `TrackSource[]`: playlist order, metadata (title, artist, album, year, duration) and artwork |
| `src/audio/beatmaps/*.json` | Committed per-track beat maps, from `yarn beatmap` |
| `src/choreography/nod.ts` | Head-nod curve, spring physics |
| `src/choreography/type.ts` | Header/EQ weight pulses, quantisation |
| `src/choreography/faces.ts` | Header faces: per word when calm, per letter in drops, Doto/Golos anchors, shockwave |
| `src/choreography/grid.ts` | Plus-grid maths: layout, cursor turn, music pulse |
| `src/choreography/glass.ts` | Glass outlines (new per load), displacement maps, drift/drag/throw/wall-bounce physics |
| `src/choreography/fit.ts` | `fitCamera(width, height)` → `{ z, y }`: desktop keeps z = 5, phones pull back (and lower the camera in portrait) until the head fits |
| `src/choreography/tilt.ts` | `tiltLook` (beta/gamma → gravity in the screen's axes by `screen.orientation.angle` → the right edge's dip and the screen's raise → pointer-like look; continuous through upright, where the raw Euler angles flip) and `TiltCalibration` |
| `src/hooks/useDeviceTilt.ts` | Tilt-follow on touch devices: `enableDeviceTilt()` on the enter tap (iOS permission, levels at the current attitude), `useDeviceTilt()` gives `Head` a look or null (no sensor/permission, desktop, reduced motion); re-levels on rotation |
| `src/styles/global.ts` | Global reset and the host-independent palette |
| `src/components/Background/index.tsx` | Canvas plus-grid: big plusses face the cursor, mini plusses pulse with the kick |
| `src/components/Head/index.tsx` | 3D head model, beat-locked nodding; follows the mouse, or the phone's tilt on touch devices; camera from `fitCamera` |
| `src/components/NameHeader/index.tsx` | Font-cycling, kick-shockwave name header |
| `src/components/SubtitleStack/index.tsx` | 6-band graphic EQ / idle scan |
| `src/components/Player/index.tsx` | Winamp-style player: artwork, LCD, visualiser, seek, transport, volume, playlist; 3 skins; docked above the links on desktop, a slide-out drawer with a tab (label stacked upright; the panel is hidden while tucked away) on narrow screens and landscape phones of any width; the jam pad docks top-right on desktop, under the name on portrait phones, right of the head on landscape ones, and opening it from the drawer tucks the drawer away. `?debug` exposes its per-frame cost as `window.__player.costs` (ms) |
| `src/components/Player/useGlobalKeys.ts` | Page-wide keys (Space play/pause, M mute, A S D F hits), mounted by the Player; pure logic in `Player/keys.ts` |
| `src/components/Player/skins.ts` | Skin ids/names, cycling, `localStorage` (`player.skin`) |
| `src/components/Player/analyser.ts` | Visualiser bar falloff and Winamp-style peak caps (pure) |
| `src/components/DjPad/index.tsx` | On-screen DJ-mode pad (opened by the Player's JAM button) |
| `src/components/GlassPanel/index.tsx` | Refractive 3D glass (SVG displacement via `backdrop-filter`; frosted fallback / `?frosted`), draggable |
| `src/components/SocialLinks/index.tsx` | Dot-matrix link dock: resolves on hover/focus, beat shimmer on touch |
| `src/components/Splash/index.tsx` | Click-to-enter veil: inside the tap, unlocks audio (iOS audio session `playback` when entering with sound) and calls `enableDeviceTilt()` |
| `src/components/MusicDebug/index.tsx` | `?debug` overlay (lamps, meters, metronome) |

## Adding a New Song

1. Drop the mp3 in `src/assets/audio/`.
2. Run `yarn beatmap <file.mp3>` — decodes it, analyzes it, and writes `src/audio/beatmaps/<id>.json`. Add an entry to `src/audio/beatmaps/overrides.json` first if the detected BPM/downbeat needs correcting.
3. Download the cover once (e.g. the Apple Music `600x600bb.jpg`), then `sips -Z 300 -s format jpeg <file> --out src/assets/artwork/<id>.jpg`. No runtime fetches: the site stays static.
4. Add a `TrackSource` entry to `src/audio/tracks.ts` at its playlist position: import the mp3 and artwork URLs, fill `title` (full release title), `artist`, `album`, `year`, `duration` (the beat map's, rounded) with a source comment for the artwork, and `loadBeatMap` importing the generated JSON.
5. Run `yarn test` — `src/audio/tracks.test.ts` fails if any file in `src/assets/audio/*.mp3` doesn't have exactly one matching `TRACKS` entry with a committed beat map, complete metadata, and a `duration` within 0.5 s of its beat map.

## Deployment

Netlify. Build command: `yarn build`. Publish directory: `dist`. No functions.
