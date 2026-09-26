# Living Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (superpowers:test-driven-development on every pure function). Steps use checkbox (`- [ ]`) syntax for tracking. Project skills that apply: `create-animation`, `tune-animation`.

**Goal:** Bring the plus-grid background to life. Big plusses within a radius of the cursor turn to face it, and the mini plusses pulse in size with the music as a shockwave from the head.

**Architecture:** Replace Background's two stacked SVG grids (2 × ~700 SVG nodes) with one full-viewport `<canvas>`, redrawn from the shared music ticker (`useMusicFrame`). All maths lives in a pure, tested module, `src/choreography/grid.ts`; the component only measures, reads the pointer and draws. Mini-plus pulses reuse the header's shockwave (`KickHistory` + `SHOCKWAVE_SPEED` from `src/choreography/type.ts`), so the grid and the name ripple out from the head together.

**Tech Stack:** React 18, TypeScript (strict), Canvas 2D, Vitest.

**Spec:** the owner's request (2026-09-26, pre-approved):
> "The background is a grid of plusses (one over another). I want the whole grid to animate… have all the plusses follow the cursor, but for a given radius around the cursor so it's not the whole screen. There are two classes on each part of the grid. Maybe one of them rotates towards the cursor, and the other changes size based on the music. It just makes it a bit more dynamic."

## Global Constraints

- **At rest** (no pointer nearby, no music) the grid must look exactly as it does today:
  - 40 px cells, the grid centred, `floor(width/40)` × `floor(height/40)` cells;
  - **big plus:** `#555555`, 1 px stroke, arms from 4 to 36 px across the cell, round caps;
  - **mini plus:** `#8AB1EE` at opacity 0.5, 2 px stroke, arms from 15 to 25 px, round caps;
  - background `rgb(20, 61, 50)`; container fixed, full viewport, `z-index: -5`.
- **Drawing:** one draw per frame, from `useMusicFrame(frame, now)`. Never start a second `requestAnimationFrame` loop. The canvas backing store is CSS size × `min(devicePixelRatio, 2)`.
- **Reduced motion:** with `prefers-reduced-motion`, draw the static grid only (no turning, no pulsing), and redraw only on resize.
- **Pointer:** the canvas never takes pointer events (`pointer-events: none`). Read the pointer from `window` `pointermove`, which covers mouse, pen, and touch while pressed. On `pointerout` with no `relatedTarget`, or on window `blur`, the pointer is gone and plusses ease back upright.
- **Performance:** the per-frame JS work inside the frame callback must be ≤ 2 ms p95 at 1450×806 CSS px and DPR 2. Measure it with `performance.now()` and report it. Skip the draw entirely on frames where nothing changed (no pointer, turns settled, not playing or jamming).
- **Ownership:** don't edit `CLAUDE.md` or `.claude/`; the coordinator syncs the docs after integration. Don't push or merge.
- **Dev server** for browser checks: `yarn dev --port 5192 --strictPort`.

## Review Focus

1. **Window resize with the cursor still:** the layout recomputes with no stretched canvas and no stale cells. Task 2 has a browser check.
2. **Pointer leaves the window or the tab loses focus:** turned plusses ease back upright instead of freezing mid-turn. `easeTurn` covers this toward 0, plus a Task 2 browser check.
3. **Frame-rate independence:** easing converges in the same wall-clock time at 60 Hz and 120 Hz. Tested in Task 1.
4. **Paused / never played:** mini plusses stay at rest size. DJ-mode jamming still pulses them, because `frame.kick` includes user hits. `miniScale(0, e)` is tested and Task 2 has a browser check.
5. **HiDPI crispness:** 1 px strokes stay sharp. At DPR 1, offset odd-width strokes by 0.5 px. Checked by screenshot in Task 2.

---

### Task 1: Grid maths (`src/choreography/grid.ts`)

**Files:**
- Create: `src/choreography/grid.ts`
- Test: `src/choreography/grid.test.ts`

**Interfaces:**
- Produces: `CELL`, `TURN_RADIUS`, `PULSE`, `gridLayout(width, height): GridLayout`, `wrapQuarter(angle): number`, `cursorTurn(cx, cy, px, py, radius?): { angle: number; weight: number }`, `easeTurn(current, target, dt, tau?): number`, `miniScale(kick, energy): number`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { CELL, cursorTurn, easeTurn, gridLayout, miniScale, TURN_RADIUS, wrapQuarter } from "./grid";

describe("gridLayout", () => {
  it("fits whole 40 px cells and centres the grid", () => {
    expect(CELL).toBe(40);
    expect(gridLayout(1450, 806)).toEqual({ columns: 36, rows: 20, originX: 5, originY: 3 });
  });
});

describe("wrapQuarter", () => {
  it("folds any angle into (-π/4, π/4] (a plus looks the same every quarter turn)", () => {
    expect(wrapQuarter(0)).toBeCloseTo(0);
    expect(wrapQuarter(Math.PI / 2)).toBeCloseTo(0);
    expect(wrapQuarter((3 * Math.PI) / 4)).toBeCloseTo(Math.PI / 4);
    expect(wrapQuarter(-Math.PI / 3)).toBeCloseTo(Math.PI / 6);
  });
});

