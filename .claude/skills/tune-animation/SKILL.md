---
name: tune-animation
description: Checklist for tuning audio-reactive animation parameters
---

# Tune Animation Parameters

## Smoothing Factor

Formula: `smoothed = prev * (1 - factor) + newValue * factor`

| Factor | Feel | Used By |
|--------|------|---------|
| 0.1-0.15 | Very smooth, stable | AnimatedSubtitle (0.15), bassIntensity (0.15) |
| 0.3-0.5 | Balanced | General purpose |
| 0.6-0.9 | Responsive, jittery | AnimatedHeader (0.6) |

## Intensity Curves

- **Linear**: `value = input` — proportional response, good for subtle effects
- **Exponential (cubic)**: `value = Math.pow(input, 3)` — quiet at low levels, dramatic at high levels. Used by Head nod intensity mapping.
- **Squared**: `value = Math.pow(input, 2)` — middle ground

## Frequency Bin Selection

| Bin | Hz | Responds To |
|-----|----|-------------|
| `senior` | 0-100 | Kick drums, deep bass |
| `software` | 100-250 | Bass lines, bass guitar |
| `engineer` | 250-500 | Lower vocals, guitar body |
| `fullstack` | 500-1000 | Vocals, snare |
| `london` | 1000-2000 | Vocal clarity, hi-hats |
| `affirm` | 2000-20000 | Cymbals, brightness, air |

Combine bins for broader response: `[...seniorData, ...softwareData]` (see bassIntensity in MusicPlayer).

## AnimatedHeader Timing Params

| Param | Value | Effect |
|-------|-------|--------|
| `CHANGE_THRESHOLD` | 0.03 | Min smoothed value change to trigger font switch |
| `FORCE_CYCLE_DURATION` | 2000ms | Force font change if no audio activity |
| `RANDOM_CHANGE_CHANCE` | 0.15 | Probability of triggering consecutive rapid changes |

## Head Nod Params

| Param | Value | Effect |
|-------|-------|--------|
| `BASE_NOD_INTENSITY` | 0.1 | Minimum nod amplitude (10%) |
| `NOD_INTENSITY_MULTIPLIER` | 0.4 | Max additional nod from bass (so max = 0.5) |
| `maxNodAngle` | PI/9 (20deg) | Maximum rotation angle |
| Mouse influence X | 0.15 | Vertical mouse → head pitch |
| Mouse influence Y | 0.2 | Horizontal mouse → head yaw |

## Value Ranges

| Value | Range | Notes |
|-------|-------|-------|
| Raw frequency data | 0-255 | From `getByteFrequencyData` |
| Normalized frequency | 0-1 | After `/255` |
| `bassIntensity` | 0-1 | RMS of senior+software, smoothed |
| Nod multiplier | 0.1-0.5 | `BASE_NOD_INTENSITY + NOD_INTENSITY_MULTIPLIER * intensity^3` |

## Performance Checklist

- [ ] Animation state in `useRef` (not `useState`)
- [ ] Direct DOM manipulation (`ref.current.style.*`)
- [ ] Frequency data memoized with `useMemo`
- [ ] No CSS transitions on animated properties
- [ ] No object allocations inside animation loops
- [ ] Update function in `useCallback`
