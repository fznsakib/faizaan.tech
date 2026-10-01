import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";

import { VARIANT_GAIN } from "../../choreography/daylight";
import { useDaylight } from "../../hooks/useDaylight";

import type { DaylightVariant } from "../../choreography/daylight";
import type { RefObject } from "react";
import type { DirectionalLight } from "three";

const RIM_POSITION: [number, number, number] = [0, 2, -6];
/** The key light's reach: today's point light at [10, 10, 10], distance 20, decay 2. */
const KEY_DISTANCE = 20;

interface DaylightRigProps {
  /** Which head it lights: "skin" (the photo-skin head) takes gentler intensities than the chrome one. */
  variant?: DaylightVariant;
  /** Added to the rim's daylight strength every frame (the head's snare flash). */
  rimFlash?: RefObject<number>;
}

/**
 * The scene's lights and the head's environment, set by the visitor's clock (`useDaylight`): a key light that
 * follows the sun, a fill, a rim, ambient, and Lightformers whose colours follow the sky and which turn with the
 * sun, so the head's reflections move through the day. At 13:00 it is exactly the scene the site had before.
 */
function DaylightRig({ variant = "chrome", rimFlash }: DaylightRigProps) {
  const day = useDaylight();
  const gain = VARIANT_GAIN[variant];
  const rim = useRef<DirectionalLight>(null);
  const rimBase = day.rim.intensity * gain.rim;

  useFrame(() => {
    if (rim.current) rim.current.intensity = rimBase + (rimFlash?.current ?? 0);
  });

  // drei re-renders the cube map whenever the Environment's children change identity: only when the daylight does
  // (once a minute; each tick of ?daycycle), never per frame or on the head's own re-renders.
  const { env } = day;
  const formers = useMemo(
    () => (
      <>
        <Lightformer
          form="rect"
          intensity={env.sky.intensity * gain.env}
          color={env.sky.color}
          position={[0, 5, 2]}
          scale={[10, 3, 1]}
          rotation-x={Math.PI / 2}
        />
        <Lightformer
          form="rect"
          intensity={env.cool.intensity * gain.env}
          color={env.cool.color}
          position={[-5, 1, -3]}
          scale={[2, 8, 1]}
          rotation-y={Math.PI / 3}
        />
        <Lightformer
          form="rect"
          intensity={env.warm.intensity * gain.env}
          color={env.warm.color}
          position={[5, 0, 1]}
          scale={[3, 6, 1]}
          rotation-y={-Math.PI / 2}
        />
        <Lightformer
          form="ring"
          intensity={env.ground.intensity * gain.env}
          color={env.ground.color}
          position={[0, -4, 0]}
          scale={8}
          rotation-x={-Math.PI / 2}
        />
      </>
    ),
    [env, gain.env]
  );

  return (
    <>
      <ambientLight color={day.ambient.color} intensity={day.ambient.intensity * gain.ambient} />
      <pointLight
        position={day.key.position}
        color={day.key.color}
        intensity={day.key.intensity * gain.key}
        distance={KEY_DISTANCE}
        decay={2}
      />
      <pointLight position={day.fill.position} color={day.fill.color} intensity={day.fill.intensity * gain.fill} />
      <directionalLight ref={rim} position={RIM_POSITION} intensity={rimBase} color={day.rim.color} />
      <Environment resolution={256} environmentRotation={[0, env.rotation, 0]}>
        {formers}
      </Environment>
    </>
  );
}

export default DaylightRig;