describe("cursorTurn", () => {
  it("turns fully at the cursor and fades to nothing at the radius", () => {
    expect(cursorTurn(100, 100, 100, 100).weight).toBe(1);
    expect(cursorTurn(100, 100, 100 + TURN_RADIUS / 2, 100).weight).toBeCloseTo(0.5);
    expect(cursorTurn(100, 100, 100 + TURN_RADIUS, 100).weight).toBe(0);
    expect(cursorTurn(100, 100, 100 + TURN_RADIUS * 3, 100).weight).toBe(0);
  });

  it("points an arm at the cursor", () => {
    expect(cursorTurn(0, 0, 50, 0).angle).toBeCloseTo(0); // right: already pointing
    expect(cursorTurn(0, 0, 0, 50).angle).toBeCloseTo(0); // below: the vertical arm points
    expect(Math.abs(cursorTurn(0, 0, 50, 50).angle)).toBeCloseTo(Math.PI / 4); // diagonal: an X
  });
});

describe("easeTurn", () => {
  it("is frame-rate independent", () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = easeTurn(at60, 0.5, 1 / 60);
    let at120 = 0;
    for (let i = 0; i < 120; i++) at120 = easeTurn(at120, 0.5, 1 / 120);
    expect(at60).toBeCloseTo(at120, 6);
    expect(at60).toBeGreaterThan(0.49);
  });

  it("takes the short way round the quarter-turn wrap", () => {
    const next = easeTurn(0.7, -0.7, 1 / 120);
    // -0.7 is 0.17 rad *ahead* of 0.7 modulo π/2, so the plus keeps turning forward
    expect(wrapQuarter(next - 0.7)).toBeGreaterThan(0);
  });

  it("settles back upright when the target is 0", () => {
    let angle = 0.6;
    for (let i = 0; i < 240; i++) angle = easeTurn(angle, 0, 1 / 120);
    expect(Math.abs(angle)).toBeLessThan(1e-3);
  });
});

