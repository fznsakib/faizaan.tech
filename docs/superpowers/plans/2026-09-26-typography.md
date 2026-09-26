# Typography: Loud-Passage EQ + Mixed-Face Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (superpowers:test-driven-development throughout; superpowers:systematic-debugging for Task 1's baseline). Steps use checkbox (`- [ ]`) syntax for tracking. Project skills that apply: `audio-analysis`, `tune-animation`.

**Goal:**
- (2a) The six subtitle lines ("senior … affirm") keep moving through the loudest parts of a song.
- (2b) The name shows several fonts at once: a font per word when calm, a font per letter in a drop.

**Architecture:**
- (2a) The live bands are normalised against a hard −20 dB ceiling, then divided by a per-frame-decaying peak. In loud passages every band clips to 1.0 and the EQ freezes at full weight. The fix replaces that with a per-band, time-based adaptive range in dB (`BandNormaliser`, `src/audio/bands.ts`).
- (2b) `src/choreography/faces.ts` steps whole-name faces. It will step per-letter face *assignments* instead: word-grouped when calm, letter-by-letter in drops. The existing shockwave from the head and the Doto/Golos anchors stay.

**Tech Stack:** TypeScript (strict), Web Audio `AnalyserNode`, Vitest.

**Spec:** the owner's request (2026-09-26, pre-approved):
> "(2a) The text where it says my role, senior engineer etc., could be a bit more sensitive to the music. There are times when the song reaches its peak in loudness and that text just stops reacting. Adjust the threshold so that even in the peaks you can still see it dynamically change.
> (2b) On the header (faizaan sakib), I love the way it transforms between the fonts. Is it worth doing a letter-by-letter transformation, so you have different fonts across the name? Even if letter by letter doesn't make sense, maybe (faiz) is one font, sakib another and aan a different one. Whatever works and looks good."

## Global Constraints

- **Font-variation steps stay coarse.** Keep `EQ_WEIGHT_STEP` 100, `HEADER_WEIGHT_STEP` 50 and `ROND_STEP` 25 in `src/choreography/type.ts`; finer steps dropped 27% of frames at 120 Hz. Keep the `setStyle` write-on-change path.
- **Keep the header's behaviour:**
  - all 13 fonts in `CYCLE_FONTS`, in the same order;
  - drops hit in Doto (`DOTO`, `DOTO_VARIATION`) and calm returns to Golos (`GOLOS`);
  - calm steps once per bar, drops once per beat;
  - each change sweeps from the head at `SHOCKWAVE_SPEED`;
  - per-face `fitScale` sizing and preloading;
  - jamming while paused stays Golos, and reduced motion stays static Golos.
- **Band timing is in seconds, not frames:** anything time-based must converge the same at 60 Hz and 120 Hz.
- **Ownership:** don't edit `CLAUDE.md` or `.claude/`. Don't touch `src/components/Background` or `src/components/GlassPanel`; other workers own those. Don't push or merge.
- **Dev server** for browser checks: `yarn dev --port 5193 --strictPort`; `?debug` exposes `window.__music`.

## Review Focus

1. **Silence and pauses:** bands are 0 when paused or silent, and after a pause the EQ resumes without a burst of full-scale values. Tested in Task 1.
2. **A quiet intro jumping into a loud drop:** the EQ reaches the top within ~100 ms, then keeps moving. Tested in Task 1.
3. **Frame rate:** 60 Hz and 120 Hz give the same levels. Tested in Task 1.
4. **Track switch mid-drop into a quiet track:** the range re-adapts within a few seconds rather than staying dark. Task 1 has a browser check.
5. **Mixed faces stay legible,** with no letters colliding badly in wide faces. Task 3 has a screenshot check and a fallback rule.

---

### Task 1: Adaptive band range (2a)

**Files:**
- Create: `src/audio/bands.ts`, `src/audio/bands.test.ts`
- Modify: `src/audio/MusicEngine.ts` (`writeBands`: drop `DB_CEIL`, `PEAK_DECAY`, `PEAK_FLOOR` and `peaks`; pass `dt`), `src/audio/MusicEngine.test.ts` if an expectation changes

**Interfaces:**
- Produces: `class BandNormaliser { update(db: number, dt: number): number; reset(): void }`, `BAND_RANGE`, `SILENCE_DB`

