import { useEffect, useMemo, useRef } from "react";

import { entered, hovers, letterAt, taps } from "./pointer";
import { engine } from "../../audio/engine";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import {
  burstAt,
  glyphShown,
  plateOpacity,
  pushFrom,
  reducedPlate,
  SHARD_COUNT,
  shardPose,
  startBurst,
} from "../../choreography/shatter";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { LetterPieces } from "./pieces";
import type { LetterBox, NamePointer, Point } from "./pointer";
import type { Shard } from "../../choreography/shatter";

/** The name's measured layout, filled in by the header's measure. */
export interface NameGeometry {
  /** Each letter's centre x, px. */
  centres: number[];
  /** Each letter's box, for hover and tap; null for the space. */
  boxes: (LetterBox | null)[];
  /** The head's x (the viewport's centre), px: kept from resize, since reading `innerWidth` mid-frame forces layout. */
  headX: number;
}

/** `?debug`: the shatter painter's per-frame cost, ms, on frames it painted and on idle frames. */
export interface ShatterProbe {
  costs: number[];
  idle: number[];
}

const COST_SAMPLES = 600;
const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
/** Phones and touch-first screens draw fewer shards. */
const liteQuery =
  typeof window !== "undefined" ? window.matchMedia("(max-width: 767px), (max-height: 500px), (pointer: coarse)") : null;
/** High-contrast modes keep the plain name. */
const forcedQuery = typeof window !== "undefined" ? window.matchMedia("(forced-colors: active)") : null;

/** Controls that take their own presses where they're drawn over the name's band (GlassPanel's list). */
const CONTROLS = 'a, button, input, select, textarea, [role="dialog"], [aria-modal="true"]';

/**
 * Whether a pointer event landed on the page itself: the head's canvas covers the viewport, so bare page is that
 * canvas (or the body); the jam pad, player, links, splash and ?debug panel are drawn over it and are not.
 */
function onPage(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest(CONTROLS)) return false;
  if (target === document.body || target === document.documentElement) return true;
  return (
    target instanceof HTMLCanvasElement &&
    target.clientWidth >= window.innerWidth - 2 &&
    target.clientHeight >= window.innerHeight - 2
  );
}

/** Put a letter back as it was: burst layer out of the render tree, shards hidden, glyph showing. */
function tidy(letter: LetterPieces) {
  if (letter.burstLayer) setStyle(letter.burstLayer, "display", "none");
  if (letter.plate) setStyle(letter.plate, "opacity", "0");
  for (const shard of letter.shards) setStyle(shard, "display", "none");
  if (letter.glyph) setStyle(letter.glyph, "visibility", "visible");
  letter.live = false;
}

/**
 * The hover shatter: the letter the pointer comes into (a tap, on touch screens) bursts into the grid's plusses,
 * away from where the pointer came in, and reassembles. Each letter bursts on its own, so sweeping across the name
 * ripples along it. Reduced motion gets a plate fade instead; forced colors, nothing. While no letter is bursting
 * nothing is rendered and the frame callback returns at once.
 */
export function useShatter(
  shards: readonly (readonly Shard[] | null)[],
  pieces: readonly (LetterPieces | null)[],
  geometry: NameGeometry
): void {
  const live = useRef(0);
  const costs = useRef<number[]>([]);
  const idle = useRef<number[]>([]);
  const pose = useMemo(() => ({ x: 0, y: 0, rotate: 0, scale: 0, opacity: 0 }), []);

  useEffect(() => {
    if (!debug) return;
    (window as Window & { __name?: ShatterProbe }).__name = { costs: costs.current, idle: idle.current };
  }, []);

  useEffect(() => {
    let last: Point | null = null;
    const pointer = (event: PointerEvent): NamePointer => ({
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      button: event.button,
      onPage: onPage(event.target),
    });
    const burst = (index: number, x: number, y: number, timeStamp: number) => {
      const letter = pieces[index];
      const box = geometry.boxes[index];
      if (!letter || !box || !engine.getSnapshot().unlocked || forcedQuery?.matches) return;
      if (startBurst(letter.burst, timeStamp / 1000, pushFrom(x, y, box), prefersReducedMotion()) && !letter.live) {
        letter.live = true;
        live.current++;
      }
    };
    const move = (event: PointerEvent) => {
      const at = pointer(event);
      if (!hovers(at)) {
        last = null;
        return;
      }
      const point = { x: at.x, y: at.y };
      for (const entry of entered(last, point, geometry.boxes)) burst(entry.index, entry.x, entry.y, event.timeStamp);
      last = point;
    };
    const down = (event: PointerEvent) => {
      const at = pointer(event);
      if (!taps(at)) return;
      const index = letterAt(at.x, at.y, geometry.boxes);
      if (index >= 0) burst(index, at.x, at.y, event.timeStamp);
    };
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) last = null;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerout", out);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerout", out);
    };
  }, [geometry, pieces]);

  const paint = (now: number) => {
    const seconds = now / 1000;
    const count = liteQuery?.matches ? SHARD_COUNT.lite : SHARD_COUNT.full;
    for (let i = 0; i < pieces.length; i++) {
      const letter = pieces[i];
      const plan = shards[i];
      if (!letter?.live || !plan) continue;
      const elapsed = burstAt(letter.burst, seconds);
      if (elapsed === null) {
        tidy(letter);
        live.current--;
        continue;
      }
      if (letter.burstLayer) setStyle(letter.burstLayer, "display", "block");
      const { reduced } = letter.burst;
      if (letter.plate) {
        setStyle(letter.plate, "opacity", (reduced ? reducedPlate(elapsed) : plateOpacity(elapsed)).toFixed(3));
      }
      if (letter.glyph) setStyle(letter.glyph, "visibility", reduced || glyphShown(elapsed) ? "visible" : "hidden");
      for (let j = 0; j < letter.shards.length; j++) {
        const el = letter.shards[j];
        if (reduced || j >= count) {
          setStyle(el, "display", "none");
          continue;
        }
        shardPose(plan[j], elapsed, letter.burst.push, pose);
        if (pose.opacity === 0) {
          setStyle(el, "display", "none");
          continue;
        }
        setStyle(el, "display", "block");
        setStyle(
          el,
          "transform",
          `translate(${pose.x.toFixed(3)}em, ${pose.y.toFixed(3)}em) rotate(${pose.rotate.toFixed(1)}deg) scale(${pose.scale.toFixed(3)})`
        );
        setStyle(el, "opacity", pose.opacity.toFixed(3));
      }
    }
  };

  useMusicFrame((_, now) => {
    if (!debug) {
      if (live.current > 0) paint(now);
      return;
    }
    const started = performance.now();
    const painted = live.current > 0;
    if (painted) paint(now);
    const samples = painted ? costs.current : idle.current;
    samples.push(performance.now() - started);
    if (samples.length > COST_SAMPLES) samples.shift();
  });
}
