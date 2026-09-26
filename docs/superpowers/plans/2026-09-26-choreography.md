# Choreography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chrome head nod on the beat, have the name and Doto lines play the song, flip the type on drops, and re-cut the glass shards on bars. Also harden the engine and transport (review minors M1, M4–M6).

**Architecture:**
- Pure motion math lives in `src/choreography/` and is unit-tested.
- The r3f `Head` reads `engine.frame` in `useFrame`.
- DOM components (`NameHeader`, `SubtitleStack`, `GlassPanel`) subscribe with `useMusicFrame` and write element-scoped styles through a change cache (`setStyle`).
- React renders only for shard re-cuts.

**Tech Stack:** React 18, @react-three/fiber 8, @react-three/drei 9 (`useGLTF`, `Environment`, `Lightformer`), three 0.173, maath 0.10 (`damp`), styled-components 6, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-26-choreography-design.md`

## Global Constraints

- **Per-frame work:**
  - Only the ticker calls `engine.update`; r3f reads `engine.frame`, and DOM code uses `useMusicFrame`.
  - No per-frame React state.
  - Per-frame DOM writes go through `setStyle` (element-scoped, never `:root`).
- **Head constants:**
  - material: color `#ff8a1c`, metalness 1, roughness 0.22, envMapIntensity 1.3, emissive `#ff6a00` at 0.04 (+0.2·kick·energy);
  - nod spring k 900 / c 45, roll spring k 120 / c 18;
  - nod lead 0.05 s; half-time above 135 BPM; downbeat accent ×1.35; amplitude (2.5° + 6.5°·energy) × accent × beatConfidence;
  - mouse clamp ±22° yaw / ±10° pitch, smoothTime 0.35 s;
  - camera z 5 − 0.35·section; rim 1.5 + 10·snare.
- **Type constants:**
  - shockwave speed 2200 px/s;
  - header weight min(900, 600 + 100·section + 300·(0.5+0.5·energy)·kick), quantised to 10;
  - EQ attack 0.015 s / release 0.22 s, weight 100 + 800·level;
  - idle scan 200–700 over 4 s;
  - drop face Doto 0.8em `"wght" 900, "ROND" 100`.
- **Shards:** re-cut every 2 bars (level 0) or every bar (level 1) on downbeats; 3–5 shards, or 6–8 on drops; idle re-cut every 4 s; opacity base × (0.55 + 0.45·energy).
- **Reduced motion:**
  - head: no nod, sway, squash, emissive pulse, camera move or breathing; mouse range halved;
  - type: static (`"wght" 700` header, `"wght" 500` lines), no flips;
  - shards: no re-cuts.
- **Code style:**
  - match existing code: double quotes, semicolons, 2-space indent, `React.FC`, `*.styled.ts`;
  - `import/order` — sibling `./` imports sort before parent `../` imports;
  - type-only imports use `import type`;
  - styled-components props are transient (`$`).
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Seek or track switch into or out of a drop.** Letters must snap to the correct face (no half-flipped header stuck). The kick history must not replay stale kicks after time goes backwards. Pinned in Task 3: "snaps without an edge" and "push with an earlier time resets the history".
2. **Tab hidden for minutes, then shown.** No spring explosion (dt clamp), no burst of shard re-cuts, and the head settles within a beat. Pinned in Task 2: "stays stable with a huge dt". Pinned in Task 4: "re-cuts once, not once per missed bar, after a jump".
3. **Window resize while a drop is showing.** Letter widths are re-measured in the Golos face, not the Doto face. Pinned in Task 6, Step 6 (browser).
4. **Reduced-motion preference toggled at runtime.** Every consumer reads `prefersReducedMotion()` per frame, so it takes effect without a reload. Pinned in Task 8, Step 3 (browser).
5. **A suspended AudioContext (iOS interruption).** Visuals go idle and time freezes, and Space resumes the context. Pinned in Task 1: "freezes time and reports not playing while the context is suspended". Task 1, Step 6 (browser) covers Space.

---

### Task 1: Engine and transport hardening (M1, M4, M5, M6)

**Files:**
- Modify: `src/audio/MusicEngine.ts` (`update`, `audibleContextTime`)
- Test: `src/audio/MusicEngine.test.ts`
- Modify: `src/components/Transport/index.tsx` (Space unlocks; no focus on mouse-down; mute naming)
- Modify: `src/components/Splash/index.tsx` (portal + `#root` inert)

**Interfaces:**
- Consumes: the existing engine and components.
- Produces:
  - `frame.isPlaying` is false while the AudioContext isn't `running`, and time freezes.
  - The splash is rendered in a portal on `document.body`.

- [ ] **Step 1: Write the failing engine test**

In `src/audio/MusicEngine.test.ts`, inside `describe("frames", …)`, add before `it("is idempotent for the same timestamp"`:

```ts
  it("freezes time and reports not playing while the context is suspended", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    engine.update(1000);
    ctx().state = "suspended";
    ctx().currentTime = 1.03;
    const frozen = engine.update(2000).time;
    expect(frozen).toBeCloseTo(1.03 - 0.005 - 0.02 - 0.05);
    expect(engine.frame.isPlaying).toBe(false);
    expect(engine.update(3000).time).toBeCloseTo(frozen);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn test src/audio/MusicEngine.test.ts`
Expected: FAIL. The stale output timestamp extrapolates to about 1.95.

- [ ] **Step 3: Freeze the clock while not running**

In `src/audio/MusicEngine.ts`, replace the body of `update` from `if (nowMs === this.lastNow)` through `this.writeBands(playing);` with:

```ts
    if (nowMs === this.lastNow) return this.frame;
    this.lastNow = nowMs;
    // A suspended/interrupted context (iOS call, Siri) freezes currentTime: visuals go idle with it.
    const running = this.ctx !== null && this.ctx.state === "running";
    const playing = this.source !== null && running;
    let time = this.pausedAt;
    if (this.source && this.ctx) {
      time = Math.max(
        this.timeFloor,
        this.songTimeAtContext(this.audibleContextTime(nowMs) + this.visualLead + this.userOffset)
      );
      this.timeFloor = time;
    }
    const map = this.tracks[this.current].map;
    if (map) writeFrame(this.frame, map, time, playing, this.cursors);
    else clearFrame(this.frame, time, playing);
    this.writeBands(playing);
```

In `audibleContextTime`, change the condition that uses the output timestamp so it first requires `ctx.state === "running"`:

```ts
    if (
      ctx.state === "running" &&
      stamp?.contextTime !== undefined &&
      stamp.performanceTime !== undefined &&
      stamp.performanceTime > 0
    ) {
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/audio/MusicEngine.test.ts`
Expected: PASS (29 tests).

- [ ] **Step 5: Transport and splash fixes**

In `src/components/Transport/index.tsx`:
- add `const keepFocus = (event: { preventDefault(): void }) => event.preventDefault();` below `CONTROLS` (a structural type avoids shadowing the DOM `MouseEvent` in this file);
- in the key handler, change the toggle branch to:

```ts
      if (action === "toggle") {
        event.preventDefault();
        engine.unlock(); // resumes a suspended context from this key gesture
        engine.toggle();
      } else if (action === "mute") {
```

- add `onMouseDown={keepFocus}` to all three `Styled.Control` buttons;
- replace the mute button's `aria-pressed={muted}` with `aria-label={muted ? "Unmute music" : "Mute music"}`.

In `src/components/Splash/index.tsx`:
- add `import { createPortal } from "react-dom";` after the `react` import;
- add this effect after the fade-timer effect:

```tsx
  const open = phase !== "gone";
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("root");
    if (!root) return;
    root.inert = true; // nothing behind the veil can take focus or clicks
    return () => {
      root.inert = false;
    };
  }, [open]);
```

- wrap the returned `<Styled.Veil …>…</Styled.Veil>` in `createPortal(…, document.body)`.

- [ ] **Step 6: Verify**

