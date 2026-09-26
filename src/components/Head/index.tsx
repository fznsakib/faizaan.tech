import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { damp } from "maath/easing";
import { useEffect, useMemo, useRef } from "react";
import { Box3, Group, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from "three";

import headModelUrl from "../../assets/head.glb?url";
import { engine } from "../../audio/engine";
import { bob, nodDrive, Spring } from "../../choreography/nod";
import { choreographyProbe } from "../../choreography/probe";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { DirectionalLight, Object3D } from "three";

const D = MathUtils.degToRad;
const CAMERA_Z = 5;
const BASE_EMISSIVE = 0.04;
const BASE_RIM = 1.5;
const MOUSE_YAW = D(22);
const MOUSE_PITCH = D(10);
/** Stand-in for energy when DJ hits drive the head without the song. */
const JAM_ENERGY = 0.6;

/** Orient and scale the scan, and move its origin to the neck so pitch reads as a nod, not a spin. */
function prepareModel(scene: Object3D, material: MeshStandardMaterial) {
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

/** The chrome head: nods on the beat (phase-locked, with anticipation), sways with the bar, follows the mouse. */
function Head() {
  const { scene } = useGLTF(headModelUrl);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#ff8a1c",
        metalness: 1,
        roughness: 0.22,
        emissive: "#ff6a00",
        emissiveIntensity: BASE_EMISSIVE,
        envMapIntensity: 1.3,
      }),
    []
  );
  const model = useMemo(() => prepareModel(scene, material), [scene, material]);
  const rig = useRef<Group>(null);
  const rim = useRef<DirectionalLight>(null);
  const springs = useMemo(
    () => ({ pitch: new Spring(900, 45), lift: new Spring(900, 45), roll: new Spring(120, 18) }),
    []
  );
  const mouse = useRef({ yaw: 0, pitch: 0 });

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ pointer, clock, camera }, delta) => {
    const head = rig.current;
    if (!head) return;
    const frame = engine.frame;
    const reduced = prefersReducedMotion();
    const dt = Math.min(delta, 0.1);
    const reach = reduced ? 0.5 : 1;
    damp(mouse.current, "yaw", MathUtils.clamp(pointer.x, -1, 1) * MOUSE_YAW * reach, 0.35, dt);
    damp(mouse.current, "pitch", MathUtils.clamp(-pointer.y, -1, 1) * MOUSE_PITCH * reach, 0.35, dt);

    let curve = 0;
    let pitch: number;
    let lift: number;
    let roll: number;
    let yaw = 0;
    let squash = 0;
    let emissive = BASE_EMISSIVE;
    let rimIntensity = BASE_RIM;
    let cameraZ = CAMERA_Z;

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
      cameraZ = CAMERA_Z - 0.35 * frame.section;
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
      const drive = frame.isPlaying ? frame.energy : JAM_ENERGY;
      squash = 0.012 * frame.kick;
      emissive = BASE_EMISSIVE + 0.2 * frame.kick * drive;
      rimIntensity = BASE_RIM + 10 * frame.snare;
    }

    head.rotation.set(mouse.current.pitch + pitch, mouse.current.yaw + yaw, roll);
    head.position.y = model.baseY + lift;
    head.scale.set(1 + squash / 2, 1 - squash, 1 + squash / 2);
    material.emissiveIntensity = emissive;
    if (rim.current) rim.current.intensity = rimIntensity;
    camera.position.z = MathUtils.lerp(camera.position.z, cameraZ, 1 - Math.exp(-3 * dt));

    choreographyProbe.headPitchDeg = MathUtils.radToDeg(pitch);
    choreographyProbe.nodCurve = curve;
    choreographyProbe.beatPhase = frame.beatPhase;
  });

  return (
    <>
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 2]} scale={[10, 3, 1]} rotation-x={Math.PI / 2} />
        <Lightformer
          form="rect"
          intensity={4}
          color="#9fd3ff"
          position={[-5, 1, -3]}
          scale={[2, 8, 1]}
          rotation-y={Math.PI / 3}
        />
        <Lightformer
          form="rect"
          intensity={3}
          color="#ffe2b8"
          position={[5, 0, 1]}
          scale={[3, 6, 1]}
          rotation-y={-Math.PI / 2}
        />
        <Lightformer
          form="ring"
          intensity={1.5}
          color="#143d32"
          position={[0, -4, 0]}
          scale={8}
          rotation-x={-Math.PI / 2}
        />
      </Environment>
      <directionalLight ref={rim} position={[0, 2, -6]} intensity={BASE_RIM} color="#bfe6ff" />
      <group ref={rig} position-y={model.baseY}>
        <primitive object={model.holder} />
      </group>
    </>
  );
}

useGLTF.preload(headModelUrl);

export default Head;
