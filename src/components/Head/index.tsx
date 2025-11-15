import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import { Box3, MeshStandardMaterial, Vector3 } from "three";
import { Mesh } from "three";
import { OBJLoader } from "three/examples/jsm/Addons.js";

import { useAudio } from "../../context/AudioContext";

import type { Group } from "three";

export const BASE_NOD_INTENSITY = 0.1;
const NOD_INTENSITY_MULTIPLIER = 0.4;

function Head() {
  const { audioData } = useAudio();
  const meshRef = useRef<Mesh>(null);
  const { viewport, clock } = useThree();
  const [obj, setObj] = useState<Group | null>(null);
  const musicStartTimeRef = useRef<number | null>(null);
  const previousSineValue = useRef(0);
  const currentIntensityMultiplier = useRef(0.1); // Start at minimum (10%)

  // Track when music starts using useEffect for precise timing
  useEffect(() => {
    const isMusicReady = audioData.isPlaying && audioData.bpm > 0;

    if (isMusicReady && musicStartTimeRef.current === null) {
      // Capture the current clock time when music becomes ready
      musicStartTimeRef.current = clock.getElapsedTime();
    } else if (!isMusicReady) {
      musicStartTimeRef.current = null;
    }
  }, [audioData.isPlaying, audioData.bpm, clock]);

  useEffect(() => {
    const loader = new OBJLoader();

    loader.load(
      "/src/assets/head.obj",
      (object) => {
        const box = new Box3().setFromObject(object);
        const center = box.getCenter(new Vector3());

        // center at origin
        object.position.sub(center);

        object.traverse((child) => {
          if (child instanceof Mesh) {
            child.material = new MeshStandardMaterial({
              color: "orange",
              metalness: 0.9,
              roughness: 0,
              emissive: "orange",
              emissiveIntensity: 0.2,
            });
          }
        });

        setObj(object);
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.error("An error occurred loading the model:", error);
      }
    );
  }, []);

  useFrame(({ pointer, clock }) => {
    if (!meshRef.current || !obj) return;

    // Get current time
    const currentTime = clock.getElapsedTime();

    // Mouse tracking for interactive rotation
    const mouseX = (pointer.x * viewport.width) / 2;
    const mouseY = (-pointer.y * viewport.height) / 2;

    // Pure BPM-based nodding (only when music is playing)
    const bpm = audioData.bpm;
    const maxNodAngle = Math.PI / 9; // 20 degrees in radians

    let bpmNodding = 0;

    // Only nod if music is ready and we have a start time
    const isMusicReady = audioData.isPlaying && bpm > 0;
    if (isMusicReady && musicStartTimeRef.current !== null) {
      const timeSinceMusicStart = currentTime - musicStartTimeRef.current;

      // Calculate the sine wave value (raw, without amplitude)
      const sineValue = Math.sin(
        timeSinceMusicStart * (bpm / 60) * Math.PI * 2
      );

      // Detect peak (going from positive to negative) or trough (going from negative to positive)
      const crossedPeak = previousSineValue.current > 0 && sineValue <= 0;
      const crossedTrough = previousSineValue.current < 0 && sineValue >= 0;

      // Update intensity multiplier only at direction changes (peak/trough)
      if (crossedPeak || crossedTrough) {
        // Map bassIntensity (0-1) to multiplier range (0.1-1.0)
        // Use exponential curve for more dramatic response at high intensity
        // Cubic function: x^3 ramps slowly at low values, dramatically at high values
        const exponentialIntensity = Math.pow(audioData.bassIntensity, 3);
        currentIntensityMultiplier.current =
          BASE_NOD_INTENSITY + NOD_INTENSITY_MULTIPLIER * exponentialIntensity;
      }

      // Store current sine value for next frame comparison
      previousSineValue.current = sineValue;

      // Apply the intensity multiplier to the nodding
      bpmNodding = sineValue * maxNodAngle * currentIntensityMultiplier.current;
    }

    // Combine mouse interaction with BPM nodding
    const mouseInfluenceX = mouseY * 0.15; // Mouse vertical influence
    const mouseInfluenceY = mouseX * 0.2; // Mouse horizontal influence

    const finalRotationX = bpmNodding + mouseInfluenceX; // BPM nodding + mouse
    const finalRotationY = mouseInfluenceY; // Pure mouse horizontal

    // Apply combined rotations with limits
    meshRef.current.rotation.x = Math.max(
      -maxNodAngle,
      Math.min(maxNodAngle, finalRotationX)
    );
    meshRef.current.rotation.y = Math.max(-0.5, Math.min(0.5, finalRotationY));
  });

  return (
    <mesh ref={meshRef}>
      {obj && (
        <primitive
          object={obj}
          scale={0.25}
          position={[0, -2.5, 0]}
          rotation={[Math.PI / 2, Math.PI, 0]}
        />
      )}
    </mesh>
  );
}

export default Head;
