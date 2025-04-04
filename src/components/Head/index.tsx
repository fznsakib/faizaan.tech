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

  useFrame(({ pointer }) => {
    if (!meshRef.current || !obj) return;

    // Convert mouse coordinates to 3D space
    const x = (pointer.x * viewport.width) / 2;
    const y = (-pointer.y * viewport.height) / 2;

    // Basic mouse-following rotation
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
