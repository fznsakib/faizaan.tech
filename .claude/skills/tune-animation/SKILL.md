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

## Name Matter (`src/choreography/matter.ts`, `src/components/NameHeader/useMatter.ts`)

- `STAGES`: lead-in 0.35 s, chrome 1.4, molten 1.6, shatter 1.2, frost 1.5 (`RUN_LENGTH` 6.05 s). Each stage blends into the next over its last `BLEND` 0.35 s; in a blend the upper layer (`MATTERS` order) fades over the lower one, which stays opaque.
- `MAX_SWEEP` 0.7 s: letters start late by their distance from the pointer (hover/tap) or the head (ambient) at `SHOCKWAVE_SPEED`.
- `AMBIENT_GAP` 40–70 s, counted from entering and restarted by any run; `RETRIGGER_COOLDOWN` 0.5 s after a run ends; a frame gap over 1 s (hidden tab) restarts the wait.
- Effect timings are in t within the state: `chromeSweep` crosses 0.08–0.8; `meltAmount` is in by 0.4 and set by 0.78; drips grow 0.18 and fall 0.3 (0.9 em); shards fly 0.3–0.5 em (+0.15 em away from the origin), out 0.1–0.4, home 0.48–0.62; sparkles twinkle 3 times, lit 0.2–0.55.
- `SAG` 0.06 and `WARP` 0.06 × font size (`useMatter`). Phones (`LITE`): no SVG filters, 3 shards / 1 drip / 1 sparkle (`pieces.ts`).
- Filter cost: blur primitives are what the GPU pays for (the molten glow's blur halved the frame rate and was cut), and a filter re-runs whenever its letter repaints. The kick moves every letter each frame, so during a desktop run each letter is its own compositor layer (`will-change: transform`), and hidden material layers are `display: none`, out of style and layout. The melt's ramp is an feImage of an in-document rect: a data-URI image is re-rasterised on the main thread every frame.

## Plus Grid (`src/choreography/grid.ts`)

- `TURN_RADIUS` 180px: big plusses within it turn to face the cursor (smooth falloff), easing with `TURN_TAU` 0.12s.
- `PULSE` 0.8: mini plusses grow up to 1 + 0.8 × kick × (0.5 + 0.5 × energy), delayed by distance from the head at `SHOCKWAVE_SPEED`; `KICK_HISTORY_SPAN` 2.5s covers ultrawide screens.

## Paper Grain (`src/choreography/grain.ts`, `src/components/Background/paper.ts`)

- Static, never music-driven. `GRAIN`: value-noise `octaves` (0.9 px × 0.11 grain, 3.2 px × 0.035 tooth, 11 px × 0.03 floc), `speckle` 0.04 per device pixel, fibres (`fibreDensity` 0.0032/px², 4–16 px long, 0.7 px wide, light +0.17 / dark −0.11, 35% dark), and the `mottle` (340/150/60 px gradient noise, 0.035/0.025/0.012). All relative luminance: the ground's RGB × (1 + delta), so its hue holds and its mean is the ground (pinned by `grain.test.ts`).
- Look at it alone: hide everything but the Background and its grid canvas, screenshot at 1:1, and check luma sd ≈ 3 (of 255) on the green; above ~5 it starts to read as dirt.
- Every noise lattice is turned by an integer vector (`TURNS`) so tiles stay seamless while no lattice line runs along the screen's axes (axis-aligned lattices stack into faint stripes when tiled).

## Glass (`src/choreography/glass.ts`, `src/components/GlassPanel`)

- `createBodies()` makes new organic outlines (pebble, blob, pill, lens, shard) on every load; the displacement map, clip path, highlights, hit-testing and wall bounces all follow the real outline.
- Physics: drift toward a moving orbit around each piece's home, drag with the pointer (window-level hit-test, since the head canvas takes events), throw with `releaseVelocity`, `applyFriction`, and `collideWalls` against the viewport edges (with a glint "ping").
- Chromatic aberration is off (`CHROMATIC` in the component) for frame budget; `?frosted` forces the non-Chromium fallback.
- The head (`collideHead`): `HEAD_RESTITUTION` 0.7 for throws (drift just stops pressing, and only throws knock: ping + flinch). Only a piece that was clear a step ago (`buried` false; `release` sets it) and is no deeper than its speed × step + `HEAD_SLACK` 8 px can knock; other overlap glides out at `DEPENETRATE` 900 px/s away from the head's spine. `HEAD_STRIDE` 4 samples 40 of 160 outline points, then refines round the deepest.
- Drift steering (`steer`): targets keep `HEAD_GAP` 14 px (× scale) off the head; below `GRAZE` 24 px deep the outline normal gives way to the spine.
- `glassScale`: width / 1440 clamped to `MIN_SCALE` 0.38 .. 1.25 (and ≤ 60% of the width / 45% of the height): on phones a piece covers at most ~1.5× the share of the width it does on desktop (tested).

## Flinch (`src/choreography/impact.ts`)

- Knocks from `SPEED_MIN` 90 px/s (the ping speed) to full at `SPEED_FULL` 2400 px/s; caps `YAW_MAX`/`ROLL_MAX` 8°, `PITCH_MAX` 5°, `SQUASH_MAX` 0.03 hold however often the head is hit (the cap trims the kick's velocity, never the position); `LEVER` 3 world units from the pivot gets the full roll.
- Spring `OMEGA` 14 rad/s, `ZETA` 0.7: peaks ~80 ms after a knock with ~5% spring-back, under 0.1° by 0.6 s.

## Caustics (`src/choreography/caustics.ts`, `src/components/Caustics`)

- Pool (`causticPool`): centred a little left of the head and 12% of its height above its bottom, rx 1.1 × head width, ry 0.3 × head height.
- Pattern: seven bands in two tilt families (≈ +12°, −19°), ripple speeds < 0.6 rad/s; `SLIDE` 0.55 rx/rad against a turn, `BREATHE` 0.9 (height) and `FOCUS` 0.8 (brightness) per radian of nod.
- Look (component): strokes 24 px @ 0.045, 7 px @ 0.09, 1.6 px @ 0.36 with `lighter`, faded to the pool's rim; DPR capped at 1.5; fades in over 1.5 s once the head is drawn.

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
- [ ] Layout values (`innerWidth`, rects) measured on resize, never read in a frame callback: a read there forces a layout of everything written earlier in the frame (≈ 1.8 ms at 4× throttle)
