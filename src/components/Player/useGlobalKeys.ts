import { useEffect } from "react";

import { djKeyVoice, transportKeyAction } from "./keys";
import { engine } from "../../audio/engine";

/** Fields that take typed keys; a range slider only takes arrows, so Space and M still reach the player from one. */
const TYPING = "input:not([type='range']), select, textarea, [contenteditable='true']";
const CONTROLS = "a, button";

/**
 * Headless page-wide keys: Space = play/pause (and resumes audio the system interrupted), M = mute, A S D F = DJ
 * hits. Mounted by the player so it keeps working while the player is collapsed or tucked away.
 */
export function useGlobalKeys(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const input = {
        key: event.key,
        repeat: event.repeat,
        defaultPrevented: event.defaultPrevented,
        modifier: event.metaKey || event.ctrlKey || event.altKey,
        unlocked: engine.getSnapshot().unlocked,
        onTypingField: Boolean(target?.closest(TYPING)),
        onControl: Boolean(target?.closest(CONTROLS)),
      };
      const voice = djKeyVoice(input);
      if (voice) engine.hit(voice, event.timeStamp);
      const action = transportKeyAction(input);
      if (action === "toggle") {
        event.preventDefault();
        engine.toggle();
      } else if (action === "mute") {
        engine.setMuted(!engine.getSnapshot().muted);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
