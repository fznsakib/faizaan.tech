import { useEffect, useRef, useSyncExternalStore } from "react";

import { engine } from "./engine";
import { onMusicFrame } from "./ticker";

import type { FrameListener } from "./ticker";
import type { EngineState } from "./types";

/** Coarse engine state (track, status, playing, muted). Re-renders only when it changes. */
export function useMusicState(): EngineState {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}

/** Run `callback` every animation frame with the current MusicFrame. Never triggers a React render. */
export function useMusicFrame(callback: FrameListener): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => onMusicFrame((frame, now) => latest.current(frame, now)), []);
}
