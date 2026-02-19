---
name: 3d-model
description: Checklist for Three.js and React Three Fiber work
---

# Three.js / React Three Fiber Work

Key file: `src/components/Head/index.tsx`

## Model Loading

Uses `OBJLoader` from `three/examples/jsm/Addons.js`:
1. Load model from `/src/assets/head.obj`
2. Center at origin: compute bounding box, subtract center
3. Traverse children, apply material to each `Mesh`
4. Store in state via `useState<Group | null>`

## Current Material Config

```ts
new MeshStandardMaterial({
  color: "orange",
  metalness: 0.9,
  roughness: 0,
  emissive: "orange",
  emissiveIntensity: 0.2,
})
```

## Lighting Setup (in App.tsx)

```tsx
<ambientLight intensity={5} />
<pointLight position={[10, 10, 10]} intensity={20} distance={20} decay={2} />
<pointLight position={[-5, -5, -5]} intensity={5} />
```

## Animation with useFrame

Always use `useFrame` for animation — never raw `requestAnimationFrame`:

```tsx
useFrame(({ pointer, clock }) => {
  if (!meshRef.current) return;
  // animation logic here
});
```

Use `useRef` for mutable state between frames (not `useState`).

## BPM-Synced Motion

The head nods to the beat using a sine wave:

```
sineValue = sin(timeSinceMusicStart * (bpm / 60) * PI * 2)
nodAngle = sineValue * maxNodAngle * intensityMultiplier
```

- Intensity updates only at direction changes (peak/trough detection via sign change)
- Bass intensity mapped through cubic curve: `intensity^3`
- Multiplier range: 0.1 (quiet) to 0.5 (loud bass)

## Mouse Interaction

Pointer NDC coordinates (-1 to 1) → rotation:
- Vertical: `mouseY * 0.15` → pitch (rotation.x)
- Horizontal: `mouseX * 0.2` → yaw (rotation.y)
- Combined with BPM nodding for final rotation
- Clamped to `[-maxNodAngle, maxNodAngle]` for X and `[-0.5, 0.5]` for Y

## Current Head Transform

```tsx
<primitive
  object={obj}
  scale={0.25}
  position={[0, -2.5, 0]}
  rotation={[Math.PI / 2, Math.PI, 0]}
/>
```

## Canvas Setup

In `App.tsx`, the Canvas uses fixed positioning with z-index 10:
```tsx
<Canvas style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10 }}>
```

## Performance Tips

- Use `useRef` for animation state, not `useState`
- Avoid creating new objects (Vector3, Material) inside `useFrame`
- Track music start time with `useRef<number | null>` to avoid reset on re-render
- Use `useEffect` to detect music state changes, store timing in ref
