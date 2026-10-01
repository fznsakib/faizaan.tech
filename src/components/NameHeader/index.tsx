import { useEffect, useMemo, useRef } from "react";

import * as Styled from "./NameHeader.styled";
import { emptyPieces, shardsOf } from "./pieces";
import ShatterLetter from "./ShatterLetter";
import { useShatter } from "./useShatter";
import * as AppStyled from "../../App.styled";
import { useMusicFrame } from "../../audio/react";
import { forgetStyles, setStyle } from "../../choreography/dom";
import {
  advanceFaces,
  createFaceWave,
  DOTO,
  DOTO_VARIATION,
  fitScale,
  GOLOS,
  HEADER_FACES,
  letterFace,
} from "../../choreography/faces";
import { headerVariation, jamHeaderVariation, KickHistory, SHOCKWAVE_SPEED } from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { NameGeometry } from "./useShatter";

/** The name split into words, for per-word faces when calm; a space is its own entry. */
const NAME_WORDS = ["(faiz)", "aan", " ", "sakib"];
const NAME = NAME_WORDS.join("");
const LETTERS = [...NAME];
/** `WORDS[i]` is letter i's word index in `NAME_WORDS`; `-1` marks a space. */
const WORDS = ((): number[] => {
  let wordIndex = -1;
  return NAME_WORDS.flatMap((word) => {
    if (word === " ") return [-1];
    wordIndex++;
    return Array.from(word, () => wordIndex);
  });
})();
/** Each letter's shards; none for the space (the parentheses are letters too). */
const SHARDS = LETTERS.map((letter, i) => (letter === " " ? null : shardsOf(i)));
/**
 * The name, one span per letter: weight pulses with the kick as a shockwave from the head, and the face changes in
 * the same wave: Doto when a drop hits, Golos when it ends, and the old header's fonts in between (a font a bar
 * when calm, a beat in a drop). The letter the pointer comes into (or a tap lands on) bursts into the grid's
 * plusses and reassembles (`useShatter`), over whichever face is showing.
 */
const NameHeader: React.FC = () => {
  const letters = useRef<HTMLSpanElement[]>([]);
  const geometry = useMemo<NameGeometry>(
    () => ({ centres: [], boxes: [], headX: window.innerWidth / 2 }),
    []
  );
  const pieces = useMemo(() => SHARDS.map((shards) => (shards ? emptyPieces() : null)), []);
  const state = useMemo(() => ({ kicks: new KickHistory(), faces: createFaceWave(WORDS) }), []);
  /** Font size (em) per face that keeps the name at its Golos width. */
  const scales = useRef(new Map<string, number>());

  useEffect(() => {
    // Fetch every face up front so its first bar doesn't flash the fallback.
    for (const family of HEADER_FACES) {
      document.fonts.load(`700 1em ${family}`, NAME).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const nameWidth = () => letters.current.reduce((sum, span) => sum + span.getBoundingClientRect().width, 0);
    // Lock each letter to its Golos advance (measured with every runtime style cleared), and size every other
    // face to the same overall width.
    const measure = () => {
      for (const span of letters.current) {
        forgetStyles(span);
        span.style.width = "";
        span.style.fontFamily = "";
        span.style.fontSize = "";
        span.style.fontVariationSettings = "";
        span.style.transform = "";
      }
      const golosWidth = nameWidth();
      for (const family of HEADER_FACES) {
        for (const span of letters.current) {
          span.style.fontFamily = family;
          span.style.fontVariationSettings = family === DOTO ? DOTO_VARIATION : "";
        }
        scales.current.set(family, fitScale(golosWidth, nameWidth()));
      }
      for (const span of letters.current) {
        span.style.fontFamily = "";
        span.style.fontVariationSettings = "";
      }
      const widths = letters.current.map((span) => span.getBoundingClientRect().width);
      letters.current.forEach((span, i) => {
        span.style.width = `${widths[i]}px`;
      });
      geometry.headX = window.innerWidth / 2;
      const rects = letters.current.map((span) => span.getBoundingClientRect());
      geometry.centres = rects.map((rect) => rect.left + rect.width / 2);
      geometry.boxes = rects.map(({ left, right, top, bottom }, i) =>
        SHARDS[i] ? { left, right, top, bottom } : null
      );
    };
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    window.addEventListener("resize", measure);
    // `fonts.ready` can settle before Golos is even requested (Safari/Firefox): re-lock when a face lands.
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", measure);
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [geometry]);

  useShatter(SHARDS, pieces, geometry);

  useMusicFrame((frame, now) => {
    const reduced = prefersReducedMotion();
    const active = (frame.isPlaying || frame.jamming) && !reduced;
    // Real time, not song time: song time is frozen while paused-and-jamming.
    const seconds = now / 1000;
    state.kicks.push(seconds, active ? frame.kick : 0);
    advanceFaces(state.faces, frame);
    const { headX } = geometry;
    letters.current.forEach((span, i) => {
      if (!active) {
        setStyle(span, "fontFamily", "");
        setStyle(span, "fontSize", "");
        setStyle(span, "fontVariationSettings", '"wght" 700');
        setStyle(span, "transform", "none");
        return;
      }
      const distance = Math.abs((geometry.centres[i] ?? headX) - headX);
      const kick = state.kicks.at(seconds - distance / SHOCKWAVE_SPEED);
      // Jamming without the song stays in Golos: faces follow the song's bars.
      const face = frame.isPlaying ? letterFace(state.faces, frame.time, distance, i) : GOLOS;
      setStyle(span, "fontFamily", face);
      setStyle(span, "fontSize", face === GOLOS ? "" : `${(scales.current.get(face) ?? 1).toFixed(3)}em`);
      setStyle(
        span,
        "fontVariationSettings",
        face === DOTO
          ? DOTO_VARIATION
          : frame.isPlaying
            ? headerVariation(frame.section, frame.energy, kick)
            : jamHeaderVariation(kick)
      );
      setStyle(span, "transform", `translateY(${(-0.05 * kick).toFixed(3)}em) scaleY(${(1 + 0.06 * kick).toFixed(3)})`);
    });
  });

  return (
    <AppStyled.HeaderText aria-label={NAME}>
      {LETTERS.map((letter, i) => {
        const shards = SHARDS[i];
        const letterPieces = pieces[i];
        return (
          <Styled.Letter
            key={i}
            aria-hidden="true"
            ref={(el) => {
              if (el) letters.current[i] = el;
            }}
          >
            <Styled.Glyph
              ref={(el) => {
                if (letterPieces) letterPieces.glyph = el;
              }}
            >
              {letter}
            </Styled.Glyph>
            {shards && letterPieces && <ShatterLetter letter={letter} shards={shards} pieces={letterPieces} />}
          </Styled.Letter>
        );
      })}
    </AppStyled.HeaderText>
  );
};

export default NameHeader;
