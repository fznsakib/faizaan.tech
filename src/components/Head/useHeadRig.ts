import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useMemo, useRef } from "react";
import { Box3, Group, MathUtils, Mesh, Vector3 } from "three";

import { engine } from "../../audio/engine";
import { CAMERA_Z, fitCamera } from "../../choreography/fit";
import { bob, nodDrive, Spring } from "../../choreography/nod";
import { choreographyProbe } from "../../choreography/probe";
import { prefersReducedMotion } from "../../hooks/reducedMotion";
import { useDeviceTilt } from "../../hooks/useDeviceTilt";

import type { HeadFit } from "../../choreography/fit";
import type { RefObject } from "react";
import type { Material, Object3D } from "three";

const D = MathUtils.degToRad;
const MOUSE_YAW = D(22);
const MOUSE_PITCH = D(10);
/** Stand-in for energy when DJ hits drive the head without the song. */
const JAM_ENERGY = 0.6;
/**
 * `?debug`: `window.__head.yaw` / `.pitch` (radians) turn the head for inspection, on top of everything else, and
 * `.dolly` moves the camera back (world units), e.g. to see the crown with the head pitched toward it.
 */
const inspect: { yaw: number; pitch: number; dolly: number } | null = new URLSearchParams(window.location.search).has("debug")
  ? ((window as unknown as { __head: { yaw: number; pitch: number; dolly: number } }).__head = { yaw: 0, pitch: 0, dolly: 0 })
  : null;

/**
 * Orient and scale a head mesh in the stock head's conventions (z up, face toward +y), and move its origin to the neck
 * so pitch reads as a nod, not a spin.
 */
export function prepareModel(scene: Object3D, material: Material) {
  const head = scene.clone(true);
  head.traverse((child) => {
    if (child instanceof Mesh) child.material = material;
  });
  head.rotation.set(Math.PI / 2, Math.PI, 0);
  head.scale.setScalar(0.25);
  const holder = new Group();
  holder.add(head);
  holder.updateMatrixWorld(true);
  const box = new Box3().setFromObject(holder);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  // ≈ the atlanto-occipital joint: low (22% up from the neck) and slightly behind centre
  const pivot = new Vector3(centre.x, box.min.y + size.y * 0.22, centre.z - size.z * 0.1);
  head.position.sub(pivot);
  return { holder, baseY: pivot.y - centre.y - 0.1 };
}

/** What the music asks of a head's look this frame; all 0 when nothing plays or jams, or motion is reduced. */
export interface HeadPulse {
  kick: number;
  snare: number;
  /** Energy (the song's, or a stand-in while jamming). */
  drive: number;
}

/**
 * The head's movement, shared by every head: nods on the beat (phase-locked, with anticipation), sways with the bar,
 * squashes on the kick, follows the mouse (or the phone's tilt), breathes when idle, and places the camera for the
 * head's measured `fit`. Each frame it hands `pulse` the beat accents for the head's own look (its material, its lights).
 */
export function useHeadRig(rig: RefObject<Group | null>, { baseY, fit, pulse }: { baseY: number; fit: HeadFit; pulse: (p: HeadPulse) => void }) {
  const springs = useMemo(
    () => ({ pitch: new Spring(900, 45), lift: new Spring(900, 45), roll: new Spring(120, 18) }),
    []
  );
  const mouse = useRef({ yaw: 0, pitch: 0 });
  const accents = useMemo<HeadPulse>(() => ({ kick: 0, snare: 0, drive: 0 }), []);
  const tilt = useDeviceTilt(); // on phones, the tilt stands in for the mouse

  useFrame(({ pointer, clock, camera, size }, delta) => {
    const head = rig.current;
    if (!head) return;
    const frame = engine.frame;
    const reduced = prefersReducedMotion();
    const dt = Math.min(delta, 0.1);
    const reach = reduced ? 0.5 : 1;
    const look = tilt.current ?? pointer;
    damp(mouse.current, "yaw", MathUtils.clamp(look.x, -1, 1) * MOUSE_YAW * reach, 0.35, dt);
    damp(mouse.current, "pitch", MathUtils.clamp(-look.y, -1, 1) * MOUSE_PITCH * reach, 0.35, dt);

    let curve = 0;
    let pitch: number;
    let lift: number;
    let roll: number;
    let yaw = 0;
    let squash = 0;
    accents.kick = accents.snare = accents.drive = 0;
    const camera0 = fitCamera(size.width, size.height, fit); // today's camera on desktop; back (and down) on phones
    let cameraZ = camera0.z;

    if (frame.isPlaying && frame.bpm > 0 && !reduced) {
      const drive = nodDrive(frame);
      const confidence = frame.beatConfidence;
      const amplitude = D(2.5 + 6.5 * frame.energy) * drive.accent * confidence;
      curve = bob(drive.phase, drive.period);
      pitch = springs.pitch.step(curve * amplitude, dt);
      lift = springs.lift.step(-0.05 * curve * (0.5 + frame.energy) * confidence, dt);
      roll = springs.roll.step(
        D(2.5) * (0.4 + 0.6 * frame.energy) * Math.sin(2 * Math.PI * frame.barPhase) * confidence,
        dt
      );
      yaw = D(1.5) * Math.sin(2 * Math.PI * frame.barPhase - 0.6) * confidence;
      cameraZ = camera0.z - 0.35 * frame.section * (camera0.z / CAMERA_Z);
    } else {
      const t = clock.elapsedTime;
      const breathe = reduced ? 0 : 1;
      const jamNod = (frame.jamming && !reduced ? D(6) : 0) * frame.kick; // DJ kicks nod the head without music
      pitch = springs.pitch.step(D(0.8) * Math.sin((2 * Math.PI * t) / 4.5) * breathe + jamNod, dt);
      lift = springs.lift.step(0, dt);
      roll = springs.roll.step(0, dt);
      yaw = D(2) * Math.sin(t * 0.37) * Math.sin(t * 0.23) * breathe;
    }

    if ((frame.isPlaying || frame.jamming) && !reduced) {
      squash = 0.012 * frame.kick;
      accents.kick = frame.kick;
      accents.snare = frame.snare;
      accents.drive = frame.isPlaying ? frame.energy : JAM_ENERGY;
    }

    head.rotation.set(mouse.current.pitch + pitch + (inspect?.pitch ?? 0), mouse.current.yaw + yaw + (inspect?.yaw ?? 0), roll);
    head.position.y = baseY + lift;
    head.scale.set(1 + squash / 2, 1 - squash, 1 + squash / 2);
    pulse(accents);
    camera.position.z = MathUtils.lerp(camera.position.z, cameraZ + (inspect?.dolly ?? 0), 1 - Math.exp(-3 * dt));
    camera.position.y = camera0.y;

    choreographyProbe.headPitchDeg = MathUtils.radToDeg(pitch);
    choreographyProbe.nodCurve = curve;
    choreographyProbe.beatPhase = frame.beatPhase;
    choreographyProbe.lookYawDeg = MathUtils.radToDeg(mouse.current.yaw);
    choreographyProbe.lookPitchDeg = MathUtils.radToDeg(mouse.current.pitch);
  });
}
