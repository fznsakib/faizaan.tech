import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "./reducedMotion";
import { TiltCalibration } from "../choreography/tilt";

import type { Attitude, Look } from "../choreography/tilt";

type PermissionState = "granted" | "denied";
type OrientationEventStatic = { requestPermission?: () => Promise<PermissionState> };

const calibration = new TiltCalibration();
let entered = false;
/** The newest reading, kept from before entering too: entering levels on it. */
let latest: Attitude | null = null;

/** Touch devices only: a laptop's orientation sensor mustn't fight the mouse. */
const isTouch = () => typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;

/** `screen.orientation.angle`, or iOS < 16.4's `window.orientation`. */
const screenAngle = () =>
  screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0;

/**
 * Call on the Splash's enter tap: starts tilt-follow, levelled at the attitude the visitor enters with. iOS only
 * sends orientation events once asked from inside a user gesture; denied, unsupported or blocked (e.g. by an
 * iframe's permissions policy), no events arrive and the head keeps following the pointer.
 */
export function enableDeviceTilt(): void {
  entered = true;
  calibration.calibrate(latest ?? undefined);
  if (!isTouch() || typeof DeviceOrientationEvent === "undefined") return;
  const events = DeviceOrientationEvent as unknown as OrientationEventStatic;
  if (typeof events.requestPermission === "function") events.requestPermission().catch(() => {});
}

/**
 * The head's look target from the phone's tilt (pointer-like, -1..1), or null when there's none: no sensor or
 * permission, a non-touch device, before entering, or with reduced motion. Re-levels after a rotation.
 */
export function useDeviceTilt(): { readonly current: Look | null } {
  const look = useRef<Look | null>(null);

  useEffect(() => {
    if (typeof DeviceOrientationEvent === "undefined" || !isTouch()) return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      latest = { beta: event.beta, gamma: event.gamma };
      look.current = entered && !prefersReducedMotion() ? calibration.look(latest, screenAngle()) : null;
    };
    const relevel = () => calibration.calibrate();
    window.addEventListener("deviceorientation", onOrientation);
    screen.orientation?.addEventListener("change", relevel);
    window.addEventListener("orientationchange", relevel);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      screen.orientation?.removeEventListener("change", relevel);
      window.removeEventListener("orientationchange", relevel);
      look.current = null;
    };
  }, []);

  return look;
}
