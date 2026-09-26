# Choreography: chrome head, beat-locked nod, typography conductor — Design (v2 sub-project 2 of 4)

Date: 2026-09-26 · Branch: `fznsakib/v2-choreography` (off `fznsakib/v2-music` @ `772b9d1`, which contains sub-project 1)

## Intent

Make the page move like a music video. Sub-project 1 delivered a sample-accurate `MusicFrame` (beat/bar phase, downbeat edges, kick/snare/hat envelopes, energy, section level, live bands). This sub-project spends it on the owner's stated priority: "the animations (3D head nod, font change, etc.) to the songs".

Success for a visitor:
- the chrome head reads as a 3D sculpture and nods *on* the beat, with weight and anticipation;
- the name and the Doto lines visibly play the song;
- the page changes character on drops;
- nothing stutters;
- it still looks finished before music starts;
- reduced-motion users get a calm page.

Approved scope (proposal, 2026-09-25): chrome head + phase-locked nod, typography conductor, drop flips. The owner approved all actions for this sub-project, so this spec proceeds without a separate review stop.

## Evidence this builds on

- **Head:** it renders flat because a mirror-like material (metalness 0.9, roughness 0) has no environment map to reflect. With a drei `Environment` built from `Lightformer`s it reads as a chrome face (motion investigation screenshots `q-verse-back.png` / `q-drop-hit.png`).
- **Mouse-follow:** hard-set rotation swings ±70° yaw at the screen edges with no smoothing.
- **Nod model (prototyped):**
  - authored curve on beat phase: small lift before the beat, down-stroke landing on it, damped rebound;
  - smoothed by a spring (k 900, c 45) sampled 50 ms early;
  - simulated peak lands 0 ms from the beat at 90/120/128 BPM at 60 and 120 fps.
- **Fonts:**
  - Doto exposes `ROND 0–100` and `wght 100–900`; Golos Text `wght 400–900`.
  - `index.html` loads Doto `wght` only.
  - Doto is monospaced: weight never changes glyph advance.
- **Style costs (measured):**
  - per-frame `:root` custom properties: 3.3 ms style recalc; element-scoped writes: 0.1–0.3 ms;
  - the full prototype held 120 Hz with 1.4 ms style+layout.
