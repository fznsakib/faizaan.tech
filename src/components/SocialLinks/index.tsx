import { useEffect, useId, useMemo, useRef } from "react";

import { cellCoverage, DOT_CELLS, dotScreen } from "./dots";
import { GLYPHS } from "./glyphs";
import { LINKS, linkTarget } from "./links";
import { approach, magnetLean } from "./magnet";
import { iconPose, kickDelay } from "./pose";
import * as Styled from "./SocialLinks.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { KickHistory } from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";
import { keepFocus } from "../keepFocus";

import type { Dot } from "./dots";
import type { Glyph } from "./glyphs";

/** Canvas px per dot cell when measuring how much of each cell a glyph covers. */
const SUPERSAMPLE = 8;
/** How quickly an icon's lean follows the pointer, 1/s. */
const LEAN_RATE = 18;
const NO_LEAN = { x: 0, y: 0 };

const hoverless =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(hover: none)")
    : null;

/** A glyph's dot screen, from each part's cover of each cell (rasterised once, through a 2D canvas). */
function glyphDots(glyph: Glyph): Dot[] {
  const size = DOT_CELLS * SUPERSAMPLE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  const view = Number(glyph.viewBox.split(" ")[2]);
  context.scale(size / view, size / view);
  const coverage = glyph.parts.map((part) => {
    context.clearRect(0, 0, view, view);
    context.fill(new Path2D(part.d));
    return cellCoverage(context.getImageData(0, 0, size, size).data, size, DOT_CELLS);
  });
  return dotScreen(coverage, DOT_CELLS, view);
}

/** Mark a link pressed straight from the pointer (touch browsers apply :active late, or not at all). */
const press = (event: React.PointerEvent<HTMLAnchorElement>) => {
  event.currentTarget.dataset.pressed = "";
};
const release = (event: React.PointerEvent<HTMLAnchorElement>) => {
  delete event.currentTarget.dataset.pressed;
};

interface Layers {
  lean: HTMLSpanElement;
  rest: HTMLSpanElement;
  solid: HTMLSpanElement;
}

/**
 * The links, bottom-right: each glyph a dot matrix in the site blue that swells into the crisp brand mark (with its
 * label) on hover or keyboard focus, leaning toward the pointer. Kicks arrive from the head as a pulse; on touch the
 * marks rest resolved and each kick shimmers dots across the row, left to right.
 */
const SocialLinks: React.FC = () => {
  const clipId = useId().replace(/:/g, "");
  const links = useRef<HTMLAnchorElement[]>([]);
  const layers = useRef<Partial<Layers>[]>(LINKS.map(() => ({})));
  const dots = useMemo(() => LINKS.map((link) => glyphDots(GLYPHS[link.label])), []);
  const state = useMemo(
    () => ({
      kicks: new KickHistory(1.2),
      centres: LINKS.map(() => ({ x: 0, y: 0, distance: 0 })),
      leans: LINKS.map(() => ({ x: 0, y: 0 })),
      pointer: { x: 0, y: 0, present: false },
      lastNow: 0,
    }),
    []
  );

  useEffect(() => {
    const measure = () => {
      const headX = window.innerWidth / 2;
      const headY = window.innerHeight / 2;
      links.current.forEach((link, i) => {
        const rect = link.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        state.centres[i] = { x, y, distance: Math.hypot(x - headX, y - headY) };
      });
    };
    // Only a mouse or pen leans the icons: a touch has no hover to follow.
    const move = (event: PointerEvent) => {
      state.pointer.present = event.pointerType !== "touch";
      state.pointer.x = event.clientX;
      state.pointer.y = event.clientY;
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) state.pointer.present = false;
    };
    const blur = () => {
      state.pointer.present = false;
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", leave);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", blur);
    };
  }, [state]);

  useMusicFrame((frame, now) => {
    const dt = state.lastNow ? Math.min(0.1, (now - state.lastNow) / 1000) : 0;
    state.lastNow = now;
    const reduced = prefersReducedMotion();
    const touch = hoverless?.matches ?? false;
    // Real time, not song time: song time is frozen while paused-and-jamming.
    const seconds = now / 1000;
    state.kicks.push(seconds, (frame.isPlaying || frame.jamming) && !reduced ? frame.kick : 0);
    const { pointer } = state;
    layers.current.forEach(({ lean, rest, solid }, i) => {
      if (!lean || !rest || !solid) return;
      const centre = state.centres[i];
      const target =
        pointer.present && !touch && !reduced ? magnetLean(pointer.x - centre.x, pointer.y - centre.y) : NO_LEAN;
      const current = state.leans[i];
      current.x = approach(current.x, target.x, dt, LEAN_RATE);
      current.y = approach(current.y, target.y, dt, LEAN_RATE);
      const kick = state.kicks.at(seconds - kickDelay(centre.distance, i, touch));
      const pose = iconPose({ kick, leanX: current.x, leanY: current.y, touch, reduced });
      setStyle(lean, "transform", pose.transform);
      setStyle(rest, "opacity", pose.rest);
      setStyle(solid, "opacity", pose.solid);
    });
  });

  return (
    <Styled.Dock aria-label="Social links">
      <Styled.Row>
        {LINKS.map((link, i) => {
          const glyph: Glyph = GLYPHS[link.label];
          return (
            <li key={link.label}>
              <Styled.Link
                href={link.href}
                {...linkTarget(link.href)}
                aria-label={link.name}
                onMouseDown={keepFocus}
                onPointerDown={press}
                onPointerUp={release}
                onPointerCancel={release}
                onPointerLeave={release}
                ref={(el) => {
                  if (el) links.current[i] = el;
                }}
              >
                <Styled.Lean
                  aria-hidden="true"
                  ref={(el) => {
                    if (el) layers.current[i].lean = el;
                  }}
                >
                  <Styled.Face>
                    <Styled.Rest
                      ref={(el) => {
                        if (el) layers.current[i].rest = el;
                      }}
                    >
                      <Styled.Dots viewBox={glyph.viewBox}>
                        <defs>
                          {glyph.parts.map((part, p) => (
                            <clipPath key={part.d} id={`${clipId}${link.label}${p}`}>
                              <path d={part.d} />
                            </clipPath>
                          ))}
                        </defs>
                        {glyph.parts.map((part, p) => (
                          <g
                            key={part.d}
                            clipPath={`url(#${clipId}${link.label}${p})`}
                            style={{ "--c": part.color } as React.CSSProperties}
                          >
                            {dots[i]
                              .filter((dot) => dot.part === p)
                              .map((dot) => (
                                <circle
                                  key={`${dot.cx},${dot.cy}`}
                                  cx={dot.cx}
                                  cy={dot.cy}
                                  r={dot.r}
                                  style={{ "--d": `${dot.delay}ms` } as React.CSSProperties}
                                />
                              ))}
                          </g>
                        ))}
                      </Styled.Dots>
                    </Styled.Rest>
                    <Styled.Solid
                      ref={(el) => {
                        if (el) layers.current[i].solid = el;
                      }}
                    >
                      <Styled.Mark viewBox={glyph.viewBox}>
                        {glyph.backing && <path d={glyph.backing.d} fill={glyph.backing.color} />}
                        {glyph.parts.map((part) => (
                          <path key={part.d} d={part.d} fill={part.color} />
                        ))}
                      </Styled.Mark>
                    </Styled.Solid>
                  </Styled.Face>
                </Styled.Lean>
                <Styled.Label aria-hidden="true">{link.label}</Styled.Label>
              </Styled.Link>
            </li>
          );
        })}
      </Styled.Row>
    </Styled.Dock>
  );
};

export default SocialLinks;
