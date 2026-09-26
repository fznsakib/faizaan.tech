import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import * as Styled from "./Splash.styled";
import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";
import { enableDeviceTilt } from "../../hooks/useDeviceTilt";

const FADE_MS = 600;

/** Click-to-enter veil: unlocks Web Audio (and asks for motion access) inside the user gesture, starts the first track. */
const Splash: React.FC = () => {
  const { status } = useMusicState();
  const [phase, setPhase] = useState<"open" | "leaving" | "gone">("open");
  const entered = useRef(false);
  const enterButton = useRef<HTMLButtonElement>(null);

  const enter = (muted: boolean) => {
    if (entered.current) return;
    entered.current = true;
    engine.setMuted(muted);
    engine.unlock();
    enableDeviceTilt(); // inside the gesture: iOS asks for motion access here
    engine.play(0);
    setPhase("leaving");
  };

  useEffect(() => {
    void engine.preload();
    enterButton.current?.focus();
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("gone"), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const open = phase !== "gone";
  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("root");
    if (!root) return;
    root.inert = true; // nothing behind the veil can take focus or clicks
    return () => {
      root.inert = false;
    };
  }, [open]);

  useEffect(() => {
    if (phase !== "open") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target instanceof HTMLButtonElement) return; // the focused button handles it
      event.preventDefault();
      enter(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (phase === "gone") return null;

  const loading = status === "idle" || status === "loading";
  return createPortal(
    <Styled.Veil
      role="dialog"
      aria-modal="true"
      aria-label="Enter faizaan.tech"
      $leaving={phase === "leaving"}
      onClick={() => enter(false)}
    >
      <Styled.EnterButton
        ref={enterButton}
        type="button"
        aria-busy={loading}
        onClick={(event) => {
          event.stopPropagation();
          enter(false);
        }}
      >
        {loading ? <Styled.Loading>loading</Styled.Loading> : "enter"}
      </Styled.EnterButton>
      <Styled.SilentButton
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          enter(true);
        }}
      >
        enter without sound
      </Styled.SilentButton>
    </Styled.Veil>,
    document.body
  );
};

export default Splash;
