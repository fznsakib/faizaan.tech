# Music Engine & Build Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make faizaan.tech v2 build again and replace the broken live beat detector with a build-time beat map + audio-clock `MusicFrame` engine, fronted by a click-to-enter splash and a Doto transport line.

**Architecture:**
- **Beat maps:** an offline analyzer (pure TS, run by Node 23 type-stripping via `yarn beatmap`) turns each MP3 into a committed JSON beat map.
- **Engine:** the `MusicEngine` singleton plays tracks through Web Audio and derives every per-frame value from the `AudioContext` output clock plus the beat map.
- **Ticker:** a single rAF ticker owns `engine.update()`. React only sees coarse state through `useSyncExternalStore`.

**Tech Stack:** Vite 6, React 18, TypeScript 5.7 (strict), styled-components 6, @react-three/fiber, Web Audio API, Vitest 3, Node 23 (type stripping), macOS `afconvert`.

**Spec:** `docs/superpowers/specs/2026-09-25-music-engine-design.md`

## Global Constraints

**Toolchain and lint**
- Package manager: Yarn 1 (`yarn.lock` v1). Add dev deps with `yarn add -D`.
- `yarn beatmap` requires Node ≥ 23.6 (type stripping) and macOS (`afconvert`).
- TS is strict with `noUnusedLocals` / `noUnusedParameters`.
- ESLint `import/order` groups: builtin, external, internal, parent+sibling, index, object, type. A blank line between groups, alphabetized, and `import type` for type-only imports (`consistent-type-imports`).
- Match the existing style: double quotes, semicolons, 2-space indent, `React.FC` components, a `*.styled.ts` file per component.

**Code boundaries**
- `src/audio/analysis/*` and `src/audio/frame.ts` are pure: no DOM, Node or Web Audio APIs.
- `src/audio/analysis/*` uses erasable TS syntax only (no enums, namespaces or parameter properties) and relative imports with an explicit `.ts` extension.
- No per-frame React state. Per-frame data flows only through `engine.frame` / `useMusicFrame`.
- Only the ticker calls `engine.update`.

**Constants (verbatim from the spec)**

| What | Value |
|---|---|
| Onset decays (kick / snare / hat) | 0.18 / 0.14 / 0.07 s |
| Live bands | 6, log-spaced 40 Hz–16 kHz |
| Band dB range | [−90, −20] → 0..1 |
| Band running peak | decay 0.995 per frame, floor 0.25 |
| Band analyser | fftSize 1024, smoothing 0 |
| Schedule-ahead | 0.05 s |
| Mute ramp | 10 ms |
| Splash veil | `rgba(20,61,50,0.82)`, blur 8 px, 600 ms fade |
| Default `beat0Shift` | +0.013 s |
| Section hysteresis | up > 0.6, down < 0.45 |
| Section curve | 4-bar centred moving average of energy, renormalised p5→0 / p95→1, span floor 0.1 |

**Reference ground truth**

| Track | BPM | `beat0` | `downbeatMod` |
|---|---|---|---|
| empty-lightning | 113.01 | 0.030 s | 0 |
| etaki | 149.98 | 0.385 s | 3 |

**Commits:** every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Keys on the splash.** With focus on "enter", on "enter without sound", or on the body, pressing Enter or Space must start exactly one source, and the transport's Space handler must not immediately pause it. Pinned in Task 8, Step 7.
2. **Rapid "next" while a track is loading.** A skipped track that finishes decoding late must not start playing or change status. Pinned in Task 6, test "ignores a skipped track that finishes loading late".
3. **Pausing within the 50 ms schedule-ahead window.** This must keep the start position, not jump to `from − 0.05`. Pinned in Task 6, test "pausing before the scheduled start keeps the start position".
4. **Returning to a tab hidden for minutes.** There must be exactly one beat edge, and the envelopes must reflect the new position. Pinned in Task 2, test "reports a single edge after a long forward jump".
5. **Mute across an automatic track advance.** Mute must survive the advance with no gain events added. Pinned in Task 6, test "mute ramps the mute gain and survives track changes".

---

### Task 1: Production build fix

**Files:**
- Modify: `src/components/Head/index.tsx` (import the OBJ via `?url`)
- Modify: `src/App.tsx` (import the 5 PNGs)
- Modify: `src/components/MusicPlayer/MusicAnalyser.ts:1-12` (drop unused field)
- Delete: `src/components/MusicPlayer/MusicAnalyzer.ts`
- Modify: `vite.config.ts` (import order, via `eslint --fix`)

**Interfaces:**
- Consumes: nothing.
- Produces: a green `yarn build`. Assets are emitted into `dist/assets/` with hashed names.

- [ ] **Step 1: Confirm the failure**

Run: `yarn build`
Expected: FAIL with `TS6133: 'audioContext' is declared but its value is never read` in `MusicAnalyser.ts` and `MusicAnalyzer.ts`.

- [ ] **Step 2: Import the head model as a URL**

In `src/components/Head/index.tsx`, add the import as its own group, between the external imports and `import type { Group } from "three";`:

```tsx
import { OBJLoader } from "three/examples/jsm/Addons.js";

import headModelUrl from "../../assets/head.obj?url";

import type { Group } from "three";
```

Replace the loader call's first argument, currently `"/src/assets/head.obj",` plus its trailing comment, with:

```tsx
      headModelUrl,
```

- [ ] **Step 3: Import the social icons as modules**

In `src/App.tsx`, replace the import block (lines 1–12) with:

```tsx
import { Canvas } from "@react-three/fiber";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import githubIcon from "./assets/github.png";
import gmailIcon from "./assets/gmail.png";
import letterboxdIcon from "./assets/letterboxd.png";
import linkedinIcon from "./assets/linkedin.png";
import stravaIcon from "./assets/strava.png";
import AnimatedElement from "./components/AnimatedElement";
import Background from "./components/Background";
import GlassPanel from "./components/GlassPanel";
import Head from "./components/Head";
import MusicPlayer from "./components/MusicPlayer";
import PixelIcon from "./components/PixelIcon";
import { AudioProvider } from "./context/AudioContext";
import { theme } from "./styles/theme";
```

Then change the five `imagePath` props:

- `imagePath="src/assets/linkedin.png"` → `imagePath={linkedinIcon}`
- `imagePath="src/assets/gmail.png"` → `imagePath={gmailIcon}`
- `imagePath="src/assets/github.png"` → `imagePath={githubIcon}`
- `imagePath="src/assets/letterboxd.png"` → `imagePath={letterboxdIcon}`
- `imagePath="src/assets/strava.png"` → `imagePath={stravaIcon}`

- [ ] **Step 4: Remove the dead analyser and the unused field**

Run: `git rm src/components/MusicPlayer/MusicAnalyzer.ts`

In `src/components/MusicPlayer/MusicAnalyser.ts`, delete the line `  private audioContext: AudioContext;` and the line `    this.audioContext = audioContext;`. The constructor keeps its `audioContext` parameter because it still calls `audioContext.createAnalyser()`.

- [ ] **Step 5: Fix import order**

Run: `node node_modules/eslint/bin/eslint.js --fix vite.config.ts src/App.tsx src/components/Head/index.tsx`
Expected: no errors reported for these three files.

- [ ] **Step 6: Build and check the emitted assets**

Run: `yarn build && ls dist/assets`
Expected: exit 0. The listing contains `head-*.obj`, `github-*.png`, `gmail-*.png`, `letterboxd-*.png`, `linkedin-*.png`, `strava-*.png` and `empty-lightning-*.mp3`. The only warning is the >500 kB chunk-size warning.

- [ ] **Step 7: Serve the build and confirm no 404s**

Run: `(node node_modules/vite/bin/vite.js preview --port 4173 --strictPort > /dev/null 2>&1 &) ; sleep 2; for f in dist/assets/*; do curl -s -o /dev/null -w "%{http_code} $(basename $f)\n" "http://localhost:4173/assets/$(basename $f)"; done; kill $(lsof -tiTCP:4173 -sTCP:LISTEN)`
Expected: every line starts with `200`.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/Head/index.tsx src/App.tsx src/components/MusicPlayer vite.config.ts
git commit -m "fix: make the production build pass and bundle the head and icons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared types, frame math and Vitest

**Files:**
- Modify: `package.json` (devDependencies + `test` script)
- Modify: `vite.config.ts` (Vitest config)
- Create: `src/audio/types.ts`
- Create: `src/audio/frame.ts`
- Test: `src/audio/frame.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `types.ts`: `BeatMap`, `OnsetBand`, `MusicFrame`, `EngineStatus`, `EngineState`, `TrackSource` (exact shapes below).
  - `frame.ts`:
    - `ONSET_DECAY: Record<OnsetBand, number>`
    - `BAND_COUNT = 6`
    - `interface FrameCursors { kick: number; snare: number; hat: number; lastBeat: number | null }`
    - `createCursors(): FrameCursors`
    - `createFrame(): MusicFrame`
    - `clearFrame(frame, time, isPlaying): MusicFrame`
    - `sampleCurve(curve: number[], fps: number, t: number): number`
    - `onsetEnvelope(events: number[], t: number, cursors: FrameCursors, band: OnsetBand): number`
    - `writeFrame(frame: MusicFrame, map: BeatMap, t: number, playing: boolean, cursors: FrameCursors): MusicFrame`

- [ ] **Step 1: Add Vitest and Node types**

Run: `yarn add -D vitest@^3.2.7 @types/node@^22`

In `package.json` `scripts`, add after `"preview"`:

```json
    "test": "vitest run"
```

(Add a comma after the preceding `"preview": "vite preview"` entry.)

Replace `vite.config.ts` with:

```ts
/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          [
            "babel-plugin-styled-components",
            {
              displayName: true,
              fileName: false,
            },
          ],
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the shared types**

Create `src/audio/types.ts`:

```ts
/** Onset bands carried in a beat map. */
export type OnsetBand = "kick" | "snare" | "hat";

/** Precomputed per-track timing data, generated by `yarn beatmap`. */
export interface BeatMap {
  id: string;
  version: number;
  /** Seconds. */
  duration: number;
  /** Constant tempo. */
  bpm: number;
  /** Seconds of beat index 0 (includes beat0Shift). */
  beat0: number;
  beatsPerBar: number;
  /** beatIndex ≡ downbeatMod (mod beatsPerBar) is a downbeat. */
  downbeatMod: number;
  /** 0..1; committed maps are 1. */
  confidence: number;
  curveFps: number;
  /** 0..255 loudness at curveFps. */
  energy: number[];
  /** 0..255 slow intensity at curveFps. */
  section: number[];
  /** Per bar index ≥ 0: 0 calm, 1 intense. */
  barLevels: number[];
  /** Flat [t0, s0, t1, s1, …]: t in seconds, s 0..1. */
  onsets: Record<OnsetBand, number[]>;
}

/** Everything visuals need for one animation frame. Mutated in place; read, never keep. */
export interface MusicFrame {
  /** Song seconds at the moment this frame is seen (latency-compensated). */
  time: number;
  isPlaying: boolean;
  bpm: number;
  /** Continuous beat position; negative before beat0. */
  beat: number;
  beatIndex: number;
  /** 0..1, 0 = on the beat. */
  beatPhase: number;
  barIndex: number;
  /** 0..1, 0 = downbeat. */
  barPhase: number;
  /** True only on the frame a beat boundary was crossed. */
  beatCrossed: boolean;
  /** beatCrossed && the crossed beat is a downbeat. */
  isDownbeat: boolean;
  timeToNextBeat: number;
  kick: number;
  snare: number;
  hat: number;
  energy: number;
  section: number;
  sectionLevel: 0 | 1;
  /** isDownbeat && sectionLevel differs from the previous bar's. */
  sectionChanged: boolean;
  /** 6 live bands, 0..1, texture only. */
  bands: Float32Array;
  beatConfidence: number;
}

export type EngineStatus = "idle" | "loading" | "ready" | "error";

/** Coarse engine state for React (via useSyncExternalStore). */
export interface EngineState {
  status: EngineStatus;
  unlocked: boolean;
  track: string | null;
  title: string | null;
  bpm: number | null;
  isPlaying: boolean;
  muted: boolean;
}

export interface TrackSource {
  id: string;
  title: string;
  url: string;
  loadBeatMap: () => Promise<BeatMap | null>;
}
```

- [ ] **Step 3: Write the failing frame tests**

