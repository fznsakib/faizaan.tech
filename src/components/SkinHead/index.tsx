import { useGLTF, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MeshStandardMaterial, SRGBColorSpace } from "three";

import { patchSkinHead, SKIN_ROUGHNESS } from "./skinMaterial";
import skinModelUrl from "../../assets/skin-head.glb?url";
import skinAtlasUrl from "../../assets/skin-head.jpg?url";
import { SKIN_FIT } from "../../choreography/fit";
import DaylightRig from "../Daylight";
import { prepareModel, useHeadRig } from "../Head/useHeadRig";

import type { HeadPulse } from "../Head/useHeadRig";
import type { Group } from "three";

/**
 * The owner's whole head — his photo face and front hair, his skin and curls synthesized everywhere else — on the
 * shared rig: nods on the beat, sways with the bar, follows the mouse. Skin, not chrome: lit by the daylight rig's gentler
 * "skin" variant (the photo already carries the light it was taken in), and only the rim light flashes, with the snare.
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
  /** The snare's rim flash, added by the daylight rig to the rim light's time-of-day strength. */
  const rimFlash = useRef(0);
  const pulse = useCallback(({ snare }: HeadPulse) => {
    rimFlash.current = 6 * snare;
  }, []);
  useHeadRig(rig, { baseY: model.baseY, fit: SKIN_FIT, pulse });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <DaylightRig variant="skin" rimFlash={rimFlash} />
      <group ref={rig} position-y={model.baseY}>
        <primitive object={model.holder} />
      </group>
    </>
  );
}

useGLTF.preload(skinModelUrl);
useTexture.preload(skinAtlasUrl);

export default SkinHead;
