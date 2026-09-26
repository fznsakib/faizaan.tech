---
name: create-animation
description: Step-by-step workflow for creating new music-reactive components
---

# Create a Music-Reactive Component

Follow these steps in order. Reference `src/components/SubtitleStack/index.tsx` (EQ bars) or `src/components/GlassPanel/index.tsx` (recut timing) as canonical patterns.

## Steps

### 1. Create component directory

Create `src/components/<Name>/index.tsx` and `src/components/<Name>/<Name>.styled.ts`.

### 2. Subscribe to the frame

```tsx
import { useMusicFrame } from "../../audio/react";

useMusicFrame((frame, now) => {
  // `frame` is a MusicFrame — mutated in place each tick, never store a reference to it
});
```

Use `useMusicState()` instead only for coarse, rarely-changing state (track title, playing/muted) that should trigger a re-render.

### 3. Set up refs for animation state

Use `useRef`/`useMemo` for ALL per-frame values (springs, histories, cursors). Never `useState` for animation — it causes re-renders.

```tsx
const ref = useRef<HTMLDivElement>(null);
const state = useMemo(() => new KickHistory(), []);
```

### 4. Put the actual math in `src/choreography/`

Curves, quantisation, envelope shaping — anything that's pure math over a `MusicFrame` — belongs in a new or existing `src/choreography/*.ts` module with a Vitest sibling (`*.test.ts`), not inline in the component. Keeps components thin glue and the math independently testable.

### 5. Write through `setStyle`

```tsx
import { setStyle } from "../../choreography/dom";

setStyle(ref.current, "opacity", `${0.6 + smoothedValue * 0.4}`);
```

`setStyle` dedupes against the last value it wrote to that element/property, so a redundant write never touches the DOM.

### 6. Respect reduced motion

```tsx
import { prefersReducedMotion } from "../../hooks/reducedMotion";

const reduced = prefersReducedMotion();
```

Check it inside the frame callback (it can change live), and reduce or disable movement — don't just skip a visual flourish.

### 7. Create styled component

Do NOT add CSS transitions on properties written by `setStyle`:

```tsx
export const Container = styled.div`
  position: fixed;
  /* NO transition on opacity, transform, or other animated props */
`;
```

### 8. Add to App.tsx

Import and place at the correct z-index layer:

Background (-5) → GlassPanel (5) → Header/Subtitle (1) → Canvas (10) → Social/Transport (20) → MusicDebug (90) → Splash (100)

### 9. Test

Run `yarn dev`, click "enter" on the splash, verify the component reacts to music. Use `?debug` for beat/bar/section/band readouts and a metronome. Run `yarn test` for any new choreography math.

## Checklist

- [ ] Frame data read via `useMusicFrame`, never per-frame `useState`
- [ ] Per-effect math lives in `src/choreography/*` with a Vitest test
- [ ] DOM writes go through `setStyle`
- [ ] No CSS transitions on animated properties
- [ ] Reduced-motion handled inside the frame callback
- [ ] Added to App.tsx at correct z-index layer
- [ ] `yarn build` and `yarn test` pass
