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