- **The OBJ head:** 7.5 MB, about 400 ms main-thread parse. Converted to a meshopt GLB it is 378 KB (227 KB gzip): `obj2gltf` → `gltf-transform optimize --compress meshopt`.
- **Glass shards:** regenerate on a 4 s timer unrelated to music; their random `rotateX(n)` has no units (ignored); their opacity is computed once at module load.
- **Deferred sub-project 1 review minors folded in here:** M1 (clock extrapolates while the AudioContext is suspended; Space can't resume), M4 (Shift+Tab escapes the aria-modal splash), M5 (a mouse-clicked transport button keeps focus, so Space re-activates it), M6 (mute button naming).

## Decisions

| Decision | Chosen | Rejected (why) |
|---|---|---|
| Head asset | Committed meshopt GLB loaded with drei `useGLTF` (bundled decoder) | Keep OBJ (7.5 MB, 400 ms parse); Draco (decoder fetched from a CDN at runtime) |
| Head look | `Environment` of 4 `Lightformer`s rendered once, metal 1 / rough 0.22 | Postprocessing bloom on the alpha canvas (fiddly over DOM, cost); matcap (loses the chrome/env feel) |
| Nod | Authored `bob(phase)` curve → spring, 50 ms lead, half-time > 135 BPM, amplitude × `beatConfidence` | Reacting to onsets (always 60–100 ms late); raw curve without spring (robotic) |
| Type updates | One `useMusicFrame` subscriber per component writing element-scoped styles through a change cache | `:root` CSS variables (3.3 ms/frame); React state (per-frame renders) |
| Drop flips | Driven by the engine's downbeat-quantised `sectionChanged`; outward letter stagger at 2200 px/s | Section threshold in the view (not quantised, flaps) |
| Grid ripple shader | Out of scope (future) | — |

## Architecture

```
src/choreography/          pure, unit-tested motion math (no DOM, no three)
  nod.ts                   bob(), nodDrive(frame), Spring
  type.ts                  KickHistory, headerWeight, vuStep, eqWeight, idleScanWeight, flip state
  shards.ts                generateShards(count, random), recutDue(...)
  dom.ts                   setStyle(el, prop, value) — write only on change
  probe.ts                 choreographyProbe (debug readout values)
src/hooks/reducedMotion.ts prefersReducedMotion() — per-frame safe (every consumer reads it per frame; no hook needed)
src/components/
  Head/                    GLB head, chrome lighting rig, nod/sway/mouse/idle in useFrame (reads engine.frame)
  NameHeader/              "(faiz)aan sakib" as per-letter spans + kick shockwave + drop flip
  SubtitleStack/           the six Doto lines: 6-band EQ while playing, idle scan otherwise
  GlassPanel/              music-cadenced re-cuts, per-shard energy opacity
src/assets/head.glb        replaces head.obj
```

- Consumers never call `engine.update`: the ticker owns it.
- r3f reads `engine.frame` in `useFrame`; DOM components use `useMusicFrame`.
- All per-frame DOM writes go through `setStyle`, so unchanged values cost nothing.
- React renders only for coarse changes (a shard re-cut, at most once per bar).

## Behaviour

**Head (r3f)**
- **Material:** color `#ff8a1c`, metalness 1, roughness 0.22, envMapIntensity 1.3, emissive `#ff6a00`.
- **Lighting:**
  - `Environment` (resolution 256) with Lightformers:
    - top softbox, intensity 2.5;
    - cool rim strip `#9fd3ff`, intensity 4, behind-left;
    - warm key `#ffe2b8`, intensity 3;
    - dark-green floor ring `#143d32`, intensity 1.5.
  - Rim `directionalLight` `#bfe6ff` from behind; ambient drops 5 → 0.3.
  - Canvas `dpr={[1, 1.75]}`.
- **Rig:** pivots at the neck (22% up the bounding box from the bottom, 10% back from centre).
- **Nod,** while `frame.isPlaying`, BPM > 0 and motion not reduced:
  - `nodDrive(frame)` gives phase, period and accent. It samples 50 ms early, runs half-time above 135 BPM, and applies ×1.35 when the landing beat is a downbeat.
  - pitch = spring(k 900, c 45) of `bob(phase, period) × amplitude`, where amplitude = (2.5° + 6.5°·energy) × accent × beatConfidence.
  - vertical bob −0.05·bob·(0.5+energy) through the same spring settings.
  - roll = spring(k 120, c 18) of 2.5°·(0.4+0.6·energy)·sin(2π·barPhase).
  - yaw follow-through 1.5°·sin(2π·barPhase − 0.6).
  - kick squash 1.2%.
  - emissive 0.04 + 0.2·kick·energy.
  - rim 1.5 + 10·snare.
  - camera z eases toward 5 − 0.35·section.
- **Mouse:** `maath` `damp` with smoothTime 0.35 s, clamped to ±22° yaw and ±10° pitch, added to the music layers.
- **Idle** (not playing): 0.8° breathing over 4.5 s, plus a slow 2° yaw drift.
- **Reduced motion:** no nod, sway, squash, emissive pulse or camera move; no breathing; mouse range halved.

**Name header**
- **Markup:** rendered once as one inline-block span per character (`aria-hidden`), with the `h1` carrying `aria-label="(faiz)aan sakib"`.
- **Width lock:** after `document.fonts.ready` and on resize, each span's width is locked to its Golos advance, so weight changes and the Doto flip never reflow neighbours.
- **Playing:**
  - each letter reads the kick from a 64-sample history at `time − distance/2200` (distance = horizontal px from the viewport centre, where the head is) → a shockwave radiating from the head;
  - weight = min(900, 600 + 100·section + 300·(0.5+0.5·energy)·kick), quantised to 10;
  - transform `translateY(−0.05em·k) scaleY(1+0.06·k)`.
- **Drop flip:**
  - When `sectionChanged` fires, letters switch to the new face in outward order at 2200 px/s. Level 1 is Doto at 0.8em, `"wght" 900, "ROND" 100`; level 0 is back to Golos.
  - A level change without an edge (seek, track switch, pause) snaps immediately.
- **Not playing:** Golos `"wght" 700`, no transform.
- **Reduced motion:** static `"wght" 700`, no flips.

**Subtitle stack (six Doto lines)**
- **Playing:** a 6-band graphic EQ. The bottom line ("affirm") is the lowest band. Each line's level follows `frame.bands[b]` with VU ballistics (attack 15 ms, release 220 ms) → `"wght" 100 + 800·level` (quantised to 10), `"ROND" 100·section`.
- **Not playing:** idle scan, a 4 s top-to-bottom wave, weight 200–700, ROND 0.
- **CSS:** the old CSS keyframe loops (weight steps, random letter-spacing) are removed.
- **Reduced motion:** static `"wght" 500`.
- **Fonts:** `index.html` loads `Doto:ROND,wght@0..100,100..900`.

**Glass shards**
- **Playing:** re-cut on a downbeat every 2 bars (sectionLevel 0) or every bar (sectionLevel 1). Drops cut 6–8 shards; otherwise 3–5.
- **Idle:** the existing 4 s re-cut.
- **Opacity:** each shard has its own random base opacity 0.5–1, scaled by 0.55 + 0.45·energy while playing.
- **Clean-up:** the unit-less rotation is dropped (it never applied). Styled props become transient (`$`), which removes the console warnings.
- **Reduced motion:** no re-cuts.

**Background:** styled props become transient (the console warnings go away). No behaviour change.

**Engine and transport hardening (deferred minors)**
- **M1:** while the AudioContext is not `running`, the clock uses the frozen `currentTime` fallback and the frame reports `isPlaying: false`. The transport's Space handler calls `unlock()` before `toggle()`.
- **M4:** the splash renders through a portal on `document.body` and sets `#root` `inert` while open.
- **M5:** transport controls don't take focus on mouse-down.
- **M6:** the mute button's accessible name matches its text ("Mute music" / "Unmute music"), without `aria-pressed`.

**Debug:** `?debug` adds a head-pitch readout from `choreographyProbe`, and exposes it on `window.__choreo`.

## Testing & acceptance

Vitest (pure modules):
- **`nod`:** curve peaks at phase 0 and is continuous across the wrap; anticipation dips below 0 just before the beat; `nodDrive` lead/half-time/accent; the spring converges; a 120 fps simulation of `bob → spring` peaks within ±12 ms of each beat at 113 and 120 BPM, and within the half-time landings at 150 BPM.
- **`type`:** kick history lookup; weight formula and clamp; VU attack faster than release; EQ mapping; idle scan range; flip state (animates on an edge, snaps without one, letters flip in distance order, reverts when paused).
- **`shards`:** generated shards stay in bounds and are valid polygons for any count; re-cut cadence per section level; no re-cut while paused or with reduced motion.
- **`dom.setStyle`:** writes only on change.
- **Engine M1:** a suspended context with a stale output timestamp freezes time and reports not playing.

Browser acceptance (Chrome, dev + production preview):
- **Head:** it renders as chrome (screenshot); `head-*.glb` loads (< 400 KB) and no `.obj` is requested.
- **Nod timing:** over ≥ 20 beats, the frame of maximum head pitch per beat is within ±12 ms of the grid beat (median).
- **Letters:** header letter weights change with kicks; the Doto EQ weights move; a seek into a section change produces the outward flip, and a seek across one snaps.
- **Shards:** re-cuts land on downbeats at the specified cadence.
- **Reduced motion** (emulated): static head (mouse only), static type, no re-cuts.
- **Budget:** frame-interval p95 ≤ 1.5× the display frame while playing; no long tasks during playback; style+layout per frame ≤ 2 ms.
- **Console:** no errors or warnings from app components.
- **Checks:** `yarn build`, `yarn lint` and `yarn test` pass.
- **Splash:** Shift+Tab from "enter" stays inside the splash (M4).

## Out of scope

- Grid ripple shader.
- Icon pulses.
- Postprocessing.
- The head overlapping "aan" in the name (composition, owner's call).
- iOS silent switch (device testing).

## Handoff

- **Sub-project 3 (DJ mode):** writes user hits into the same kick/snare/hat envelopes, so this choreography responds to them unchanged.
- **Sub-project 4:** adds tracks; the choreography needs nothing new.
