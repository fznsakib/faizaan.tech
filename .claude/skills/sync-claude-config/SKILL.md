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
| `src/choreography/matter.ts` | `STAGES`, `BLEND`, `MAX_SWEEP`, `AMBIENT_GAP`, `RETRIGGER_COOLDOWN`, effect timings |
| `src/components/NameHeader/*` | `SAG`, `WARP`, `LITE` and its piece counts, filter primitives |
| `src/choreography/grid.ts` | `TURN_RADIUS`, `TURN_TAU`, `PULSE`, `KICK_HISTORY_SPAN` |
| `src/choreography/glass.ts` | Glass shape families, physics (friction, restitution), map bevel |
| `src/audio/bands.ts` | `BAND_RANGE`, `SILENCE_DB` |
| `src/components/SocialLinks/*` | Links, glyphs, dot/magnet constants |
| `src/components/Head/index.tsx` | Material config, mouse influence, lighting, nod amplitude |
| `src/App.tsx` | Component list, z-index values, lighting setup |
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
