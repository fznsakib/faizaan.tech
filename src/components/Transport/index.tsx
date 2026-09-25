import { useEffect } from "react";

import { transportKeyAction } from "./keys";
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
      const target = event.target instanceof Element ? event.target : null;
      const action = transportKeyAction({
        key: event.key,
        repeat: event.repeat,
        defaultPrevented: event.defaultPrevented,
        modifier: event.metaKey || event.ctrlKey || event.altKey,
        unlocked: engine.getSnapshot().unlocked,
        onTypingField: Boolean(target?.closest(TYPING)),
        onControl: Boolean(target?.closest(CONTROLS)),
      });
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
