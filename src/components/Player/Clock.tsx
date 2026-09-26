import { useRef } from "react";

import { endCost, startCost } from "./cost";
import { formatTime } from "./format";
import { PauseIcon, PlayIcon, StopIcon } from "./icons";
import * as Styled from "./Player.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { prefersReducedMotion } from "../../hooks/reducedMotion";
import { keepFocus } from "../keepFocus";

/** Chunky seven-segment outlines in a 12×20 box: a (top), b, c (right), d (bottom), e, f (left), g (middle). */
const SEGMENTS: [string, string][] = [
  ["a", "2.2,1.2 3.4,0 8.6,0 9.8,1.2 8.6,2.4 3.4,2.4"],
  ["b", "10.9,2.2 12,3.4 12,8.4 10.9,9.5 9.7,8.4 9.7,3.4"],
  ["c", "10.9,10.5 12,11.6 12,16.6 10.9,17.8 9.7,16.6 9.7,11.6"],
  ["d", "2.2,18.8 3.4,17.6 8.6,17.6 9.8,18.8 8.6,20 3.4,20"],
  ["e", "1.1,10.5 2.3,11.6 2.3,16.6 1.1,17.8 0,16.6 0,11.6"],
  ["f", "1.1,2.2 2.3,3.4 2.3,8.4 1.1,9.5 0,8.4 0,3.4"],
  ["g", "2.2,10 3.4,8.8 8.6,8.8 9.8,10 8.6,11.2 3.4,11.2"],
];

/** A digit slot; the sign slot only has the middle bar, so it ghosts as a dash, not an 8. */
const Digit = ({ slot, sign = false }: { slot: (el: SVGSVGElement | null) => void; sign?: boolean }) => (
  <Styled.Digit ref={slot} viewBox={sign ? "1.5 0 9 20" : "-1.5 0 15 20"} data-d=" " $sign={sign}>
    {SEGMENTS.filter(([id]) => !sign || id === "g").map(([id, points]) => (
      <polygon key={id} data-s={id} points={points} />
    ))}
  </Styled.Digit>
);

/** "-3:07" → the five digit slots: sign, minutes (tens, units), seconds (tens, units); minutes read "03", as on a deck. */
function slots(text: string): string[] {
  const sign = text.startsWith("-") ? "-" : " ";
  const [minutes, seconds] = text.replace("-", "").split(":");
  const m = minutes.slice(-2).padStart(2, "0");
  return [sign, m[0], m[1], seconds[0], seconds[1]];
}

interface ClockProps {
  /** Segment digits (base, chrome) or dot-matrix text (faizaan). */
  segments: boolean;
  remaining: boolean;
  duration: number | null;
  isPlaying: boolean;
  onToggle: () => void;
  mini?: boolean;
}

/**
 * The LCD's time. Written only when the displayed text changes; blinks while paused, as Winamp's did (not under
 * reduced motion). Clicking it switches elapsed/remaining.
 */
const Clock: React.FC<ClockProps> = ({ segments, remaining, duration, isPlaying, onToggle, mini = false }) => {
  const digits = useRef<(SVGSVGElement | null)[]>([]);
  const minutes = useRef<HTMLSpanElement>(null);
  const seconds = useRef<HTMLSpanElement>(null);
  const face = useRef<HTMLSpanElement>(null);
  const glyph = useRef<HTMLSpanElement>(null);
  const shown = useRef("");
  const shownState = useRef("");

  useMusicFrame((frame, now) => {
    const started = startCost();
    const value = remaining && duration ? formatTime(frame.time, { duration }) : formatTime(frame.time);
    if (value !== shown.current) {
      shown.current = value;
      if (segments) {
        slots(value).forEach((d, i) => digits.current[i]?.setAttribute("data-d", d));
      } else if (minutes.current && seconds.current) {
        const [m, s] = value.split(":");
        minutes.current.textContent = m;
        seconds.current.textContent = s;
      }
    }
    const paused = !isPlaying && frame.time > 0.05;
    const state = isPlaying ? "play" : paused ? "pause" : "stop";
    if (state !== shownState.current && glyph.current) {
      shownState.current = state;
      glyph.current.dataset.state = state;
    }
    const blinkOff = paused && !prefersReducedMotion() && now % 1000 > 600;
    if (face.current) setStyle(face.current, "opacity", blinkOff ? "0.12" : "1");
    endCost(now, started);
  });

  const slot = (i: number) => (el: SVGSVGElement | null) => {
    digits.current[i] = el;
    if (el && shown.current) el.setAttribute("data-d", slots(shown.current)[i]);
  };

  return (
    <>
      {!mini && (
        <Styled.StateGlyph ref={glyph} aria-hidden="true" data-state="stop">
          <PlayIcon />
          <PauseIcon />
          <StopIcon />
        </Styled.StateGlyph>
      )}
      <Styled.Clock
        type="button"
        aria-label="Remaining time"
        aria-pressed={remaining}
        onMouseDown={keepFocus}
        onClick={onToggle}
      >
        <Styled.ClockFace ref={face} aria-hidden="true">
          {segments ? (
            <>
              <Digit slot={slot(0)} sign />
              <Digit slot={slot(1)} />
              <Digit slot={slot(2)} />
              <Styled.Colon viewBox="0 0 4 20">
                <rect x="1" y="5" width="2" height="2" />
                <rect x="1" y="13" width="2" height="2" />
              </Styled.Colon>
              <Digit slot={slot(3)} />
              <Digit slot={slot(4)} />
            </>
          ) : (
            <Styled.ClockText>
              <span ref={minutes}>{shown.current.split(":")[0] || "0"}</span>
              <Styled.DotColon />
              <span ref={seconds}>{shown.current.split(":")[1] ?? "00"}</span>
            </Styled.ClockText>
          )}
        </Styled.ClockFace>
      </Styled.Clock>
    </>
  );
};

export default Clock;