- [ ] **Step 1: Baseline (root cause first).** In the browser (`?debug`, audio muted), play `generate-utopia` from 120 s, and `bend-tiesto` from 60 s, for 6 s each. Per band, record the fraction of frames with `__music.frame.bands[b] >= 0.999`. Per subtitle line, record the number of distinct `"wght"` values in `style.fontVariationSettings`. Write the numbers into your report. The expectation is that most bands are pinned near 1 and lines show 1–2 weights. If they aren't, stop and investigate with superpowers:systematic-debugging before changing anything.

- [ ] **Step 2: Write the failing tests** (`src/audio/bands.test.ts`)

```ts
import { describe, expect, it } from "vitest";

import { BandNormaliser } from "./bands";

/** Feed `seconds` of a dB signal sampled at `hz`; returns [time, level] pairs. */
function run(normaliser: BandNormaliser, signal: (t: number) => number, seconds: number, hz: number, from = 0) {
  const out: [number, number][] = [];
  for (let i = 1; i <= seconds * hz; i++) {
    const t = from + i / hz;
    out.push([t, normaliser.update(signal(t), 1 / hz)]);
  }
  return out;
}

const loud = (t: number) => -8 + 4 * Math.sin(2 * Math.PI * 2 * t); // a loud passage: −12 … −4 dB, 2 Hz

describe("BandNormaliser", () => {
  it("keeps moving through a loud passage instead of pinning at 1", () => {
    const levels = run(new BandNormaliser(), loud, 10, 120).slice(-600).map(([, level]) => level);
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.5);
    expect(levels.filter((level) => level >= 0.999).length / levels.length).toBeLessThan(0.15);
  });

  it("is frame-rate independent", () => {
    const at60 = run(new BandNormaliser(), loud, 10, 60).at(-1)![1];
    const at120 = run(new BandNormaliser(), loud, 10, 120).at(-1)![1];
    expect(Math.abs(at60 - at120)).toBeLessThan(0.05);
  });

  it("reaches the top within 100 ms when a quiet intro drops into a loud section", () => {
    const normaliser = new BandNormaliser();
    run(normaliser, () => -60, 5, 120);
    const after = run(normaliser, () => -20, 0.1, 120, 5);
    expect(after.at(-1)![1]).toBeGreaterThan(0.9);
  });

  it("is 0 for silence", () => {
    const normaliser = new BandNormaliser();
    expect(normaliser.update(-Infinity, 1 / 120)).toBe(0);
    expect(normaliser.update(-140, 1 / 120)).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn vitest run src/audio/bands.test.ts`
Expected: FAIL, `Cannot find module './bands'`.

- [ ] **Step 4: Implement** (`src/audio/bands.ts`)

```ts
/** Below this a band is silent (the analyser reports −Infinity for true silence). */
export const SILENCE_DB = -100;

/** Seconds and dB. The peak attacks instantly and releases slowly; the floor follows dips fast and rises slowly. */
export const BAND_RANGE = { peakRelease: 2, floorRise: 4, floorFall: 0.25, minSpan: 12 };

/**
 * Per-band automatic range, in dB: a peak follower and a floor follower define where this band has been living
 * lately, so a loud passage still spans 0..1 instead of clipping at a fixed ceiling. Time-based (dt in seconds).
 */
export class BandNormaliser {
  private peak = -Infinity;
  private floor = -Infinity;

  constructor(private readonly range = BAND_RANGE) {}

  update(db: number, dt: number): number {
    if (!Number.isFinite(db) || db < SILENCE_DB) return 0;
    const { peakRelease, floorRise, floorFall, minSpan } = this.range;
    if (!Number.isFinite(this.peak)) {
      this.peak = db;
      this.floor = db - minSpan;
    }
    this.peak = db > this.peak ? db : this.peak + (db - this.peak) * (1 - Math.exp(-dt / peakRelease));
    this.floor += (db - this.floor) * (1 - Math.exp(-dt / (db < this.floor ? floorFall : floorRise)));
    const span = Math.max(minSpan, this.peak - this.floor);
    return Math.min(1, Math.max(0, (db - (this.peak - span)) / span));
  }

  reset(): void {
    this.peak = -Infinity;
    this.floor = -Infinity;
  }
}
```

- [ ] **Step 5: Run to verify it passes.** Run `yarn vitest run src/audio/bands.test.ts`; expect PASS (4 tests). If the range test fails, tune only `BAND_RANGE` values, then record a `Ruling:` line.

