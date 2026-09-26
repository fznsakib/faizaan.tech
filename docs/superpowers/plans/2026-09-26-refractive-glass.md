# Refractive 3D Glass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (superpowers:test-driven-development for the pure modules). Steps use checkbox (`- [ ]`) syntax for tracking. Project skills that apply: `create-animation`, `tune-animation`, `3d-model` (for lighting consistency with the head).

**Goal:** Replace the flat, randomly re-cut glass shards with a few beautiful pieces of thick 3D glass. They float over the whole page, genuinely refract whatever is behind them, and move smoothly with the cursor and the music.

**Architecture:**
- Glass objects are DOM elements in one fixed layer just behind the head (and below the transport and icons), with `pointer-events: none`.
- Each refracts its backdrop through an SVG displacement filter (`backdrop-filter: url(#…)`), whose map is generated per shape: flat in the middle, bending hard at the rim, like thick glass. This is the only technique that refracts *all* page content (DOM text, the grid canvas, the WebGL head); a WebGL-only material can only see the three.js scene.
- 3D comes from perspective tilt (toward the cursor, nudged by the beat), a curved rim profile, and specular highlight layers lit from the same direction as the head's key light.
- Motion is continuous: slow drifting orbits, beat bobs and energy-driven refraction, with no hard re-cuts.
- Non-Chromium browsers get a frosted fallback (blur + saturate + the same highlights).
- Pure maths lives in `src/choreography/glass.ts` (tested); the component renders.

**Tech Stack:** React 18, TypeScript (strict), styled-components 6, SVG filters (`feImage`, `feDisplacementMap`, optional per-channel chromatic aberration), CSS 3D transforms, Vitest. A library such as `liquid-glass-react` may be evaluated as a reference, but prefer a native implementation: you need control over shape, 3D and performance. If you do add a dependency, pin it and justify it in a `Ruling:`.

**Spec:** the owner's request (2026-09-26, pre-approved, "just go crazy, really make it cool"):
> "There are currently glass panels that appear around the screen. I don't really like them. We should make them way nicer glass that actually properly refracts what's behind it. You can use a library or implement it natively. The way they move is a bit weird too; maybe do something about it, make it 3D as well. Make sure it's globally on top of all the components, so no matter what it's over, it blurs and properly glassifies the thing behind it."

## Global Constraints

- **Layering** (owner change, 2026-09-26: "the glass should always be behind the head model"):
  - The glass layer is fixed, full viewport, `z-index: 9`: directly beneath the head's three.js canvas (10), above the name/subtitles (1) and the grid (−5), so it refracts those, while the head renders in front of it, unrefracted.
  - The transport and social icons (20), MusicDebug (90) and Splash (100) stay above the glass.
  - It has `pointer-events: none` throughout.
  - No ancestor of a glass element may create a backdrop root. That means no `filter`, `opacity < 1`, `mask`, `clip-path`, `mix-blend-mode`, `backdrop-filter`, or `will-change` of those, otherwise the backdrop stops at that ancestor. Put per-element opacity on inner highlight layers, never on the glass element or its parents.
- **Refraction:** in Chromium, content behind the glass is visibly displaced, and more at the rim than the centre. Elsewhere (Safari, Firefox), frosted blur. Detect Chromium via `navigator.userAgentData?.brands` containing "Chromium", falling back to a UA test.
- **Motion:**
  - It is driven only from `useMusicFrame` (no extra rAF loop, no CSS keyframe animations on the glass).
  - Positions are continuous: a piece of glass never teleports.
  - With `prefers-reduced-motion`, glass sits still at its anchors (still refractive, no drift, tilt or pulses).
