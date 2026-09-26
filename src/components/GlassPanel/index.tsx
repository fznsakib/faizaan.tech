import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { FilterDefs, GlassLayer, Glint, Pane, Rim, Sheen } from "./GlassPanel.styled";
import { engine } from "../../audio/engine";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import {
  createBodies,
  dragTo,
  glassHalfSize,
  glassMap,
  glassPose,
  glassScale,
  glassSheen,
  hitGlass,
  initialState,
  release,
  releaseVelocity,
  stepGlass,
  supportsRefraction,
} from "../../choreography/glass";
import { quantise } from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { GlassBody, GlassMap, PointerSample } from "../../choreography/glass";

const params = new URLSearchParams(window.location.search);
/** Chromium refracts through an SVG filter; everything else (and `?frosted`) gets frosted glass. */
const REFRACT = supportsRefraction(navigator) && !params.has("frosted");
/** `?debug` exposes `window.__glass`: live physics states and the frame callback's recent costs (ms). */
const DEBUG = params.has("debug");
const COST_SAMPLES = 600;
/** Chromatic fringe at the rim: refract each channel separately (red bends least, blue most) and recombine. */
const CHROMATIC = false;
const CHANNELS = CHROMATIC
  ? [
      { gain: 0.92, matrix: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
      { gain: 1, matrix: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" },
      { gain: 1.08, matrix: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" },
    ]
  : [{ gain: 1, matrix: "" }];
/** A breath of blur after the bend, so it reads as glass rather than a lens; the rim still visibly refracts. */
const CHROME_FILTER = "blur(1.5px) saturate(1.4) brightness(1.06)";
const FROST_FILTER = "blur(14px) saturate(1.5)";
/** Tilt eases toward its target with this time constant (s), so a cursor arriving or leaving never snaps. */
const TILT_TAU = 0.14;
/** Each refraction change rebuilds the filter: quantise it (px) and change it at most this often (ms). */
const REFRACTION_STEP = 3;
const FILTER_INTERVAL_MS = 100;
const RESIZE_DEBOUNCE_MS = 150;
/** Pointer history kept while dragging (s): enough for releaseVelocity's window. */
const SAMPLE_HISTORY = 0.2;
/** Presses on these never grab glass. */
const INTERACTIVE = 'a, button, input, select, textarea, [role="dialog"], [aria-modal="true"]';

interface Slab {
  w: number;
  h: number;
  radius: number;
  /** Displacement map as a data URI; empty when frosted. */
  map: string;
}

function toDataUri(map: GlassMap): string {
  const canvas = document.createElement("canvas");
  canvas.width = map.width;
  canvas.height = map.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
  return canvas.toDataURL();
}

/**
 * Whether a press on `target` is a press on the page itself, so it may grab glass. The head's canvas covers the
 * whole viewport above the glass, so a press on bare page lands on that canvas; presses on the transport, crate,
 * jam pad, icons, splash or ?debug panel land on those instead, and never grab.
 */
function isPageSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest(INTERACTIVE)) return false;
  if (target === document.body || target === document.documentElement) return true;
  return (
    target instanceof HTMLCanvasElement &&
    target.clientWidth >= window.innerWidth - 2 &&
    target.clientHeight >= window.innerHeight - 2
  );
}

/** Size every piece for the viewport and bake its displacement map. */
function cutSlabs(bodies: GlassBody[], width: number, height: number): Slab[] {
  return bodies.map((body) => {
    const size = glassScale(body, width, height);
    const w = Math.round(body.w * size);
    const h = Math.round(body.h * size);
    const radius = Math.round(Math.min(body.radius * size, Math.min(w, h) / 2));
    const bevel = Math.min(w, h) * (0.22 + 0.16 * body.depth);
    return { w, h, radius, map: REFRACT ? toDataUri(glassMap(w, h, radius, bevel)) : "" };
  });
}

interface Drag {
  index: number;
  pointerId: number;
  /** Pointer position minus the body's centre at the grab. */
  grab: { x: number; y: number };
  point: { x: number; y: number };
  samples: PointerSample[];
}

/**
 * Thick 3D glass floating behind the head: refracts the page behind it, drifts, faces the cursor, lights up with
 * the music, and can be grabbed, thrown and bounced off the window edges.
 */
const GlassPanel: React.FC = () => {
  const bodies = useMemo(() => createBodies(), []);
  const [slabs, setSlabs] = useState(() => cutSlabs(bodies, window.innerWidth, window.innerHeight));
  const states = useRef(
    bodies.map((body) =>
      initialState(body, performance.now() / 1000, window.innerWidth, window.innerHeight, prefersReducedMotion()),
    ),
  );
  const panes = useRef<(HTMLDivElement | null)[]>([]);
  const sheens = useRef<(HTMLDivElement | null)[]>([]);
  const glints = useRef<(HTMLDivElement | null)[]>([]);
  const displacements = useRef<(SVGFEDisplacementMapElement | null)[][]>(bodies.map(() => []));
  const refraction = useRef(bodies.map(() => ({ value: NaN, at: -Infinity })));
  const tilt = useRef(bodies.map(() => ({ x: 0, y: 0 })));
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const lastNow = useRef<number | null>(null);
  const costs = useRef<number[]>([]);

  useEffect(() => {
    if (!DEBUG) return;
    const probe = { bodies, states: states.current, costs: costs.current };
    (window as Window & { __glass?: typeof probe }).__glass = probe;
  }, [bodies]);

  useEffect(() => {
    let cursor: "grab" | "grabbing" | null = null;
    let restoreCursor = "";
    const setCursor = (next: typeof cursor) => {
      if (next === cursor) return;
      if (cursor === null) restoreCursor = document.body.style.cursor;
      cursor = next;
      document.body.style.cursor = next ?? restoreCursor;
    };
    const hit = (event: PointerEvent) =>
      engine.getSnapshot().unlocked && isPageSurface(event.target)
        ? hitGlass(bodies, states.current, { x: event.clientX, y: event.clientY }, window.innerWidth, window.innerHeight)
        : -1;

    const down = (event: PointerEvent) => {
      if (drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
      const index = hit(event);
      if (index < 0) return;
      event.preventDefault();
      try {
        (event.target as Element).setPointerCapture(event.pointerId);
      } catch {
        // capture is a nicety: window listeners still see the moves
      }
      const point = { x: event.clientX, y: event.clientY };
      const state = states.current[index];
      drag.current = {
        index,
        pointerId: event.pointerId,
        grab: { x: point.x - state.x, y: point.y - state.y },
        point,
        samples: [{ t: event.timeStamp / 1000, ...point }],
      };
      setCursor("grabbing");
    };
    const letGo = (event: PointerEvent | null, fling: boolean) => {
      const held = drag.current;
      if (!held || (event && event.pointerId !== held.pointerId)) return;
      drag.current = null;
      const now = (event?.timeStamp ?? performance.now()) / 1000;
      if (event) held.samples.push({ t: now, x: event.clientX, y: event.clientY });
      const velocity = fling ? releaseVelocity(held.samples, now) : { vx: 0, vy: 0 };
      const { innerWidth: width, innerHeight: height } = window;
      states.current[held.index] = release(states.current[held.index], velocity, width, height, prefersReducedMotion());
      setCursor(event && hit(event) >= 0 ? "grab" : null);
    };
    const move = (event: PointerEvent) => {
      const point = { x: event.clientX, y: event.clientY };
      pointer.current = point;
      const held = drag.current;
      if (held?.pointerId === event.pointerId && event.buttons === 0 && event.pointerType !== "touch") {
        letGo(event, false); // the button came up somewhere we never heard about
      } else if (held?.pointerId === event.pointerId) {
        const t = event.timeStamp / 1000;
        held.point = point;
        held.samples.push({ t, ...point });
        while (held.samples.length > 2 && held.samples[0].t < t - SAMPLE_HISTORY) held.samples.shift();
      } else if (!held) {
        setCursor(hit(event) >= 0 ? "grab" : null);
      }
    };
    const up = (event: PointerEvent) => letGo(event, true);
    const cancel = (event: PointerEvent) => letGo(event, false);
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) pointer.current = null;
    };
    const blur = () => {
      pointer.current = null;
      letGo(null, false);
    };
    // a held piece owns the touch: no scrolling or pull-to-refresh underneath it
    const touchMove = (event: TouchEvent) => {
      if (drag.current) event.preventDefault();
    };
    const capture = { capture: true };
    window.addEventListener("pointerdown", down, capture);
    window.addEventListener("pointermove", move, { capture: true, passive: true });
    window.addEventListener("pointerup", up, capture);
    window.addEventListener("pointercancel", cancel, capture);
    window.addEventListener("pointerout", out);
    window.addEventListener("blur", blur);
    window.addEventListener("touchmove", touchMove, { passive: false });
    return () => {
      window.removeEventListener("pointerdown", down, capture);
      window.removeEventListener("pointermove", move, capture);
      window.removeEventListener("pointerup", up, capture);
      window.removeEventListener("pointercancel", cancel, capture);
      window.removeEventListener("pointerout", out);
      window.removeEventListener("blur", blur);
      window.removeEventListener("touchmove", touchMove);
      setCursor(null);
    };
  }, [bodies]);

  useEffect(() => {
    let timer: number | undefined;
    const resize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSlabs(cutSlabs(bodies, window.innerWidth, window.innerHeight)), RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", resize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
    };
  }, [bodies]);

  useMusicFrame((frame, now) => {
    const started = DEBUG ? performance.now() : 0;
    const dt = lastNow.current === null ? 0 : (now - lastNow.current) / 1000;
    lastNow.current = now;
    const t = now / 1000;
    const reduced = prefersReducedMotion();
    const ease = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) / TILT_TAU);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const input = {
      t,
      width,
      height,
      pointer: pointer.current,
      energy: frame.energy,
      beatPhase: frame.beatPhase,
      isPlaying: frame.isPlaying,
      sectionLevel: frame.sectionLevel,
      stab: frame.stab,
      reduced,
    };
    const held = drag.current;
    bodies.forEach((body, i) => {
      let state = states.current[i];
      if (held?.index === i) {
        const { hw, hh } = glassHalfSize(body, width, height);
        state = { ...dragTo(state, held.point, held.grab, hw, hh, width, height), ...releaseVelocity(held.samples, t) };
      } else {
        state = stepGlass(body, state, { t, dt, width, height, reduced });
      }
      states.current[i] = state;

      const pane = panes.current[i];
      const slab = slabs[i];
      if (!pane || !slab) return;
      const pose = glassPose(body, input, state);
      const turn = tilt.current[i];
      turn.x += (pose.rotateX - turn.x) * ease;
      turn.y += (pose.rotateY - turn.y) * ease;
      setStyle(
        pane,
        "transform",
        `translate3d(${(pose.x - slab.w / 2).toFixed(1)}px, ${(pose.y - slab.h / 2).toFixed(1)}px, 0) ` +
          `rotateX(${turn.x.toFixed(2)}deg) rotateY(${turn.y.toFixed(2)}deg) rotateZ(${pose.rotateZ.toFixed(2)}deg) ` +
          `scale(${(pose.scale * pose.squashX).toFixed(3)}, ${(pose.scale * pose.squashY).toFixed(3)})`,
      );

      const sheen = glassSheen(turn.x, turn.y);
      const sheenNode = sheens.current[i];
      if (sheenNode) {
        setStyle(sheenNode, "transform", `translate(${((sheen.x - 100) / 2).toFixed(1)}%, ${((sheen.y - 100) / 2).toFixed(1)}%)`);
        setStyle(sheenNode, "opacity", quantise(sheen.intensity, 0.02).toFixed(2));
      }
      const glintNode = glints.current[i];
      if (glintNode) setStyle(glintNode, "opacity", quantise(pose.glint, 0.02).toFixed(2));

      const applied = refraction.current[i];
      const target = quantise(pose.refraction, REFRACTION_STEP);
      if (REFRACT && target !== applied.value && now - applied.at >= FILTER_INTERVAL_MS) {
        applied.value = target;
        applied.at = now;
        displacements.current[i].forEach((node, channel) =>
          node?.setAttribute("scale", (target * CHANNELS[channel].gain).toFixed(1)),
        );
      }
    });
    if (DEBUG) {
      costs.current.push(performance.now() - started);
      if (costs.current.length > COST_SAMPLES) costs.current.shift();
    }
  });

  return (
    <GlassLayer aria-hidden>
      {REFRACT && (
        <FilterDefs width="0" height="0">
          {slabs.map((slab, i) => (
            <filter
              key={bodies[i].id}
              id={`glass-${bodies[i].id}`}
              x="0"
              y="0"
              width={slab.w}
              height={slab.h}
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feImage href={slab.map} x="0" y="0" width={slab.w} height={slab.h} preserveAspectRatio="none" result="map" />
              {CHANNELS.map((channel, c) => (
                <Fragment key={c}>
                  <feDisplacementMap
                    ref={(node) => {
                      displacements.current[i][c] = node;
                    }}
                    in="SourceGraphic"
                    in2="map"
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result={`bent${c}`}
                  />
                  {CHROMATIC && (
                    <feColorMatrix in={`bent${c}`} type="matrix" values={channel.matrix} result={`channel${c}`} />
                  )}
                </Fragment>
              ))}
              {CHROMATIC && <feBlend in="channel0" in2="channel1" mode="screen" result="rg" />}
              {CHROMATIC && <feBlend in="rg" in2="channel2" mode="screen" />}
            </filter>
          ))}
        </FilterDefs>
      )}
      {slabs.map((slab, i) => {
        const id = bodies[i].id;
        const filter = REFRACT ? `url(#glass-${id}) ${CHROME_FILTER}` : FROST_FILTER;
        return (
          <Pane
            key={id}
            ref={(node) => {
              panes.current[i] = node;
            }}
            style={{
              width: slab.w,
              height: slab.h,
              borderRadius: slab.radius,
              backdropFilter: filter,
              WebkitBackdropFilter: REFRACT ? undefined : filter,
            }}
          >
            <Sheen
              ref={(node) => {
                sheens.current[i] = node;
              }}
            />
            <Glint
              ref={(node) => {
                glints.current[i] = node;
              }}
            />
            <Rim />
          </Pane>
        );
      })}
    </GlassLayer>
  );
};

export default GlassPanel;
