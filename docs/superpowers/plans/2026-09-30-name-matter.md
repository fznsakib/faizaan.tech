# Name Matter: the Header Changes Material

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (superpowers:test-driven-development for the state machine and timing). Project skills that apply: `create-animation`, `tune-animation`.

**Goal:** Every so often, and on hover or tap, the letters of "(faiz)aan sakib" pass through physical materials:
- **chrome**, like the head;
- **molten copper**, dripping down;
- **shatter** into the grid's plusses and reassemble;
- **frost**, hairline ice with glinting sparkle.

It ties the name to the head's world, and it is purely visual, with no audio interaction.

**Owner's words** (2026-09-30): "purely visual, like motion design, colours, etc… no audio interactivity". Idea 3 was approved: "the name changes material".

## Design
1. **The state machine** (pure, tested, in `src/choreography/matter.ts`):
   - States: `plain → chrome → molten → shatter → frost → plain`.
   - A sequence runs **on hover or tap** of the name (debounced; a hover during a run doesn't restart it) and **ambiently** every ~40–70 s (randomised, seeded for tests). Ambient runs happen only after the visitor has entered, and never while the tab is hidden.
   - Each state has a duration (~0.9–1.6 s) plus transitions. The whole run is ≤ ~7 s.
   - `matterAt(run, now) → { state, t (0..1 within state), blend (to next) }`.
   - Per-letter delays sweep from the pointer (hover) or the head (ambient), consistent with the existing shockwave feel.
2. **Rendering on the existing per-letter spans** (`src/components/NameHeader/index.tsx`): prefer SVG filters and CSS on the letters, over a WebGL text rebuild.
   - **chrome:** a `background-clip: text` metallic gradient that sweeps with a moving highlight, plus a slight `feSpecularLighting` bevel filter.
   - **molten:** a copper/orange gradient with an `feTurbulence` + `feDisplacementMap` warp that grows downward, plus drips: small blob elements that elongate below letters and fall away (transform-only animation).
   - **shatter:** each letter breaks into a handful of plus-shaped shards (reuse the grid's plus look: `#555555` / `#8AB1EE` strokes) that fly out a short distance and snap back into the glyph.
   - **frost:** a cool white-blue fill with a fine crystalline noise mask, plus sparkle points that twinkle (a few tiny elements, transform/opacity only).
   - Keep the letter boxes' locked widths (the name's layout mustn't reflow).
   - The per-letter **font cycle keeps running underneath** (faces keep stepping); materials are an overlay on whichever face is showing. If a face makes a material unreadable, prefer legibility (a Ruling).
3. **Performance:**
   - Animate transforms, opacity, filter parameters and `background-position` only, with no per-frame layout.
   - SVG filters only on the letters, during a run; idle cost is zero.
   - ≤ 1.5 ms/frame p95 during a run at 1440×900 and on an iPhone 15 emulation at 4× CPU throttle. A lighter variant on phones is fine.
4. **Reduced motion:** no ambient runs. Hover/tap shows a gentle cross-fade through the four materials, with no drips, shards or sparkle movement.
5. **Accessibility:** the header's accessible name stays "(faiz)aan sakib". Decorative elements are `aria-hidden`.

## Constraints and conflicts
- **Parallel workers:** `v2-skinhead`, `v2-daylight` (colours), `v2-glasshead`. You own `NameHeader` and the new `matter.ts`; don't touch other components. Keep `faces.ts` behaviour unchanged unless a hook is strictly needed (a Ruling).
- **The mobile pass's constraints still hold:** the name stays on one line on phones, white base colour, safe-area insets.
- **Ownership:**
  - `src/components/NameHeader/*`;
  - `src/choreography/matter.ts` (+ test);
  - any SVG `<defs>` the header needs;
  - `CLAUDE.md` / `.claude` via `sync-claude-config` at the end.

  Don't push or merge.
- **Dev server:** `yarn dev --port 5205 --strictPort`. Isolated Chrome with its own `--user-data-dir`.

## Acceptance (report with evidence)
- **A screenshot per state** on desktop and iPhone 15, plus a frame strip of one full run.
- **Hover/tap trigger and ambient timing** verified (a hover during a run doesn't restart it); reduced motion behaves.
- **Measured frame cost** during a run, and zero cost when idle.
- **Tests:** the state machine timing, per-letter delay sweep and ambient scheduling.
- `yarn test`, `yarn lint` and `yarn build` are green, with counts; every `Ruling:` line.