describe("miniScale", () => {
  it("rests at 1 and pulses with the kick, more in energetic passages", () => {
    expect(miniScale(0, 1)).toBe(1);
    expect(miniScale(1, 0)).toBeCloseTo(1.4);
    expect(miniScale(1, 1)).toBeCloseTo(1.8);
    expect(miniScale(2, 2)).toBeCloseTo(1.8); // inputs clamp to 0..1
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn vitest run src/choreography/grid.test.ts`
Expected: FAIL, `Cannot find module './grid'`.

- [ ] **Step 3: Implement**

```ts
/** Grid cell size, px. */
export const CELL = 40;
/** How far from the cursor plusses turn to face it, px. */
export const TURN_RADIUS = 180;
/** Extra mini-plus size on a full kick at full energy. */
export const PULSE = 0.8;
/** Time constant for plusses easing toward their target turn, s. */
export const TURN_TAU = 0.12;

const QUARTER = Math.PI / 2;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface GridLayout {
  columns: number;
  rows: number;
  /** Top-left of the grid in CSS px (the grid is centred). */
  originX: number;
  originY: number;
}

export function gridLayout(width: number, height: number): GridLayout {
  const columns = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  return { columns, rows, originX: (width - columns * CELL) / 2, originY: (height - rows * CELL) / 2 };
}

/** Fold an angle into (-π/4, π/4]: a plus looks identical every quarter turn. */
export function wrapQuarter(angle: number): number {
  const folded = angle - QUARTER * Math.round(angle / QUARTER);
  return folded <= -Math.PI / 4 ? folded + QUARTER : folded;
}

/** The turn that points an arm of the plus centred at (cx, cy) at the pointer, and how strongly (smooth falloff to 0 at `radius`). */
export function cursorTurn(cx: number, cy: number, px: number, py: number, radius = TURN_RADIUS) {
  const distance = Math.hypot(px - cx, py - cy);
  const t = clamp01(1 - distance / radius);
  return { angle: wrapQuarter(Math.atan2(py - cy, px - cx)), weight: t * t * (3 - 2 * t) };
}

/** Ease `current` toward `target` along the shorter way round the quarter-turn wrap; frame-rate independent. */
export function easeTurn(current: number, target: number, dt: number, tau = TURN_TAU): number {
  return wrapQuarter(current + wrapQuarter(target - current) * (1 - Math.exp(-dt / tau)));
}

/** Mini-plus scale for a kick envelope that has reached this cell (already delayed by distance) and the song's energy. */
export function miniScale(kick: number, energy: number): number {
  return 1 + PULSE * clamp01(kick) * (0.5 + 0.5 * clamp01(energy));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn vitest run src/choreography/grid.test.ts`
Expected: PASS (8 tests). Then run the full `yarn test`; everything passes.

- [ ] **Step 5: Commit**

```bash
git add src/choreography/grid.ts src/choreography/grid.test.ts
git commit -m "feat(grid): pure maths for cursor-facing plusses and music pulses"
```

### Task 2: Canvas background

**Files:**
- Modify: `src/components/Background/index.tsx` (rewrite), `src/components/Background/Background.styled.ts` (drop `GridLayout`, add `Canvas`)
- Delete: `src/components/Icon/PlusIcon.tsx` and `src/components/Icon/PlusMiniIcon.tsx`, if nothing else imports them (check with `git grep -n "PlusIcon\|PlusMiniIcon" src`)

**Interfaces:**
- Consumes: Task 1 exports; `useMusicFrame` from `src/audio/react`; `KickHistory` and `SHOCKWAVE_SPEED` from `src/choreography/type`; `prefersReducedMotion` from `src/hooks/reducedMotion`.

- [ ] **Step 1: Rewrite the component.** The shape:

```tsx
const BIG = { color: "#555555", width: 1, inner: 4, outer: 36 }; // arm span within the cell, px
const MINI = { color: "rgba(138, 177, 238, 0.5)", width: 2, half: 5 }; // #8AB1EE @ 0.5, arms 15–25 px

const Background: React.FC = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ width: 0, height: 0, dpr: 1, layout: gridLayout(0, 0) });
  const angles = useRef(new Float32Array(0));
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const kicks = useMemo(() => new KickHistory(), []);
  const lastNow = useRef(0);
  const dirty = useRef(true);

  // resize: size the backing store, recompute the layout, reset angles, mark dirty
  // window pointermove → pointer.current = { x: clientX, y: clientY }; pointerout (no relatedTarget) / blur → null

  useMusicFrame((frame, now) => {
    // dt from `now` (clamp to 0.1 s); reduced motion → draw static once, then return
    // active = frame.isPlaying || frame.jamming; kicks.push(now / 1000, active ? frame.kick : 0)
    // for each cell: target = pointer ? cursorTurn(cx, cy, px, py) : { angle: 0, weight: 0 };
    //   angles[i] = easeTurn(angles[i], target.angle * target.weight, dt)
    //   (note: easing toward angle*weight gives a soft falloff at the radius edge)
    // head = (innerWidth / 2, innerHeight / 2);
    //   scale = active ? miniScale(kicks.at(now / 1000 - dist(cell, head) / SHOCKWAVE_SPEED), frame.energy) : 1
    // skip the draw when nothing moved (all |Δangle| < 1e-4, no scale != 1, not dirty)
    // draw: fill background; ONE path for all big plusses (rotated endpoints via cos/sin) → one stroke;
    //       ONE path for all mini plusses (arms of half-length MINI.half * scale) → one stroke
  });

  return (
    <Styled.Background>
      <Styled.Canvas ref={canvas} aria-hidden="true" />
    </Styled.Background>
  );
};
```

Keep comment density and style like `src/components/NameHeader/index.tsx`. Canvas CSS: `position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;`.

- [ ] **Step 2: Verify at rest.** Run `yarn dev --port 5192 --strictPort` and open `http://localhost:5192/` (don't press enter). Sample the canvas with `getImageData` at a few known cells: the arm lengths, stroke widths and colours must match the Global Constraints. Take a screenshot; it should read identically to today's grid (the reference is `git show v2:src/components/Background/index.tsx` and the Icon components).
- [ ] **Step 3: Verify the pointer.**
  - Dispatch `pointermove` on window at a cell centre + (60, 60). Plusses within 180 px turn toward it (read the angles through a `?debug`-only `window.__grid` if helpful), and cells beyond 180 px stay upright.
  - Move the pointer away, or dispatch `blur`: within ~0.6 s all angles are < 0.01 rad.
- [ ] **Step 4: Verify the music.** Press Enter at the splash with audio muted (`AudioNode.connect` gain-0 init script, or the mute button). Sampling the scale of the cell nearest the head over 2 s shows pulses (max ≥ 1.3), and a cell 600 px away pulses ~0.27 s later. Paused, it stays at scale 1. Pressing A (DJ kick) while paused pulses it.
- [ ] **Step 5: Measure performance.** Wrap the frame callback body in `performance.now()` and record 600 frames. Report the p50/p95 ms. p95 must be ≤ 2 ms at DPR 2; remove the instrumentation, or keep it behind `?debug`.
- [ ] **Step 6: Verify resize and reduced motion.** Resize to 500×800: no stretching, the layout is recomputed. Emulate `prefers-reduced-motion: reduce`: a static grid, with no turning on pointer move.
- [ ] **Step 7: Run all checks and commit.**
  - Run `yarn test`, `yarn lint` and `yarn build`; all green.
  - `git commit -m "feat(grid): canvas grid whose plusses face the cursor and pulse with the music"`

## Acceptance (report with evidence)
- Tests, lint and build are green, with test counts.
- Screenshots: the grid at rest, turned plusses around a pointer, and pulses mid-song.
- Per-frame cost: p50/p95 ms.
- Any judgement calls, each as `Ruling: <what> — <why> — <cost if wrong>`.