- [ ] **Step 6: Wire into the engine.** In `MusicEngine`:
  - keep `private readonly normalisers = Array.from({ length: BAND_COUNT }, () => new BandNormaliser())`;
  - pass `nowMs` into `writeBands`, with `dt = clamp((nowMs - lastBandsMs) / 1000, 0, 0.1)`;
  - set `bands[b] = this.normalisers[b].update(meanDb, dt)`, where `meanDb` is the mean dB of the band's bins as today;
  - remove `DB_CEIL`, `PEAK_DECAY`, `PEAK_FLOOR` and `peaks`;
  - when not playing and not jamming, keep `bands.fill(0)` and don't update the normalisers.

  Run the full `yarn test`. If "normalises live bands while playing" changes, update only its expectation and say why in the commit message.

- [ ] **Step 7: Verify in the browser.** Repeat Step 1's measurements after the change and put before/after in the report. Target: fewer than 15% of frames pinned (≥ 0.999) per band in both passages, and ≥ 4 distinct weights per subtitle line in 6 s. Also switch from a loud drop (`generate-utopia` 120 s) to the start of `empty-lightning`: the lines move again within 3 s.

- [ ] **Step 8: Commit.** `git commit -m "fix(eq): adaptive per-band range so the subtitles keep moving in loud passages"`

### Task 2: Mixed-face name (2b): face assignments

**Files:**
- Modify: `src/choreography/faces.ts`, `src/choreography/faces.test.ts` (rewrite for the new API; keep every existing behaviour covered)

**Interfaces:**
- Produces:
  - `createFaceWave(words: readonly number[]): FaceWave`, where `words[i]` is letter i's word index and `-1` means a space;
  - `advanceFaces(wave, frame)` (unchanged signature);
  - `letterFace(wave, time, distance, index): string`;
  - `SPREAD = 5`.
- Consumes: `CYCLE_FONTS`, `DOTO`, `GOLOS` (unchanged).

- [ ] **Step 1: Write the failing tests** (replace the "header faces" describe block; keep the `CYCLE_FONTS` order test and the `fitScale` tests as they are)

```ts
// "(faiz)aan sakib": (faiz) | aan | space | sakib
const WORDS = [0, 0, 0, 0, 0, 0, 1, 1, 1, -1, 2, 2, 2, 2, 2];
const faces = (wave: FaceWave, time: number) => WORDS.map((_, i) => letterFace(wave, time, 0, i));

it("starts all Golos, then gives each word its own font per calm bar", () => {
  const wave = createFaceWave(WORDS);
  expect(new Set(faces(wave, 0))).toEqual(new Set([GOLOS]));
  advanceFaces(wave, downbeat(2));
  const now = faces(wave, 2);
  expect(new Set(now.slice(0, 6)).size).toBe(1); // (faiz) shares a font
  expect(new Set(now.slice(10)).size).toBe(1); // sakib shares a font
  expect(new Set([now[0], now[6], now[10]]).size).toBe(3); // three different fonts
});

it("still walks every font in order (word 0 over 13 calm bars)", () => {
  const wave = createFaceWave(WORDS);
  const seen: string[] = [];
  for (let bar = 1; bar <= CYCLE_FONTS.length; bar++) {
    advanceFaces(wave, downbeat(2 * bar));
    seen.push(letterFace(wave, 2 * bar, 0, 0));
  }
  expect(seen).toEqual([...CYCLE_FONTS]);
});

it("gives neighbouring letters different fonts on each beat of a drop", () => {
  const wave = createFaceWave(WORDS);
  advanceFaces(wave, beat(1, { sectionLevel: 1 }));
  const now = faces(wave, 1).filter((_, i) => WORDS[i] >= 0);
  now.slice(1).forEach((family, i) => expect(family).not.toBe(now[i]));
  expect(new Set(now).size).toBeGreaterThanOrEqual(10);
});

it("hits drops in Doto and returns to Golos across the whole name", () => {
  const wave = createFaceWave(WORDS);
  advanceFaces(wave, downbeat(4, { sectionLevel: 1, sectionChanged: true }));
  expect(new Set(faces(wave, 4))).toEqual(new Set([DOTO]));
  advanceFaces(wave, downbeat(8, { sectionChanged: true }));
  expect(new Set(faces(wave, 8))).toEqual(new Set([GOLOS]));
});
```

Also port the existing tests for the new API, each with the same intent:
- calm steps only on downbeats;
- drops step on every beat;
- the sweep outward from the head (use index 0 and a far distance);
- overlapping waves;
- no change while paused;
- time going backwards collapses to the latest assignment everywhere.

- [ ] **Step 2: Run to verify it fails.** Run `yarn vitest run src/choreography/faces.test.ts`; expect FAIL, since `createFaceWave` takes no words and `letterFace` has no index.

