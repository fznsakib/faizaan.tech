---
name: create-animation
description: Step-by-step workflow for creating new audio-reactive components
---

# Create Audio-Reactive Component

Follow these steps in order. Reference `src/components/AnimatedSubtitle/index.tsx` as the canonical pattern.

## Steps

### 1. Create component directory

Create `src/components/<Name>/index.tsx` and `src/components/<Name>/<Name>.styled.ts`.

### 2. Connect to audio

```tsx
import { useAudio } from "../../context/AudioContext";

const { audioData } = useAudio();
```

### 3. Set up refs for animation state

Use `useRef` for ALL per-frame values. Never `useState` for animation — it causes re-renders.

```tsx
const ref = useRef<HTMLDivElement>(null);
const lastValueRef = useRef(0);
```

### 4. Memoize frequency data

```tsx
const frequencyData = useMemo(() => {
  return audioData.frequencyBins[frequencyBin] || [];
}, [audioData.frequencyBins, frequencyBin]);
```

Available bins: `senior` (sub-bass), `software` (bass), `engineer` (low-mid), `fullstack` (mid), `london` (high-mid), `affirm` (treble).

### 5. Create update function with useCallback

Manipulate DOM directly — never trigger React re-renders in the animation loop:

```tsx
const updateAnimation = useCallback((smoothedValue: number) => {
  if (!ref.current) return;
  ref.current.style.opacity = `${0.6 + smoothedValue * 0.4}`;
  ref.current.style.transform = `scale(${0.95 + smoothedValue * 0.1})`;
}, []);
```

### 6. Apply exponential smoothing in useEffect

```tsx
useEffect(() => {
  if (frequencyData.length === 0) return;

  const maxValue = Math.max(...frequencyData);
  const normalizedValue = maxValue / 255;

  const smoothingFactor = 0.15; // 0.1=smooth, 0.9=responsive
  const smoothedValue =
    lastValueRef.current * (1 - smoothingFactor) +
    normalizedValue * smoothingFactor;
  lastValueRef.current = smoothedValue;

  updateAnimation(smoothedValue);
}, [frequencyData, updateAnimation]);
```

### 7. Create styled component

In the `.styled.ts` file. Do NOT add CSS transitions on animated properties:

```tsx
export const Container = styled.div`
  position: fixed;
  /* NO transition on opacity, transform, or other animated props */
`;
```

### 8. Render with transition: "none"

```tsx
return (
  <Styled.Container
    ref={ref}
    style={{ transition: "none" }}
  >
    {children}
  </Styled.Container>
);
```

### 9. Add to App.tsx

Import and place at the correct z-index layer:
- Background (z:0) → GlassPanel (z:1) → Canvas (z:10) → Social (z:20) → PlayButton (z:1000)

### 10. Test

Run `yarn dev`, click the play button, verify the component reacts to music.

## Checklist

- [ ] Uses `useRef` for all animation state (not `useState`)
- [ ] Frequency data memoized with `useMemo`
- [ ] Update function wrapped in `useCallback`
- [ ] DOM manipulation is direct (`ref.current.style.*`)
- [ ] No CSS transitions on animated properties
- [ ] Smoothing factor chosen appropriately
- [ ] Added to App.tsx at correct z-index layer
- [ ] `yarn build` passes
