---
name: 3d-model
description: Checklist for Three.js and React Three Fiber work
---

# Three.js / React Three Fiber Work

Key file: `src/components/Head/index.tsx`

## Model Loading

Uses `useGLTF` from `@react-three/drei`:
1. Load `headModelUrl` (`src/assets/head.glb`, imported with `?url`)
2. `prepareModel()` clones the scene, traverses children and applies the shared material to each `Mesh`
3. Computes a bounding box and re-centres the model on a pivot near the atlanto-occipital joint (22% up from the neck, slightly behind centre) — this makes a pitch rotation read as a nod, not a spin
4. Memoize the prepared model with `useMemo` keyed on `[scene, material]`

## Current Material Config

```ts
new MeshStandardMaterial({
  color: "#ff8a1c",
  metalness: 1,
  roughness: 0.22,
  emissive: "#ff6a00",
  emissiveIntensity: BASE_EMISSIVE, // 0.04, pulses with kick*energy
  envMapIntensity: 1.3,
})
```

Dispose it on unmount: `useEffect(() => () => material.dispose(), [material])`.

## Lighting Setup

In `App.tsx` (Canvas-level):
```tsx
<ambientLight intensity={0.3} />
<pointLight position={[10, 10, 10]} intensity={20} distance={20} decay={2} />
<pointLight position={[-5, -5, -5]} intensity={5} />
```

In `Head/index.tsx`: an `Environment` with 4 `Lightformer`s (front rect, two colored side rects, a ring below) plus one `directionalLight` rim light (`BASE_RIM` 1.5, intensity pulses with `frame.snare`).

## Animation with useFrame

`Head` reads `engine.frame` directly inside `useFrame` — no hook subscription, since it already lives inside the r3f render loop:

```tsx
useFrame(({ pointer, clock, camera, size }, delta) => {
  const frame = engine.frame;
  // animation logic here
});
```

Use `useRef`/`useMemo` for mutable state between frames (springs, the rig group ref) — never `useState`.

## Beat-Locked Nodding

The head nods locked to the beat map, not a free-running sine wave. From `src/choreography/nod.ts`:

```
drive = nodDrive(frame)          // { phase, period, accent } — phase 0 at the landing beat
curve = bob(drive.phase, drive.period)   // authored curve: rebound + anticipation lift
amplitude = deg(2.5 + 6.5 * frame.energy) * drive.accent * frame.beatConfidence
pitch = pitchSpring.step(curve * amplitude, dt)
```

- Half-time above `HALF_TIME_BPM` (135): nods every other beat.
- `DOWNBEAT_ACCENT` (1.35) scales the nod when the nearest landing is a downbeat.
- `NOD_LEAD` (0.05s) samples the authored curve early to cancel the smoothing spring's lag.
- Pitch/lift/roll are each driven through a `Spring` (second-order, sub-stepped at 240Hz): pitch/lift `(900, 45)`, roll `(120, 18)` stiffness/damping.
- With no song playing but a recent DJ hit (`frame.jamming`): a small extra nod, `deg(6) * frame.kick`.

## Mouse and Tilt Interaction

Pointer NDC coordinates (-1 to 1), damped with `maath/easing`'s `damp` (tau 0.35):
- `MOUSE_YAW` = 22°, `MOUSE_PITCH` = 10°
- Combined additively with the music-driven pitch/yaw/roll for the final `head.rotation`
- Scaled by `0.5` instead of `1` under `prefersReducedMotion()`
- On touch devices with orientation data, `useDeviceTilt()` (`src/hooks/useDeviceTilt.ts`) stands in for the pointer: `tiltLook` (`src/choreography/tilt.ts`) turns beta/gamma into gravity in the screen's axes (rotated by `screen.orientation.angle`), reads the right edge's dip and the screen's raise from it (continuous through upright, where raw beta/gamma flip), and measures them from the attitude at the enter tap (re-levelled after a rotation) as the same -1..1 look; `TILT_RANGE` 25° of tilt = full range. The head looks "downhill": right when the right edge dips, up when the top tips away. No sensor, no permission (iOS asks on the Splash tap), an iframe without `allow="accelerometer; gyroscope"`, a desktop, or reduced motion → the pointer, as before.
- `?debug` exposes the damped look as `window.__choreo.lookYawDeg`/`lookPitchDeg`.

## Camera Fit

`fitCamera(size.width, size.height)` (`src/choreography/fit.ts`) → `{ z, y }`, read every frame in `Head`: desktop (and landscape phones) keep `z = CAMERA_Z` (5), `y = 0` exactly (pinned by tests); portrait pulls back until the head is ≤ 65% of the width and ≤ 45% of the height, and lowers the camera so the head centres 40% down, between the name and the subtitles. The limits ease off between aspect 0.75 and 1.25. The drop punch-in scales with the fitted distance (`fit.z - 0.35 × section × fit.z / CAMERA_Z`). `HEAD_WIDTH`/`HEAD_HEIGHT`/`HEAD_CENTRE` are measured from screenshots at z = 5: re-measure them if the model's silhouette changes.

## Current Head Transform

Set inside `prepareModel()`, not as a static JSX prop: `rotation.set(Math.PI / 2, Math.PI, 0)`, `scale.setScalar(0.25)`, then re-centred onto the nod pivot described above.

## Canvas Setup

In `App.tsx`, the Canvas is fixed-position with `dpr={[1, 1.75]}` and z-index 10, starting at the fitted distance so phones don't open zoomed in (y is set by `Head` each frame, so r3f's one-time `lookAt(0, 0, 0)` stays level):
```tsx
<Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, fitCamera(window.innerWidth, window.innerHeight).z] }} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 10 }}>
```

## Performance Tips

- `useRef`/`useMemo` for animation state and one-time objects (material, springs), not `useState`
- Avoid creating new objects (Vector3, Material) inside `useFrame`
- `Head` reads `engine.frame` directly each tick — no per-frame allocations, no React re-renders
- `prefersReducedMotion()` (`src/hooks/reducedMotion.ts`) gates mouse reach and idle motion; check it inside `useFrame`, not once at mount
