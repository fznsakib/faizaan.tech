import { useEffect, useState } from "react";

import { djKeyVoice, transportKeyAction } from "./keys";
import * as Styled from "./Transport.styled";
import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";
import DjPad from "../DjPad";

const TYPING = "input, select, textarea, [contenteditable='true']";
const CONTROLS = "a, button";
/** Mouse clicks shouldn't leave focus on a control (Space would then re-press it instead of play/pause). */
const keepFocus = (event: { preventDefault(): void }) => event.preventDefault();

/** Always-visible Doto transport: play/pause, track · bpm, mute, next. Space = play/pause, M = mute. */
const Transport: React.FC = () => {
  const { status, title, bpm, isPlaying, muted } = useMusicState();
  const [padOpen, setPadOpen] = useState(false);

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
      if (voice) engine.hit(voice);
      const action = transportKeyAction(input);
      if (action === "toggle") {
        event.preventDefault();
        engine.toggle(); // also resumes audio the system interrupted
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
    <>
    <Styled.Bar>
      <Styled.Control
        type="button"
        onMouseDown={keepFocus}
        aria-label={isPlaying ? "Pause music" : "Play music"}
        onClick={() => engine.toggle()}
      >
        {isPlaying ? "pause" : "play"}
      </Styled.Control>
      <Styled.Label aria-live="polite">
        {title}
        {bpm ? ` · ${Math.round(bpm)} bpm` : ""}
        {status === "loading" ? " · loading" : ""}
      </Styled.Label>
      <Styled.Control type="button" onMouseDown={keepFocus} aria-label={muted ? "Unmute music" : "Mute music"} onClick={() => engine.setMuted(!muted)}>
        {muted ? "unmute" : "mute"}
      </Styled.Control>
      <Styled.Control
        type="button"
        onMouseDown={keepFocus}
        aria-label="Next track"
        onClick={() => {
          engine.unlock();
          engine.next();
        }}
      >
        next
      </Styled.Control>
      <Styled.Control
        type="button"
        onMouseDown={keepFocus}
        aria-label="Jam pad"
        aria-pressed={padOpen}
        onClick={() => setPadOpen((open) => !open)}
      >
        jam
      </Styled.Control>
    </Styled.Bar>
    {padOpen && <DjPad />}
    </>
  );
};

export default Transport;
