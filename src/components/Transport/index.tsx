import { useEffect } from "react";

import * as Styled from "./Transport.styled";
import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";

const TYPING = "input, select, textarea, [contenteditable='true']";
const CONTROLS = "a, button";

/** Always-visible Doto transport: play/pause, track · bpm, mute, next. Space = play/pause, M = mute. */
const Transport: React.FC = () => {
  const { status, title, bpm, isPlaying, muted } = useMusicState();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!engine.getSnapshot().unlocked) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TYPING)) return;
      if (event.key === " ") {
        if (target?.closest(CONTROLS)) return; // a focused button handles its own Space
        event.preventDefault();
        engine.toggle();
      } else if (event.key === "m" || event.key === "M") {
        engine.setMuted(!engine.getSnapshot().muted);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (status === "error") {
    return <Styled.Bar role="status">audio unavailable</Styled.Bar>;
  }

  return (
    <Styled.Bar>
      <Styled.Control
        type="button"
        aria-label={isPlaying ? "Pause music" : "Play music"}
        onClick={() => {
          engine.unlock();
          engine.toggle();
        }}
      >
        {isPlaying ? "pause" : "play"}
      </Styled.Control>
      <Styled.Label aria-live="polite">
        {title}
        {bpm ? ` · ${Math.round(bpm)} bpm` : ""}
        {status === "loading" ? " · loading" : ""}
      </Styled.Label>
      <Styled.Control type="button" aria-pressed={muted} onClick={() => engine.setMuted(!muted)}>
        {muted ? "unmute" : "mute"}
      </Styled.Control>
      <Styled.Control
        type="button"
        aria-label="Next track"
        onClick={() => {
          engine.unlock();
          engine.next();
        }}
      >
        next
      </Styled.Control>
    </Styled.Bar>
  );
};

export default Transport;
