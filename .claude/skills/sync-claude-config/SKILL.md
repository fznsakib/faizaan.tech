---
name: sync-claude-config
description: Keep CLAUDE.md, skills, and agents in sync with source code changes
---

# Sync Claude Config

Run this after significant refactors to keep configuration files accurate.

## Steps

### 1. Read current source values

Read these files and extract current values:

| File | Values to Extract |
|------|--------------------|
| `src/audio/types.ts` | `MusicFrame`/`BeatMap`/`EngineState` field names |
| `src/audio/MusicEngine.ts` | Band analysis params (`writeBands`), DJ-mode constants (`hit`), engine internals |
| `src/audio/frame.ts` | Onset decay constants, frame construction |
| `src/choreography/nod.ts` | Spring/rebound/lift/accent constants |
| `src/choreography/type.ts` | Shockwave speed, EQ ballistics, quantisation steps |
| `src/choreography/faces.ts` | `CYCLE_FONTS`, `HISTORY`, `SPREAD` |
| `src/choreography/shatter.ts` | `SHARD_COUNT`, `FLIGHT_OUT`, `HOME`, `DURATION`, `PUSH`, `DRIFT`, shard spread, `REDUCED_DURATION` |
| `src/components/NameHeader/*` | `MIN_SHARD` (`ShatterLetter.tsx`), the lite media query (`useShatter.ts`), the plate's look (`NameHeader.styled.ts`) |
| `src/choreography/grid.ts` | `TURN_RADIUS`, `TURN_TAU`, `PULSE`, `KICK_HISTORY_SPAN` |
| `src/choreography/grain.ts` | `GRAIN` (octaves, speckle, fibres, mottle), `TILE_CSS`, `MOTTLE_STEP`/`MOTTLE_CELLS`, `MAX_GRAIN_DPR` |
| `src/choreography/glass.ts` | Glass shape families, physics (friction, restitution), map bevel |
| `src/audio/bands.ts` | `BAND_RANGE`, `SILENCE_DB` |
| `src/components/SocialLinks/*` | Links, glyphs, dot/magnet constants |
| `src/components/Head/index.tsx` / `SkinHead/index.tsx` | Material config, each head's own lights |
| `src/App.tsx` | Component list, z-index values, the `?head` switch |
| `src/styles/theme.ts` / `src/styles/colors.ts` | Theme structure |

### 2. Compare against config files

Check each config file for drift:

- `./CLAUDE.md` — audio pipeline description, MusicFrame table, z-index table, key files table, dev commands
- `.claude/skills/create-animation/SKILL.md` — pattern references, z-index order
- `.claude/skills/tune-animation/SKILL.md` — choreography constants, value ranges
- `.claude/skills/audio-analysis/SKILL.md` — beat-map pipeline, live-band params, DJ-mode hit flow
- `.claude/skills/3d-model/SKILL.md` — material config, lighting values, nod/mouse math
- `.claude/agents/frontend-dev.md` — component list, z-index values
- `.claude/agents/creative-dev.md` — audio pipeline description, key file paths, param values
- `.claude/agents/code-reviewer.md` — review criteria, z-index table

### 3. Report drift

List any differences found, grouped by config file.

### 4. Update config files

Apply corrections to all affected files to match current source. Where a documented file/component no longer exists, rewrite that section to describe its replacement rather than deleting context.

### 5. Verify

Run `yarn lint && yarn build && yarn test` to confirm no source files were accidentally modified.
