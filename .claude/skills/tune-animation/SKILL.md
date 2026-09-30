---
name: tune-animation
description: Checklist for tuning choreography parameters
---

# Tune Choreography Parameters

## Head Nod (`src/choreography/nod.ts`)

| Param | Value | Effect |
|-------|-------|--------|
| `REBOUND_TAU` | 0.11s | Decay time of the rebound after the nod lands |
| `REBOUND_HZ` | 2.6 | Rebound oscillation frequency (~17% overshoot at ~190ms) |
| `LIFT` | 0.25 | Anticipation lift fraction just before the next beat |
| `HALF_TIME_BPM` | 135 | Above this tempo, nod every other beat instead of every beat |
| `NOD_LEAD` | 0.05s | Sample the curve this far ahead to cancel spring lag |
| `DOWNBEAT_ACCENT` | 1.35 | Amplitude multiplier when the nearest landing is a downbeat |

Amplitude: `deg(2.5 + 6.5 * frame.energy) * drive.accent * frame.beatConfidence`.

Spring physics (stiffness, damping), sub-stepped at 240Hz: pitch `(900, 45)`, lift `(900, 45)`, roll `(120, 18)`.

## Header Type (`src/choreography/type.ts`)

| Param | Value | Effect |
|-------|-------|--------|
| `SHOCKWAVE_SPEED` | 2200 px/s | Speed a kick travels outward from the head across the name |
| `EQ_ATTACK` | 0.015s | VU-meter fast attack for the Doto EQ lines |
| `EQ_RELEASE` | 0.22s | VU-meter slow release |
| `EQ_WEIGHT_STEP` | 100 | Coarse quantisation of EQ line weight |
| `HEADER_WEIGHT_STEP` | 50 | Coarse quantisation of header letter weight |
| `ROND_STEP` | 25 | Coarse quantisation of the `ROND` variation axis |

`headerWeight(section, energy, kick) = min(900, 600 + 100*section + 300*(0.5 + 0.5*energy)*kick)`.

Quantisation steps are deliberately coarse: each distinct `font-variation-settings` value forces the browser to re-rasterise 6–12rem glyphs (and re-blur the glass above them) — fine steps drop frames at high refresh rates.

## Header Faces (`src/choreography/faces.ts`)

- `CYCLE_FONTS`: the old header's 13 fonts. Calm: each word — `(faiz)`, `aan`, `sakib` — gets its own font, stepping per bar. Drop: each letter gets its own font, stepping per beat.
- `SPREAD` = 5 (coprime with 13), so neighbouring words/letters never share a font; `fitScale` sizes each face to the name's Golos width.
- `HISTORY` = 6 steps kept, so a letter the shockwave hasn't reached yet still shows the right (older) face.
- Drops switch to Doto (`DOTO_VARIATION`); calm returns to the name's own Golos face (empty string).

## Plus Grid (`src/choreography/grid.ts`)

- `TURN_RADIUS` 180px: big plusses within it turn to face the cursor (smooth falloff), easing with `TURN_TAU` 0.12s.
- `PULSE` 0.8: mini plusses grow up to 1 + 0.8 × kick × (0.5 + 0.5 × energy), delayed by distance from the head at `SHOCKWAVE_SPEED`; `KICK_HISTORY_SPAN` 2.5s covers ultrawide screens.

## Glass (`src/choreography/glass.ts`, `src/components/GlassPanel`)

- `createBodies()` makes new organic outlines (pebble, blob, pill, lens, shard) on every load; the displacement map, clip path, highlights, hit-testing and wall bounces all follow the real outline.
- Physics: drift toward a moving orbit around each piece's home, drag with the pointer (window-level hit-test, since the head canvas takes events), throw with `releaseVelocity`, `applyFriction`, and `collideWalls` against the viewport edges (with a glint "ping").
- Chromatic aberration is off (`CHROMATIC` in the component) for frame budget; `?frosted` forces the non-Chromium fallback.
- `glassScale`: width / 1440 clamped to `MIN_SCALE` 0.38 .. 1.25 (and ≤ 60% of the width / 45% of the height): on phones a piece covers at most ~1.5× the share of the width it does on desktop (tested).

## Daylight (`src/choreography/daylight.ts`, `src/components/Daylight`)

- `KEYFRAMES`: one row per keyframe (02:00, 05:00, 06:30 `SUNRISE`, 09:00, 13:00 `NOON`, 18:30, 20:00, 22:30) of lamp `[colour, intensity]`s (key, fill, rim, ambient, sky, cool, warm) and palette tokens; mixed in OKLab with a smoothstep per segment. The 13:00 row is the site's original scene and is pinned by `daylight.test.ts`: never edit it.
- Sun: rises `SUNRISE` at front-left (azimuth −45°), peaks at `NOON` at today's key angle ([10, 10, 10]), sets `SUNSET` 19:30 back-right; the key never goes below the horizon; the environment turns with the sun's azimuth.
- Guard-rail tests: no step > ΔE 0.015 or 2% of a lamp's peak between minutes; neighbouring keyframes ΔE > 0.06 apart, and > 0.08 from noon; the ground stays the site's green (OKLCH L 0.22–0.38, C 0.03–0.07, hue 140–215°, ΔE < 0.1 from `rgb(20, 61, 50)`).
- Preview with `?hour=18.5`; sweep with `?daycycle` (24 h in `CYCLE_SECONDS` 60, 100 ms ticks; each tick is ~0.4 ms JS plus one `:root` custom-property style recalc).
- The copper chrome swallows blue: cold and violet hours show on the head through brighter environments and strong rims, not through colour alone.

## Head Fit and Tilt (`src/choreography/fit.ts`, `src/choreography/tilt.ts`)

- `fitCamera(width, height, head)`: each head's measured `HeadFit` (`COPPER_FIT` 0.41 × 0.654 at 0.489; `SKIN_FIT` 0.439 × 0.701 at 0.484 — its hair makes it bigger); `MAX_WIDTH` 0.65 of the width; `PORTRAIT_HEIGHT` 0.45 of the height and `PORTRAIT_CENTRE` 0.4 down, easing off between aspect `EASE_FROM` 0.75 and `EASE_TO` 1.25; desktop exactly z = 5, y = 0.
- `tiltLook`: `TILT_RANGE` 25° of phone tilt from the calibration = the full mouse-follow range (22° yaw / 10° pitch); smoothing is the head's own damp (tau 0.35).

## Value Ranges

| Value | Range | Notes |
|-------|-------|-------|
| `frame.kick`/`snare`/`hat`/`energy`/`section`/`bands[i]` | 0..1 | Normalized |
| `frame.beatPhase`/`barPhase` | 0..1 | 0 = on the beat/downbeat |
| `frame.beatConfidence` | 0..1 | 0 with no beat map |
| `frame.stab` | 0..1 | Decays over ~0.3s after a DJ hit |

## Performance Checklist

- [ ] Animation state in `useRef`/`useMemo` (not `useState`)
- [ ] DOM writes go through `setStyle` (`src/choreography/dom.ts`)
- [ ] Per-effect math lives in `src/choreography/*`, unit-tested
- [ ] No CSS transitions on animated properties
- [ ] No object allocations inside animation loops or `useFrame`
- [ ] Springs/histories/cursors created once via `useMemo`, not recreated per frame