Create `src/audio/frame.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  clearFrame,
  createCursors,
  createFrame,
  onsetEnvelope,
  sampleCurve,
  writeFrame,
} from "./frame";

import type { BeatMap } from "./types";

// 120 BPM → 0.5 s beats; beat 0 at 0.5 s; bar 0 starts on beat 1 (t = 1.0 s); bars last 2 s.
const map: BeatMap = {
  id: "test",
  version: 1,
  duration: 20,
  bpm: 120,
  beat0: 0.5,
  beatsPerBar: 4,
  downbeatMod: 1,
  confidence: 1,
  curveFps: 10,
  energy: [0, 255, 0],
  section: [0, 255],
  barLevels: [0, 1, 1, 0],
  onsets: { kick: [1.0, 0.8, 1.5, 0.5], snare: [], hat: [] },
};

function frameAt(times: number[], playing = true) {
  const frame = createFrame();
  const cursors = createCursors();
  for (const t of times) writeFrame(frame, map, t, playing, cursors);
  return frame;
}

describe("writeFrame beat and bar position", () => {
  it("places beat 0 at beat0 as the last beat of bar -1", () => {
    const f = frameAt([0.5]);
    expect(f.beat).toBeCloseTo(0);
    expect(f.beatIndex).toBe(0);
    expect(f.beatPhase).toBeCloseTo(0);
    expect(f.barIndex).toBe(-1);
    expect(f.barPhase).toBeCloseTo(0.75);
  });

  it("starts bar 0 on the downbeat", () => {
    const f = frameAt([1.0]);
    expect(f.beatIndex).toBe(1);
    expect(f.barIndex).toBe(0);
    expect(f.barPhase).toBeCloseTo(0);
  });

  it("reports phases and time to the next beat mid-beat", () => {
    const f = frameAt([1.25]);
    expect(f.time).toBe(1.25);
    expect(f.bpm).toBe(120);
    expect(f.beatPhase).toBeCloseTo(0.5);
    expect(f.barPhase).toBeCloseTo(0.125);
    expect(f.timeToNextBeat).toBeCloseTo(0.25);
  });

  it("is negative before beat0", () => {
    const f = frameAt([0.25]);
    expect(f.beat).toBeCloseTo(-0.5);
    expect(f.beatIndex).toBe(-1);
  });
});

describe("writeFrame edges", () => {
  it("does not report an edge on the first frame", () => {
    expect(frameAt([1.01]).beatCrossed).toBe(false);
  });

  it("reports beatCrossed and isDownbeat only on the crossing frame", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 0.9, true, cursors);
    writeFrame(frame, map, 1.01, true, cursors);
    expect(frame.beatCrossed).toBe(true);
    expect(frame.isDownbeat).toBe(true);
    writeFrame(frame, map, 1.02, true, cursors);
    expect(frame.beatCrossed).toBe(false);
    expect(frame.isDownbeat).toBe(false);
    writeFrame(frame, map, 1.51, true, cursors);
    expect(frame.beatCrossed).toBe(true);
    expect(frame.isDownbeat).toBe(false);
  });

  it("reports a single edge after a long forward jump", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 1.1, true, cursors);
    writeFrame(frame, map, 13.2, true, cursors);
    expect(frame.beatCrossed).toBe(true);
    expect(frame.kick).toBeCloseTo(0);
    writeFrame(frame, map, 13.21, true, cursors);
    expect(frame.beatCrossed).toBe(false);
  });

  it("reports no edges while paused", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 0.9, false, cursors);
    writeFrame(frame, map, 1.01, false, cursors);
    expect(frame.beatCrossed).toBe(false);
    expect(frame.isPlaying).toBe(false);
  });
});

describe("section levels", () => {
  it("reads sectionLevel from barLevels and flags the changing downbeat", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 2.99, true, cursors);
    expect(frame.sectionLevel).toBe(0);
    writeFrame(frame, map, 3.01, true, cursors);
    expect(frame.isDownbeat).toBe(true);
    expect(frame.sectionLevel).toBe(1);
    expect(frame.sectionChanged).toBe(true);
    writeFrame(frame, map, 4.99, true, cursors);
    writeFrame(frame, map, 5.01, true, cursors);
    expect(frame.isDownbeat).toBe(true);
    expect(frame.sectionChanged).toBe(false);
  });

  it("is 0 before bar 0 and clamps past the last bar", () => {
    expect(frameAt([0.6]).sectionLevel).toBe(0);
    expect(frameAt([19]).sectionLevel).toBe(0);
  });
});

describe("onset envelopes", () => {
  it("attacks instantly and decays exponentially", () => {
    expect(frameAt([0.99]).kick).toBe(0);
    expect(frameAt([1.0]).kick).toBeCloseTo(0.8);
    expect(frameAt([1.18]).kick).toBeCloseTo(0.8 * Math.exp(-1));
    expect(frameAt([1.5]).kick).toBeCloseTo(0.5);
  });

  it("rewinds when time goes backwards", () => {
    const cursors = createCursors();
    const events = map.onsets.kick;
    onsetEnvelope(events, 1.6, cursors, "kick");
    expect(onsetEnvelope(events, 0.9, cursors, "kick")).toBe(0);
    expect(onsetEnvelope(events, 1.0, cursors, "kick")).toBeCloseTo(0.8);
  });

  it("is silent while paused", () => {
    const f = frameAt([1.0], false);
    expect(f.kick).toBe(0);
    expect(f.beatConfidence).toBe(0);
  });
});

describe("curves and clearing", () => {
  it("interpolates 0..255 curves to 0..1", () => {
    expect(sampleCurve([0, 255, 0], 10, 0.05)).toBeCloseTo(0.5);
    expect(sampleCurve([0, 255, 0], 10, 0.1)).toBeCloseTo(1);
    expect(sampleCurve([0, 255, 0], 10, 99)).toBe(0);
    expect(sampleCurve([], 10, 1)).toBe(0);
  });

  it("writes energy, section and confidence from the map", () => {
    const f = frameAt([0.05]);
    expect(f.energy).toBeCloseTo(0.5);
    expect(f.section).toBeCloseTo(0.5);
    expect(frameAt([1.0]).beatConfidence).toBe(1);
  });

  it("clearFrame zeroes musical fields but keeps time and playing", () => {
    const f = frameAt([1.0]);
    clearFrame(f, 3, true);
    expect(f.time).toBe(3);
    expect(f.isPlaying).toBe(true);
    expect(f.bpm).toBe(0);
    expect(f.kick).toBe(0);
    expect(f.beatConfidence).toBe(0);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `yarn test src/audio/frame.test.ts`
Expected: FAIL, `Failed to resolve import "./frame"`.

- [ ] **Step 5: Implement `frame.ts`**

Create `src/audio/frame.ts`:

```ts
import type { BeatMap, MusicFrame, OnsetBand } from "./types";

/** Onset envelope decay time constants, seconds. */
export const ONSET_DECAY: Record<OnsetBand, number> = {
  kick: 0.18,
  snare: 0.14,
  hat: 0.07,
};

export const BAND_COUNT = 6;

const ONSET_BANDS: OnsetBand[] = ["kick", "snare", "hat"];

/** Scan state for one playback run. Reset it on play, seek and track switch. */
export interface FrameCursors {
  kick: number;
  snare: number;
  hat: number;
  lastBeat: number | null;
}

export function createCursors(): FrameCursors {
  return { kick: 0, snare: 0, hat: 0, lastBeat: null };
}

export function createFrame(): MusicFrame {
  return {
    time: 0,
    isPlaying: false,
    bpm: 0,
    beat: 0,
    beatIndex: 0,
    beatPhase: 0,
    barIndex: 0,
    barPhase: 0,
    beatCrossed: false,
    isDownbeat: false,
    timeToNextBeat: 0,
    kick: 0,
    snare: 0,
    hat: 0,
    energy: 0,
    section: 0,
    sectionLevel: 0,
    sectionChanged: false,
    bands: new Float32Array(BAND_COUNT),
    beatConfidence: 0,
  };
}

/** Zero every musical field (no beat map); keeps `time`, `isPlaying` and `bands`. */
export function clearFrame(
  frame: MusicFrame,
  time: number,
  isPlaying: boolean
): MusicFrame {
  frame.time = time;
  frame.isPlaying = isPlaying;
  frame.bpm = 0;
  frame.beat = 0;
  frame.beatIndex = 0;
  frame.beatPhase = 0;
  frame.barIndex = 0;
  frame.barPhase = 0;
  frame.beatCrossed = false;
  frame.isDownbeat = false;
  frame.timeToNextBeat = 0;
  frame.kick = 0;
  frame.snare = 0;
  frame.hat = 0;
  frame.energy = 0;
  frame.section = 0;
  frame.sectionLevel = 0;
  frame.sectionChanged = false;
  frame.beatConfidence = 0;
  return frame;
}

/** Interpolate a 0..255 curve sampled at `fps` to a 0..1 value at time `t`. */
export function sampleCurve(curve: number[], fps: number, t: number): number {
  if (curve.length === 0) return 0;
  const x = Math.max(0, t * fps);
  const i = Math.floor(x);
  const a = curve[Math.min(i, curve.length - 1)];
  const b = curve[Math.min(i + 1, curve.length - 1)];
  return (a + (b - a) * (x - i)) / 255;
}

/** Envelope for flat [t, strength, …] events: instant attack, exponential decay. Advances `cursors[band]`. */
export function onsetEnvelope(
  events: number[],
  t: number,
  cursors: FrameCursors,
  band: OnsetBand
): number {
  let c = cursors[band];
  if (c > 0 && events[c - 2] > t) c = 0; // time went backwards (seek)
  while (c < events.length && events[c] <= t) c += 2;
  cursors[band] = c;
  if (c === 0) return 0;
  return events[c - 1] * Math.exp(-(t - events[c - 2]) / ONSET_DECAY[band]);
}

const mod = (value: number, n: number) => ((value % n) + n) % n;

function levelAt(map: BeatMap, bar: number): 0 | 1 {
  if (bar < 0 || map.barLevels.length === 0) return 0;
  return map.barLevels[Math.min(bar, map.barLevels.length - 1)] === 1 ? 1 : 0;
}

/** Write every beat-map-derived field for song time `t` (everything except `bands`). */
export function writeFrame(
  frame: MusicFrame,
  map: BeatMap,
  t: number,
  playing: boolean,
  cursors: FrameCursors
): MusicFrame {
  const period = 60 / map.bpm;
  const beat = (t - map.beat0) / period;
  const beatIndex = Math.floor(beat);
  const relative = beatIndex - map.downbeatMod;
  const barIndex = Math.floor(relative / map.beatsPerBar);

  frame.time = t;
  frame.isPlaying = playing;
  frame.bpm = map.bpm;
  frame.beat = beat;
  frame.beatIndex = beatIndex;
  frame.beatPhase = beat - beatIndex;
  frame.barIndex = barIndex;
  frame.barPhase =
    (beat - map.downbeatMod - barIndex * map.beatsPerBar) / map.beatsPerBar;
  frame.timeToNextBeat = (1 - frame.beatPhase) * period;

  const crossed =
    playing &&
    cursors.lastBeat !== null &&
    beatIndex > cursors.lastBeat &&
    beatIndex >= 0;
  cursors.lastBeat = beatIndex;
  frame.beatCrossed = crossed;
  frame.isDownbeat = crossed && mod(relative, map.beatsPerBar) === 0;

  frame.energy = sampleCurve(map.energy, map.curveFps, t);
  frame.section = sampleCurve(map.section, map.curveFps, t);
  frame.sectionLevel = levelAt(map, barIndex);
  frame.sectionChanged =
    frame.isDownbeat && frame.sectionLevel !== levelAt(map, barIndex - 1);

  for (const band of ONSET_BANDS) {
    frame[band] = playing ? onsetEnvelope(map.onsets[band], t, cursors, band) : 0;
  }
  frame.beatConfidence = playing ? map.confidence : 0;
  return frame;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `yarn test src/audio/frame.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 7: Type-check**

Run: `node node_modules/typescript/bin/tsc -b`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add package.json yarn.lock vite.config.ts src/audio/types.ts src/audio/frame.ts src/audio/frame.test.ts
git commit -m "feat(audio): add MusicFrame types and pure beat/bar frame math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: FFT and track analyzer

**Files:**
- Create: `src/audio/analysis/fft.ts`
- Create: `src/audio/analysis/analyzeTrack.ts`
- Test: `src/audio/analysis/fft.test.ts`
- Test: `src/audio/analysis/analyzeTrack.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createFFT(size: number): (re: Float64Array, im: Float64Array) => void` (in-place; throws on a non-power-of-two size).
  - `WINDOW_SIZE = 2048`
  - `type AnalysisBand = "kick" | "snare" | "hat" | "full"`
  - `interface Analysis { sampleRate: number; duration: number; onsetFps: number; frameOffset: number; bpm: number; phase: number; downbeatMod: number; loudness: Float32Array; env: Record<AnalysisBand, Float32Array> }`
  - `analyzeTrack(pcm: Float32Array, sampleRate: number): Analysis`

- [ ] **Step 1: Write the failing tests**

Create `src/audio/analysis/fft.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createFFT } from "./fft.ts";

describe("createFFT", () => {
  it("puts a cosine's energy in its bin and the mirror bin", () => {
    const n = 16;
    const fft = createFFT(n);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 4 * i) / n);
    fft(re, im);
    const magnitude = Array.from(re, (r, k) => Math.hypot(r, im[k]));
    expect(magnitude[4]).toBeCloseTo(8, 6);
    expect(magnitude[12]).toBeCloseTo(8, 6);
    magnitude.forEach((m, k) => {
      if (k !== 4 && k !== 12) expect(m).toBeCloseTo(0, 6);
    });
  });

  it("rejects sizes that are not powers of two", () => {
    expect(() => createFFT(12)).toThrow(/power of two/);
  });
});
```

Create `src/audio/analysis/analyzeTrack.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { analyzeTrack, WINDOW_SIZE } from "./analyzeTrack.ts";

/** A deterministic click track: decaying 60 Hz thump + noise burst on every beat. */
function clickTrack(bpm: number, firstBeat: number, seconds: number, sampleRate: number) {
  const pcm = new Float32Array(Math.round(seconds * sampleRate));
  const period = 60 / bpm;
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 1073741824 - 1;
  };
  for (let t = firstBeat; t < seconds; t += period) {
    const start = Math.round(t * sampleRate);
    for (let i = 0; i < sampleRate * 0.08 && start + i < pcm.length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.015));
      pcm[start + i] +=
        decay * (0.8 * Math.sin((2 * Math.PI * 60 * i) / sampleRate) + 0.2 * noise());
    }
  }
  return pcm;
}

