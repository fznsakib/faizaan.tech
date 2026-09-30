import { useGLTF, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MeshStandardMaterial, SRGBColorSpace } from "three";

import { patchFaceSkin } from "./faceSkin";
import { prepareModel, useHeadRig } from "./useHeadRig";
import headFaceUrl from "../../assets/head-face.jpg?url";
import headModelUrl from "../../assets/head.glb?url";
import { COPPER_FIT } from "../../choreography/fit";
import DaylightRig from "../Daylight";

import type { HeadPulse } from "./useHeadRig";
import type { Group } from "three";

const BASE_EMISSIVE = 0.04;

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
  /** The snare's rim flash, added by the daylight rig to the rim light's time-of-day strength. */
  const rimFlash = useRef(0);
  const pulse = useCallback(
    ({ kick, snare, drive }: HeadPulse) => {
      material.emissiveIntensity = BASE_EMISSIVE + 0.2 * kick * drive;
      rimFlash.current = 10 * snare;
    },
    [material]
  );
  useHeadRig(rig, { baseY: model.baseY, fit: COPPER_FIT, pulse });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <DaylightRig rimFlash={rimFlash} />
      <group ref={rig} position-y={model.baseY}>
        <primitive object={model.holder} />
      </group>
    </>
  );
}

useGLTF.preload(headModelUrl);
useTexture.preload(headFaceUrl);

export default Head;