Run: `node node_modules/typescript/bin/tsc -b && yarn lint && yarn test`
Expected: all exit 0.

In Chrome (dev server with the mute `initScript`, see Task 5, Step 7) at `http://localhost:5191/?debug` (which exposes `__music`):

| Check | Expected |
|---|---|
| Press Shift+Tab from the focused "enter" | `document.activeElement` is not inside `#root` |
| Enter, click "next" with the mouse, press Space | playback toggles (it does not skip again) |
| Transport a11y snapshot | shows "Mute music" |
| Evaluate `await __music.audioContext.suspend()`, then press Space | playback resumes: `__music.audioContext.state === "running"` after two Space presses |

- [ ] **Step 7: Commit**

```bash
git add src/audio/MusicEngine.ts src/audio/MusicEngine.test.ts src/components/Transport/index.tsx src/components/Splash/index.tsx
git commit -m "fix: freeze visuals while audio is suspended; keep focus inside the splash; tidy transport a11y

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Nod model

**Files:**
- Create: `src/choreography/nod.ts`
- Test: `src/choreography/nod.test.ts`

**Interfaces:**
- Consumes: `MusicFrame` (`src/audio/types.ts`).
- Produces:
  - `bob(phase: number, period: number): number`
  - `interface NodDrive { phase: number; period: number; accent: number }`
  - `nodDrive(frame: Pick<MusicFrame, "bpm" | "beat" | "beatIndex" | "barPhase">): NodDrive`
  - `class Spring { value; velocity; constructor(stiffness, damping); step(target, dt): number }`
  - Constants `HALF_TIME_BPM = 135`, `NOD_LEAD = 0.05`, `DOWNBEAT_ACCENT = 1.35`.

- [ ] **Step 1: Write the failing tests**

Create `src/choreography/nod.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { bob, DOWNBEAT_ACCENT, nodDrive, Spring } from "./nod";

/** Frame fields for a map with beat0 = 0 and the given downbeat offset. */
function beatFrame(bpm: number, beat: number, downbeatMod = 0) {
  const beatIndex = Math.floor(beat);
  const relative = beat - downbeatMod;
  const barIndex = Math.floor(Math.floor(relative) / 4);
  return { bpm, beat, beatIndex, barPhase: (relative - barIndex * 4) / 4 };
}

describe("bob", () => {
  it("peaks on the beat and is continuous across the wrap", () => {
    expect(bob(0, 0.5)).toBeCloseTo(1);
    expect(Math.abs(bob(0.9999, 0.5) - bob(0, 0.5))).toBeLessThan(0.01);
  });

  it("lifts (goes negative) before the beat", () => {
    let lowest = Infinity;
    for (let p = 0.6; p < 0.95; p += 0.01) lowest = Math.min(lowest, bob(p, 0.5));
    expect(lowest).toBeLessThan(-0.05);
  });
});

describe("nodDrive", () => {
  it("samples the curve NOD_LEAD early", () => {
    const drive = nodDrive(beatFrame(120, 0.9));
    expect(drive.phase).toBeCloseTo(0);
    expect(drive.period).toBeCloseTo(0.5);
    expect(drive.accent).toBe(1);
  });

  it("accents nods that land on a downbeat", () => {
    expect(nodDrive(beatFrame(120, 3.9)).accent).toBe(DOWNBEAT_ACCENT);
  });

  it("goes half-time above 135 BPM, landing on the downbeat and the third beat", () => {
    const early = nodDrive(beatFrame(150, 3.9, 3));
    expect(early.period).toBeCloseTo(0.8);
    expect(early.phase).toBeCloseTo(0.5125);
    expect(early.accent).toBe(1); // next landing is beat 5 (third beat of the bar)
    expect(nodDrive(beatFrame(150, 6.9, 3)).accent).toBe(DOWNBEAT_ACCENT); // landing on beat 7, a downbeat
  });
});

describe("Spring", () => {
  it("converges on its target", () => {
    const spring = new Spring(900, 45);
    for (let i = 0; i < 240; i++) spring.step(1, 1 / 120);
    expect(spring.value).toBeCloseTo(1, 3);
  });

  it("stays stable with a huge dt (tab hidden for minutes)", () => {
    const spring = new Spring(900, 45);
    const value = spring.step(1, 120);
    expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(value)).toBeLessThan(2);
  });
});