describe("analyzeTrack", () => {
  // 44.1 kHz like the real tracks: the 2048-sample window is 46 ms, so the flux peak lands
  // ≤ ~40 ms before the click and the +13 ms shift brings it inside the 50 ms tolerance.
  const sampleRate = 44100;
  const analysis = analyzeTrack(clickTrack(120, 0.25, 20, sampleRate), sampleRate);

  it("finds the tempo", () => {
    expect(Math.abs(analysis.bpm - 120)).toBeLessThanOrEqual(0.1);
  });

  it("finds the beat phase (after the default +13 ms shift) within 50 ms", () => {
    const period = 60 / analysis.bpm;
    const raw = analysis.phase + 0.013 - 0.25;
    const offset = ((raw % period) + period * 1.5) % period - period / 2;
    expect(Math.abs(offset)).toBeLessThan(0.05);
  });

  it("reports frame timing and per-band envelopes", () => {
    expect(analysis.duration).toBeCloseTo(20);
    expect(analysis.onsetFps).toBeCloseTo(sampleRate / Math.round(sampleRate / 100));
    expect(analysis.frameOffset).toBeCloseTo(WINDOW_SIZE / 2 / sampleRate);
    expect(analysis.env.kick.length).toBe(analysis.loudness.length);
    expect(Math.max(...analysis.env.kick)).toBeGreaterThan(0);
    expect(analysis.downbeatMod).toBeGreaterThanOrEqual(0);
    expect(analysis.downbeatMod).toBeLessThan(4);
  });

  it("handles audio shorter than one window", () => {
    const short = analyzeTrack(new Float32Array(100), 44100);
    expect(short.loudness.length).toBe(0);
    expect(short.downbeatMod).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/audio/analysis`
Expected: FAIL, `Failed to resolve import "./fft.ts"` and `"./analyzeTrack.ts"`.

- [ ] **Step 3: Implement the FFT**

Create `src/audio/analysis/fft.ts`:

```ts
/** Returns an in-place iterative radix-2 FFT for arrays of length `size` (a power of two). */
export function createFFT(size: number): (re: Float64Array, im: Float64Array) => void {
  const bits = Math.log2(size);
  if (!Number.isInteger(bits)) {
    throw new Error(`FFT size must be a power of two, got ${size}`);
  }
  const reversed = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let r = 0;
    for (let j = 0; j < bits; j++) r |= ((i >> j) & 1) << (bits - 1 - j);
    reversed[i] = r;
  }

  return (re, im) => {
    for (let i = 0; i < size; i++) {
      const j = reversed[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    for (let span = 2; span <= size; span <<= 1) {
      const half = span >> 1;
      const angle = (-2 * Math.PI) / span;
      const wr = Math.cos(angle);
      const wi = Math.sin(angle);
      for (let start = 0; start < size; start += span) {
        let cr = 1;
        let ci = 0;
        for (let j = 0; j < half; j++) {
          const u = start + j;
          const v = u + half;
          const tr = re[v] * cr - im[v] * ci;
          const ti = re[v] * ci + im[v] * cr;
          re[v] = re[u] - tr;
          im[v] = im[u] - ti;
          re[u] += tr;
          im[u] += ti;
          const next = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = next;
        }
      }
    }
  };
}
```

- [ ] **Step 4: Implement the analyzer**

Create `src/audio/analysis/analyzeTrack.ts`:

```ts
import { createFFT } from "./fft.ts";

export const WINDOW_SIZE = 2048;

const BAND_RANGES = {
  kick: [30, 150],
  snare: [150, 4000],
  hat: [6000, 16000],
  full: [30, 16000],
} as const;

export type AnalysisBand = keyof typeof BAND_RANGES;

export interface Analysis {
  sampleRate: number;
  duration: number;
  /** STFT frames per second (≈100). */
  onsetFps: number;
  /** Seconds from a frame's start to its centre (WINDOW_SIZE / 2 / sampleRate). */
  frameOffset: number;
  bpm: number;
  /** First grid beat in seconds, frame-start time base (before beat0Shift). */
  phase: number;
  downbeatMod: number;
  /** Mean log-magnitude over the full band, per frame. */
  loudness: Float32Array;
  /** Detrended, rectified spectral flux per band, per frame. */
  env: Record<AnalysisBand, Float32Array>;
}

interface Grid {
  bpm: number;
  phase: number;
  score: number;
}

const BANDS = Object.keys(BAND_RANGES) as AnalysisBand[];

/** Offline beat analysis: band spectral flux → ACF tempo → grid fit → downbeat vote. */
export function analyzeTrack(pcm: Float32Array, sampleRate: number): Analysis {
  const hop = Math.round(sampleRate / 100);
  const fps = sampleRate / hop;
  const duration = pcm.length / sampleRate;
  const { flux, loudness } = spectralFlux(pcm, sampleRate, hop);
  const env: Record<AnalysisBand, Float32Array> = {
    kick: detrend(flux.kick, 50),
    snare: detrend(flux.snare, 50),
    hat: detrend(flux.hat, 50),
    full: detrend(flux.full, 50),
  };
  const onset = new Float32Array(env.full.length);
  for (let i = 0; i < onset.length; i++) {
    onset[i] = env.full[i] + env.kick[i] + 0.5 * env.snare[i];
  }
  const grid = fitGrid(onset, fps, duration, estimateTempo(onset, fps));
  return {
    sampleRate,
    duration,
    onsetFps: fps,
    frameOffset: WINDOW_SIZE / 2 / sampleRate,
    bpm: grid.bpm,
    phase: grid.phase,
    downbeatMod: estimateDownbeat(env, fps, duration, grid),
    loudness,
    env,
  };
}

function spectralFlux(pcm: Float32Array, sampleRate: number, hop: number) {
  const n = WINDOW_SIZE;
  const half = n / 2;
  const frames = Math.max(0, Math.floor((pcm.length - n) / hop));
  const fft = createFFT(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const window = new Float32Array(n);
  for (let i = 0; i < n; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  const binHz = sampleRate / n;
  const ranges = BANDS.map((band) => [
    Math.ceil(BAND_RANGES[band][0] / binHz),
    Math.min(half - 1, Math.floor(BAND_RANGES[band][1] / binHz)),
  ]);
  const flux: Record<AnalysisBand, Float32Array> = {
    kick: new Float32Array(frames),
    snare: new Float32Array(frames),
    hat: new Float32Array(frames),
    full: new Float32Array(frames),
  };
  const loudness = new Float32Array(frames);
  let previous = new Float32Array(half);
  let current = new Float32Array(half);

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < n; i++) {
      re[i] = pcm[start + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < half; k++) {
      current[k] = Math.log1p(100 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
    }
    for (let b = 0; b < BANDS.length; b++) {
      const [lo, hi] = ranges[b];
      let rise = 0;
      let sum = 0;
      for (let k = lo; k <= hi; k++) {
        const d = current[k] - previous[k];
        if (d > 0) rise += d;
        sum += current[k];
      }
      flux[BANDS[b]][f] = rise / (hi - lo + 1);
      if (BANDS[b] === "full") loudness[f] = sum / (hi - lo + 1);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return { flux, loudness };
}

/** Subtract a trailing moving average of `width` frames and rectify. */
function detrend(values: Float32Array, width: number): Float32Array {
  const out = new Float32Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= width) sum -= values[i - width];
    out[i] = Math.max(0, values[i] - sum / Math.min(i + 1, width));
  }
  return out;
}

/** Autocorrelation tempo over 60–200 BPM (0.5 steps) with a log-Gaussian prior at 120 BPM. */
function estimateTempo(onset: Float32Array, fps: number): number {
  let best = 120;
  let bestScore = -Infinity;
  for (let bpm = 60; bpm <= 200; bpm += 0.5) {
    const lag = (60 * fps) / bpm;
    const whole = Math.floor(lag);
    const frac = lag - whole;
    let sum = 0;
    for (let i = 0; i + whole + 1 < onset.length; i++) {
      sum += onset[i] * (onset[i + whole] * (1 - frac) + onset[i + whole + 1] * frac);
    }
    const score = sum * Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  return best;
}

/** Mean onset strength (±1 frame) at grid lines phase + k·period within [from, to). */
function gridScore(
  onset: Float32Array,
  fps: number,
  bpm: number,
  phase: number,
  from: number,
  to: number
): number {
  const period = 60 / bpm;
  let sum = 0;
  let count = 0;
  for (let t = phase + Math.ceil((from - phase) / period) * period; t < to; t += period) {
    const i = Math.floor(t * fps);
    if (i < 1 || i + 2 >= onset.length) continue;
    sum += Math.max(onset[i - 1], onset[i], onset[i + 1]);
    count++;
  }
  return count ? sum / count : 0;
}

/** Search ±2 BPM around the ACF estimate (0.01 steps) × phase (2 ms steps), then refine phase to 0.5 ms. */
function fitGrid(onset: Float32Array, fps: number, duration: number, center: number): Grid {
  let best: Grid = { bpm: center, phase: 0, score: -1 };
  for (let step = -200; step <= 200; step++) {
    const bpm = center + step * 0.01;
    const period = 60 / bpm;
    for (let phase = 0; phase < period; phase += 0.002) {
      const score = gridScore(onset, fps, bpm, phase, 0, duration);
      if (score > best.score) best = { bpm, phase, score };
    }
  }
  const period = 60 / best.bpm;
  for (let phase = best.phase - 0.004; phase <= best.phase + 0.004; phase += 0.0005) {
    const wrapped = ((phase % period) + period) % period;
    const score = gridScore(onset, fps, best.bpm, wrapped, 0, duration);
    if (score > best.score) best = { ...best, phase: wrapped, score };
  }
  return best;
}

/** Vote for the beat-in-bar where the biggest 8-beat texture changes land (section changes fall on downbeats). */
function estimateDownbeat(
  env: Record<AnalysisBand, Float32Array>,
  fps: number,
  duration: number,
  grid: Grid
): number {
  const period = 60 / grid.bpm;
  const perBeat: number[] = [];
  for (let k = 0; grid.phase + (k + 1) * period < duration; k++) {
    const a = Math.round((grid.phase + k * period) * fps);
    const b = Math.round((grid.phase + (k + 1) * period) * fps);
    let sum = 0;
    for (let i = a; i < b && i < env.kick.length; i++) {
      sum += env.kick[i] + env.snare[i] + env.hat[i];
    }
    perBeat.push(sum / Math.max(1, b - a));
  }
  const width = 8;
  const novelty = perBeat.map((_, k) => {
    if (k < width || k + width > perBeat.length) return 0;
    let before = 0;
    let after = 0;
    for (let j = 1; j <= width; j++) {
      before += perBeat[k - j];
      after += perBeat[k + j - 1];
    }
    return Math.abs(after - before) / width;
  });
  const candidates = novelty
    .map((v, k) => ({ k, v }))
    .filter(({ k, v }) => v > 0 && v >= Math.max(...novelty.slice(Math.max(0, k - 4), k + 5)))
    .sort((x, y) => y.v - x.v)
    .slice(0, 12);
  const votes = [0, 0, 0, 0];
  for (const { k, v } of candidates) votes[k % 4] += v;
  return votes.indexOf(Math.max(...votes));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test src/audio/analysis`
Expected: PASS (6 tests, a few seconds).

- [ ] **Step 6: Type-check and lint**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js src/audio`
Expected: exit 0, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/audio/analysis
git commit -m "feat(audio): add offline beat analyzer (spectral flux, tempo, grid, downbeat)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Beat-map builder

**Files:**
- Create: `src/audio/analysis/buildBeatMap.ts`
- Test: `src/audio/analysis/buildBeatMap.test.ts`

**Interfaces:**
- Consumes: `Analysis` (Task 3); `BeatMap` (Task 2).
- Produces:
  - `interface BeatMapOverrides { beat0Shift?: number; downbeatMod?: number; bpm?: number }`
  - `DEFAULT_BEAT0_SHIFT = 0.013`
  - `CURVE_FPS = 10`
  - `buildBeatMap(id: string, analysis: Analysis, overrides?: BeatMapOverrides): BeatMap`

- [ ] **Step 1: Write the failing tests**

Create `src/audio/analysis/buildBeatMap.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildBeatMap, DEFAULT_BEAT0_SHIFT } from "./buildBeatMap.ts";

import type { Analysis } from "./analyzeTrack.ts";

/** 20 s at 100 fps: quiet first half, loud second half, a kick spike every 0.5 s from 0.1 s. */
function syntheticAnalysis(): Analysis {
  const frames = 2000;
  const loudness = new Float32Array(frames);
  for (let i = 0; i < frames; i++) loudness[i] = i < 1000 ? 1 : 5;
  const kick = new Float32Array(frames);
  for (let i = 10; i < frames - 1; i += 50) kick[i] = 1;
  kick[65] = 0.9; // 0.15 s after the spike at frame 60 → inside the 0.2 s kick min gap
  return {
    sampleRate: 44100,
    duration: 20,
    onsetFps: 100,
    frameOffset: 0.0232,
    bpm: 120,
    phase: 0.1,
    downbeatMod: 2,
    loudness,
    env: {
      kick,
      snare: new Float32Array(frames),
      hat: new Float32Array(frames),
      full: new Float32Array(frames),
    },
  };
}

describe("buildBeatMap", () => {
  it("applies the default beat0 shift and keeps the analysis tempo and downbeat", () => {
    const map = buildBeatMap("t", syntheticAnalysis());
    expect(map).toMatchObject({ id: "t", version: 1, bpm: 120, downbeatMod: 2, beatsPerBar: 4, confidence: 1, curveFps: 10 });
    expect(map.beat0).toBeCloseTo(0.1 + DEFAULT_BEAT0_SHIFT, 4);
  });

  it("applies overrides", () => {
    const map = buildBeatMap("t", syntheticAnalysis(), { beat0Shift: 0, downbeatMod: 1, bpm: 121 });
    expect(map.beat0).toBeCloseTo(0.1, 4);
    expect(map.downbeatMod).toBe(1);
    expect(map.bpm).toBe(121);
  });

  it("peak-picks onsets at frame centres and respects the minimum gap", () => {
    const { onsets } = buildBeatMap("t", syntheticAnalysis());
    expect(onsets.kick.length / 2).toBe(40);
    expect(onsets.kick[0]).toBeCloseTo(0.1232, 3);
    expect(onsets.kick[1]).toBe(1);
    expect(onsets.kick[2]).toBeCloseTo(0.6232, 3);
    expect(onsets.kick[4]).toBeCloseTo(1.1232, 3);
    expect(onsets.snare).toEqual([]);
  });

  it("normalises energy to 0..255 at 10 fps", () => {
    const { energy } = buildBeatMap("t", syntheticAnalysis());
    expect(energy).toHaveLength(200);
    expect(energy[0]).toBe(0);
    expect(energy[199]).toBe(255);
  });

  it("derives bar levels with hysteresis: calm first, intense after the change, no flapping", () => {
    const { barLevels, section } = buildBeatMap("t", syntheticAnalysis());
    expect(section).toHaveLength(200);
    expect(barLevels).toHaveLength(10);
    expect(barLevels[0]).toBe(0);
    expect(barLevels[barLevels.length - 1]).toBe(1);
    const firstIntense = barLevels.indexOf(1);
    expect(barLevels.slice(firstIntense).every((level) => level === 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/audio/analysis/buildBeatMap.test.ts`
Expected: FAIL, `Failed to resolve import "./buildBeatMap.ts"`.

- [ ] **Step 3: Implement the builder**

Create `src/audio/analysis/buildBeatMap.ts`:

```ts
import type { BeatMap, OnsetBand } from "../types.ts";
import type { Analysis } from "./analyzeTrack.ts";

export interface BeatMapOverrides {
  beat0Shift?: number;
  downbeatMod?: number;
  bpm?: number;
}

/** Measured median offset from the STFT-frame grid to the kick transient. */
export const DEFAULT_BEAT0_SHIFT = 0.013;
export const CURVE_FPS = 10;

const BEATS_PER_BAR = 4;
const SECTION_UP = 0.6;
const SECTION_DOWN = 0.45;

interface PeakOptions {
  k: number;
  floor: number;
  minGap: number;
}

const PEAKS: Record<OnsetBand, PeakOptions> = {
  kick: { k: 4, floor: 0.3, minGap: 0.2 },
  snare: { k: 3, floor: 0.08, minGap: 0.09 },
  hat: { k: 2.5, floor: 0.08, minGap: 0.06 },
};

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function percentile(values: ArrayLike<number>, q: number): number {
  if (values.length === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.floor(q * (sorted.length - 1))];
}

/** Turn an analysis into the committed runtime beat map. */
export function buildBeatMap(
  id: string,
  analysis: Analysis,
  overrides: BeatMapOverrides = {}
): BeatMap {
  const bpm = overrides.bpm ?? analysis.bpm;
  const beat0 = analysis.phase + (overrides.beat0Shift ?? DEFAULT_BEAT0_SHIFT);
  const downbeatMod = overrides.downbeatMod ?? analysis.downbeatMod;
  const energy = energyCurve(analysis.loudness, Math.max(1, Math.round(analysis.onsetFps / CURVE_FPS)));
  const section = sectionCurve(energy, bpm);
  return {
    id,
    version: 1,
    duration: round(analysis.duration, 3),
    bpm: round(bpm, 3),
    beat0: round(beat0, 4),
    beatsPerBar: BEATS_PER_BAR,
    downbeatMod,
    confidence: 1,
    curveFps: CURVE_FPS,
    energy: energy.map((v) => Math.round(v * 255)),
    section: section.map((v) => Math.round(v * 255)),
    barLevels: barLevels(section, bpm, beat0, downbeatMod, analysis.duration),
    onsets: {
      kick: pickOnsets(analysis.env.kick, analysis, PEAKS.kick),
      snare: pickOnsets(analysis.env.snare, analysis, PEAKS.snare),
      hat: pickOnsets(analysis.env.hat, analysis, PEAKS.hat),
    },
  };
}

/** Mean loudness per `factor` frames, normalised so p2 → 0 and p98 → 1 (clamped). */
function energyCurve(loudness: Float32Array, factor: number): number[] {
  const lo = percentile(loudness, 0.02);
  const span = percentile(loudness, 0.98) - lo || 1;
  const out: number[] = [];
  for (let i = 0; i < loudness.length; i += factor) {
    let sum = 0;
    let n = 0;
    for (let j = i; j < i + factor && j < loudness.length; j++) {
      sum += loudness[j];
      n++;
    }
    out.push(clamp01((sum / n - lo) / span));
  }
  return out;
}

/** Four-bar centred moving average of energy, renormalised so p5 → 0 and p95 → 1 (span floor 0.1). */
function sectionCurve(energy: number[], bpm: number): number[] {
  const width = Math.max(1, Math.round(4 * BEATS_PER_BAR * (60 / bpm) * CURVE_FPS));
  const smooth = energy.map((_, i) => {
    let sum = 0;
    let n = 0;
    const end = Math.min(energy.length, i + Math.ceil(width / 2));
    for (let j = Math.max(0, i - Math.floor(width / 2)); j < end; j++) {
      sum += energy[j];
      n++;
    }
    return n ? sum / n : 0;
  });
  const lo = percentile(smooth, 0.05);
  const span = Math.max(percentile(smooth, 0.95) - lo, 0.1);
  return smooth.map((v) => clamp01((v - lo) / span));
}

/** Per-bar level (0 calm, 1 intense) from the bar's mean section value, with hysteresis. */
function barLevels(
  section: number[],
  bpm: number,
  beat0: number,
  downbeatMod: number,
  duration: number
): number[] {
  const barSeconds = (BEATS_PER_BAR * 60) / bpm;
  const firstBar = beat0 + downbeatMod * (60 / bpm);
  const levels: number[] = [];
  let level = 0;
  for (let bar = 0; firstBar + bar * barSeconds < duration; bar++) {
    const start = firstBar + bar * barSeconds;
    const a = Math.max(0, Math.floor(start * CURVE_FPS));
    const b = Math.min(section.length, Math.max(a + 1, Math.floor((start + barSeconds) * CURVE_FPS)));
    let sum = 0;
    for (let i = a; i < b; i++) sum += section[i];
    const mean = b > a ? sum / (b - a) : 0;
    if (level === 0 && mean > SECTION_UP) level = 1;
    else if (level === 1 && mean < SECTION_DOWN) level = 0;
    levels.push(level);
  }
  return levels;
}

/** Peak-pick an onset envelope with a moving median + k·MAD threshold. Returns flat [t, strength, …]. */
function pickOnsets(env: Float32Array, analysis: Analysis, options: PeakOptions): number[] {
  const window = 100;
  const norm = percentile(env.filter((v) => v > 0), 0.98) || 1;
  const out: number[] = [];
  let last = -Infinity;
  for (let i = 1; i < env.length - 1; i++) {
    if (!(env[i] > env[i - 1] && env[i] >= env[i + 1])) continue;
    if (env[i] < options.floor * norm) continue;
    const local = env.subarray(Math.max(0, i - window / 2), Math.min(env.length, i + window / 2));
    const median = percentile(local, 0.5);
    const mad = percentile(Array.from(local, (v) => Math.abs(v - median)), 0.5);
    if (env[i] < median + options.k * mad) continue;
    const t = i / analysis.onsetFps + analysis.frameOffset;
    if (t - last < options.minGap) continue;
    last = t;
    out.push(round(t, 3), round(Math.min(1, env[i] / norm), 2));
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/audio/analysis`
Expected: PASS (11 tests).

- [ ] **Step 5: Type-check and lint**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js src/audio`
Expected: exit 0, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/audio/analysis/buildBeatMap.ts src/audio/analysis/buildBeatMap.test.ts
git commit -m "feat(audio): build runtime beat maps (onsets, energy/section curves, bar levels)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `yarn beatmap` CLI, real-track verification, committed beat maps

**Files:**
- Create: `scripts/decode.ts`
- Test: `scripts/decode.test.ts`
- Create: `scripts/beatmap.ts`
- Test: `scripts/analyzeTrack.real.test.ts`
- Create: `src/audio/beatmaps/overrides.json`
- Create (generated): `src/audio/beatmaps/empty-lightning.json`, `src/audio/beatmaps/etaki.json`
- Modify: `package.json` (`beatmap` script)
- Modify: `tsconfig.node.json` (include `scripts`, Node types)

**Interfaces:**
- Consumes: `analyzeTrack` (Task 3), `buildBeatMap` and `BeatMapOverrides` (Task 4).
- Produces:
  - `parseWav(buffer: Buffer): { pcm: Float32Array; sampleRate: number }`
  - `decodeWithAfconvert(file: string): { pcm: Float32Array; sampleRate: number }`
  - The committed JSON beat maps that Task 7 imports.

- [ ] **Step 1: Point the Node TS project at `scripts/`**

In `tsconfig.node.json`, add `"types": ["node"],` inside `compilerOptions`, and change `"include"` to:

```json
  "include": ["vite.config.ts", "scripts"]
```

In `package.json` `scripts`, add:

```json
    "beatmap": "node --disable-warning=ExperimentalWarning scripts/beatmap.ts"
```

- [ ] **Step 2: Write the failing WAV parser tests**

Create `scripts/decode.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseWav } from "./decode.ts";

function wav(channels: number, sampleRate: number, samples: number[]): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0, "ascii");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8);
  fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(sampleRate, 12);
  fmt.writeUInt32LE(sampleRate * channels * 2, 16);
  fmt.writeUInt16LE(channels * 2, 20);
  fmt.writeUInt16LE(16, 22);
  const filler = Buffer.alloc(12);
  filler.write("FLLR", 0, "ascii");
  filler.writeUInt32LE(4, 4);
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(data.length, 4);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + fmt.length + filler.length + dataHeader.length + data.length, 4);
  header.write("WAVE", 8, "ascii");
  return Buffer.concat([header, fmt, filler, dataHeader, data]);
}

describe("parseWav", () => {
  it("reads mono 16-bit PCM", () => {
    const { pcm, sampleRate } = parseWav(wav(1, 44100, [0, 16384, -32768]));
    expect(sampleRate).toBe(44100);
    expect(Array.from(pcm)).toEqual([0, 0.5, -1]);
  });

  it("downmixes interleaved stereo and skips unknown chunks", () => {
    const { pcm, sampleRate } = parseWav(wav(2, 48000, [16384, 0, -16384, -16384]));
    expect(sampleRate).toBe(48000);
    expect(Array.from(pcm)).toEqual([0.25, -0.5]);
  });

  it("throws without a data chunk", () => {
    expect(() => parseWav(Buffer.from("RIFF\0\0\0\0WAVE"))).toThrow(/data chunk/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `yarn test scripts/decode.test.ts`
Expected: FAIL, `Failed to resolve import "./decode.ts"`.

- [ ] **Step 4: Implement decoding**

Create `scripts/decode.ts`:

```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface DecodedAudio {
  pcm: Float32Array;
  sampleRate: number;
}

/** Parse a 16-bit PCM WAV, downmixing to mono. */
export function parseWav(buffer: Buffer): DecodedAudio {
  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
    }
    if (id === "data") {
      const count = Math.floor(size / 2 / channels);
      const pcm = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) {
          sum += buffer.readInt16LE(offset + 8 + (i * channels + c) * 2);
        }
        pcm[i] = sum / channels / 32768;
      }
      return { pcm, sampleRate };
    }
    offset += 8 + size + (size & 1);
  }
  throw new Error("WAV has no data chunk");
}

/**
 * Decode an audio file to mono PCM with macOS afconvert. afconvert matches Chrome's
 * decodeAudioData sample-for-sample (gapless trimming included), so beat maps line up with playback.
 */
export function decodeWithAfconvert(file: string): DecodedAudio {
  if (process.platform !== "darwin") {
    throw new Error("Beat-map decoding needs macOS afconvert (it matches Chrome's decodeAudioData exactly).");
  }
  const dir = mkdtempSync(join(tmpdir(), "beatmap-"));
  const wav = join(dir, "track.wav");
  try {
    execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16", "-c", "1", file, wav]);
    return parseWav(readFileSync(wav));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 5: Run the parser tests to verify they pass**

Run: `yarn test scripts/decode.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the CLI and an empty overrides file**

Create `src/audio/beatmaps/overrides.json`:

```json
{}
```

Create `scripts/beatmap.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeTrack } from "../src/audio/analysis/analyzeTrack.ts";
import { buildBeatMap } from "../src/audio/analysis/buildBeatMap.ts";
import { decodeWithAfconvert } from "./decode.ts";

import type { BeatMapOverrides } from "../src/audio/analysis/buildBeatMap.ts";

const beatmapDir = fileURLToPath(new URL("../src/audio/beatmaps/", import.meta.url));
const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("usage: yarn beatmap <file.mp3> [--id <id>]");
  process.exit(1);
}
const idFlag = flags.indexOf("--id");
const id = idFlag >= 0 ? flags[idFlag + 1] : basename(file, extname(file));

const overrides: Record<string, BeatMapOverrides> = JSON.parse(
  readFileSync(join(beatmapDir, "overrides.json"), "utf8")
);
const started = performance.now();
const { pcm, sampleRate } = decodeWithAfconvert(file);
const analysis = analyzeTrack(pcm, sampleRate);
const map = buildBeatMap(id, analysis, overrides[id]);
writeFileSync(join(beatmapDir, `${id}.json`), JSON.stringify(map) + "\n");

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `${id}: ${map.bpm} bpm, beat0 ${map.beat0}s, downbeatMod ${map.downbeatMod} (raw ${analysis.downbeatMod}), ` +
    `${map.onsets.kick.length / 2} kicks, ${map.barLevels.length} bars, ${seconds}s`
);
console.log(`bar levels: ${map.barLevels.join("")}`);
```

- [ ] **Step 7: Generate both beat maps**

Run: `yarn beatmap src/assets/audio/empty-lightning.mp3 && yarn beatmap src/assets/audio/etaki.mp3`

Expected: two summary lines within tolerance of the reference (BPM ±0.05, beat0 ±0.010):
- `empty-lightning: 113.01 bpm, beat0 0.03s, downbeatMod 0 …`
- `etaki: 149.98 bpm, beat0 0.385s, downbeatMod 3 …`

If a raw `downbeatMod` differs from the reference (0 / 3):
1. Put the reference value in `src/audio/beatmaps/overrides.json`, e.g. `{ "empty-lightning": { "downbeatMod": 0 } }`.
2. Rerun that track.
3. The reference downbeats come from the investigation's section-change analysis; the owner confirms them by ear in `?debug`.

If BPM or beat0 is outside tolerance, stop and use superpowers:systematic-debugging. Compare against the investigation's analysis output in `/private/tmp/claude-501/-Users-faizaan-orca-workspaces-faizaan-tech-mandarin/53b6e84d-93a8-4770-b35e-1e8506db64c5/scratchpad/proto-audio-engine/*.analysis.json` (fields `grid.bpm`, `grid.phase`).

Sanity-check the printed bar levels. Intense (`1`) runs should roughly cover empty-lightning 26–60 s and 64–109 s, and etaki 90–128 s. Bars are 2.12 s and 1.6 s long respectively.

- [ ] **Step 8: Write the real-track regression test**

Create `scripts/analyzeTrack.real.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { analyzeTrack } from "../src/audio/analysis/analyzeTrack.ts";
import { buildBeatMap } from "../src/audio/analysis/buildBeatMap.ts";
import { decodeWithAfconvert } from "./decode.ts";

import type { BeatMapOverrides } from "../src/audio/analysis/buildBeatMap.ts";
import type { BeatMap } from "../src/audio/types.ts";

const path = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const overrides: Record<string, BeatMapOverrides> = JSON.parse(
  readFileSync(path("src/audio/beatmaps/overrides.json"), "utf8")
);

/** Ground truth from the 2026-09-25 investigation (spectral flux + DP tracker + epoch averaging). */
const REFERENCE = [
  { id: "empty-lightning", bpm: 113.01, beat0: 0.03, downbeatMod: 0 },
  { id: "etaki", bpm: 149.98, beat0: 0.385, downbeatMod: 3 },
];

describe.skipIf(process.platform !== "darwin")("beat maps for the bundled tracks", () => {
  for (const ref of REFERENCE) {
    it(`${ref.id} matches ground truth and the committed map`, () => {
      const { pcm, sampleRate } = decodeWithAfconvert(path(`src/assets/audio/${ref.id}.mp3`));
      const analysis = analyzeTrack(pcm, sampleRate);
      const map = buildBeatMap(ref.id, analysis, overrides[ref.id]);
      expect(Math.abs(analysis.bpm - ref.bpm)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(map.beat0 - ref.beat0)).toBeLessThanOrEqual(0.01);
      expect(map.downbeatMod).toBe(ref.downbeatMod);

      const committed: BeatMap = JSON.parse(readFileSync(path(`src/audio/beatmaps/${ref.id}.json`), "utf8"));
      expect(committed).toMatchObject({ bpm: map.bpm, beat0: map.beat0, downbeatMod: map.downbeatMod });
    }, 180_000);
  }
});
```

- [ ] **Step 9: Run the whole suite**

Run: `yarn test`
Expected: PASS (all tests, including 2 real-track tests; about 10–30 s).

- [ ] **Step 10: Type-check and lint**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js scripts src/audio`
Expected: exit 0, no lint errors.

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.node.json scripts src/audio/beatmaps
git commit -m "feat(audio): add yarn beatmap CLI and commit beat maps for both tracks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: MusicEngine

**Files:**
- Create: `src/audio/testing/fakeAudio.ts`
- Create: `src/audio/MusicEngine.ts`
- Test: `src/audio/MusicEngine.test.ts`

**Interfaces:**
- Consumes: `frame.ts` (Task 2): `BAND_COUNT`, `clearFrame`, `createCursors`, `createFrame`, `writeFrame`, `FrameCursors`. `types.ts`: `BeatMap`, `EngineState`, `MusicFrame`, `TrackSource`.
- Produces:
  - `interface EngineDeps { createContext: () => AudioContext; fetchArrayBuffer: (url: string) => Promise<ArrayBuffer> }`
  - `class MusicEngine`:
    - `constructor(tracks: TrackSource[], deps?: Partial<EngineDeps>)`
    - fields: `readonly frame: MusicFrame`, `visualLead: number`, `userOffset: number`
    - getters: `audioContext: AudioContext | null`, `beatMap: BeatMap | null`
    - clock: `songTimeAtContext(t)`, `contextTimeAtSong(t)`
    - transport: `preload(id?)` (returns a Promise), `unlock()`, `play(from?)`, `pause()`, `toggle()`, `seek(t)`, `next()`, `setMuted(muted)`
    - frames: `update(nowMs): MusicFrame`
    - state: `subscribe(fn): () => void`, `getSnapshot(): EngineState`

- [ ] **Step 1: Write the Web Audio fakes**

Create `src/audio/testing/fakeAudio.ts`:

```ts
/** Minimal Web Audio fakes for MusicEngine tests: only what the engine touches. */

export class FakeParam {
  value: number;
  readonly events: { type: "set" | "ramp" | "cancel"; value: number; time: number }[] = [];

  constructor(value: number) {
    this.value = value;
  }

  setValueAtTime(value: number, time: number) {
    this.events.push({ type: "set", value, time });
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: "ramp", value, time });
    this.value = value;
    return this;
  }

  cancelScheduledValues(time: number) {
    this.events.push({ type: "cancel", value: this.value, time });
    return this;
  }
}

export class FakeNode {
  readonly connections: unknown[] = [];

  connect<T>(node: T): T {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.connections.length = 0;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

export class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  level = -40;

  get frequencyBinCount() {
    return this.fftSize / 2;
  }

  getFloatFrequencyData(array: Float32Array) {
    array.fill(this.level);
  }
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started: { when: number; offset: number } | null = null;
  stopped = false;

  start(when = 0, offset = 0) {
    this.started = { when, offset };
  }

  stop() {
    this.stopped = true;
  }

  /** Simulate the track reaching its end. */
  finish() {
    this.onended?.();
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  baseLatency = 0.005;
  outputLatency = 0.02;
  state: "suspended" | "running" | "closed" = "suspended";
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  outputTimestamp = { contextTime: 0, performanceTime: 0 };
  bufferDuration = 120;
  decodeCalls = 0;

  get lastSource(): FakeSource {
    return this.sources[this.sources.length - 1];
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createAnalyser() {
    return new FakeAnalyser();
  }

  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  decodeAudioData() {
    this.decodeCalls++;
    return Promise.resolve({ duration: this.bufferDuration });
  }

  getOutputTimestamp() {
    return this.outputTimestamp;
  }
}
```

- [ ] **Step 2: Write the failing engine tests**

Create `src/audio/MusicEngine.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { MusicEngine } from "./MusicEngine";
import { FakeAudioContext } from "./testing/fakeAudio";

import type { BeatMap, TrackSource } from "./types";

const baseMap: BeatMap = {
  id: "a",
  version: 1,
  duration: 120,
  bpm: 120,
  beat0: 0,
  beatsPerBar: 4,
  downbeatMod: 0,
  confidence: 1,
  curveFps: 10,
  energy: [128],
  section: [0],
  barLevels: [0],
  onsets: { kick: [], snare: [], hat: [] },
};

interface SetupOptions {
  maps?: Record<string, BeatMap | null>;
  fetch?: (url: string) => Promise<ArrayBuffer>;
  createContext?: () => AudioContext;
}

function setup(options: SetupOptions = {}) {
  const contexts: FakeAudioContext[] = [];
  const maps = options.maps ?? { a: baseMap, b: { ...baseMap, id: "b", bpm: 150 } };
  const tracks: TrackSource[] = ["a", "b"].map((id) => ({
    id,
    title: id.toUpperCase(),
    url: `/${id}.mp3`,
    loadBeatMap: async () => maps[id] ?? null,
  }));
  const engine = new MusicEngine(tracks, {
    createContext:
      options.createContext ??
      (() => {
        const ctx = new FakeAudioContext();
        contexts.push(ctx);
        return ctx as unknown as AudioContext;
      }),
    fetchArrayBuffer: options.fetch ?? (async () => new ArrayBuffer(8)),
  });
  engine.visualLead = 0;
  return { engine, contexts, ctx: () => contexts[0] };
}

async function playing(options?: SetupOptions) {
  const s = setup(options);
  await s.engine.preload();
  s.engine.unlock();
  s.engine.play(0);
  return s;
}

/** Make the fake output clock say `contextTime` is audible at performance time `nowMs`. */
function audibleAt(ctx: FakeAudioContext, contextTime: number, nowMs: number) {
  ctx.outputTimestamp = { contextTime, performanceTime: nowMs };
  ctx.currentTime = contextTime + 0.03;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loading and unlocking", () => {
  it("creates one context and decodes once, however often preload is called", async () => {
    const { engine, contexts } = setup();
    const statuses: string[] = [];
    engine.subscribe(() => statuses.push(engine.getSnapshot().status));
    await Promise.all([engine.preload(), engine.preload()]);
    await engine.preload();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].decodeCalls).toBe(1);
    expect(statuses).toEqual(["loading", "ready"]);
    expect(engine.getSnapshot()).toMatchObject({ track: "a", title: "A", bpm: 120, isPlaying: false });
  });

  it("keeps the context suspended until unlock", async () => {
    const { engine, ctx } = setup();
    await engine.preload();
    expect(ctx().state).toBe("suspended");
    engine.unlock();
    expect(ctx().state).toBe("running");
    expect(engine.getSnapshot().unlocked).toBe(true);
  });

  it("reports error when Web Audio is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { engine } = setup({
      createContext: () => {
        throw new Error("no audio");
      },
    });
    await engine.preload();
    engine.unlock();
    engine.play(0);
    expect(engine.getSnapshot().status).toBe("error");
    expect(engine.update(16).isPlaying).toBe(false);
  });

  it("reports error when the track fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { engine } = setup({
      fetch: async () => {
        throw new Error("404");
      },
    });
    await engine.preload();
    expect(engine.getSnapshot().status).toBe("error");
  });
});

describe("transport", () => {
  it("anchors playback slightly ahead of currentTime", async () => {
    const { engine, ctx } = await playing();
    expect(ctx().lastSource.started).toEqual({ when: 0.05, offset: 0 });
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it("starts as soon as decoding finishes when play is pressed early", async () => {
    let release: (buffer: ArrayBuffer) => void = () => {};
    const { engine, ctx } = setup({ fetch: () => new Promise((resolve) => (release = resolve)) });
    const loaded = engine.preload();
    engine.unlock();
    engine.play(0);
    expect(ctx().sources).toHaveLength(0);
    release(new ArrayBuffer(8));
    await loaded;
    expect(ctx().sources).toHaveLength(1);
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it("keeps exactly one live source when play is called twice", async () => {
    const { engine, ctx } = await playing();
    engine.play(0);
    expect(ctx().sources).toHaveLength(2);
    expect(ctx().sources[0].stopped).toBe(true);
    expect(ctx().sources[1].stopped).toBe(false);
  });

  it("pause freezes time and resume continues from it", async () => {
    const { engine, ctx } = await playing();
    ctx().currentTime = 3.05;
    engine.pause();
    expect(ctx().sources[0].stopped).toBe(true);
    expect(engine.update(5000).time).toBeCloseTo(3.0);
    expect(engine.frame.isPlaying).toBe(false);
    expect(engine.getSnapshot().isPlaying).toBe(false);
    engine.play();
    expect(ctx().lastSource.started?.when).toBeCloseTo(3.1);
    expect(ctx().lastSource.started?.offset).toBeCloseTo(3.0);
  });

  it("pausing before the scheduled start keeps the start position", async () => {
    const { engine } = await playing();
    engine.pause();
    expect(engine.update(1).time).toBe(0);
  });

  it("toggle pauses and resumes", async () => {
    const { engine } = await playing();
    engine.toggle();
    expect(engine.getSnapshot().isPlaying).toBe(false);
    engine.toggle();
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it("seek restarts the source at the target and clamps to the track", async () => {
    const { engine, ctx } = await playing();
    engine.seek(10);
    expect(ctx().lastSource.started?.offset).toBe(10);
    engine.seek(500);
    expect(ctx().lastSource.started?.offset).toBeCloseTo(119.9);
    engine.pause();
    engine.seek(-5);
    expect(engine.update(99).time).toBe(0);
  });

  it("mute ramps the mute gain and survives track changes", async () => {
    const { engine, ctx } = await playing();
    engine.setMuted(true);
    const mute = ctx().gains[1].gain;
    expect(mute.events[mute.events.length - 1]).toEqual({ type: "ramp", value: 0, time: 0.01 });
    const eventCount = mute.events.length;
    ctx().lastSource.finish();
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", muted: true, isPlaying: true });
    expect(mute.events).toHaveLength(eventCount);
  });
});

describe("track switching", () => {
  it("advances to the next track when one ends and loops back", async () => {
    const { engine, ctx } = await playing();
    ctx().lastSource.finish();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", status: "loading", isPlaying: false });
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", title: "B", bpm: 150, status: "ready", isPlaying: true });
    expect(ctx().lastSource.started?.offset).toBe(0);
    engine.next();
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "a", isPlaying: true });
    expect(ctx().decodeCalls).toBe(3);
  });

  it("switches without playing when paused", async () => {
    const { engine, ctx } = await playing();
    engine.pause();
    const sources = ctx().sources.length;
    engine.next();
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", isPlaying: false, status: "ready" });
    expect(ctx().sources).toHaveLength(sources);
  });

  it("ignores a skipped track that finishes loading late", async () => {
    const pending: { url: string; resolve: (buffer: ArrayBuffer) => void }[] = [];
    const { engine, ctx } = setup({
      fetch: (url) => new Promise((resolve) => pending.push({ url, resolve })),
    });
    const first = engine.preload();
    await flush();
    pending[0].resolve(new ArrayBuffer(8));
    await first;
    engine.unlock();
    engine.play(0);
    engine.next();
    engine.next();
    await flush();
    expect(pending.map((p) => p.url)).toEqual(["/a.mp3", "/b.mp3", "/a.mp3"]);
    pending[2].resolve(new ArrayBuffer(8));
    await engine.preload();
    const sources = ctx().sources.length;
    pending[1].resolve(new ArrayBuffer(8));
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ track: "a", status: "ready", isPlaying: true });
    expect(ctx().sources).toHaveLength(sources);
  });
});

describe("frames", () => {
  it("derives song time from the output timestamp", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    const frame = engine.update(1100);
    expect(frame.time).toBeCloseTo(1.05);
    expect(frame.beatIndex).toBe(2);
    expect(frame.isPlaying).toBe(true);
    expect(frame.beatConfidence).toBe(1);
  });

  it("adds visualLead and userOffset", async () => {
    const { engine, ctx } = await playing();
    engine.visualLead = 0.01;
    engine.userOffset = 0.1;
    audibleAt(ctx(), 1.0, 1000);
    expect(engine.update(1000).time).toBeCloseTo(1.06);
  });

  it("falls back to currentTime minus latency without an output timestamp", async () => {
    const { engine, ctx } = await playing();
    ctx().currentTime = 2.05;
    expect(engine.update(10).time).toBeCloseTo(2.05 - 0.005 - 0.02 - 0.05);
  });

  it("is idempotent for the same timestamp", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    const time = engine.update(1100).time;
    audibleAt(ctx(), 5.0, 1000);
    expect(engine.update(1100).time).toBe(time);
  });

  it("plays tracks without a beat map with zero confidence", async () => {
    const { engine, ctx } = await playing({ maps: { a: null, b: null } });
    audibleAt(ctx(), 1.0, 1000);
    expect(engine.update(1000)).toMatchObject({ isPlaying: true, bpm: 0, beatConfidence: 0 });
    expect(engine.getSnapshot().bpm).toBeNull();
  });

  it("normalises live bands while playing and zeroes them when paused", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    const bands = Array.from(engine.update(1000).bands);
    expect(bands).toHaveLength(6);
    bands.forEach((value) => expect(value).toBeCloseTo(1, 5));
    engine.pause();
    expect(Array.from(engine.update(2000).bands)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("state subscription", () => {
  it("notifies only when a field changes and keeps snapshot identity otherwise", () => {
    const { engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);
    const before = engine.getSnapshot();
    engine.setMuted(false);
    expect(listener).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toBe(before);
    engine.setMuted(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `yarn test src/audio/MusicEngine.test.ts`
Expected: FAIL, `Failed to resolve import "./MusicEngine"`.

- [ ] **Step 4: Implement the engine**

Create `src/audio/MusicEngine.ts`:

```ts
import { BAND_COUNT, clearFrame, createCursors, createFrame, writeFrame } from "./frame";

import type { FrameCursors } from "./frame";
import type { BeatMap, EngineState, MusicFrame, TrackSource } from "./types";

export interface EngineDeps {
  createContext: () => AudioContext;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
}

/** Sources start this far ahead of currentTime so the clock anchor is sample-exact. */
const SCHEDULE_AHEAD = 0.05;
const MUTE_RAMP = 0.01;
/** 6 log-spaced bands, 40 Hz – 16 kHz. */
const BAND_EDGES = Array.from(
  { length: BAND_COUNT + 1 },
  (_, i) => 40 * Math.pow(16000 / 40, i / BAND_COUNT)
);
const DB_FLOOR = -90;
const DB_CEIL = -20;
const PEAK_DECAY = 0.995;
const PEAK_FLOOR = 0.25;

interface LoadedTrack {
  source: TrackSource;
  buffer: AudioBuffer | null;
  map: BeatMap | null;
  loading: Promise<void> | null;
}

const defaultDeps: EngineDeps = {
  createContext: () => new AudioContext({ latencyHint: "interactive" }),
  fetchArrayBuffer: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.arrayBuffer();
  },
};

/**
 * Plays tracks through Web Audio and derives every per-frame value from the AudioContext
 * output clock plus the track's precomputed beat map. See docs/superpowers/specs/2026-09-25-music-engine-design.md.
 */
export class MusicEngine {
  /** Mutated in place by `update`. Read it each frame; never keep its values across frames. */
  readonly frame: MusicFrame = createFrame();
  /** Seconds between a rAF callback and the photons it produces; the ticker sets it to one display frame. */
  visualLead = 1 / 60;
  /** Per-device calibration in seconds (e.g. Bluetooth output). */
  userOffset = 0;

  private readonly deps: EngineDeps;
  private readonly tracks: LoadedTrack[];
  private readonly listeners = new Set<() => void>();
  private readonly peaks = new Float32Array(BAND_COUNT).fill(PEAK_FLOOR);
  private state: EngineState;
  private current = 0;
  private ctx: AudioContext | null = null;
  private contextFailed = false;
  private bus: GainNode | null = null;
  private muteGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private spectrum = new Float32Array(0);
  private source: AudioBufferSourceNode | null = null;
  private anchorCtx = 0;
  private anchorSong = 0;
  private pausedAt = 0;
  private wantsPlay = false;
  private cursors: FrameCursors = createCursors();
  private lastNow = Number.NaN;

  constructor(tracks: TrackSource[], deps: Partial<EngineDeps> = {}) {
    if (tracks.length === 0) throw new Error("MusicEngine needs at least one track");
    this.deps = { ...defaultDeps, ...deps };
    this.tracks = tracks.map((source) => ({ source, buffer: null, map: null, loading: null }));
    this.state = {
      status: "idle",
      unlocked: false,
      track: tracks[0].id,
      title: tracks[0].title,
      bpm: null,
      isPlaying: false,
      muted: false,
    };
  }

  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  get beatMap(): BeatMap | null {
    return this.tracks[this.current].map;
  }

  songTimeAtContext(contextTime: number): number {
    return this.anchorSong + (contextTime - this.anchorCtx);
  }

  contextTimeAtSong(songTime: number): number {
    return this.anchorCtx + (songTime - this.anchorSong);
  }

  /** Create the (suspended) context if needed, then fetch and decode a track (default: current). Idempotent. */
  preload(id?: string): Promise<void> {
    const index = id === undefined ? this.current : this.tracks.findIndex((t) => t.source.id === id);
    const track = this.tracks[index];
    if (!track) return Promise.reject(new Error(`Unknown track: ${id}`));
    if (track.loading) return track.loading;
    if (!this.ensureContext()) {
      this.set({ status: "error" });
      return Promise.resolve();
    }
    const ctx = this.ctx as AudioContext;
    if (index === this.current) this.set({ status: "loading" });

    const loading: Promise<void> = (async () => {
      try {
        const [data, map] = await Promise.all([
          this.deps.fetchArrayBuffer(track.source.url),
          track.source.loadBeatMap().catch((err: unknown) => {
            console.warn(`[music] no beat map for ${track.source.id}`, err);
            return null;
          }),
        ]);
        const buffer = await ctx.decodeAudioData(data);
        if (track.loading !== loading) return; // switched away while loading: drop it
        track.buffer = buffer;
        track.map = map;
        if (this.tracks[this.current] === track) this.onCurrentReady();
      } catch (err) {
        console.error(`[music] failed to load ${track.source.id}`, err);
        if (track.loading !== loading) return;
        track.loading = null; // allow a retry
        if (this.tracks[this.current] === track) {
          this.wantsPlay = false;
          this.set({ status: "error", isPlaying: false });
        }
      }
    })();
    track.loading = loading;
    return loading;
  }

  /** Resume audio output. Call synchronously inside a user-gesture handler (autoplay policy, iOS). */
  unlock(): void {
    if (!this.ensureContext()) {
      this.set({ status: "error" });
      return;
    }
    const ctx = this.ctx as AudioContext;
    if (ctx.state !== "running") {
      ctx.resume().catch((err: unknown) => console.error("[music] resume failed", err));
    }
    this.set({ unlocked: true });
  }

  /** Play the current track from song time `from` (default: where it paused); waits for decoding if needed. */
  play(from: number = this.pausedAt): void {
    if (!this.ensureContext()) {
      this.set({ status: "error" });
      return;
    }
    this.pausedAt = Math.max(0, from);
    const track = this.tracks[this.current];
    if (!track.buffer) {
      this.wantsPlay = true;
      void this.preload(track.source.id);
      return;
    }
    this.startSource(this.pausedAt);
  }

  pause(): void {
    this.wantsPlay = false;
    if (this.source && this.ctx) {
      this.pausedAt = Math.max(this.anchorSong, this.songTimeAtContext(this.ctx.currentTime));
      this.stopSource();
    }
    this.set({ isPlaying: false });
  }

  toggle(): void {
    if (this.state.isPlaying || this.wantsPlay) this.pause();
    else this.play();
  }

  seek(time: number): void {
    const track = this.tracks[this.current];
    const duration = track.buffer?.duration ?? track.map?.duration ?? 0;
    const target = Math.min(Math.max(0, time), Math.max(0, duration - 0.1));
    if (this.source) {
      this.startSource(target);
    } else {
      this.pausedAt = target;
      this.cursors = createCursors();
    }
  }

  /** Switch to the next track (looping); keeps playing if it was playing. */
  next(): void {
    this.advance(this.state.isPlaying || this.wantsPlay);
  }

  setMuted(muted: boolean): void {
    if (this.muteGain && this.ctx) {
      const gain = this.muteGain.gain;
      const now = this.ctx.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(muted ? 0 : 1, now + MUTE_RAMP);
    }
    this.set({ muted });
  }

  /** Compute the frame for a rAF timestamp. Only the ticker calls this; idempotent per `nowMs`. */
  update(nowMs: number): MusicFrame {
    if (nowMs === this.lastNow) return this.frame;
    this.lastNow = nowMs;
    const playing = this.source !== null && this.ctx !== null;
    const time = playing
      ? this.songTimeAtContext(this.audibleContextTime(nowMs) + this.visualLead + this.userOffset)
      : this.pausedAt;
    const map = this.tracks[this.current].map;
    if (map) writeFrame(this.frame, map, time, playing, this.cursors);
    else clearFrame(this.frame, time, playing);
    this.writeBands(playing);
    return this.frame;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): EngineState => this.state;

  private set(patch: Partial<EngineState>): void {
    const keys = Object.keys(patch) as (keyof EngineState)[];
    if (keys.every((key) => patch[key] === this.state[key])) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private ensureContext(): boolean {
    if (this.ctx) return true;
    if (this.contextFailed) return false;
    let ctx: AudioContext;
    try {
      ctx = this.deps.createContext();
    } catch (err) {
      console.error("[music] Web Audio unavailable", err);
      this.contextFailed = true;
      return false;
    }
    const bus = ctx.createGain();
    const muteGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    bus.connect(analyser);
    bus.connect(muteGain);
    muteGain.connect(ctx.destination);
    muteGain.gain.value = this.state.muted ? 0 : 1;
    this.ctx = ctx;
    this.bus = bus;
    this.muteGain = muteGain;
    this.analyser = analyser;
    this.spectrum = new Float32Array(analyser.frequencyBinCount);
    return true;
  }

  private onCurrentReady(): void {
    const track = this.tracks[this.current];
    this.set({ status: "ready", bpm: track.map?.bpm ?? null });
    if (this.wantsPlay) this.startSource(this.pausedAt);
  }

  private startSource(from: number): void {
    const ctx = this.ctx;
    const track = this.tracks[this.current];
    if (!ctx || !this.bus || !track.buffer) return;
    this.stopSource();
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.connect(this.bus);
    const when = ctx.currentTime + SCHEDULE_AHEAD;
    source.start(when, from);
    source.onended = () => {
      if (this.source !== source) return;
      this.source = null;
      this.pausedAt = 0;
      this.advance(true);
    };
    this.source = source;
    this.anchorCtx = when;
    this.anchorSong = from;
    this.pausedAt = from;
    this.wantsPlay = false;
    this.cursors = createCursors();
    this.set({ isPlaying: true });
  }

  private stopSource(): void {
    const source = this.source;
    if (!source) return;
    this.source = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // already stopped
    }
    source.disconnect();
  }

  private advance(resume: boolean): void {
    this.stopSource();
    const previous = this.tracks[this.current];
    this.current = (this.current + 1) % this.tracks.length;
    const track = this.tracks[this.current];
    if (previous !== track) {
      previous.buffer = null; // decoded PCM is 45–72 MB per track: keep only the active one
      previous.loading = null;
    }
    this.pausedAt = 0;
    this.wantsPlay = false;
    this.cursors = createCursors();
    this.set({
      track: track.source.id,
      title: track.source.title,
      bpm: track.map?.bpm ?? null,
      isPlaying: false,
      status: track.buffer ? "ready" : "loading",
    });
    if (resume) this.play(0);
    else void this.preload();
  }

  private audibleContextTime(nowMs: number): number {
    const ctx = this.ctx as AudioContext;
    const stamp = typeof ctx.getOutputTimestamp === "function" ? ctx.getOutputTimestamp() : undefined;
    if (
      stamp?.contextTime !== undefined &&
      stamp.performanceTime !== undefined &&
      stamp.performanceTime > 0
    ) {
      return stamp.contextTime + (nowMs - stamp.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.baseLatency || 0) - (ctx.outputLatency || 0);
  }

  private writeBands(playing: boolean): void {
    const bands = this.frame.bands;
    const analyser = this.analyser;
    if (!playing || !analyser || !this.ctx) {
      bands.fill(0);
      return;
    }
    analyser.getFloatFrequencyData(this.spectrum);
    const binHz = this.ctx.sampleRate / analyser.fftSize;
    for (let b = 0; b < BAND_COUNT; b++) {
      const lo = Math.max(1, Math.floor(BAND_EDGES[b] / binHz));
      const hi = Math.max(lo, Math.min(this.spectrum.length - 1, Math.ceil(BAND_EDGES[b + 1] / binHz) - 1));
      let sum = 0;
      for (let k = lo; k <= hi; k++) sum += this.spectrum[k];
      const level = Math.min(1, Math.max(0, (sum / (hi - lo + 1) - DB_FLOOR) / (DB_CEIL - DB_FLOOR)));
      this.peaks[b] = Math.max(level, this.peaks[b] * PEAK_DECAY, PEAK_FLOOR);
      bands[b] = level / this.peaks[b];
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `yarn test src/audio/MusicEngine.test.ts`
Expected: PASS (22 tests).

- [ ] **Step 6: Type-check and lint**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js src/audio`
Expected: exit 0, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/audio/MusicEngine.ts src/audio/MusicEngine.test.ts src/audio/testing
git commit -m "feat(audio): add MusicEngine (transport, latency-compensated clock, live bands)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Engine singleton, ticker and React bindings

**Files:**
- Modify: `tsconfig.app.json` (add `"resolveJsonModule": true`)
- Create: `src/audio/tracks.ts`
- Create: `src/audio/engine.ts`
- Create: `src/audio/ticker.ts`
- Test: `src/audio/ticker.test.ts`
- Create: `src/audio/react.ts`

**Interfaces:**
- Consumes: `MusicEngine` (Task 6); beat-map JSONs (Task 5); `MusicFrame`, `EngineState`, `TrackSource`, `BeatMap` (Task 2).
- Produces:
  - `TRACKS: TrackSource[]`
  - `engine: MusicEngine` (singleton)
  - `ticker.ts`:
    - `type FrameListener = (frame: MusicFrame, nowMs: number) => void`
    - `estimateVisualLead(deltasMs: number[]): number`
    - `startMusicTicker(engine: MusicEngine): void`
    - `onMusicFrame(listener: FrameListener): () => void`
  - `react.ts`: `useMusicState(): EngineState`, `useMusicFrame(callback: FrameListener): void`

- [ ] **Step 1: Write the failing ticker test**

Create `src/audio/ticker.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { estimateVisualLead } from "./ticker";

describe("estimateVisualLead", () => {
  it("uses the median frame interval", () => {
    expect(estimateVisualLead([8.3, 8.4, 8.3, 50, 8.3])).toBeCloseTo(0.0083);
  });

  it("clamps to 30–240 Hz displays", () => {
    expect(estimateVisualLead([1])).toBeCloseTo(1 / 240);
    expect(estimateVisualLead([500])).toBeCloseTo(1 / 30);
  });

  it("defaults to 60 Hz without samples", () => {
    expect(estimateVisualLead([])).toBeCloseTo(1 / 60);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn test src/audio/ticker.test.ts`
Expected: FAIL, `Failed to resolve import "./ticker"`.

- [ ] **Step 3: Implement the ticker**

Create `src/audio/ticker.ts`:

```ts
import type { MusicEngine } from "./MusicEngine";
import type { MusicFrame } from "./types";

export type FrameListener = (frame: MusicFrame, nowMs: number) => void;

const listeners = new Set<FrameListener>();
const SAMPLE_FRAMES = 30;
let running = false;

/** Median frame interval in seconds, clamped to 30–240 Hz displays. */
export function estimateVisualLead(deltasMs: number[]): number {
  const sorted = [...deltasMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 1000 / 60;
  return Math.min(1 / 30, Math.max(1 / 240, median / 1000));
}

/**
 * Start the single rAF loop that owns `engine.update`. Call once, before React renders,
 * so this callback runs before r3f's loop every frame and `engine.frame` is fresh for `useFrame`.
 */
export function startMusicTicker(engine: MusicEngine): void {
  if (running) return;
  running = true;
  const deltas: number[] = [];
  let last = 0;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (last > 0) {
      deltas.push(now - last);
      if (deltas.length === SAMPLE_FRAMES) {
        engine.visualLead = estimateVisualLead(deltas);
        deltas.length = 0;
      }
    }
    last = now;
    const frame = engine.update(now);
    listeners.forEach((listener) => listener(frame, now));
  };
  requestAnimationFrame(tick);
}

/** Subscribe to every animation frame (after `engine.update`). Returns an unsubscribe function. */
export function onMusicFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `yarn test src/audio/ticker.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the track registry, singleton and hooks**

In `tsconfig.app.json` `compilerOptions`, add under `"moduleDetection": "force",`:

```json
    "resolveJsonModule": true,
```

Create `src/audio/tracks.ts`:

```ts
import emptyLightningUrl from "../assets/audio/empty-lightning.mp3";
import etakiUrl from "../assets/audio/etaki.mp3";

import type { BeatMap, TrackSource } from "./types";

/** Playback order; the list loops. Beat maps are generated with `yarn beatmap <file.mp3>`. */
export const TRACKS: TrackSource[] = [
  {
    id: "empty-lightning",
    title: "empty lightning",
    url: emptyLightningUrl,
    loadBeatMap: async () => (await import("./beatmaps/empty-lightning.json")).default as BeatMap,
  },
  {
    id: "etaki",
    title: "etaki",
    url: etakiUrl,
    loadBeatMap: async () => (await import("./beatmaps/etaki.json")).default as BeatMap,
  },
];
```

Create `src/audio/engine.ts`:

```ts
import { MusicEngine } from "./MusicEngine";
import { TRACKS } from "./tracks";

/** The app-wide music engine. Only `src/audio/ticker.ts` calls `engine.update`. */
export const engine = new MusicEngine(TRACKS);
```

Create `src/audio/react.ts`:

```ts
import { useEffect, useRef, useSyncExternalStore } from "react";

import { engine } from "./engine";
import { onMusicFrame } from "./ticker";

import type { FrameListener } from "./ticker";
import type { EngineState } from "./types";

/** Coarse engine state (track, status, playing, muted). Re-renders only when it changes. */
export function useMusicState(): EngineState {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}

/** Run `callback` every animation frame with the current MusicFrame. Never triggers a React render. */
export function useMusicFrame(callback: FrameListener): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => onMusicFrame((frame, now) => latest.current(frame, now)), []);
}
```

- [ ] **Step 6: Type-check, lint and test**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js src/audio && yarn test`
Expected: exit 0 and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add tsconfig.app.json src/audio/tracks.ts src/audio/engine.ts src/audio/ticker.ts src/audio/ticker.test.ts src/audio/react.ts
git commit -m "feat(audio): add engine singleton, frame ticker and React bindings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Splash, transport and app wiring (removing the old audio code)

**Files:**
- Create: `src/components/Splash/index.tsx`, `src/components/Splash/Splash.styled.ts`
- Create: `src/components/Transport/index.tsx`, `src/components/Transport/Transport.styled.ts`
- Modify: `src/App.tsx` (full replacement below)
- Modify: `src/main.tsx` (start the ticker)
- Delete: `src/context/AudioContext.tsx`, `src/components/MusicPlayer/`, `src/components/AnimatedElement/`, `src/assets/audio/sample.mp3`

**Interfaces:**
- Consumes: `engine` (Task 7), `useMusicState` (Task 7), `startMusicTicker` (Task 7).
- Produces: `<Splash />` and `<Transport />` default exports. `App` renders them, plus a lazy `MusicDebug` (created in Task 9) when `?debug` is present.

- [ ] **Step 1: Splash styles**

Create `src/components/Splash/Splash.styled.ts`:

```ts
import styled, { css, keyframes } from "styled-components";

const pulse = keyframes`
  0%, 100% { font-variation-settings: "wght" 300; opacity: 0.7; }
  50% { font-variation-settings: "wght" 900; opacity: 1; }
`;

const dots = keyframes`
  0% { content: ""; }
  25% { content: "."; }
  50% { content: ".."; }
  75% { content: "..."; }
`;

const bareButton = css`
  all: unset;
  cursor: pointer;
  font-family: "Doto", monospace;
  color: rgba(255, 255, 255, 0.92);

  &:focus-visible {
    outline: 2px dashed rgba(255, 255, 255, 0.6);
    outline-offset: 0.5rem;
  }
`;

export const Veil = styled.div<{ $leaving: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  background: rgba(20, 61, 50, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  cursor: pointer;
  opacity: ${({ $leaving }) => ($leaving ? 0 : 1)};
  pointer-events: ${({ $leaving }) => ($leaving ? "none" : "auto")};
  transition: opacity 600ms ease;
`;

export const EnterButton = styled.button`
  ${bareButton}
  font-size: clamp(3rem, 12vw, 9rem);
  line-height: 1;
  animation: ${pulse} 2.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const Loading = styled.span`
  &::after {
    content: "";
    display: inline-block;
    width: 3ch;
    text-align: left;
    animation: ${dots} 1.2s steps(1) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
      content: "...";
    }
  }
`;

export const SilentButton = styled.button`
  ${bareButton}
  font-size: clamp(1rem, 2vw, 1.4rem);
  opacity: 0.75;

  &:hover {
    opacity: 1;
  }
`;
```

- [ ] **Step 2: Splash component**

Create `src/components/Splash/index.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";

import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";
import * as Styled from "./Splash.styled";

const FADE_MS = 600;

/** Click-to-enter veil: unlocks Web Audio inside the user gesture and starts the first track. */
const Splash: React.FC = () => {
  const { status } = useMusicState();
  const [phase, setPhase] = useState<"open" | "leaving" | "gone">("open");
  const entered = useRef(false);
  const enterButton = useRef<HTMLButtonElement>(null);

  const enter = (muted: boolean) => {
    if (entered.current) return;
    entered.current = true;
    engine.setMuted(muted);
    engine.unlock();
    engine.play(0);
    setPhase("leaving");
  };

  useEffect(() => {
    void engine.preload();
    enterButton.current?.focus();
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLButtonElement) return; // the focused button handles it
      event.preventDefault();
      enter(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (phase === "gone") return null;

  const loading = status === "idle" || status === "loading";
  return (
    <Styled.Veil
      role="dialog"
      aria-modal="true"
      aria-label="Enter faizaan.tech"
      $leaving={phase === "leaving"}
      onClick={() => enter(false)}
    >
      <Styled.EnterButton
        ref={enterButton}
        type="button"
        aria-busy={loading}
        onClick={(event) => {
          event.stopPropagation();
          enter(false);
        }}
      >
        {loading ? <Styled.Loading>loading</Styled.Loading> : "enter"}
      </Styled.EnterButton>
      <Styled.SilentButton
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          enter(true);
        }}
      >
        enter without sound
      </Styled.SilentButton>
    </Styled.Veil>
  );
};

export default Splash;
```

- [ ] **Step 3: Transport styles and component**

Create `src/components/Transport/Transport.styled.ts`:

```ts
import styled from "styled-components";

export const Bar = styled.div`
  position: fixed;
  top: 0.75rem;
  left: 1rem;
  z-index: 20;
  display: flex;
  align-items: baseline;
  gap: 1.25rem;
  font-family: "Doto", monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
`;

export const Control = styled.button`
  all: unset;
  cursor: pointer;

  &:hover {
    color: #ffffff;
  }

  &:focus-visible {
    outline: 1px dashed rgba(255, 255, 255, 0.6);
    outline-offset: 0.25rem;
  }
`;

export const Label = styled.span`
  opacity: 0.7;
`;
```

Create `src/components/Transport/index.tsx`:

```tsx
import { useEffect } from "react";

import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";
import * as Styled from "./Transport.styled";

const TYPING = "input, select, textarea, [contenteditable='true']";
const CONTROLS = "a, button";

/** Always-visible Doto transport: play/pause, track · bpm, mute, next. Space = play/pause, M = mute. */
const Transport: React.FC = () => {
  const { status, title, bpm, isPlaying, muted } = useMusicState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!engine.getSnapshot().unlocked) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TYPING)) return;
      if (event.key === " ") {
        if (target?.closest(CONTROLS)) return; // a focused button handles its own Space
        event.preventDefault();
        engine.toggle();
      } else if (event.key === "m" || event.key === "M") {
        engine.setMuted(!engine.getSnapshot().muted);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (status === "error") {
    return <Styled.Bar role="status">audio unavailable</Styled.Bar>;
  }

  return (
    <Styled.Bar>
      <Styled.Control
        type="button"
        aria-label={isPlaying ? "Pause music" : "Play music"}
        onClick={() => {
          engine.unlock();
          engine.toggle();
        }}
      >
        {isPlaying ? "pause" : "play"}
      </Styled.Control>
      <Styled.Label aria-live="polite">
        {title}
        {bpm ? ` · ${Math.round(bpm)} bpm` : ""}
        {status === "loading" ? " · loading" : ""}
      </Styled.Label>
      <Styled.Control type="button" aria-pressed={muted} onClick={() => engine.setMuted(!muted)}>
        {muted ? "unmute" : "mute"}
      </Styled.Control>
      <Styled.Control
        type="button"
        aria-label="Next track"
        onClick={() => {
          engine.unlock();
          engine.next();
        }}
      >
        next
      </Styled.Control>
    </Styled.Bar>
  );
};

export default Transport;
```

- [ ] **Step 4: Wire the app and start the ticker; delete the old audio code**

Run: `git rm -r src/context/AudioContext.tsx src/components/MusicPlayer src/components/AnimatedElement src/assets/audio/sample.mp3`

Replace `src/App.tsx` with:

```tsx
import { Canvas } from "@react-three/fiber";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import githubIcon from "./assets/github.png";
import gmailIcon from "./assets/gmail.png";
import letterboxdIcon from "./assets/letterboxd.png";
import linkedinIcon from "./assets/linkedin.png";
import stravaIcon from "./assets/strava.png";
import Background from "./components/Background";
import GlassPanel from "./components/GlassPanel";
import Head from "./components/Head";
import PixelIcon from "./components/PixelIcon";
import Splash from "./components/Splash";
import Transport from "./components/Transport";
import { theme } from "./styles/theme";

const MusicDebug = lazy(() => import("./components/MusicDebug"));
const showMusicDebug = new URLSearchParams(window.location.search).has("debug");

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Background />
      <GlassPanel />
      <Styled.HeaderText>(faiz)aan sakib</Styled.HeaderText>
      <Styled.SubtitleText bottom="52" left="2" width="20">
        senior
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="42" left="2" width="20">
        software
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="32" left="2" width="20">
        engineer
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="22" left="2">
        fullstack
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="12" left="2">
        london
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="2" left="2">
        affirm
      </Styled.SubtitleText>

      <Styled.SocialIconsContainer>
        <PixelIcon
          imagePath={linkedinIcon}
          link={"https://www.linkedin.com/in/faizaan-sakib/"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={gmailIcon}
          link={"mailto:fznsakib@gmail.com"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={githubIcon}
          link={"https://github.com/fznsakib"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={letterboxdIcon}
          link={"https://letterboxd.com/fznsakib/"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={stravaIcon}
          link={"https://strava.app.link/VhdUXhuiWRb"}
          initialPixelSize={12}
          size={80}
        />
      </Styled.SocialIconsContainer>

      {/* three.js canvas */}
      <Styled.AppContainer>
        <Canvas
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
          }}
        >
          <ambientLight intensity={5} />
          <pointLight
            position={[10, 10, 10]}
            intensity={20}
            distance={20}
            decay={2}
          />
          <pointLight position={[-5, -5, -5]} intensity={5} />

          <Head />
        </Canvas>
      </Styled.AppContainer>

      <Transport />
      <Splash />
      {showMusicDebug && (
        <Suspense fallback={null}>
          <MusicDebug />
        </Suspense>
      )}
    </ThemeProvider>
  );
}

export default App;
```

Replace `src/main.tsx` with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { engine } from "./audio/engine";
import { startMusicTicker } from "./audio/ticker";
import { GlobalStyle } from "./styles/global";

// Before React renders, so the ticker's rAF callback precedes r3f's every frame.
startMusicTicker(engine);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalStyle />
    <App />
  </StrictMode>
);
```

Create a placeholder `src/components/MusicDebug/index.tsx` so the lazy import resolves until Task 9 replaces it:

```tsx
const MusicDebug: React.FC = () => null;

export default MusicDebug;
```

- [ ] **Step 5: Type-check, lint and test**

Run: `node node_modules/typescript/bin/tsc -b && yarn lint && yarn test`
Expected: exit 0, `yarn lint` reports 0 errors, all tests pass.

- [ ] **Step 6: Run the site and check the splash and transport**

Run: `node node_modules/vite/bin/vite.js --port 5191 --strictPort` (background).

In Chrome via chrome-devtools MCP, open `http://localhost:5191/` with this `initScript`. It counts contexts and sources, mutes output and counts React commits:

```js
(() => {
  window.__contexts = 0; window.__sources = 0; window.__commits = 0;
  const Base = window.AudioContext;
  window.AudioContext = class extends Base { constructor(...a) { super(...a); window.__contexts++; } };
  const create = Base.prototype.createBufferSource;
  Base.prototype.createBufferSource = function () { window.__sources++; return create.call(this); };
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) { const g = this.context.createGain(); g.gain.value = 0; connect.call(this, g); return connect.call(g, dest); }
    return connect.call(this, dest, ...rest);
  };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: false, supportsFiber: true, renderers: new Map(), inject() { return 1; }, onCommitFiberRoot() { window.__commits++; }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {} };
})();
```

Expected:
- The screenshot shows the veil over the page with a pulsing Doto "enter" (after "loading…") and "enter without sound".
- `window.__contexts === 1`, even under StrictMode.
- The console shows no errors.

- [ ] **Step 7: Verify the keyboard and flows (Review Focus #1)**

With focus on the enter button (it is focused on mount), press Enter (`press_key`). Expected:
- `window.__sources === 1`;
- the veil is gone after 600 ms;
- the transport reads `pause  empty lightning · 113 bpm  mute  next`.

Then:
1. **Commits:** `const c = __commits; await new Promise(r => setTimeout(r, 5000)); __commits - c` → ≤ 2.
2. **Space:** press Space with focus on the body → the transport reads `play`. Press it again → `pause`, and `__sources === 2`.
3. **Mute and next:** click "mute" → reads "unmute". Click "next" → the label reads `etaki · 150 bpm` and playback continues.
4. **Silent entry:** reload, click "enter without sound" → the transport shows "unmute", `__sources === 1`, and the frames advance (checked in Task 9's overlay).
5. **Body-focus entry:** reload, click the page body outside the buttons (the veil) → one source starts.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat: add click-to-enter splash and Doto transport; drop the old audio pipeline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `?debug` music overlay

**Files:**
- Create: `src/components/MusicDebug/MusicDebug.styled.ts`
- Modify: `src/components/MusicDebug/index.tsx` (replace the placeholder)

**Interfaces:**
- Consumes:
  - `engine.audioContext`, `engine.beatMap`, `engine.songTimeAtContext`, `engine.contextTimeAtSong`, `engine.frame` (Task 6);
  - `useMusicFrame` (Task 7).
- Produces: a debug overlay (lazy chunk). It also exposes `window.__music = engine` for manual measurements.

- [ ] **Step 1: Overlay styles**

Create `src/components/MusicDebug/MusicDebug.styled.ts`:

```ts
import styled from "styled-components";

export const Panel = styled.div`
  position: fixed;
  top: 3rem;
  right: 1rem;
  z-index: 90;
  width: 280px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #eeeeee;
  font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
`;

export const Row = styled.div`
  display: flex;
  gap: 10px;
`;

export const Lamp = styled.div<{ $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  opacity: 0;
`;

export const Meter = styled.div`
  display: grid;
  grid-template-columns: 60px 1fr;
  align-items: center;
`;

export const Track = styled.div`
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
`;

export const Fill = styled.div`
  height: 100%;
  background: #8ab1ee;
  transform-origin: left;
  transform: scaleX(0);
`;

export const Bands = styled.div`
  display: flex;
  gap: 4px;
  height: 48px;
`;

export const Band = styled.div`
  flex: 1;
  background: #ff8a1c;
  transform-origin: bottom;
  transform: scaleY(0);
`;

export const Readout = styled.div`
  min-height: 2.6em;
  white-space: pre-wrap;
`;
```

- [ ] **Step 2: Overlay component with the audio-clock metronome**

Replace `src/components/MusicDebug/index.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";

import { engine } from "../../audio/engine";
import { useMusicFrame } from "../../audio/react";
import * as Styled from "./MusicDebug.styled";

import type { MusicFrame } from "../../audio/types";

const METERS = ["kick", "snare", "hat", "energy", "section"] as const;
const LOOKAHEAD = 0.2;

/** Schedules clicks on grid beats via the audio clock (1760 Hz downbeats, 880 Hz otherwise). */
function createMetronome() {
  let nextBeat: number | null = null;
  return (frame: MusicFrame) => {
    const ctx = engine.audioContext;
    const map = engine.beatMap;
    if (!ctx || !map || !frame.isPlaying) {
      nextBeat = null;
      return;
    }
    const period = 60 / map.bpm;
    const songNow = engine.songTimeAtContext(ctx.currentTime);
    const due = Math.ceil((songNow - map.beat0) / period);
    if (nextBeat === null || nextBeat < due - 1 || nextBeat > due + 2) nextBeat = due;
    while (map.beat0 + nextBeat * period < songNow + LOOKAHEAD) {
      const when = engine.contextTimeAtSong(map.beat0 + nextBeat * period);
      if (when >= ctx.currentTime) {
        const beatInBar = (((nextBeat - map.downbeatMod) % map.beatsPerBar) + map.beatsPerBar) % map.beatsPerBar;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.frequency.value = beatInBar === 0 ? 1760 : 880;
        gain.gain.setValueAtTime(0.4, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(when);
        oscillator.stop(when + 0.06);
      }
      nextBeat++;
    }
  };
}

/** `?debug` overlay: beat/downbeat/section lamps, envelopes, live bands, readout and a metronome. */
const MusicDebug: React.FC = () => {
  const root = useRef<HTMLDivElement>(null);
  const [metronome, setMetronome] = useState(false);
  const metronomeOn = useRef(false);
  const tickMetronome = useRef(createMetronome());

  useEffect(() => {
    metronomeOn.current = metronome;
  }, [metronome]);

  useEffect(() => {
    (window as Window & { __music?: typeof engine }).__music = engine;
  }, []);

  useMusicFrame((frame) => {
    const panel = root.current;
    if (!panel) return;
    const el = (key: string) => panel.querySelector<HTMLElement>(`[data-k="${key}"]`);
    const set = (key: string, property: "opacity" | "transform", value: string) => {
      const node = el(key);
      if (node) node.style[property] = value;
    };
    const on = frame.isPlaying;
    set("beat", "opacity", String(on ? (1 - frame.beatPhase) ** 3 : 0));
    set("bar", "opacity", String(on ? (1 - frame.barPhase) ** 4 : 0));
    set("drop", "opacity", frame.sectionLevel ? "1" : "0.15");
    for (const key of METERS) set(key, "transform", `scaleX(${frame[key]})`);
    frame.bands.forEach((value, i) => set(`band${i}`, "transform", `scaleY(${value})`));
    const readout = el("readout");
    if (readout) {
      readout.textContent =
        `t=${frame.time.toFixed(3)} bpm=${frame.bpm.toFixed(2)} beat=${frame.beatIndex} ` +
        `bar=${frame.barIndex}.${Math.floor(frame.barPhase * 4) + 1}\n` +
        `sec=${frame.section.toFixed(2)} lvl=${frame.sectionLevel} conf=${frame.beatConfidence}`;
    }
    if (metronomeOn.current) tickMetronome.current(frame);
  });

  return (
    <Styled.Panel ref={root}>
      <Styled.Row>
        <Styled.Lamp data-k="beat" $color="#ffffff" title="beat" />
        <Styled.Lamp data-k="bar" $color="#ff8a00" title="downbeat" />
        <Styled.Lamp data-k="drop" $color="#ff4fd8" title="section level" />
      </Styled.Row>
      {METERS.map((key) => (
        <Styled.Meter key={key}>
          <span>{key}</span>
          <Styled.Track>
            <Styled.Fill data-k={key} />
          </Styled.Track>
        </Styled.Meter>
      ))}
      <Styled.Bands>
        {Array.from({ length: 6 }, (_, i) => (
          <Styled.Band key={i} data-k={`band${i}`} />
        ))}
      </Styled.Bands>
      <Styled.Readout data-k="readout" />
      <label>
        <input type="checkbox" checked={metronome} onChange={(event) => setMetronome(event.target.checked)} />{" "}
        metronome
      </label>
    </Styled.Panel>
  );
};

export default MusicDebug;
```

- [ ] **Step 3: Type-check and lint**

Run: `node node_modules/typescript/bin/tsc -b && yarn lint`
Expected: exit 0, 0 lint errors.

- [ ] **Step 4: Verify the overlay and beat timing in the browser**

Open `http://localhost:5191/?debug` with the Task 8 `initScript`, then click "enter". Expected:
- The panel shows the beat lamp flashing, meters moving and bands moving.
- The readout shows `bpm=113.01` and the beat count advancing.

Measure the first-frame lateness with this `evaluate_script`:

```js
async () => {
  const e = window.__music; const late = [];
  await new Promise((done) => {
    const t0 = performance.now();
    const tick = (now) => { const f = e.frame; if (f.beatCrossed) late.push((f.beatPhase * 60000) / f.bpm); if (now - t0 < 20000) requestAnimationFrame(tick); else done(); };
    requestAnimationFrame(tick);
  });
  late.sort((a, b) => a - b);
  return { beats: late.length, medianMs: late[late.length >> 1], maxMs: late[late.length - 1] };
}
```

Expected: `beats ≥ 30`, and `medianMs` ≤ one frame interval (≤ 8.4 ms at 120 Hz, ≤ 16.7 ms at 60 Hz).

- [ ] **Step 5: Commit**

```bash
git add src/components/MusicDebug
git commit -m "feat: add ?debug music overlay with audio-clock metronome

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Acceptance pass and whole-branch review

**Files:** none (verification only). Fixes found here go into new commits on the branch.

**Interfaces:**
- Consumes: everything above.
- Produces: an evidence list per acceptance criterion.

- [ ] **Step 1: Build, lint and test from clean**

Run: `yarn build && yarn lint && yarn test`
Expected: all exit 0. The only build warning is chunk size.

- [ ] **Step 2: Production preview has no 404s and plays**

Run the Task 1 Step 7 loop against a fresh `dist`, then open `http://localhost:4173/` in Chrome. Use `list_network_requests` to confirm every request returns 2xx/304, and that the head canvas, the icons and the splash render. Click "enter" and confirm the transport shows `pause`.

- [ ] **Step 3: Track end → next → loop**

In the dev `?debug` page after entering:
1. Evaluate `__music.seek(__music.beatMap.duration - 1.5)` and wait 3 s. Expected: `__music.getSnapshot()` shows `{ track: "etaki", isPlaying: true }`.
2. Evaluate `__music.seek(__music.beatMap.duration - 1.5)` again and wait 3 s. Expected: `{ track: "empty-lightning", isPlaying: true }`.

- [ ] **Step 4: Confirm the remaining acceptance criteria**

With the Task 8 `initScript`:
- `__contexts === 1` after load in dev (StrictMode).
- Commits ≤ 2 over 5 s of playback.
- "Enter without sound": `__music.getSnapshot().muted === true` and `__music.frame.time` advances.

- [ ] **Step 5: Whole-branch review**

Use superpowers:requesting-code-review for the range `a73ee3b..HEAD` against the spec and this plan. Apply fixes as follow-up commits, re-running Step 1 after them.

- [ ] **Step 6: Stop the dev and preview servers**

Run: `for p in 5191 4173; do pid=$(lsof -tiTCP:$p -sTCP:LISTEN); [ -n "$pid" ] && kill $pid; done`
