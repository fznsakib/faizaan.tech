# DJ Mode — Design (v2 sub-project 3 of 4)

Date: 2026-09-26 · Branch: `fznsakib/v2-dj-mode` (off `fznsakib/v2-music` @ `d08c419`, which contains sub-projects 1–2). Owner approved all actions (no review stops).

## Intent

Let visitors play the page. Keys **A S D F**, or an on-screen pad, fire kick / snare / hat / stab sounds:
- **Hits are musical:** they snap to the playing song's grid.
- **Hits drive the visuals:** the same visuals that dance to the song respond — the head nods, the name pulses, shards crack.

It works with the song playing, paused, or never started (after entering). It needs no backend and no audio assets: the voices are synthesized with Web Audio.

Why (proposal, approved 2026-09-25): it's the most interactive thing on the page, rewards staying, and doubles as a tuning rig for the choreography.

## Decisions

| Decision | Chosen | Rejected (why) |
|---|---|---|
| Sounds | Synthesized voices (Web Audio oscillators + noise) | Sample files (asset weight, licensing, decode latency) |
| Timing | While a mapped track plays: snap to the 16th **nearest to the heard position** (audible time + userOffset, from the key/pointer event's timestamp); if that moment is already past, play at once (`currentTime + 0.005`) — never a whole 16th late. Otherwise immediate. *(Revised after review: quantising forward from `currentTime` landed on-time presses a 16th late.)* | Unquantised (sloppy); forward-to-next-16th from the scheduling clock (lands on-time presses 133 ms late) |
| Visual link | Hits become engine envelopes merged into `MusicFrame.kick/snare/hat` (max), plus `stab` / `stabHit` | A parallel visual path per component (duplicate logic) |
| Idle activity | `frame.jamming` = a user hit within the last 2 s while not playing; envelope-driven visuals treat `isPlaying \|\| jamming` as active (the nod phase-lock stays playing-only) | Starting a metronome clock when jamming without music (surprising) |
| Input | A S D F keys (window, ignores repeats/modifiers/typing/locked) + a "jam" pad toggled from the transport (pointerdown, for touch) | 2×2 invisible tap grid (undiscoverable, conflicts with links) |

## Architecture

```
src/audio/sampler/
  voices.ts        playVoice(ctx, destination, voice, when, noise) — kick/snare/hat/stab synthesis
  quantize.ts      nextSixteenth(songTime, beat0, bpm, lead) (pure)
  hits.ts          HitLog: ring buffer of { voice, contextTime }; envelopeAt(voice, contextTime) (pure)
src/audio/MusicEngine.ts
  hit(voice)       unlock-safe; schedules the voice (quantised when playing) into the bus; logs the hit
  update()         merges user envelopes into kick/snare/hat; sets stab, stabHit, jamming; bands also while jamming
src/components/DjPad/   the on-screen pad (4 Doto buttons), shown when the transport's "jam" toggle is on
src/components/Transport/keys.ts  djKeyVoice(key, …) (pure) next to transportKeyAction
```

Voices route `voice → sampler gain (0.7, headroom over the song) → bus → (analyser, mute) → destination`, so the live EQ bands react and mute applies. The sampler gain is created after the mute gain.

## Voices (synthesis parameters)

| Voice | Synthesis |
|---|---|
| kick | Sine osc; frequency 150 → 45 Hz exponential over 0.12 s; gain 0.9 → 0.001 exponential over 0.35 s |
| snare | Noise (0.2 s) → highpass 1200 Hz → gain 0.6 → 0.001 over 0.18 s; plus a triangle at 190 Hz, gain 0.3 → 0.001 over 0.1 s |
| hat | Noise → highpass 7000 Hz → gain 0.35 → 0.001 over 0.05 s |
| stab | 3 sawtooths (A minor: 220, 261.63, 329.63 Hz) → lowpass 1800 Hz (Q 4) → gain 0.25 → 0.001 over 0.45 s |

The noise buffer is created once per context (1 s, deterministic).

## Frame additions

- **`stab: number`:** 0..1, decays over 0.3 s.
- **`stabHit: boolean`:** true on the frame a stab becomes audible.
- **`jamming: boolean`:** a user hit landed within the last 2 s while not playing.
- **Merged envelopes:** `kick`, `snare` and `hat` become max(map envelope, user envelope). User envelopes are strength 1 with the same decays (0.18 / 0.14 / 0.07 s).
- **Bands:** computed while `playing || jamming`.

## Consumers

- **Head:**
  - Kick squash, emissive and snare rim apply whenever `isPlaying || jamming`.
  - When not playing, a user kick adds a nod impulse: pitch target += 6°·kick through the pitch spring.
  - Reduced motion: unchanged (no motion).
- **NameHeader:**
  - active = `(isPlaying || jamming) && !reduced`; the drop flip follows `sectionLevel` only while playing.
  - When not playing, the weight comes from `jamHeaderVariation(kick)` = 700 + 200·kick, stepped to 50.
- **SubtitleStack:** the EQ mode runs when `isPlaying || jamming`, with ROND 0 while not playing.
- **GlassPanel:**
  - Re-cuts on `stabHit` any time (6–8 shards; never under reduced motion), as well as the bar cadence.
  - Folds in the deferred sub-project 2 review minors:
    - M-a: read the current cut through a ref;
    - M-b: no per-frame-retargeted opacity transition, and energy opacity stepped to 0.05;
    - M-c: no instant idle re-cut on pause.

## Behaviour

- **Keys:**
  - A = kick, S = snare, D = hat, F = stab (case-insensitive).
  - Ignored before entering, on key repeat, with modifiers, and in typing fields.
  - A focused control does not block them (the keys aren't Space).
- **Pad:**
  - The transport gains a "jam" toggle (`aria-pressed`) that shows a 4-button Doto pad top-right on the transport's row: `a kick · s snare · d hat · f stab`, with aria-labels like "Kick (A)".
  - Buttons fire on `pointerdown` (preventDefault, so no focus) and on keyboard-initiated clicks (`event.detail === 0`), never both.
- **Quantisation:**
  - While a mapped track plays: song time of the next 16th ≥ now + 10 ms. Maximum added delay at 113 BPM is 133 ms.
  - Otherwise: `ctx.currentTime + 0.005`.
- **Muted:** voices are silent (they go through the mute gain) but the visuals still respond.

## Testing & acceptance

**Vitest:**
- `quantize`: grid maths including negative/pre-beat0 times and the 10 ms lead.
- `hits`: envelope decay per voice, latest hit wins, and time before a hit returns 0.
- `djKeyVoice`: the key mapping and ignore rules.
- `voices`, with Web Audio fakes: each voice starts its nodes at `when` and stops after its tail.
- Engine `hit`:
  - quantised `when` while playing, immediate when paused;
  - envelopes merged into the frame;
  - `stabHit` edge once;
  - `jamming` window;
  - bands while jamming.

**Browser:**
- Pressing A while paused nods the head (a pitch impulse > 2°) and pulses the name.
- F re-cuts the shards.
- Hits while playing land on 16ths: the scheduled `when` maps to a song time within 1 ms of the grid.
- The pad works with pointer events.
- 0 console warnings; frame p95 ≤ 1.5× median while mashing keys during a drop.
