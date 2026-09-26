import { useCallback, useEffect, useRef, useState } from "react";

import { djKeyVoice, transportKeyAction } from "./keys";
import * as Styled from "./Transport.styled";
import { engine } from "../../audio/engine";
import { useMusicState } from "../../audio/react";
import Crate from "../Crate";
import DjPad from "../DjPad";
import { keepFocus } from "../keepFocus";

const TYPING = "input, select, textarea, [contenteditable='true']";
const CONTROLS = "a, button";

/** Always-visible Doto transport: play/pause, track · bpm, mute, next. Space = play/pause, M = mute. */
const Transport: React.FC = () => {
  const { status, title, bpm, isPlaying, muted } = useMusicState();
  const [padOpen, setPadOpen] = useState(false);
  const [crateOpen, setCrateOpen] = useState(false);
  const crateToggle = useRef<HTMLButtonElement>(null);
  const closeCrate = useCallback(() => {
    // Closing with focus inside the crate would drop it to <body>: hand it back to the toggle.
    if (document.activeElement?.closest("#crate")) crateToggle.current?.focus();
    setCrateOpen(false);
  }, []);

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
        engine.toggle(); // also resumes audio the system interrupted
      } else if (action === "mute") {
        engine.setMuted(!engine.getSnapshot().muted);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (status === "error") {
    return (
      <Styled.Dock>
        <Styled.Bar role="status">audio unavailable</Styled.Bar>
      </Styled.Dock>
    );
  }

  return (
    <Styled.Dock>
      <Styled.Bar>
        <Styled.Control
          type="button"
          onMouseDown={keepFocus}
          aria-label={isPlaying ? "Pause music" : "Play music"}
          onClick={() => engine.toggle()}
        >
          {isPlaying ? "pause" : "play"}
        </Styled.Control>
        <Styled.Control
          ref={crateToggle}
          type="button"
          onMouseDown={keepFocus}
          aria-expanded={crateOpen}
          aria-controls="crate"
          onClick={() => setCrateOpen((open) => !open)}
        >
          <Styled.Label aria-live="polite">
            {title}
            {bpm ? ` · ${Math.round(bpm)} bpm` : ""}
            {status === "loading" ? " · loading" : ""}
          </Styled.Label>
        </Styled.Control>
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
      {crateOpen && <Crate onClose={closeCrate} />}
      {padOpen && <DjPad />}
    </Styled.Dock>
  );
};

export default Transport;
