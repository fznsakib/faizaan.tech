import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import { Box3, MeshStandardMaterial, Vector3 } from "three";
import { Mesh } from "three";
import { OBJLoader } from "three/examples/jsm/Addons.js";

import type { Group } from "three";

function Head() {
  const meshRef = useRef<Mesh>(null);
  const { viewport } = useThree();
  const [obj, setObj] = useState<Group | null>(null);

  useEffect(() => {
    const loader = new OBJLoader();
    // Load the OBJ file from the assets directory
    loader.load(
      "/src/assets/head.obj", // Make sure this path is correct relative to your public directory
      (object) => {
        // Calculate the center of the model
        const box = new Box3().setFromObject(object);
        const center = box.getCenter(new Vector3());

        // Move the geometry to be centered at origin
        object.position.sub(center);

        // Apply standard material to all meshes in the object
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

  useFrame(({ pointer }) => {
    if (!meshRef.current) return;

    // Convert mouse coordinates to 3D space
    const x = (pointer.x * viewport.width) / 2;
    const y = (-pointer.y * viewport.height) / 2;

    // Smooth rotation based on mouse position
    meshRef.current.rotation.x = y * 0.2;
    meshRef.current.rotation.y = x * 0.2;
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
