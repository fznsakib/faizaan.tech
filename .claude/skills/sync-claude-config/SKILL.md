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
|------|------------------|
| `src/context/AudioContext.tsx` | `AudioData` interface fields, default values |
| `src/components/MusicPlayer/MusicAnalyser.ts` | `frequencyRanges` object, FFT params, normalization logic |
| `src/components/MusicPlayer/index.ts` | Bass intensity calculation, smoothing factor |
| `src/components/MusicPlayer/songs.ts` | `SONGS` array, `SONG_INDEX` |
| `src/components/Head/index.tsx` | Material config, nod params, mouse influence values, transform |
| `src/components/AnimatedSubtitle/index.tsx` | Smoothing factor, animation ranges |
| `src/components/AnimatedHeader/index.tsx` | Timing params (threshold, cycle duration, random chance), smoothing factor |
| `src/App.tsx` | Component list, z-index values, lighting setup |
| `src/styles/theme.ts` | Theme structure |
| `src/styles/colors.ts` | Color values |

### 2. Compare against config files

Check each config file for drift:

- `./CLAUDE.md` — frequency bins table, z-index table, key files table, dev commands
- `.claude/skills/create-animation/SKILL.md` — bin names, smoothing example, z-index order
- `.claude/skills/tune-animation/SKILL.md` — smoothing factors, intensity params, bin table, value ranges
- `.claude/skills/audio-analysis/SKILL.md` — frequency ranges, FFT params, normalization, BPM params, song list
- `.claude/skills/3d-model/SKILL.md` — material config, lighting values, transform, mouse values
- `.claude/agents/frontend-dev.md` — component list, z-index values
- `.claude/agents/creative-dev.md` — bin names, key file paths, param values

### 3. Report drift

List any differences found, grouped by config file.

### 4. Update config files

Apply corrections to all affected files to match current source.

### 5. Verify

Run `yarn lint && yarn build` to confirm no source files were accidentally modified.
