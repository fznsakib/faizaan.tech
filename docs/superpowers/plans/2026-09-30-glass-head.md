# Glass Meets Head: Collisions, Flinch and Caustics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (superpowers:test-driven-development for the collision and caustic maths). Project skills that apply: `3d-model`, `tune-animation`.

**Goal:** Make the head a physical object in the glass world.
- Thrown or drifting glass pieces collide with the head's on-screen silhouette and bounce off it, with the same visible "ping" the walls give.
- The head **flinches** on impact: a quick recoil away from the hit, scaled by impact speed, springing back.
- The head casts **caustics**: faint bright refracted-light bands that slide across the grid behind it as it nods and turns.

It is purely visual physics, with no audio interaction.

**Owner's words** (2026-09-30): "purely visual, like motion design, colours, etc… no audio interactivity". Idea 2 was approved: "the head goes through the glass".

## Design
1. **The head's screen silhouette** (pure, tested, in `src/choreography/headShape.ts`):
   - Approximate the head's projected outline as a capsule or an ellipse plus a neck rectangle, in CSS px.
   - Compute it from `fitCamera(width, height)` (`src/choreography/fit.ts`) and its `HEAD_*` shares, plus the current rig pose (yaw/pitch/lift) so the shape follows nod and turn.
   - Expose `headOutline(view, pose) → { contains(x, y), nearest(x, y) → { point, normal, depth } }`.
2. **Collision** (extend `src/choreography/glass.ts`, pure, tested). Each glass body already has an outline, an extent and physics state (`stepGlass`, `collideWalls`, `release`, …).
   - Add `collideHead(state, extent/outline, head)`: when a piece overlaps the head silhouette, push it out along the normal and reflect the normal velocity with restitution ≈ 0.7. Return the impact speed so the component can ping the glass and flinch the head.
   - Drifting pieces glide around the head rather than jittering against it: ambient drift targets steer outside the silhouette.
   - The glass stays visually behind the head (z 9 under the canvas at z 10). This is a 2.5D collision: the piece meets the head's outline.
3. **Flinch** (pure, tested, in `src/choreography/impact.ts`): a tiny impulse channel.
   - `impact.hit({ x, y, speed })` is called by the glass layer.
   - `impact.sample(now) → { yaw, pitch, roll, squash }`: a damped spring kick away from the hit point, e.g. a hit on the left side yaws the head right. Amplitude is capped (≤ 8° yaw/roll, ≤ 5° pitch) and settles within ~0.6 s. Rapid hits accumulate, capped.
   - Head wiring: read `impact.sample` inside the head's `useFrame` and add it to the pose. Keep this edit **tiny and isolated** (a few lines): a `SkinHead` component and a shared head rig are being built in parallel on `fznsakib/v2-skinhead`, and the coordinator will wire the same channel into it at integration. Also add an eye-squint-like beat if cheap, e.g. a brief scale squash; optional.
4. **Caustics** (a new layer component, `src/components/Caustics/`):
   - A canvas **between the grid and the name**: z-index above `Background` (0) and below the name/subtitles (1). Pick the value and ruling carefully; keep it below the glass (9).
   - It paints soft, bright, animated refracted-light bands, e.g. a few thin warped bright curves with additive blending, over the grid **in a pool below and behind the head**, moving with the head's pose (a turn shifts the pattern, a nod makes it breathe).
   - Subtle: it should read as light through a lens, not as a new shape. Use the site's warm light colour. It's cheap: ≤ 1 ms/frame p95 at 1440×900, with DPR capped.
   - Put the pure pattern maths in `src/choreography/caustics.ts` with tests (deterministic, bounded, continuous over time).
   - **Don't edit `Background`**: another worker (`fznsakib/v2-daylight`) is changing its colours. If a CSS variable `--day-accent` exists at runtime, use it for the caustic colour; otherwise fall back to warm white.
5. **Reduced motion:** no flinch and static caustics. Collisions still resolve, since they keep the glass sensible.

## Constraints and conflicts
- **Parallel workers:** `v2-skinhead` (head rig refactor), `v2-daylight` (lighting and colours in Head, Background and Glass), `v2-namematter` (NameHeader).
- **Your edits are limited to:**
  - `glass.ts` (+ tests);
  - `GlassPanel/index.tsx` physics wiring (not tint styling);
  - the new `headShape.ts`, `impact.ts` and `caustics.ts`;
  - the new Caustics component;
  - a ≤ ~10-line hook-in in `Head/index.tsx`;
  - `App.tsx` to mount Caustics;
  - `CLAUDE.md` / `.claude` via `sync-claude-config` at the end.

  Don't push or merge.
- **Performance:** the glass callback stays ≤ 1.5 ms p95 and caustics ≤ 1 ms p95. No new per-frame React state.
- **Dev server:** `yarn dev --port 5204 --strictPort`. Isolated Chrome; test with scripted throws (the glass has window-level drag, see GlassPanel) and on iPhone 15 emulation.

## Acceptance (report with evidence)
- **A scripted throw into the head** (desktop and phone): the piece bounces off the silhouette (a frame strip or before/after positions), the ping shows, and the head flinches with the measured yaw/pitch peak and settle time.
- **Drifting pieces** never visibly overlap the head outline for more than a frame.
- **Caustics:** screenshots at rest, turned, and mid-nod.
- **Tests:** silhouette containment/normals, collision push-out + restitution, flinch amplitude caps + settling, caustic continuity.
- `yarn test`, `yarn lint` and `yarn build` are green, with counts; frame costs; every `Ruling:` line.
