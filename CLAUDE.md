# faizaan.tech v2

Personal audiovisual portfolio site. A 3D head nods to music while typography and UI elements react to audio frequencies in real-time.

## Dev Commands

```
yarn dev          # Vite dev server
yarn build        # tsc -b && vite build
yarn lint         # eslint .
yarn preview      # Preview production build
```

## Audio Pipeline

```
PlayButton → AudioContext.startMusic(bpm) → MusicPlayer loads audio file
  → MusicAnalyser.getFrequencyData() → setAudioData() → components via useAudio()
```

- `AudioProvider` wraps the app and holds `AudioData` state (bpm, frequencyBins, isPlaying, bassIntensity)
- `MusicPlayer` runs a `requestAnimationFrame` loop calling `MusicAnalyser` each frame
- Components consume data via `useAudio()` hook from `src/context/AudioContext.tsx`

## Frequency Bins

Defined in `src/components/MusicPlayer/MusicAnalyser.ts`:

| Bin Name     | Range (Hz)   | Musical Role |
|-------------|-------------|--------------|
| `senior`    | 0-100       | Sub-bass     |
| `software`  | 100-250     | Bass         |
| `engineer`  | 250-500     | Low-mid      |
| `fullstack` | 500-1000    | Mid          |
| `london`    | 1000-2000   | High-mid     |
| `affirm`    | 2000-20000  | Treble       |

Each bin is normalized to ~3 values via 3-segment chunking (80% avg + 20% max blend).

## Component Layers (z-index order)

| Layer            | z-index | Component(s)                    |
|-----------------|---------|--------------------------------|
| Background      | 0       | `Background`                   |
| GlassPanel      | 1       | `GlassPanel`                   |
| Header/Subtitle | 1       | `AnimatedHeader`, `AnimatedSubtitle` |
| Canvas (3D)     | 10      | Three.js `Canvas` with `Head`  |
| Social Icons    | 20      | `SocialIconsContainer`         |
| Play Button     | 1000    | `PlayButton`                   |

## State & Animation Patterns

- **State**: `AudioProvider` uses `useState` for audio data. Components read via `useAudio()`.
- **Animation state**: Always `useRef` for per-frame values (never `useState` — avoids re-renders).
- **Direct DOM manipulation**: Animated components set `ref.current.style.*` directly in `useEffect`.
- **Exponential smoothing**: `smoothed = prev * (1 - factor) + newValue * factor`
  - Lower factor (0.1-0.15) = smoother/stable (AnimatedSubtitle uses 0.15)
  - Higher factor (0.6-0.9) = more responsive (AnimatedHeader uses 0.6)
- **No CSS transitions** on properties being animated per-frame (set `transition: "none"`).
- **Three.js**: Use `useFrame` for animation loops (never raw `requestAnimationFrame`). Use refs for mutable state.

## Code Conventions

- **Components**: Each component gets a directory with `index.tsx` + `*.styled.ts`
- **Styled components**: Use `styled-components` v6 with transient props (`$propName`)
- **Imports**: React/libraries first, then local (`../../App.styled`), then context (`../../context/AudioContext`)
- **Type imports**: Use `import type { ... }` for type-only imports
- **Theme**: `src/styles/theme.ts` exports `theme` with `colors` and `spacing`

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root layout, component composition, Canvas/lighting setup |
| `src/context/AudioContext.tsx` | AudioProvider, useAudio hook, AudioData interface |
| `src/components/MusicPlayer/MusicAnalyser.ts` | FFT analysis, frequency bins, BPM detection |
| `src/components/MusicPlayer/index.ts` | Audio loading, analysis loop, bass intensity calc |
| `src/components/MusicPlayer/songs.ts` | Song list with BPM metadata |
| `src/components/Head/index.tsx` | 3D head model, BPM-synced nodding |
| `src/components/AnimatedSubtitle/index.tsx` | Canonical audio-reactive component pattern |
| `src/components/AnimatedHeader/index.tsx` | Font-cycling header with audio reactivity |

## Deployment

Netlify. Build command: `yarn build`. Publish directory: `dist`.
