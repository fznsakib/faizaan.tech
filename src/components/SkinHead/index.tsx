import { Environment, Lightformer, useGLTF, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MeshStandardMaterial, SRGBColorSpace } from "three";

import { patchSkinHead, SKIN_ROUGHNESS } from "./skinMaterial";
import skinModelUrl from "../../assets/skin-head.glb?url";
import skinAtlasUrl from "../../assets/skin-head.jpg?url";
import { SKIN_FIT } from "../../choreography/fit";
import { prepareModel, useHeadRig } from "../Head/useHeadRig";

import type { HeadPulse } from "../Head/useHeadRig";
import type { DirectionalLight, Group } from "three";

const BASE_RIM = 1.2;

/**
 * The owner's whole head — his photo face and front hair, his skin and curls synthesized everywhere else — on the
 * shared rig: nods on the beat, sways with the bar, follows the mouse. Skin, not chrome: soft light of its own (the
 * photo already carries the light it was taken in), and only the rim light flashes, with the snare.
 */
function SkinHead() {
  const { scene } = useGLTF(skinModelUrl);
  const atlas = useTexture(skinAtlasUrl);
  const material = useMemo(() => {
    atlas.flipY = false; // glTF-style UVs: v runs down from the top of the image
    atlas.colorSpace = SRGBColorSpace;
    atlas.anisotropy = 4;
    atlas.needsUpdate = true;
    const skin = new MeshStandardMaterial({ map: atlas, metalness: 0, roughness: SKIN_ROUGHNESS, envMapIntensity: 0.9 });
    skin.onBeforeCompile = patchSkinHead;
    skin.customProgramCacheKey = () => "skin-head";
    return skin;
  }, [atlas]);
  const model = useMemo(() => prepareModel(scene, material), [scene, material]);
  const rig = useRef<Group>(null);
  const rim = useRef<DirectionalLight>(null);
  const pulse = useCallback(({ snare }: HeadPulse) => {
    if (rim.current) rim.current.intensity = BASE_RIM + 6 * snare;
  }, []);
  useHeadRig(rig, { baseY: model.baseY, fit: SKIN_FIT, pulse });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={1.6} color="#fff3e6" position={[0, 3, 5]} scale={[8, 5, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#d7ecff" position={[-5, 1, 1]} scale={[3, 8, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.1} color="#ffe2c4" position={[5, 1, 1]} scale={[3, 8, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" intensity={1} color="#143d32" position={[0, -4, 0]} scale={8} rotation-x={-Math.PI / 2} />
      </Environment>
      <ambientLight intensity={0.25} />
      <directionalLight position={[1.5, 3, 5]} intensity={1.1} color="#fff6ec" />
      <directionalLight ref={rim} position={[0, 2, -6]} intensity={BASE_RIM} color="#bfe6ff" />
      <group ref={rig} position-y={model.baseY}>
        <primitive object={model.holder} />
      </group>
    </>
  );
}

useGLTF.preload(skinModelUrl);
useTexture.preload(skinAtlasUrl);

export default SkinHead;
