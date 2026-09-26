import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { FilterDefs, GlassLayer, Glint, Pane, Rim, Sheen } from "./GlassPanel.styled";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import { createBodies, glassMap, glassPose, glassScale, glassSheen, supportsRefraction } from "../../choreography/glass";
import { quantise } from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { GlassBody, GlassMap } from "../../choreography/glass";

/** Chromium refracts through an SVG filter; everything else (and `?frosted`) gets frosted glass. */
const REFRACT = supportsRefraction(navigator) && !new URLSearchParams(window.location.search).has("frosted");
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

/** Thick 3D glass floating over the whole page: refracts whatever is behind it, drifts, faces the cursor, lights up with the music. */
const GlassPanel: React.FC = () => {
  const bodies = useMemo(() => createBodies(), []);
  const [slabs, setSlabs] = useState(() => cutSlabs(bodies, window.innerWidth, window.innerHeight));
  const panes = useRef<(HTMLDivElement | null)[]>([]);
  const sheens = useRef<(HTMLDivElement | null)[]>([]);
  const glints = useRef<(HTMLDivElement | null)[]>([]);
  const displacements = useRef<(SVGFEDisplacementMapElement | null)[][]>(bodies.map(() => []));
  const refraction = useRef(bodies.map(() => ({ value: NaN, at: -Infinity })));
  const tilt = useRef(bodies.map(() => ({ x: 0, y: 0 })));
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const lastNow = useRef<number | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) pointer.current = null;
    };
    const blur = () => {
      pointer.current = null;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", out);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", out);
      window.removeEventListener("blur", blur);
    };
  }, []);

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
    const dt = lastNow.current === null ? 0 : Math.min((now - lastNow.current) / 1000, 0.1);
    lastNow.current = now;
    const reduced = prefersReducedMotion();
    const ease = reduced ? 1 : 1 - Math.exp(-dt / TILT_TAU);
    const input = {
      t: now / 1000,
      width: window.innerWidth,
      height: window.innerHeight,
      pointer: pointer.current,
      energy: frame.energy,
      beatPhase: frame.beatPhase,
      isPlaying: frame.isPlaying,
      sectionLevel: frame.sectionLevel,
      stab: frame.stab,
      reduced,
    };
    bodies.forEach((body, i) => {
      const pane = panes.current[i];
      const slab = slabs[i];
      if (!pane || !slab) return;
      const pose = glassPose(body, input);
      const turn = tilt.current[i];
      turn.x += (pose.rotateX - turn.x) * ease;
      turn.y += (pose.rotateY - turn.y) * ease;
      setStyle(
        pane,
        "transform",
        `translate3d(${(pose.x - slab.w / 2).toFixed(1)}px, ${(pose.y - slab.h / 2).toFixed(1)}px, 0) ` +
          `rotateX(${turn.x.toFixed(2)}deg) rotateY(${turn.y.toFixed(2)}deg) rotateZ(${pose.rotateZ.toFixed(2)}deg) ` +
          `scale(${pose.scale.toFixed(3)})`,
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
