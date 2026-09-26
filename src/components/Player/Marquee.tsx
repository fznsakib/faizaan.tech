import { useEffect, useRef } from "react";

import { endCost, startCost } from "./cost";
import * as Styled from "./Player.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { MutableRefObject } from "react";

/** Pixels per second: a slow, stepped crawl. */
const SPEED = 30;

interface MarqueeProps {
  text: string;
  /** While set (dragging the seek bar), shown still in place of the title, as Winamp's "seek to". */
  preview: MutableRefObject<string | null>;
  mini?: boolean;
}

/** The LCD's scrolling title: the text twice in a strip, so the loop is seamless. Decorative (aria-hidden). */
const Marquee: React.FC<MarqueeProps> = ({ text, preview, mini = false }) => {
  const strip = useRef<HTMLSpanElement>(null);
  const copy = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const width = useRef(0);
  const start = useRef(0);
  const noted = useRef<string | null>(null);

  useEffect(() => {
    start.current = performance.now();
    const el = copy.current;
    if (!el) return;
    const measure = () => {
      width.current = el.getBoundingClientRect().width;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  useMusicFrame((_, now) => {
    const started = startCost();
    const moving = strip.current;
    const still = note.current;
    if (!moving || !still) return;
    const seeking = preview.current;
    if (seeking !== noted.current) {
      noted.current = seeking;
      if (seeking !== null) still.textContent = seeking;
    }
    setStyle(still, "opacity", seeking === null ? "0" : "1");
    setStyle(moving, "opacity", seeking === null ? "1" : "0");
    const w = width.current;
    const offset = w > 0 && !prefersReducedMotion() ? Math.round((((now - start.current) / 1000) * SPEED) % w) : 0;
    setStyle(moving, "transform", `translateX(${-offset}px)`);
    endCost(now, started);
  });

  return (
    <Styled.Marquee $mini={mini} aria-hidden="true">
      <Styled.MarqueeStrip ref={strip}>
        <span ref={copy}>{text}</span>
        <span>{text}</span>
      </Styled.MarqueeStrip>
      <Styled.MarqueeNote ref={note} />
    </Styled.Marquee>
  );
};

export default Marquee;
