import { useEffect, useRef } from "react";

import { endCost, startCost } from "./cost";
import { formatTime } from "./format";
import * as Styled from "./Player.styled";
import { engine } from "../../audio/engine";
import { useMusicFrame } from "../../audio/react";

import type { MutableRefObject } from "react";

interface SeekProps {
  duration: number | null;
  /** Set to Winamp's "seek to m:ss/m:ss (n%)" while dragging; the marquee shows it. */
  preview: MutableRefObject<string | null>;
}

const seekTo = (value: number, duration: number) =>
  `seek to: ${formatTime(value)}/${formatTime(duration)} (${Math.round((value / duration) * 100)}%)`;

/** The position bar. Follows the song each frame (whole seconds) except while held; commits on release. */
const Seek: React.FC<SeekProps> = ({ duration, preview }) => {
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const shown = useRef(-1);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const commit = () => {
      dragging.current = false;
      preview.current = null;
      engine.seek(Number(el.value));
    };
    const release = () => {
      dragging.current = false;
      preview.current = null;
    };
    el.addEventListener("change", commit);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      el.removeEventListener("change", commit);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [preview]);

  useEffect(() => {
    shown.current = -1; // a new track: rewrite the position on the next frame
  }, [duration]);

  useMusicFrame((frame, now) => {
    const started = startCost();
    const el = input.current;
    if (!el || dragging.current) return;
    const second = Math.floor(frame.time);
    if (second !== shown.current) {
      shown.current = second;
      el.value = String(second);
      el.setAttribute(
        "aria-valuetext",
        duration ? `${formatTime(second)} of ${formatTime(duration)}` : formatTime(second)
      );
    }
    endCost(now, started);
  });

  const max = duration ? Math.floor(duration) : 0;
  return (
    <Styled.Seek
      ref={input}
      type="range"
      aria-label="Seek"
      min={0}
      max={max}
      step={1}
      defaultValue={0}
      disabled={!duration}
      onPointerDown={() => {
        dragging.current = true;
      }}
      onChange={(event) => {
        if (dragging.current && duration) preview.current = seekTo(Number(event.currentTarget.value), duration);
      }}
    />
  );
};

export default Seek;
