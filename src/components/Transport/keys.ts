import type { Voice } from "../../audio/types";

export type TransportKeyAction = "toggle" | "mute" | null;

export interface TransportKey {
  key: string;
  repeat: boolean;
  defaultPrevented: boolean;
  /** Any of meta/ctrl/alt held. */
  modifier: boolean;
  /** The engine has been unlocked (the visitor has entered). */
  unlocked: boolean;
  /** Focus is in an input, select, textarea or contenteditable. */
  onTypingField: boolean;
  /** Focus is on a link or button (which handles its own Space). */
  onControl: boolean;
}

/** What a window keydown does to the transport: Space = play/pause, M = mute. */
export function transportKeyAction(input: TransportKey): TransportKeyAction {
  // A held key auto-repeats: without this, holding Space (e.g. after entering with it) flickers play/pause.
  if (input.repeat || input.defaultPrevented || input.modifier || !input.unlocked) return null;
  if (input.onTypingField) return null;
  if (input.key === " ") return input.onControl ? null : "toggle";
  if (input.key === "m" || input.key === "M") return "mute";
  return null;
}

const DJ_KEYS = new Map<string, Voice>([
  ["a", "kick"],
  ["s", "snare"],
  ["d", "hat"],
  ["f", "stab"],
]);

/** Which DJ-mode voice a window keydown plays (A S D F), if any. */
export function djKeyVoice(input: Omit<TransportKey, "onControl"> & { onControl?: boolean }): Voice | null {
  if (input.repeat || input.defaultPrevented || input.modifier || !input.unlocked) return null;
  if (input.onTypingField) return null;
  return DJ_KEYS.get(input.key.toLowerCase()) ?? null;
}