- [ ] **Step 3: Implement.** Change `FaceStep` to `{ families: readonly string[]; at: number | null }`, and `FaceWave` to `{ steps: FaceStep[]; next: number; words: readonly number[] }`. Then:

```ts
/** Offset between neighbouring words/letters in the cycle: 5 is coprime with 13, so neighbours never share a font. */
export const SPREAD = 5;

const uniform = (wave: FaceWave, family: string) => wave.words.map(() => family);
const cycleAt = (offset: number) => CYCLE_FONTS[offset % CYCLE_FONTS.length];

export function createFaceWave(words: readonly number[]): FaceWave {
  return { steps: [{ families: words.map(() => GOLOS), at: null }], next: 0, words };
}

// in advanceFaces, replacing the pushes:
//   sectionChanged        → push(wave, uniform(wave, level 1 ? DOTO : GOLOS), time)
//   drop beat             → push(wave, wave.words.map((_, i) => cycleAt(wave.next + i * SPREAD)), time); next++
//   calm downbeat         → push(wave, wave.words.map((w) => cycleAt(wave.next + Math.max(0, w) * SPREAD)), time); next++
// (spaces render nothing; giving them their neighbour's word font keeps the maths simple)

export function letterFace(wave: FaceWave, time: number, distance: number, index: number): string {
  for (let i = wave.steps.length - 1; i > 0; i--) {
    const { families, at } = wave.steps[i];
    if (at === null || time - at >= distance / SHOCKWAVE_SPEED) return families[index];
  }
  return wave.steps[0].families[index];
}
```

Keep the "time went backwards" collapse, now keeping the latest `families`. Update the doc comments so they describe word/letter faces.

- [ ] **Step 4: Run to verify it passes.** Run `yarn vitest run src/choreography/faces.test.ts` (PASS), then `yarn test` (all pass).

- [ ] **Step 5: Commit.** `git commit -m "feat(header): per-word faces when calm, per-letter faces in drops"`

### Task 3: Mixed-face name (2b): header wiring and look

**Files:**
- Modify: `src/components/NameHeader/index.tsx`

- [ ] **Step 1: Wire it.**
  - Derive `WORDS` from `NAME` with the segmentation `(faiz) | aan | space | sakib`, i.e. `[0,0,0,0,0,0,1,1,1,-1,2,2,2,2,2]`. Build it from a `NAME_WORDS = ["(faiz)", "aan", " ", "sakib"]` constant rather than hard-coding the numbers.
  - Create the wave with `createFaceWave(WORDS)`, and call `letterFace(state.faces, frame.time, distance, i)` for letter `i`.
  - Font size and variation stay per-letter by that letter's face, as today.
- [ ] **Step 2: Look at it.**
  - With `?debug` and muted audio, play `empty-lightning`. Screenshot a calm bar (`seek(2)` then wait for the next bar), and a drop beat (`seek(22)`).
  - Also screenshot the widest faces mixed together; set the letters' styles by hand while paused, as the tests do.
  - Judge legibility. If per-letter drops read as noise, keep per-word in drops but step it per beat (a one-line change in `advanceFaces` plus its test), and record `Ruling:` with the screenshots as evidence.
- [ ] **Step 3: Measure performance.**
  - The per-frame JS cost of `NameHeader`'s callback: record 600 frames with `performance.now()`; p95 ≤ 1 ms.
  - Frame drops, if your page can be the foreground tab, using the snippet below, at `seek(2)` and `seek(22)` of `empty-lightning`. Before this change: calm ~0.4–1% slow frames, drop mean ~10%.
  - Report both.

```js
// frame-drop % over 6 s (>12.5 ms at 120 Hz); run in the page console after entering, with ?debug
async (at) => { const e = window.__music; e.seek(at); await new Promise(r => setTimeout(r, 1200)); const d = []; let last = performance.now(); const t0 = last; await new Promise(done => { const tick = (now) => { d.push(now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); }); d.shift(); return (d.filter(x => x > 12.5).length / d.length * 100).toFixed(1) + '%'; }
```

- [ ] **Step 4: Run all checks and commit.** Run `yarn test`, `yarn lint` and `yarn build`, then `git commit -m "feat(header): the name wears several fonts at once"`

## Acceptance (report with evidence)
- Tests, lint and build are green, with counts.
- Band pinning and distinct-weight numbers, before and after.
- Screenshots: calm per-word and drop per-letter.
- The per-frame cost.
- Any `Ruling:` lines.
