---
name: audio-analysis
description: Checklist for modifying the audio analysis pipeline
---

# Modify Audio Pipeline

Key files:
- `src/components/MusicPlayer/MusicAnalyser.ts` — FFT analysis, frequency bins, BPM detection
- `src/components/MusicPlayer/index.ts` — Audio loading, analysis loop, bass intensity
- `src/context/AudioContext.tsx` — AudioData interface, provider, useAudio hook
- `src/components/MusicPlayer/songs.ts` — Song list with BPM metadata

## Adding/Modifying Frequency Bins

In `MusicAnalyser.ts`, update the `frequencyRanges` object:

```ts
const frequencyRanges = {
  senior:    { min: 0,    max: 100 },    // sub-bass
  software:  { min: 100,  max: 250 },    // bass
  engineer:  { min: 250,  max: 500 },    // low-mid
  fullstack: { min: 500,  max: 1000 },   // mid
  london:    { min: 1000, max: 2000 },   // high-mid
  affirm:    { min: 2000, max: 20000 },  // treble
};
```

Bins auto-convert to FFT indices: `index = (hz / nyquist) * bufferLength`.

## FFT Parameters

In `MusicAnalyser.ts` constructor:
- `fftSize`: 2048 (gives 1024 frequency bins, ~21Hz resolution at 44.1kHz)
- `smoothingTimeConstant`: 0.6 (built-in browser smoothing, 0=none, 1=max)

## Data Normalization

`normaliseData()` in `MusicAnalyser.ts`:
1. Splits bin data into 3 equal chunks (low/mid/high of that range)
2. For each chunk: `stableValue = avgValue * 0.8 + maxValue * 0.2`
3. Returns array of ~3 values per bin

## Bass Intensity Calculation

In `MusicPlayer/index.ts`, inside the analysis loop:
1. Combine `senior` + `software` bin data
2. Calculate RMS: `sqrt(sumOfSquares / count)`
3. Normalize to 0-1: `min(rms / 255, 1)`
4. Smooth: factor 0.15, initialized to `BASE_NOD_INTENSITY` (0.1)

## BPM Detection

`BPMDetector` class in `MusicAnalyser.ts`:
- Energy threshold: 60th percentile of recent energies (`sortedEnergies.length * 0.6`)
- Min beat interval: 350ms (max ~171 BPM)
- Recent energies buffer: 43 frames (~1 second)
- Beat times buffer: 10 beats
- Required beats for BPM: 4 minimum
- Currently uses static BPM from `songs.ts` instead of detected BPM

## Adding a New Audio Metric

1. Add field to `AudioData` interface in `AudioContext.tsx`
2. Add default value in `defaultAudioData`
3. Calculate in MusicPlayer's `analyzeFrame` loop
4. Include in `setAudioData()` call
5. Consume via `useAudio()` in target component

## Adding a New Song

In `src/components/MusicPlayer/songs.ts`:
1. Import the audio file: `import name from "../../assets/audio/name.mp3";`
2. Add to `SONGS` array: `{ file: name, name: "Display Name", bpm: 120 }`
3. Update `SONG_INDEX` if needed

Current songs:
- Bend (Tiesto) — 134 BPM
- Empty Lightning — 113 BPM (currently active, index 1)
- Expression On Your Face — 133 BPM
- Generate Utopia — 150 BPM
- Void — 150 BPM
- In My Heart — 150 BPM