- **Transport:** glass must not sit parked over the transport bar (top-left strip) or the social icons (bottom-right) for more than a few seconds at a time. Bias the drift paths away from them.
- **Performance:**
  - The per-frame JS cost of the glass callback is ≤ 1.5 ms p95.
  - Frame drops at 120 Hz must be no worse than today. Today: calm ~0.4–1% slow frames, drop mean ~10% (bimodal); measure with the snippet in Task 4.
  - If the displacement filter is too expensive, reduce the glass area, piece count or chromatic-aberration passes, or quantise how often `scale` attributes change. Never swap refraction for plain blur in Chromium.
  - Changing a filter primitive's attributes forces a filter rebuild: prefer transforms per frame and quantised filter-parameter updates (e.g. ≤ 10 Hz, stepped).
- **Ownership:** don't edit `CLAUDE.md` or `.claude/`. Don't touch `src/components/Background`, `src/components/SubtitleStack`, `src/components/NameHeader`, `src/audio/*` or `src/choreography/faces.ts`; other workers own those. Don't push or merge.
- **Dev server** for browser checks: `yarn dev --port 5194 --strictPort`; `?debug` exposes `window.__music`.

## Review Focus

1. **Clicks through glass:** clicks on the transport, crate sleeves, jam pad and social icons still land while glass is over them. Task 3 has a browser check with `elementFromPoint`.
2. **Resize to phone width (400–500 px):** glass scales down, stays inside the viewport and doesn't cover the whole screen. Tested in Task 2 and by screenshot in Task 3.
3. **Tab hidden then shown (large `dt`):** no jump or spring explosion. Positions are functions of time, not integrated velocity. Tested in Task 2.
4. **Safari/Firefox:** the frosted fallback shows no broken `url()` filter and no invisible glass. Task 3 has a fallback-branch check by forcing the flag.
5. **Splash and debug overlay stay above the glass,** and the glass doesn't blur the splash itself. Task 3 has a browser check.

---

### Task 0: Spike: prove the refraction technique here (throwaway)

- [ ] In a scratch HTML file served by the dev server (or a temporary route), put one 300×200 rounded element with `backdrop-filter: url(#f)` over text and the grid. `#f` is an SVG filter with `feImage` (a small displacement-map PNG data URI) → `feDisplacementMap scale="40"`.
- [ ] Confirm in this Chrome that the content behind is displaced (screenshot).
- [ ] Also confirm that the element keeps refracting under a CSS 3D transform (`perspective(900px) rotateY(20deg)`).
- [ ] Record the results as `Ruling:` lines, then delete the scratch file.
- [ ] If `backdrop-filter: url()` doesn't refract, stop and report back with a question before building further.

### Task 1: Displacement maps (`src/choreography/glass.ts`, part 1)

**Files:**
- Create: `src/choreography/glass.ts`, `src/choreography/glass.test.ts`

**Interfaces:**
- Produces: `glassMap(width: number, height: number, radius: number, bevel: number): { data: Uint8ClampedArray; width: number; height: number }`. RGBA; R and G encode the x and y sampling offset (128 = none); A = 255.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { glassMap } from "./glass";

const px = (map: ReturnType<typeof glassMap>, x: number, y: number) => {
  const i = (y * map.width + x) * 4;
  return { r: map.data[i], g: map.data[i + 1], a: map.data[i + 3] };
};