describe("nod landing (bob → spring at 120 fps)", () => {
  function peakOffsetsMs(bpm: number) {
    const fps = 120;
    const spring = new Spring(900, 45);
    const samples: { t: number; value: number }[] = [];
    for (let i = 0; i < 12 * fps; i++) {
      const t = i / fps;
      const drive = nodDrive(beatFrame(bpm, t / (60 / bpm)));
      samples.push({ t, value: spring.step(bob(drive.phase, drive.period), 1 / fps) });
    }
    const period = nodDrive(beatFrame(bpm, 0)).period;
    const offsets: number[] = [];
    for (let landing = period * 4; landing < 11; landing += period) {
      const window = samples.filter((s) => Math.abs(s.t - landing) < period / 2);
      const peak = window.reduce((best, s) => (s.value > best.value ? s : best));
      offsets.push((peak.t - landing) * 1000);
    }
    return offsets.sort((a, b) => a - b);
  }

  for (const bpm of [113.01, 120, 149.98]) {
    it(`peaks within ±12 ms of each landing at ${bpm} BPM`, () => {
      const offsets = peakOffsetsMs(bpm);
      expect(Math.abs(offsets[offsets.length >> 1])).toBeLessThanOrEqual(12);
    });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/choreography`
Expected: FAIL, `Cannot find module './nod'`.

- [ ] **Step 3: Implement**

Create `src/choreography/nod.ts`:

```ts
import type { MusicFrame } from "../audio/types";

/** Rebound after the nod lands: decay (s) and oscillation (Hz) — ≈17% overshoot at ~190 ms. */
const REBOUND_TAU = 0.11;
const REBOUND_HZ = 2.6;
/** Anticipation lift before the beat, as a fraction of the amplitude. */
const LIFT = 0.25;
const BEATS_PER_BAR = 4;

/** Nod every other beat above this tempo. */
export const HALF_TIME_BPM = 135;
/** Sample the authored curve this far ahead to cancel the smoothing spring's lag. */
export const NOD_LEAD = 0.05;
export const DOWNBEAT_ACCENT = 1.35;

/**
 * Authored head-bob curve over one nod cycle: +1 = chin fully down, exactly on the beat (phase 0);
 * a damped rebound after it, and a small lift then an accelerating drop into the next beat.
 */
export function bob(phase: number, period: number): number {
  const seconds = phase * period;
  const rebound = Math.exp(-seconds / REBOUND_TAU) * Math.cos(2 * Math.PI * REBOUND_HZ * seconds);
  const window = Math.min(0.3 * period, 0.2);
  const toNext = period - seconds;
  if (toNext >= window) return rebound;
  const u = 1 - toNext / window;
  return rebound - LIFT * Math.sin(Math.PI * u) + u * u * u;
}

export interface NodDrive {
  /** 0..1 through the current nod cycle; 0 = the nod lands. */
  phase: number;
  /** Seconds per nod cycle (one beat, or two in half-time). */
  period: number;
  /** DOWNBEAT_ACCENT when the nearest landing is a downbeat, else 1. */
  accent: number;
}

const mod = (value: number, n: number) => ((value % n) + n) % n;

/** Where the nod is for a frame: sampled NOD_LEAD early, half-time above 135 BPM (landing on beats 1 and 3). */
export function nodDrive(frame: Pick<MusicFrame, "bpm" | "beat" | "beatIndex" | "barPhase">): NodDrive {
  const beatSeconds = 60 / frame.bpm;
  const beatsPerNod = frame.bpm > HALF_TIME_BPM ? 2 : 1;
  const beatInBar = Math.floor(frame.barPhase * BEATS_PER_BAR + 1e-6);
  const downbeat = frame.beatIndex - beatInBar;
  const cycles = (frame.beat + NOD_LEAD / beatSeconds - downbeat) / beatsPerNod;
  const cycle = Math.floor(cycles);
  const phase = cycles - cycle;
  const landing = (phase < 0.5 ? cycle : cycle + 1) * beatsPerNod;
  return {
    phase,
    period: beatSeconds * beatsPerNod,
    accent: mod(landing, BEATS_PER_BAR) === 0 ? DOWNBEAT_ACCENT : 1,
  };
}

/** Second-order spring (unit mass), sub-stepped at 240 Hz; dt is clamped so a hidden tab can't blow it up. */
export class Spring {
  value = 0;
  velocity = 0;
  private readonly stiffness: number;
  private readonly damping: number;

  constructor(stiffness: number, damping: number) {
    this.stiffness = stiffness;
    this.damping = damping;
  }

  step(target: number, dt: number): number {
    const clamped = Math.min(Math.max(dt, 0), 0.1);
    const steps = Math.max(1, Math.ceil(clamped * 240));
    const h = clamped / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (this.stiffness * (target - this.value) - this.damping * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/choreography`
Expected: PASS (10 tests).

- [ ] **Step 5: Type-check, lint, commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js src/choreography`
Expected: exit 0.

```bash
git add src/choreography/nod.ts src/choreography/nod.test.ts
git commit -m "feat(choreography): add beat-locked nod curve, drive and spring

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Typography math and the style-write cache

**Files:**
- Create: `src/choreography/type.ts`, `src/choreography/dom.ts`
- Test: `src/choreography/type.test.ts`, `src/choreography/dom.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type.ts`:
    - constants `SHOCKWAVE_SPEED = 2200`, `EQ_ATTACK = 0.015`, `EQ_RELEASE = 0.22`
    - `quantise(value: number, step: number): number`
    - `class KickHistory { push(time, value); at(time): number; clear() }`
    - `headerWeight(section, energy, kick): number`
    - `vuStep(current, target, dt): number`
    - `eqWeight(level): number`
    - `idleScanWeight(seconds, line): number`
    - `interface FlipState { level: 0 | 1; changedAt: number | null }`
    - `createFlipState(): FlipState`
    - `updateFlip(state, level: 0 | 1, changed: boolean, time: number): void`
    - `letterFlipped(state, time, distance): boolean`
  - `dom.ts`:
    - `type StyleProp = "fontVariationSettings" | "transform" | "fontFamily" | "fontSize" | "opacity"`
    - `setStyle(el: HTMLElement, prop: StyleProp, value: string): void`
    - `forgetStyles(el: HTMLElement): void`

- [ ] **Step 1: Write the failing tests**

Create `src/choreography/type.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  createFlipState,
  eqWeight,
  headerWeight,
  idleScanWeight,
  KickHistory,
  letterFlipped,
  quantise,
  updateFlip,
  vuStep,
} from "./type";

describe("KickHistory", () => {
  it("returns the latest value at or before a time", () => {
    const kicks = new KickHistory(4);
    kicks.push(1, 0.5);
    kicks.push(2, 0.8);
    expect(kicks.at(0.5)).toBe(0);
    expect(kicks.at(1.5)).toBe(0.5);
    expect(kicks.at(2.5)).toBeCloseTo(0.8);
  });

  it("keeps only the most recent entries", () => {
    const kicks = new KickHistory(2);
    kicks.push(1, 0.1);
    kicks.push(2, 0.2);
    kicks.push(3, 0.3);
    expect(kicks.at(1.5)).toBe(0);
    expect(kicks.at(2.5)).toBeCloseTo(0.2);
  });

  it("push with an earlier time resets the history (seek backwards)", () => {
    const kicks = new KickHistory(8);
    kicks.push(10, 1);
    kicks.push(4, 0.25);
    expect(kicks.at(9)).toBeCloseTo(0.25);
    expect(kicks.at(3)).toBe(0);
  });
});

describe("weights", () => {
  it("drives the header weight from section, energy and kick, capped at 900", () => {
    expect(headerWeight(0, 0, 0)).toBe(600);
    expect(headerWeight(0, 0, 1)).toBe(750);
    expect(headerWeight(1, 1, 1)).toBe(900);
  });

  it("maps EQ levels to Doto weight and quantises", () => {
    expect(eqWeight(0)).toBe(100);
    expect(eqWeight(1)).toBe(900);
    expect(quantise(733, 10)).toBe(730);
  });

  it("attacks faster than it releases", () => {
    const up = vuStep(0, 1, 0.015);
    const down = 1 - vuStep(1, 0, 0.015);
    expect(up).toBeCloseTo(1 - Math.exp(-1));
    expect(up).toBeGreaterThan(down);
  });

  it("idle scan stays within 200–700", () => {
    for (let t = 0; t < 8; t += 0.1) {
      for (let line = 0; line < 6; line++) {
        const w = idleScanWeight(t, line);
        expect(w).toBeGreaterThanOrEqual(200);
        expect(w).toBeLessThanOrEqual(700);
      }
    }
  });
});

describe("drop flip", () => {
  it("animates outward from the head when a section change fires", () => {
    const state = createFlipState();
    updateFlip(state, 1, true, 10);
    expect(letterFlipped(state, 10, 0)).toBe(true);
    expect(letterFlipped(state, 10, 440)).toBe(false);
    expect(letterFlipped(state, 10.21, 440)).toBe(true);
  });

  it("snaps without an edge (seek, track switch)", () => {
    const state = createFlipState();
    updateFlip(state, 1, false, 50);
    expect(letterFlipped(state, 50, 1000)).toBe(true);
  });

  it("flips back outward when the section calms", () => {
    const state = createFlipState();
    updateFlip(state, 1, true, 10);
    updateFlip(state, 0, true, 20);
    expect(letterFlipped(state, 20, 440)).toBe(true);
    expect(letterFlipped(state, 20.21, 440)).toBe(false);
  });

  it("ignores updates that don't change the level", () => {
    const state = createFlipState();
    updateFlip(state, 1, true, 10);
    updateFlip(state, 1, false, 11);
    expect(state.changedAt).toBe(10);
  });
});
```

Create `src/choreography/dom.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { forgetStyles, setStyle } from "./dom";

function recordingElement() {
  const writes: string[] = [];
  const style = new Proxy({} as Record<string, string>, {
    set(target, prop, value) {
      writes.push(`${String(prop)}=${value}`);
      target[String(prop)] = value;
      return true;
    },
  });
  return { el: { style } as unknown as HTMLElement, writes };
}

describe("setStyle", () => {
  it("writes a style only when its value changes", () => {
    const { el, writes } = recordingElement();
    setStyle(el, "transform", "a");
    setStyle(el, "transform", "a");
    setStyle(el, "transform", "b");
    setStyle(el, "opacity", "1");
    expect(writes).toEqual(["transform=a", "transform=b", "opacity=1"]);
  });

  it("writes again after forgetStyles", () => {
    const { el, writes } = recordingElement();
    setStyle(el, "fontSize", "1em");
    forgetStyles(el);
    setStyle(el, "fontSize", "1em");
    expect(writes).toEqual(["fontSize=1em", "fontSize=1em"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/choreography`
Expected: FAIL, `Cannot find module './type'` and `'./dom'`.

- [ ] **Step 3: Implement**

Create `src/choreography/type.ts`:

```ts
/** How fast a kick travels outward from the head across the name, px/s. */
export const SHOCKWAVE_SPEED = 2200;
/** VU-meter ballistics for the Doto EQ lines, seconds. */
export const EQ_ATTACK = 0.015;
export const EQ_RELEASE = 0.22;

export const quantise = (value: number, step: number): number => Math.round(value / step) * step;

/** Ring buffer of recent kick values so letters far from the head can read the kick "in the past". */
export class KickHistory {
  private readonly times: Float64Array;
  private readonly values: Float32Array;
  private head = -1;
  private count = 0;

  constructor(size = 64) {
    this.times = new Float64Array(size);
    this.values = new Float32Array(size);
  }

  push(time: number, value: number): void {
    if (this.count > 0 && time < this.times[this.head]) this.clear(); // time went backwards (seek)
    this.head = (this.head + 1) % this.times.length;
    this.times[this.head] = time;
    this.values[this.head] = value;
    this.count = Math.min(this.count + 1, this.times.length);
  }

  /** Latest value at or before `time` (0 if none is that old). */
  at(time: number): number {
    for (let n = 0; n < this.count; n++) {
      const i = (this.head - n + this.times.length) % this.times.length;
      if (this.times[i] <= time) return this.values[i];
    }
    return 0;
  }

  clear(): void {
    this.head = -1;
    this.count = 0;
  }
}

export function headerWeight(section: number, energy: number, kick: number): number {
  return Math.min(900, 600 + 100 * section + 300 * (0.5 + 0.5 * energy) * kick);
}

/** One step of VU ballistics: fast attack, slow release. */
export function vuStep(current: number, target: number, dt: number): number {
  const tau = target > current ? EQ_ATTACK : EQ_RELEASE;
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export function eqWeight(level: number): number {
  return 100 + 800 * level;
}

/** Idle "scan": a slow top-to-bottom weight wave over the Doto lines (4 s period). */
export function idleScanWeight(seconds: number, line: number): number {
  const wave = Math.max(0, Math.sin(2 * Math.PI * (seconds / 4 - line / 8)));
  return 200 + 500 * wave * wave;
}

export interface FlipState {
  level: 0 | 1;
  /** Song time the change started animating, or null to show the level everywhere at once. */
  changedAt: number | null;
}

export function createFlipState(): FlipState {
  return { level: 0, changedAt: null };
}

/** Track the drop level: animate on the engine's downbeat-quantised edge, snap otherwise (seek, switch, pause). */
export function updateFlip(state: FlipState, level: 0 | 1, changed: boolean, time: number): void {
  if (level === state.level) return;
  state.level = level;
  state.changedAt = changed ? time : null;
}

/** Whether a letter `distance` px from the head shows the drop face at song time `time`. */
export function letterFlipped(state: FlipState, time: number, distance: number): boolean {
  if (state.changedAt === null) return state.level === 1;
  const reached = time - state.changedAt >= distance / SHOCKWAVE_SPEED;
  return state.level === 1 ? reached : !reached;
}
```

Create `src/choreography/dom.ts`:

```ts
export type StyleProp = "fontVariationSettings" | "transform" | "fontFamily" | "fontSize" | "opacity";

const written = new WeakMap<HTMLElement, Partial<Record<StyleProp, string>>>();

/** Write an inline style only if it differs from the last value written through here (per-frame writes stay cheap). */
export function setStyle(el: HTMLElement, prop: StyleProp, value: string): void {
  let entry = written.get(el);
  if (!entry) {
    entry = {};
    written.set(el, entry);
  }
  if (entry[prop] === value) return;
  entry[prop] = value;
  el.style[prop] = value;
}

/** Forget cached values for an element whose styles were changed elsewhere. */
export function forgetStyles(el: HTMLElement): void {
  written.delete(el);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/choreography`
Expected: PASS (24 tests).

- [ ] **Step 5: Type-check, lint, commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js src/choreography`
Expected: exit 0.

```bash
git add src/choreography/type.ts src/choreography/type.test.ts src/choreography/dom.ts src/choreography/dom.test.ts
git commit -m "feat(choreography): add typography math (kick shockwave, EQ ballistics, drop flip) and style cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shard generation and cadence

**Files:**
- Create: `src/choreography/shards.ts`
- Test: `src/choreography/shards.test.ts`

**Interfaces:**
- Consumes: `MusicFrame`.
- Produces:
  - `interface ShardSpec { id; clipPath; top; left; width; height; scale; delay; duration; opacity }` (all numbers except `clipPath`)
  - `type Random = () => number`
  - `generateShards(count: number, random?: Random): ShardSpec[]`
  - `shardCount(sectionLevel: 0 | 1, random?: Random): number`
  - `recutDue(frame, lastRecutBar: number | null, reducedMotion: boolean): boolean`
  - `IDLE_RECUT_MS = 4000`

- [ ] **Step 1: Write the failing tests**

Create `src/choreography/shards.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { generateShards, recutDue, shardCount } from "./shards";

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const frame = (overrides: Partial<{ isPlaying: boolean; isDownbeat: boolean; barIndex: number; sectionLevel: 0 | 1 }>) => ({
  isPlaying: true,
  isDownbeat: true,
  barIndex: 4,
  sectionLevel: 0 as 0 | 1,
  ...overrides,
});

describe("generateShards", () => {
  it("makes in-bounds shards with valid 3–8 point polygons", () => {
    const random = seeded(7);
    for (const count of [3, 5, 8]) {
      const shards = generateShards(count, random);
      expect(shards).toHaveLength(count);
      for (const s of shards) {
        const points = s.clipPath.replace(/^polygon\(|\)$/g, "").split(", ");
        expect(points.length).toBeGreaterThanOrEqual(3);
        expect(points.length).toBeLessThanOrEqual(8);
        for (const point of points) expect(point).toMatch(/^\d+(\.\d)?% \d+(\.\d)?%$/);
        expect(s.top).toBeGreaterThanOrEqual(20);
        expect(s.top).toBeLessThanOrEqual(70);
        expect(s.left).toBeGreaterThanOrEqual(10);
        expect(s.left).toBeLessThanOrEqual(80);
        expect(s.opacity).toBeGreaterThanOrEqual(0.5);
        expect(s.opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it("cuts more shards on drops", () => {
    expect(shardCount(0, () => 0)).toBe(3);
    expect(shardCount(0, () => 0.999)).toBe(5);
    expect(shardCount(1, () => 0)).toBe(6);
    expect(shardCount(1, () => 0.999)).toBe(8);
  });
});

describe("recutDue", () => {
  it("re-cuts on downbeats every 2 bars in calm sections and every bar in drops", () => {
    expect(recutDue(frame({ barIndex: 5 }), 4, false)).toBe(false);
    expect(recutDue(frame({ barIndex: 6 }), 4, false)).toBe(true);
    expect(recutDue(frame({ barIndex: 5, sectionLevel: 1 }), 4, false)).toBe(true);
    expect(recutDue(frame({ barIndex: 4 }), null, false)).toBe(true);
  });

  it("only re-cuts on a downbeat while playing and motion is allowed", () => {
    expect(recutDue(frame({ isDownbeat: false, barIndex: 8 }), 4, false)).toBe(false);
    expect(recutDue(frame({ isPlaying: false, barIndex: 8 }), 4, false)).toBe(false);
    expect(recutDue(frame({ barIndex: 8 }), 4, true)).toBe(false);
  });

  it("re-cuts once, not once per missed bar, after a jump", () => {
    expect(recutDue(frame({ barIndex: 40 }), 4, false)).toBe(true);
    expect(recutDue(frame({ barIndex: 2 }), 40, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/choreography/shards.test.ts`
Expected: FAIL, `Cannot find module './shards'`.

- [ ] **Step 3: Implement**

Create `src/choreography/shards.ts`:

```ts
import type { MusicFrame } from "../audio/types";

export type Random = () => number;

export interface ShardSpec {
  id: number;
  clipPath: string;
  /** Viewport percent. */
  top: number;
  left: number;
  /** Pixels. */
  width: number;
  height: number;
  scale: number;
  /** Seconds. */
  delay: number;
  duration: number;
  opacity: number;
}

export const IDLE_RECUT_MS = 4000;

const between = (random: Random, lo: number, hi: number) => lo + random() * (hi - lo);
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

function outline(points: number, random: Random): string {
  const corners = Array.from({ length: points }, (_, i) => {
    const angle = (i / points) * Math.PI * 2;
    const radius = 40 + random() * 60;
    const x = clamp(50 + radius * Math.cos(angle), 0, 100);
    const y = clamp(50 + radius * Math.sin(angle), 0, 100);
    return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
  });
  return `polygon(${corners.join(", ")})`;
}

/** `count` glass shards with random 3–8 point outlines, placement, size and base opacity. */
export function generateShards(count: number, random: Random = Math.random): ShardSpec[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    clipPath: outline(3 + Math.floor(random() * 6), random),
    top: between(random, 20, 70),
    left: between(random, 10, 80),
    width: between(random, 200, 400),
    height: between(random, 150, 300),
    scale: between(random, 0.2, 1),
    delay: id * 0.2,
    duration: between(random, 8, 14),
    opacity: between(random, 0.5, 1),
  }));
}

/** 3–5 shards normally, 6–8 on a drop. */
export function shardCount(sectionLevel: 0 | 1, random: Random = Math.random): number {
  return (sectionLevel === 1 ? 6 : 3) + Math.floor(random() * 3);
}

/** Re-cut on downbeats: every 2 bars in calm sections, every bar in a drop; once after any jump. */
export function recutDue(
  frame: Pick<MusicFrame, "isPlaying" | "isDownbeat" | "barIndex" | "sectionLevel">,
  lastRecutBar: number | null,
  reducedMotion: boolean
): boolean {
  if (!frame.isPlaying || reducedMotion || !frame.isDownbeat) return false;
  if (lastRecutBar === null || frame.barIndex < lastRecutBar) return true;
  return frame.barIndex - lastRecutBar >= (frame.sectionLevel === 1 ? 1 : 2);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/choreography`
Expected: PASS (29 tests).

- [ ] **Step 5: Type-check, lint, commit**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/eslint/bin/eslint.js src/choreography`
Expected: exit 0.

```bash
git add src/choreography/shards.ts src/choreography/shards.test.ts
git commit -m "feat(choreography): add glass shard generation and bar-cadenced re-cuts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Chrome head with the beat-locked nod

**Files:**
- Create: `src/assets/head.glb` (copy of `/private/tmp/claude-501/-Users-faizaan-orca-workspaces-faizaan-tech-mandarin/53b6e84d-93a8-4770-b35e-1e8506db64c5/scratchpad/head.glb`)
- Delete: `src/assets/head.obj`
- Create: `src/hooks/reducedMotion.ts`, `src/choreography/probe.ts`
- Modify: `src/components/Head/index.tsx` (full replacement below)
- Modify: `src/App.tsx` (Canvas `dpr`, ambient light, `Suspense` around `Head`)
- Modify: `src/components/MusicDebug/index.tsx` (head-pitch readout, `window.__choreo`)

**Interfaces:**
- Consumes:
  - `engine.frame` (sub-project 1);
  - `bob`, `nodDrive`, `Spring` (Task 2).
- Produces:
  - `prefersReducedMotion(): boolean`
  - `choreographyProbe: { headPitchDeg: number; nodCurve: number; beatPhase: number }`

- [ ] **Step 1: Swap the asset and add the helpers**

Run: `cp /private/tmp/claude-501/-Users-faizaan-orca-workspaces-faizaan-tech-mandarin/53b6e84d-93a8-4770-b35e-1e8506db64c5/scratchpad/head.glb src/assets/head.glb && git rm -q src/assets/head.obj && ls -la src/assets/head.glb`

Expected: `head.glb` is about 378 KB. It was produced by:
1. `sed -i '' '/^mtllib/d;/^usemtl/d' head.obj`
2. `npx obj2gltf@3 -i head.obj -o head-raw.glb`
3. `npx @gltf-transform/cli@4 optimize head-raw.glb head.glb --compress meshopt --texture-compress false --simplify false`

Create `src/hooks/reducedMotion.ts`:

```ts
const media =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

/** The visitor's reduced-motion preference. Cheap: safe to read every frame, and live if it changes. */
export function prefersReducedMotion(): boolean {
  return media?.matches ?? false;
}
```

Create `src/choreography/probe.ts`:

```ts
/** Latest choreography values, for the ?debug overlay and browser measurements. */
export const choreographyProbe = { headPitchDeg: 0, nodCurve: 0, beatPhase: 0 };
```

- [ ] **Step 2: Replace the head component**

Replace `src/components/Head/index.tsx` with:

```tsx
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Group, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from "three";

import headModelUrl from "../../assets/head.glb?url";
import { engine } from "../../audio/engine";
import { bob, nodDrive, Spring } from "../../choreography/nod";
import { choreographyProbe } from "../../choreography/probe";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { DirectionalLight, Object3D } from "three";

const D = MathUtils.degToRad;
const CAMERA_Z = 5;
const BASE_EMISSIVE = 0.04;
const BASE_RIM = 1.5;
const MOUSE_YAW = D(22);
const MOUSE_PITCH = D(10);

/** Orient and scale the scan, and move its origin to the neck so pitch reads as a nod, not a spin. */
function prepareModel(scene: Object3D, material: MeshStandardMaterial) {
  const head = scene.clone(true);
  head.traverse((child) => {
    if (child instanceof Mesh) child.material = material;
  });
  head.rotation.set(Math.PI / 2, Math.PI, 0);
  head.scale.setScalar(0.25);
  const holder = new Group();
  holder.add(head);
  holder.updateMatrixWorld(true);
  const box = new Box3().setFromObject(holder);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  // ≈ the atlanto-occipital joint: low (22% up from the neck) and slightly behind centre
  const pivot = new Vector3(centre.x, box.min.y + size.y * 0.22, centre.z - size.z * 0.1);
  head.position.sub(pivot);
  return { holder, baseY: pivot.y - centre.y - 0.1 };
}

/** The chrome head: nods on the beat (phase-locked, with anticipation), sways with the bar, follows the mouse. */
function Head() {
  const { scene } = useGLTF(headModelUrl);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#ff8a1c",
        metalness: 1,
        roughness: 0.22,
        emissive: "#ff6a00",
        emissiveIntensity: BASE_EMISSIVE,
        envMapIntensity: 1.3,
      }),
    []
  );
  const model = useMemo(() => prepareModel(scene, material), [scene, material]);
  const rig = useRef<Group>(null);
  const rim = useRef<DirectionalLight>(null);
  const springs = useMemo(
    () => ({ pitch: new Spring(900, 45), lift: new Spring(900, 45), roll: new Spring(120, 18) }),
    []
  );
  const mouse = useRef({ yaw: 0, pitch: 0 });

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ pointer, clock, camera }, delta) => {
    const head = rig.current;
    if (!head) return;
    const frame = engine.frame;
    const reduced = prefersReducedMotion();
    const dt = Math.min(delta, 0.1);
    const reach = reduced ? 0.5 : 1;
    damp(mouse.current, "yaw", MathUtils.clamp(pointer.x, -1, 1) * MOUSE_YAW * reach, 0.35, dt);
    damp(mouse.current, "pitch", MathUtils.clamp(-pointer.y, -1, 1) * MOUSE_PITCH * reach, 0.35, dt);

    let curve = 0;
    let pitch: number;
    let lift: number;
    let roll: number;
    let yaw = 0;
    let squash = 0;
    let emissive = BASE_EMISSIVE;
    let rimIntensity = BASE_RIM;
    let cameraZ = CAMERA_Z;

    if (frame.isPlaying && frame.bpm > 0 && !reduced) {
      const drive = nodDrive(frame);
      const confidence = frame.beatConfidence;
      const amplitude = D(2.5 + 6.5 * frame.energy) * drive.accent * confidence;
      curve = bob(drive.phase, drive.period);
      pitch = springs.pitch.step(curve * amplitude, dt);
      lift = springs.lift.step(-0.05 * curve * (0.5 + frame.energy) * confidence, dt);
      roll = springs.roll.step(
        D(2.5) * (0.4 + 0.6 * frame.energy) * Math.sin(2 * Math.PI * frame.barPhase) * confidence,
        dt
      );
      yaw = D(1.5) * Math.sin(2 * Math.PI * frame.barPhase - 0.6) * confidence;
      squash = 0.012 * frame.kick;
      emissive = BASE_EMISSIVE + 0.2 * frame.kick * frame.energy;
      rimIntensity = BASE_RIM + 10 * frame.snare;
      cameraZ = CAMERA_Z - 0.35 * frame.section;
    } else {
      const t = clock.elapsedTime;
      const breathe = reduced ? 0 : 1;
      pitch = springs.pitch.step(D(0.8) * Math.sin((2 * Math.PI * t) / 4.5) * breathe, dt);
      lift = springs.lift.step(0, dt);
      roll = springs.roll.step(0, dt);
      yaw = D(2) * Math.sin(t * 0.37) * Math.sin(t * 0.23) * breathe;
    }

    head.rotation.set(mouse.current.pitch + pitch, mouse.current.yaw + yaw, roll);
    head.position.y = model.baseY + lift;
    head.scale.set(1 + squash / 2, 1 - squash, 1 + squash / 2);
    material.emissiveIntensity = emissive;
    if (rim.current) rim.current.intensity = rimIntensity;
    camera.position.z = MathUtils.lerp(camera.position.z, cameraZ, 1 - Math.exp(-3 * dt));

    choreographyProbe.headPitchDeg = MathUtils.radToDeg(pitch);
    choreographyProbe.nodCurve = curve;
    choreographyProbe.beatPhase = frame.beatPhase;
  });

  return (
    <>
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 2]} scale={[10, 3, 1]} rotation-x={Math.PI / 2} />
        <Lightformer
          form="rect"
          intensity={4}
          color="#9fd3ff"
          position={[-5, 1, -3]}
          scale={[2, 8, 1]}
          rotation-y={Math.PI / 3}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffe2b8"
          position={[5, 0, 1]}
          scale={[3, 6, 1]}
          rotation-y={-Math.PI / 2}
        />
        <Lightformer
          form="ring"
          intensity={1.5}
          color="#143d32"
          position={[0, -4, 0]}
          scale={8}
          rotation-x={-Math.PI / 2}
        />
      </Environment>
      <directionalLight ref={rim} position={[0, 2, -6]} intensity={BASE_RIM} color="#bfe6ff" />
      <group ref={rig} position-y={model.baseY}>
        <primitive object={model.holder} />
      </group>
    </>
  );
}

useGLTF.preload(headModelUrl);

export default Head;
```

- [ ] **Step 3: Update the canvas**

In `src/App.tsx`:
- add `dpr={[1, 1.75]}` to `<Canvas`;
- change `<ambientLight intensity={5} />` to `<ambientLight intensity={0.3} />`;
- wrap `<Head />` as:

```tsx
          <Suspense fallback={null}>
            <Head />
          </Suspense>
```

- [ ] **Step 4: Debug readout**

In `src/components/MusicDebug/index.tsx`:
- add `import { choreographyProbe } from "../../choreography/probe";` to the parent-import group;
- in the existing `useEffect` that sets `__music`, also set it:

```tsx
    (window as Window & { __music?: typeof engine; __choreo?: typeof choreographyProbe }).__music = engine;
    (window as Window & { __choreo?: typeof choreographyProbe }).__choreo = choreographyProbe;
```

- append to the readout string: `` + ` head=${choreographyProbe.headPitchDeg.toFixed(1)}°` ``.

- [ ] **Step 5: Type-check, lint, test**

Run: `node node_modules/eslint/bin/eslint.js --fix src && node node_modules/typescript/bin/tsc -b && yarn lint && yarn test`
Expected: all exit 0.

- [ ] **Step 6: Build and check the asset**

Run: `yarn build && ls -la dist/assets | grep -E "head|\.obj"`
Expected: one `head-*.glb` of about 378 KB, and no `.obj`.

- [ ] **Step 7: Verify in the browser**

Start dev: `node node_modules/vite/bin/vite.js --port 5191 --strictPort` (background).

Open `http://localhost:5191/?debug` with this mute `initScript`:

```js
(() => { const connect = AudioNode.prototype.connect; AudioNode.prototype.connect = function (dest, ...rest) { if (dest instanceof AudioDestinationNode) { const g = this.context.createGain(); g.gain.value = 0; connect.call(this, g); return connect.call(g, dest); } return connect.call(this, dest, ...rest); }; })();
```

Checks:
1. Before entering, the screenshot shows the head as a shaded chrome face (not a flat silhouette).
2. Network: `head-*.glb` is 200 and no `.obj` is requested.
3. Press Enter, wait 2 s, then run this `evaluate_script`:

```js
async () => {
  const e = window.__music, p = window.__choreo; const samples = [];
  await new Promise((done) => { const t0 = performance.now(); const tick = (now) => { samples.push({ beat: e.frame.beat, pitch: p.headPitchDeg }); if (now - t0 < 15000) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
  const best = new Map(); for (const s of samples) { const k = Math.round(s.beat); const cur = best.get(k); if (!cur || s.pitch > cur.pitch) best.set(k, s); }
  const offs = [...best.entries()].slice(1, -1).map(([k, s]) => ((s.beat - k) * 60000) / e.frame.bpm).sort((a, b) => a - b);
  return { beats: offs.length, medianMs: offs[offs.length >> 1], p10: offs[Math.floor(offs.length * 0.1)], p90: offs[Math.floor(offs.length * 0.9)] };
}
```

Expected: `beats ≥ 20` and `|medianMs| ≤ 12`.

4. A screenshot mid-song shows the head tilted (nodding) with chrome shading.

- [ ] **Step 8: Commit**

```bash
git add -A src/assets src/hooks src/choreography/probe.ts src/components/Head src/App.tsx src/components/MusicDebug
git commit -m "feat: chrome head from a 378 KB GLB with a beat-locked nod, bar sway and damped mouse-follow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Name header and Doto EQ lines

**Files:**
- Modify: `src/App.styled.tsx` (HeaderText without the `fontCycle` keyframes, new `Letter`, SubtitleText with transient props and no animation)
- Create: `src/components/NameHeader/index.tsx`, `src/components/SubtitleStack/index.tsx`
- Modify: `src/App.tsx` (use the two components)
- Modify: `index.html` (Doto ROND axis)

**Interfaces:**
- Consumes: `useMusicFrame` (sub-project 1); `type.ts` and `dom.ts` (Task 3); `prefersReducedMotion` (Task 5).
- Produces: `<NameHeader />` and `<SubtitleStack />` default exports.

- [ ] **Step 1: Styles**

In `src/App.styled.tsx`, replace the entire `HeaderText` definition (including its `@keyframes fontCycle` block) and the entire `SubtitleText` definition (including both keyframe blocks and the trailing `animation:` line) with:

```ts
export const HeaderText = styled.h1`
  position: fixed;
  top: 2rem;
  width: 110%;
  text-align: center;
  font-size: 12rem;
  z-index: 1;
  font-weight: 700;
  font-family: "Golos Text", sans-serif;
  white-space: nowrap;
`;

/** One character of the name; width is locked at runtime so weight changes never reflow neighbours. */
export const Letter = styled.span`
  display: inline-block;
  white-space: pre;
  text-align: center;
  font-variation-settings: "wght" 700;
`;

export const SubtitleText = styled.h2<{ $bottom: number; $left: number; $width?: number }>`
  position: fixed;
  left: ${({ $left }) => $left}%;
  bottom: ${({ $bottom }) => $bottom}%;
  width: ${({ $width }) => ($width === undefined ? "auto" : `${$width}%`)};
  font-size: 6em;
  line-height: 1;
  text-align: left;
  margin: 0;
  font-family: "Doto", sans-serif;
  font-variation-settings: "wght" 500, "ROND" 0;
`;
```

In `index.html`, change the Doto stylesheet `href` to:

```
https://fonts.googleapis.com/css2?family=Doto:ROND,wght@0..100,100..900&display=swap
```

- [ ] **Step 2: Name header**

Create `src/components/NameHeader/index.tsx`:

```tsx
import { useEffect, useMemo, useRef } from "react";

import * as Styled from "../../App.styled";
import { useMusicFrame } from "../../audio/react";
import { forgetStyles, setStyle } from "../../choreography/dom";
import {
  createFlipState,
  headerWeight,
  KickHistory,
  letterFlipped,
  quantise,
  SHOCKWAVE_SPEED,
  updateFlip,
} from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

const NAME = "(faiz)aan sakib";
const LETTERS = [...NAME];
const DROP_FONT = '"Doto", monospace';

/** The name, one span per letter: weight pulses with the kick as a shockwave from the head; flips to Doto on drops. */
const NameHeader: React.FC = () => {
  const letters = useRef<HTMLSpanElement[]>([]);
  const centres = useRef<number[]>([]);
  const state = useMemo(() => ({ kicks: new KickHistory(), flip: createFlipState() }), []);

  useEffect(() => {
    // Lock each letter to its Golos advance (measured with every runtime style cleared).
    const measure = () => {
      for (const span of letters.current) {
        forgetStyles(span);
        span.style.width = "";
        span.style.fontFamily = "";
        span.style.fontSize = "";
        span.style.fontVariationSettings = "";
        span.style.transform = "";
      }
      const widths = letters.current.map((span) => span.getBoundingClientRect().width);
      letters.current.forEach((span, i) => {
        span.style.width = `${widths[i]}px`;
      });
      centres.current = letters.current.map((span) => {
        const rect = span.getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
    };
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, []);

  useMusicFrame((frame) => {
    const active = frame.isPlaying && !prefersReducedMotion();
    state.kicks.push(frame.time, active ? frame.kick : 0);
    updateFlip(state.flip, active ? frame.sectionLevel : 0, frame.sectionChanged, frame.time);
    const headX = window.innerWidth / 2;
    letters.current.forEach((span, i) => {
      if (!active) {
        setStyle(span, "fontFamily", "");
        setStyle(span, "fontSize", "");
        setStyle(span, "fontVariationSettings", '"wght" 700');
        setStyle(span, "transform", "none");
        return;
      }
      const distance = Math.abs((centres.current[i] ?? headX) - headX);
      const kick = state.kicks.at(frame.time - distance / SHOCKWAVE_SPEED);
      const flipped = letterFlipped(state.flip, frame.time, distance);
      setStyle(span, "fontFamily", flipped ? DROP_FONT : "");
      setStyle(span, "fontSize", flipped ? "0.8em" : "");
      setStyle(
        span,
        "fontVariationSettings",
        flipped ? '"wght" 900, "ROND" 100' : `"wght" ${quantise(headerWeight(frame.section, frame.energy, kick), 10)}`
      );
      setStyle(span, "transform", `translateY(${(-0.05 * kick).toFixed(3)}em) scaleY(${(1 + 0.06 * kick).toFixed(3)})`);
    });
  });

  return (
    <Styled.HeaderText aria-label={NAME}>
      {LETTERS.map((letter, i) => (
        <Styled.Letter
          key={i}
          aria-hidden="true"
          ref={(el) => {
            if (el) letters.current[i] = el;
          }}
        >
          {letter}
        </Styled.Letter>
      ))}
    </Styled.HeaderText>
  );
};

export default NameHeader;
```

- [ ] **Step 3: Subtitle stack**

Create `src/components/SubtitleStack/index.tsx`:

```tsx
import { useMemo, useRef } from "react";

import * as Styled from "../../App.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { eqWeight, idleScanWeight, quantise, vuStep } from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

const LINES: { text: string; bottom: number; width?: number }[] = [
  { text: "senior", bottom: 52, width: 20 },
  { text: "software", bottom: 42, width: 20 },
  { text: "engineer", bottom: 32, width: 20 },
  { text: "fullstack", bottom: 22 },
  { text: "london", bottom: 12 },
  { text: "affirm", bottom: 2 },
];

/** The six Doto lines: a 6-band graphic EQ while music plays (bottom = lowest band), a slow scan when idle. */
const SubtitleStack: React.FC = () => {
  const lines = useRef<HTMLHeadingElement[]>([]);
  const levels = useMemo(() => new Float32Array(LINES.length), []);
  const lastNow = useRef(0);

  useMusicFrame((frame, now) => {
    const dt = lastNow.current ? Math.min(0.1, (now - lastNow.current) / 1000) : 0;
    lastNow.current = now;
    const reduced = prefersReducedMotion();
    lines.current.forEach((line, i) => {
      const band = LINES.length - 1 - i;
      let settings: string;
      if (reduced) {
        settings = '"wght" 500, "ROND" 0';
      } else if (frame.isPlaying) {
        levels[band] = vuStep(levels[band], frame.bands[band] ?? 0, dt);
        settings = `"wght" ${quantise(eqWeight(levels[band]), 10)}, "ROND" ${Math.round(100 * frame.section)}`;
      } else {
        levels[band] = 0;
        settings = `"wght" ${quantise(idleScanWeight(now / 1000, i), 10)}, "ROND" 0`;
      }
      setStyle(line, "fontVariationSettings", settings);
    });
  });

  return (
    <>
      {LINES.map((line, i) => (
        <Styled.SubtitleText
          key={line.text}
          $bottom={line.bottom}
          $left={2}
          $width={line.width}
          ref={(el) => {
            if (el) lines.current[i] = el;
          }}
        >
          {line.text}
        </Styled.SubtitleText>
      ))}
    </>
  );
};

export default SubtitleStack;
```

- [ ] **Step 4: Use them in the app**

In `src/App.tsx`:
- replace `<Styled.HeaderText>(faiz)aan sakib</Styled.HeaderText>` and the six `<Styled.SubtitleText …>` elements with:

```tsx
      <NameHeader />
      <SubtitleStack />
```

- add `import NameHeader from "./components/NameHeader";` and `import SubtitleStack from "./components/SubtitleStack";` to the sibling-import group.

- [ ] **Step 5: Type-check, lint, test**

Run: `node node_modules/eslint/bin/eslint.js --fix src && node node_modules/typescript/bin/tsc -b && yarn lint && yarn test`
Expected: all exit 0.

- [ ] **Step 6: Verify in the browser**

On `?debug` with the mute `initScript`:

1. **Idle:** before entering, screenshot the lines. Their Doto weights differ top to bottom (the scan), and the header is solid Golos.
2. **Header and EQ:** after Enter, sample over 3 s: `[...document.querySelectorAll('h1 span')].map(s => s.style.fontVariationSettings)` and the six `h2` values. Expected:
   - at least 3 distinct header weights appear;
   - the `h2` `"wght"` values vary between samples;
   - `ROND` > 0 when `__music.frame.section > 0`.
3. **Drop flip:** evaluate `__music.seek(20.4)` (empty-lightning's first intense bar starts at ≈21.27 s). Poll `h1 span` `fontFamily` every 50 ms for 2 s. Expected:
   - the centre letters switch to Doto first;
   - within 0.3 s all letters are Doto;
   - `__music.frame.sectionLevel === 1`.
   Then `__music.seek(5)`: all letters return to Golos immediately.
4. **Resize during a drop (Review Focus 3):** while in a drop, `window.resizeTo` is unavailable, so resize the viewport with the devtools `resize_page` to 1200×800 and back. Expected: after returning to 1450 wide, each `h1 span` `style.width` equals its Golos width. Compare with a fresh reload's widths at the same size; the difference must be < 1 px.
5. **Console:** no styled-components unknown-prop warnings for `SubtitleText`.

- [ ] **Step 7: Commit**

```bash
git add index.html src/App.styled.tsx src/App.tsx src/components/NameHeader src/components/SubtitleStack
git commit -m "feat: name pulses with a kick shockwave and flips to Doto on drops; Doto lines become a 6-band EQ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bar-cadenced glass shards and a warning-free background

**Files:**
- Modify: `src/components/GlassPanel/GlassPanel.styled.ts`, `src/components/GlassPanel/index.tsx` (full replacements below)
- Modify: `src/components/Background/Background.styled.ts`, `src/components/Background/index.tsx` (transient props)

**Interfaces:**
- Consumes: `generateShards`, `shardCount`, `recutDue`, `IDLE_RECUT_MS` (Task 4); `setStyle` (Task 3); `useMusicFrame`; `prefersReducedMotion`.
- Produces: `<GlassPanel />` (same default export).

- [ ] **Step 1: Shard styles (static CSS; per-shard values go inline, so re-cuts don't mint new classes)**

Replace `src/components/GlassPanel/GlassPanel.styled.ts` with:

```ts
import styled, { keyframes } from "styled-components";

const float = keyframes`
  0% {
    transform: translateY(0px) translateX(0px) rotateX(0deg) rotateY(0deg);
  }
  50% {
    transform: translateY(-15px) translateX(5px) rotateX(5deg) rotateY(-2deg);
  }
  100% {
    transform: translateY(0px) translateX(0px) rotateX(0deg) rotateY(0deg);
  }
`;

export const GlassPanelContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
`;

export const GlassShape = styled.div`
  position: absolute;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 0 30px rgba(255, 255, 255, 0.05);
  animation-name: ${float};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  transition: opacity 0.8s ease-out;
  transform-style: preserve-3d;
  perspective: 1000px;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
```

- [ ] **Step 2: Shard component**

Replace `src/components/GlassPanel/index.tsx` with:

```tsx
import { useRef, useState } from "react";

import { GlassPanelContainer, GlassShape } from "./GlassPanel.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { generateShards, IDLE_RECUT_MS, recutDue, shardCount } from "../../choreography/shards";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { ShardSpec } from "../../choreography/shards";

/** Frosted-glass shards: hard re-cuts on downbeats (every 2 bars, every bar in a drop), every 4 s when idle. */
const GlassPanel: React.FC = () => {
  const [cut, setCut] = useState<{ generation: number; shards: ShardSpec[] }>(() => ({
    generation: 0,
    shards: generateShards(5),
  }));
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const lastRecutBar = useRef<number | null>(null);
  const lastIdleRecut = useRef<number | null>(null);

  const recut = (level: 0 | 1) =>
    setCut((previous) => ({ generation: previous.generation + 1, shards: generateShards(shardCount(level)) }));

  useMusicFrame((frame, now) => {
    const reduced = prefersReducedMotion();
    if (recutDue(frame, lastRecutBar.current, reduced)) {
      lastRecutBar.current = frame.barIndex;
      recut(frame.sectionLevel);
    } else if (!frame.isPlaying) {
      lastRecutBar.current = null;
      if (lastIdleRecut.current === null) lastIdleRecut.current = now;
      if (!reduced && now - lastIdleRecut.current >= IDLE_RECUT_MS) {
        lastIdleRecut.current = now;
        recut(0);
      }
    }
    const gain = frame.isPlaying ? 0.55 + 0.45 * frame.energy : 1;
    cut.shards.forEach((shard, i) => {
      const node = nodes.current[i];
      if (node) setStyle(node, "opacity", (shard.opacity * gain).toFixed(2));
    });
  });

  return (
    <GlassPanelContainer>
      {cut.shards.map((shard, i) => (
        <GlassShape
          key={`${cut.generation}-${shard.id}`}
          ref={(el) => {
            nodes.current[i] = el;
          }}
          style={{
            clipPath: shard.clipPath,
            top: `${shard.top}%`,
            left: `${shard.left}%`,
            width: `${shard.width}px`,
            height: `${shard.height}px`,
            scale: String(shard.scale),
            animationDelay: `${shard.delay}s`,
            animationDuration: `${shard.duration}s`,
          }}
        />
      ))}
    </GlassPanelContainer>
  );
};

export default GlassPanel;
```

- [ ] **Step 3: Background transient props**

In `src/components/Background/Background.styled.ts`, rename the `GridLayout` props to transient: `gridWidth`→`$gridWidth`, `gridHeight`→`$gridHeight`, `columns`→`$columns`, `rows`→`$rows`, `zIndex`→`$zIndex`. Update both the generic type and each interpolation, e.g. `width: ${({ $gridWidth }) => $gridWidth}px;`.

In `src/components/Background/index.tsx`, update both `<Styled.GridLayout …>` usages to pass `$zIndex`, `$gridWidth`, `$gridHeight`, `$columns`, `$rows`.

- [ ] **Step 4: Type-check, lint, test**

Run: `node node_modules/eslint/bin/eslint.js --fix src && node node_modules/typescript/bin/tsc -b && yarn lint && yarn test`
Expected: all exit 0.

- [ ] **Step 5: Verify in the browser**

On `?debug` with the mute `initScript`, after Enter, run:

```js
async () => {
  const e = window.__music; const bars = [];
  const container = document.querySelector('[class*="GlassPanelContainer"]') ?? [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).zIndex === "5" && getComputedStyle(d).position === "fixed");
  const mo = new MutationObserver(() => bars.push({ bar: e.frame.barIndex, level: e.frame.sectionLevel, downbeatPhase: +e.frame.barPhase.toFixed(3) }));
  mo.observe(container, { childList: true });
  await new Promise((r) => setTimeout(r, 20000)); mo.disconnect();
  return bars;
}
```

Expected:
- consecutive entries differ by 2 bars when `level` is 0 and by 1 bar when it is 1;
- every `downbeatPhase` is < 0.05 (re-cut on the downbeat).

The console shows no styled-components unknown-prop warnings from `Background` or `GlassPanel`.

- [ ] **Step 6: Commit**

```bash
git add src/components/GlassPanel src/components/Background
git commit -m "feat: glass shards re-cut on bars (faster on drops) with energy opacity; transient styled props

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Acceptance pass, review, merge into the base branch

**Files:** none (verification). Fixes go into new commits.

**Interfaces:**
- Consumes: everything above.
- Produces: evidence per acceptance criterion; a `--no-ff` merge into `fznsakib/v2-music`.

- [ ] **Step 1: Build, lint and test**

Run: `yarn build && yarn lint && yarn test`
Expected: all exit 0.

- [ ] **Step 2: Production preview**

Run `vite preview --port 4173` and open it. Expected:
- `head-*.glb` is 200 and under 400 KB;
- no `.obj` is requested;
- every request is 2xx;
- enter → the nod, header pulses and EQ are visible (screenshot).

- [ ] **Step 3: Reduced motion (Review Focus 4)**

Emulate `prefers-reduced-motion: reduce`. If the devtools `emulate` tool can't set media features, use this `initScript` override:

```js
(() => { const real = window.matchMedia.bind(window); window.matchMedia = (q) => (q.includes("prefers-reduced-motion") ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q)); })();
```

After entering, sample for 5 s. Expected:
- `__choreo.headPitchDeg` stays within ±0.1° of its first value (the mouse is still);
- header spans all read `"wght" 700`;
- lines all read `"wght" 500, "ROND" 0`;
- no shard re-cuts (MutationObserver count 0).

- [ ] **Step 4: Frame budget**

While playing, record rAF deltas and long tasks for 10 s. Expected: p95 delta ≤ 1.5× the median delta, and no long tasks (> 50 ms).

- [ ] **Step 5: Whole-branch review**

Use superpowers:requesting-code-review for `772b9d1..HEAD` (against this plan and the spec, including the Review Focus list). Apply Critical and Important fixes test-first as new commits; re-run Step 1.

- [ ] **Step 6: Merge into the base**

```bash
git switch fznsakib/v2-music
git merge --no-ff fznsakib/v2-choreography -m "Merge sub-project 2: chrome head nod, typography conductor, bar-cadenced shards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
yarn test && yarn build && yarn lint
```

Expected: all exit 0 on the merged result.
