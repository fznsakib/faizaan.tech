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
yarn headmap <capture.glb> [--flags]  # regenerate src/assets/head.glb from a face capture (see below)
```

## Audio Pipeline

```
Splash (click-to-enter) → engine.unlock() + engine.play() → MusicEngine (Web Audio clock)
  → src/audio/ticker.ts's single rAF loop calls engine.update() → engine.frame (MusicFrame)
  → components via useMusicFrame()/useMusicState(); r3f reads engine.frame directly in useFrame
```

- `engine` (`src/audio/engine.ts`) is the single app-wide `MusicEngine` instance. `startMusicTicker` (`src/audio/ticker.ts`) owns the one `requestAnimationFrame` loop that calls `engine.update`, before React or r3f's own loop runs each frame.
- Every musical field on `MusicFrame` is derived from the `AudioContext` output clock plus a precomputed beat map (`src/audio/beatmaps/*.json`), not from live analysis of the beat. See `docs/superpowers/specs/2026-09-25-music-engine-design.md`.
- `useMusicFrame` (`src/audio/react.ts`) subscribes a callback to every frame without ever triggering a React render. `useMusicState` (`useSyncExternalStore`) gives coarse state (`track`, `status`, `isPlaying`, `muted`, `tracks`) that does re-render when it changes.
- 6 live spectrum bands (`frame.bands`) come from a real-time `AnalyserNode` — texture only, not the timing source.
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
| Background        | -5      | `Background` (canvas plus-grid)    |
| Header/Subtitle   | 1       | `NameHeader`, `SubtitleStack`      |
| GlassPanel        | 9       | `GlassPanel` (refractive glass, always behind the head) |
| Canvas (3D)       | 10      | Three.js `Canvas` with `Head`      |
| Social/Transport  | 20      | `SocialLinks`, `Transport` (+ `Crate`, `DjPad`) |
| MusicDebug        | 90      | `MusicDebug` (`?debug`)            |
| Splash            | 100     | `Splash`                           |

## State & Animation Patterns

- **Engine state**: `MusicEngine` is a plain class outside React. `useMusicState()` for coarse, re-rendering state; `useMusicFrame()` for per-frame callbacks that never re-render.
- **Animation state**: Always `useRef`/`useMemo` for per-frame values (never `useState` — avoids re-renders).
- **Direct DOM manipulation**: Write through `setStyle(el, prop, value)` in `src/choreography/dom.ts`, which dedupes so a redundant write never hits the DOM.
- **Choreography module** (`src/choreography/`): pure, unit-tested per-effect math, kept separate from components — `nod` (phase-locked head nod, spring physics), `type` (header weight pulse, EQ ballistics, coarse font-variation steps), `faces` (per-word/per-letter header faces and their shockwave), `grid` (cursor-facing plusses, music pulses), `glass` (glass outlines, refraction maps, drift/drag/throw/wall physics), `dom` (`setStyle`).
- **No CSS transitions** on properties written per-frame.
- **Three.js**: Use `useFrame` for animation loops (never raw `requestAnimationFrame`). `Head` reads `engine.frame` directly inside `useFrame` rather than via a hook. Use `useRef`/`useMemo` for mutable state and one-time objects (materials, springs).

## Code Conventions

- **Components**: Each component gets a directory with `index.tsx` + `*.styled.ts`
- **Styled components**: Use `styled-components` v6 with transient props (`$propName`)
- **Imports**: React/libraries first, then local (`../../App.styled`), then audio/choreography (`../../audio/react`, `../../choreography/dom`)
- **Type imports**: Use `import type { ... }` for type-only imports
- **Theme**: `src/styles/theme.ts` exports `theme` with `colors` and `spacing`
- **Testing**: Vitest (`yarn test`); choreography math, audio internals and the `scripts/headmap/` geometry helpers each have a `*.test.ts` sibling

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root layout, component composition, Canvas/lighting setup |
| `src/audio/MusicEngine.ts` | Web Audio playback, transport, DJ-mode hits, live band analysis |
| `src/audio/engine.ts` | The single app-wide `MusicEngine` instance |
| `src/audio/ticker.ts` | The one rAF loop that calls `engine.update` |
| `src/audio/frame.ts` | `MusicFrame` construction and per-frame beat-map math |
| `src/audio/react.ts` | `useMusicFrame`, `useMusicState` hooks |
| `src/audio/bands.ts` | `BandNormaliser`: per-band adaptive dB range for the live bands |
| `src/audio/tracks.ts` | Bundled `TrackSource[]` (the crate) |
| `src/audio/beatmaps/*.json` | Committed per-track beat maps, from `yarn beatmap` |
| `src/choreography/nod.ts` | Head-nod curve, spring physics |
| `src/choreography/type.ts` | Header/EQ weight pulses, quantisation |
| `src/choreography/faces.ts` | Header faces: per word when calm, per letter in drops, Doto/Golos anchors, shockwave |
| `src/choreography/grid.ts` | Plus-grid maths: layout, cursor turn, music pulse |
| `src/choreography/glass.ts` | Glass outlines (new per load), displacement maps, drift/drag/throw/wall-bounce physics |
| `src/components/Background/index.tsx` | Canvas plus-grid: big plusses face the cursor, mini plusses pulse with the kick |
| `src/components/Head/index.tsx` | 3D head model, beat-locked nodding |
| `src/assets/head.glb` | The head mesh: stock head with the owner's face, generated by `yarn headmap` |
| `scripts/headmap.ts` | Face capture → head pipeline (crop, align, transfer, meshopt write); helpers in `scripts/headmap/` |
| `scripts/assets/base-head.glb` | The untouched stock head every `yarn headmap` run starts from |
| `src/components/NameHeader/index.tsx` | Font-cycling, kick-shockwave name header |
| `src/components/SubtitleStack/index.tsx` | 6-band graphic EQ / idle scan |
| `src/components/Transport/index.tsx` | Play/pause, crate, mute, jam pad dock |
| `src/components/Crate/index.tsx` | Track picker sleeves |
| `src/components/DjPad/index.tsx` | On-screen DJ-mode pad |
| `src/components/GlassPanel/index.tsx` | Refractive 3D glass (SVG displacement via `backdrop-filter`; frosted fallback / `?frosted`), draggable |
| `src/components/SocialLinks/index.tsx` | Dot-matrix link dock: resolves on hover/focus, beat shimmer on touch |
| `src/components/Splash/index.tsx` | Click-to-enter veil, unlocks audio |
| `src/components/MusicDebug/index.tsx` | `?debug` overlay (lamps, meters, metronome) |

## Adding a New Song

1. Drop the mp3 in `src/assets/audio/`.
2. Run `yarn beatmap <file.mp3>` — decodes it, analyzes it, and writes `src/audio/beatmaps/<id>.json`. Add an entry to `src/audio/beatmaps/overrides.json` first if the detected BPM/downbeat needs correcting.
3. Add a `TrackSource` entry to `src/audio/tracks.ts` (import the mp3 URL, `loadBeatMap` importing the generated JSON).
4. Run `yarn test` — `src/audio/tracks.test.ts` fails if any file in `src/assets/audio/*.mp3` doesn't have exactly one matching `TRACKS` entry with a committed beat map.

## Regenerating the Head

`src/assets/head.glb` is generated output: the stock "11091_FemaleHead" (`scripts/assets/base-head.glb`) with the owner's face transferred onto it from a single-view phone capture. To take a new capture:

1. Keep the capture outside the repo (it holds the owner's room and photo) and run `yarn headmap <capture.glb>`. It prints the landmarks it found (nose tip, chin, L), the alignment, and how many head vertices moved; every run starts from the base head, so reruns never compound, and the same inputs give byte-identical output.
2. Check the result from several angles in chrome. `--debug <dir>` writes `crop.glb` (the cropped capture with its photo — point `<dir>` outside the repo), `aligned.glb` and a `weights.glb` blend map for a viewer.
3. Tune with flags (`yarn headmap` alone prints them). Crop and blend sizes are in units of L, the nose-tip-to-chin height of each mesh, so they carry across capture scales; `--nose`/`--chin` override landmark detection when a capture confuses it. Bake flags you keep into the defaults in `scripts/headmap.ts`, so the no-flag run reproduces the committed head.

The output keeps the stock file's conventions (one node, z up, face toward +y, stock units, meshopt + quantised positions/normals), which is what `prepareModel` in `Head` assumes; the material is set in code.

## Deployment

Netlify. Build command: `yarn build`. Publish directory: `dist`. No functions.