describe("glassMap", () => {
  const map = glassMap(200, 120, 40, 24);

  it("is RGBA of the requested size, opaque", () => {
    expect(map.data.length).toBe(200 * 120 * 4);
    expect(px(map, 100, 60).a).toBe(255);
  });

  it("leaves the flat middle undisplaced", () => {
    expect(px(map, 100, 60)).toMatchObject({ r: 128, g: 128 });
  });

  it("bends hard at the rim, pulling samples inward like thick glass", () => {
    expect(px(map, 2, 60).r).toBeGreaterThan(168); // left rim samples from the right
    expect(px(map, 197, 60).r).toBeLessThan(88); // right rim samples from the left
    expect(px(map, 100, 2).g).toBeGreaterThan(168); // top rim samples from below
  });

  it("is mirror-symmetric", () => {
    for (const x of [3, 10, 20, 30]) {
      expect(px(map, x, 60).r + px(map, 199 - x, 60).r).toBeGreaterThanOrEqual(254);
      expect(px(map, x, 60).r + px(map, 199 - x, 60).r).toBeLessThanOrEqual(256);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Run `yarn vitest run src/choreography/glass.test.ts`; expect FAIL, missing module.
- [ ] **Step 3: Implement** with the signed distance to a rounded rectangle (`radius`), and depth `s = clamp(-sd / bevel, 0, 1)` (0 at the rim, 1 in the flat middle).
  - Offset magnitude: `m = (1 - s) ** 2`, or a circular bevel profile; tune by eye later.
  - Direction: minus the outward normal, i.e. the SDF gradient.
  - Encoding: `R = 128 + 127 * dx`, `G = 128 + 127 * dy`, rounded.
- [ ] **Step 4: Run to verify it passes, then commit.** `git commit -m "feat(glass): thick-glass displacement maps"`

### Task 2: Glass bodies and poses (`src/choreography/glass.ts`, part 2)

**Interfaces:**
- Produces:
  - `interface GlassBody { id: number; ax: number; ay: number /* anchor, viewport fractions */; w: number; h: number /* px at a 1440 px-wide viewport */; radius: number; depth: number /* 0..1 */; orbit: { rx: number; ry: number /* fractions */; px: number; py: number /* periods, s */; phase: number } }`
  - `createBodies(random?: () => number): GlassBody[]`: 3–5 bodies; deterministic for a given `random`.
  - `interface GlassInput { t: number; width: number; height: number; pointer: { x: number; y: number } | null; energy: number; beatPhase: number; isPlaying: boolean; sectionLevel: 0 | 1; stab: number; reduced: boolean }`
  - `interface GlassPose { x: number; y: number /* centre, px */; w: number; h: number; rotateX: number; rotateY: number; rotateZ: number /* deg */; scale: number; refraction: number /* feDisplacementMap scale, px */; glint: number /* 0..1 */ }`
  - `glassPose(body: GlassBody, input: GlassInput): GlassPose`

- [ ] **Step 1: Write the failing tests** (in `glass.test.ts`). Each is a concrete assertion:
  - **Continuity:** over t = 0…30 s in 1/120 s steps with a fixed input, successive `x`/`y` differ by < 3 px, and `rotate*` by < 1°.
  - **Large dt is harmless:** `glassPose(body, {…t: 1000})` is finite and inside the viewport, i.e. a pure function of time.
  - **Bounds:**
    - |rotateX|, |rotateY| ≤ 18°, and |rotateZ| ≤ 8°;
    - the centre stays within [8%, 92%] of width and height at 1440×900 and at 500×800;
    - at 500 px wide, `w` ≤ 60% of the viewport width.
  - **Faces the cursor:** with the pointer at the right edge, `rotateY` is greater than with the pointer at the left edge (same t).
  - **Music:**
    - `refraction` with `energy: 1, isPlaying: true` exceeds `energy: 0`;
    - `sectionLevel: 1` exceeds `sectionLevel: 0`;
    - `glint` with `stab: 1` is greater than with `stab: 0`;
    - when not playing, refraction is a fixed resting value.
  - **Reduced motion:** `reduced: true` returns the anchor position with all rotations 0, regardless of `t` or the pointer.
  - **Avoidance:** sample t over 60 s. No body's centre spends more than 10% of the samples inside the transport strip (x < 45% of width, y < 12% of height) or the icon strip (x > 60%, y > 85%).
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
  - Lissajous or low-frequency sum-of-sines orbits around the anchors.
  - The pointer tilt is proportional to the pointer's offset from the body's centre and clamped. Ease it in the component with an exponential, frame-rate-independent step if needed; keep `glassPose` itself pure.
  - Beat bob: a few px on `beatPhase` while playing.
  - `refraction = base + k·energy (+ drop boost)`.
  - `glint = max(stab, beat accent)`.
- [ ] **Step 4: Run to verify it passes, then commit.** `git commit -m "feat(glass): drifting, cursor-facing, music-lit glass poses"`

### Task 3: The glass layer

**Files:**
- Rewrite: `src/components/GlassPanel/index.tsx` and `GlassPanel.styled.ts` (keep the directory and export name, so `App.tsx` changes minimally)
- Delete: `src/choreography/shards.ts` and `src/choreography/shards.test.ts` (their re-cut logic goes away; check that nothing else imports them)
- Modify: `src/App.tsx` only if needed; z-index handles order

- [ ] **Step 1: Render.**
  - One inline `<svg width="0" height="0" aria-hidden>` with a `<filter>` per body: `feImage` pointing at a data URI of `glassMap(...)` (make it once per body and size, via a canvas's `toDataURL`), then `feDisplacementMap` with `xChannelSelector="R"` and `yChannelSelector="G"`.
  - Optional chromatic aberration: three displacements at slightly different scales, isolated per channel and recombined. Keep it only if Task 4's budget allows, as a `Ruling:`.
  - Each body is an element with:
    - `border-radius` matching the map;
    - `backdrop-filter: url(#glass-N) saturate(1.4) brightness(1.06)` in Chromium, or `blur(14px) saturate(1.5)` in the fallback;
    - highlight layers: a specular gradient whose position follows the tilt, a bright rim (inset shadows), and a soft drop shadow for depth.
  - The layer: `position: fixed; inset: 0; z-index: 60; pointer-events: none; perspective: 1200px;`.
- [ ] **Step 2: Animate.**
  - Per frame: compute `glassPose` for each body and write `transform` through `setStyle` (`translate3d(...) rotateX() rotateY() rotateZ() scale()`), plus the highlight positions.
  - Write the `feDisplacementMap` `scale` attribute only when its quantised value changes, at most ~10 Hz.
  - Recompute maps on resize (debounced).
  - Read the pointer from `window` `pointermove`; it's gone on `pointerout` with no `relatedTarget`, or on `blur`.
- [ ] **Step 3: Look and click (browser, muted audio).** Screenshots:
  - (a) glass over the name and grid, showing refraction bending at the rims;
  - (b) glass tilted toward a pointer;
  - (c) mid-drop;
  - (d) at 500×800.

  Then check clicks with `elementFromPoint` at the transport buttons, crate sleeves and icons while glass covers them: they must return those controls. Check that the Splash (before entering) and the `?debug` panel render above the glass. Force the fallback flag and screenshot the frosted look.
- [ ] **Step 4: Run all checks and commit.** Run `yarn test`, `yarn lint` and `yarn build`, then `git commit -m "feat(glass): refractive 3D glass floating over the whole page"`

### Task 4: Performance pass

- [ ] Measure the glass callback's JS cost (600 frames, `performance.now()`); p95 ≤ 1.5 ms.
- [ ] If your page can be the foreground tab, measure frame drops with this snippet at `seek(2)` (calm) and `seek(22)` (drop) of `empty-lightning`, three runs each, before (on `fznsakib/v2-polish`) and after:

```js
async (at) => { const e = window.__music; e.seek(at); await new Promise(r => setTimeout(r, 1200)); const d = []; let last = performance.now(); const t0 = last; await new Promise(done => { const tick = (now) => { d.push(now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); }); d.shift(); return (d.filter(x => x > 12.5).length / d.length * 100).toFixed(1) + '%'; }
```

- [ ] If the drop numbers are worse than before, cut in this order:
  - chromatic aberration passes;
  - total glass area;
  - piece count;
  - filter-parameter update rate.

  Record each step as a `Ruling:` with its numbers. If you can't get foreground measurements, say so; the coordinator measures at integration.
- [ ] Commit any tuning.

## Acceptance (report with evidence)
- Tests, lint and build are green, with counts.
- The spike result.
- Screenshots (a)–(d) plus the fallback.
- Click-through results.
- JS cost and frame-drop numbers (or why not).
- Every `Ruling:` line.
