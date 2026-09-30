import { Environment, Lightformer, useGLTF, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MeshStandardMaterial, SRGBColorSpace } from "three";

import { patchFaceSkin } from "./faceSkin";
import { prepareModel, useHeadRig } from "./useHeadRig";
import headFaceUrl from "../../assets/head-face.jpg?url";
import headModelUrl from "../../assets/head.glb?url";
import { COPPER_FIT } from "../../choreography/fit";

import type { HeadPulse } from "./useHeadRig";
import type { DirectionalLight, Group } from "three";

const BASE_EMISSIVE = 0.04;
const BASE_RIM = 1.5;

/**
 * The chrome head with the owner's photo face (blended by the mesh's `_faceweight`), on the shared rig: nods on the
 * beat, sways with the bar, follows the mouse. Its chrome glows with the kick and its rim light flashes with the snare.
 */
function Head() {
  const { scene } = useGLTF(headModelUrl);
  const skin = useTexture(headFaceUrl);
  const material = useMemo(() => {
    skin.flipY = false; // glTF-style UVs: v runs down from the top of the image
    skin.colorSpace = SRGBColorSpace;
    skin.anisotropy = 4;
    skin.needsUpdate = true;
    const chrome = new MeshStandardMaterial({
      color: "#ff8a1c",
      metalness: 1,
      roughness: 0.22,
      emissive: "#ff6a00",
      emissiveIntensity: BASE_EMISSIVE,
      envMapIntensity: 1.3,
      map: skin,
    });
    chrome.onBeforeCompile = patchFaceSkin;
    chrome.customProgramCacheKey = () => "face-skin";
    return chrome;
  }, [skin]);
  const model = useMemo(() => prepareModel(scene, material), [scene, material]);
  const rig = useRef<Group>(null);
  const rim = useRef<DirectionalLight>(null);
  const pulse = useCallback(
    ({ kick, snare, drive }: HeadPulse) => {
      material.emissiveIntensity = BASE_EMISSIVE + 0.2 * kick * drive;
      if (rim.current) rim.current.intensity = BASE_RIM + 10 * snare;
    },
    [material]
  );
  useHeadRig(rig, { baseY: model.baseY, fit: COPPER_FIT, pulse });

  useEffect(() => () => material.dispose(), [material]);

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
useTexture.preload(headFaceUrl);

export default Head;
