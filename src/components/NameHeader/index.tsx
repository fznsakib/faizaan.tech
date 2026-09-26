import { useEffect, useMemo, useRef } from "react";

import * as Styled from "../../App.styled";
import { useMusicFrame } from "../../audio/react";
import { forgetStyles, setStyle } from "../../choreography/dom";
import {
  createFlipState,
  headerVariation,
  KickHistory,
  letterFlipped,
  SHOCKWAVE_SPEED,
  updateFlip,
} from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

const NAME = "(faiz)aan sakib";
const LETTERS = [...NAME];
const DROP_FONT = '"Doto", monospace';

/** The name, one span per letter: weight pulses with the kick as a shockwave from the head; flips to Doto on drops. */
const NameHeader: React.FC = () => {
  const letters = useRef<HTMLSpanElement[]>([]);
  const centres = useRef<number[]>([]);
  const state = useMemo(() => ({ kicks: new KickHistory(), flip: createFlipState() }), []);

  useEffect(() => {
    // Lock each letter to its Golos advance (measured with every runtime style cleared).
    const measure = () => {
      for (const span of letters.current) {
        forgetStyles(span);
        span.style.width = "";
        span.style.fontFamily = "";
        span.style.fontSize = "";
        span.style.fontVariationSettings = "";
        span.style.transform = "";
      }
      const widths = letters.current.map((span) => span.getBoundingClientRect().width);
      letters.current.forEach((span, i) => {
        span.style.width = `${widths[i]}px`;
      });
      centres.current = letters.current.map((span) => {
        const rect = span.getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
    };
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
    };
  }, []);

  useMusicFrame((frame) => {
    const active = frame.isPlaying && !prefersReducedMotion();
    state.kicks.push(frame.time, active ? frame.kick : 0);
    updateFlip(state.flip, active ? frame.sectionLevel : 0, frame.sectionChanged, frame.time);
    const headX = window.innerWidth / 2;
    letters.current.forEach((span, i) => {
      if (!active) {
        setStyle(span, "fontFamily", "");
        setStyle(span, "fontSize", "");
        setStyle(span, "fontVariationSettings", '"wght" 700');
        setStyle(span, "transform", "none");
        return;
      }
      const distance = Math.abs((centres.current[i] ?? headX) - headX);
      const kick = state.kicks.at(frame.time - distance / SHOCKWAVE_SPEED);
      const flipped = letterFlipped(state.flip, frame.time, distance);
      setStyle(span, "fontFamily", flipped ? DROP_FONT : "");
      setStyle(span, "fontSize", flipped ? "0.8em" : "");
      setStyle(
        span,
        "fontVariationSettings",
        flipped ? '"wght" 900, "ROND" 100' : headerVariation(frame.section, frame.energy, kick)
      );
      setStyle(span, "transform", `translateY(${(-0.05 * kick).toFixed(3)}em) scaleY(${(1 + 0.06 * kick).toFixed(3)})`);
    });
  });

  return (
    <Styled.HeaderText aria-label={NAME}>
      {LETTERS.map((letter, i) => (
        <Styled.Letter
          key={i}
          aria-hidden="true"
          ref={(el) => {
            if (el) letters.current[i] = el;
          }}
        >
          {letter}
        </Styled.Letter>
      ))}
    </Styled.HeaderText>
  );
};

export default NameHeader;
