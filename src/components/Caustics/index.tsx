import { useEffect, useRef } from "react";

import * as Styled from "./Caustics.styled";
import { useMusicFrame } from "../../audio/react";
import { BAND_STRIDE, BANDS, causticPool, POINTS, writeCaustics } from "../../choreography/caustics";
import { headOutline, headPose, restPose } from "../../choreography/headShape";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { CausticPose, Pool } from "../../choreography/caustics";
import type { HeadSilhouette } from "../../choreography/headShape";

/** The key light's warm white (Head's right-hand Lightformer), unless the page sets `--day-accent`. */
const WARM = "#ffe2b8";
const MAX_DPR = 1.5;
/** How far the light can wander from the pool's centre, in pool radii: the canvas covers this much. */
const REACH = 1.5;
/** Each band is stroked three times, a wide soft glow, a halo and a thin bright core: width (px) and opacity at full brightness. */
const PASSES = [
  { width: 24, alpha: 0.045 },
  { width: 7, alpha: 0.09 },
  { width: 1.6, alpha: 0.36 },
];
/** The pool's soft rim: opacity of the light from its centre out to its edge (share of its radius). */
const RIM = [
  [0, 1],
  [0.55, 0.9],
  [0.85, 0.35],
  [1, 0],
] as const;
/** Fade in over this long (ms) once the head is drawn, so the light never pops in. */
const FADE_IN_MS = 1500;
/** How often (ms) to re-read `--day-accent`: off the frame path, where reading styles could force a recalc. */
const ACCENT_POLL_MS = 2000;
const REST: CausticPose = { yaw: 0, pitch: 0, roll: 0 };
/** `?debug` exposes `window.__caustics`: the frame callback's recent costs (ms). */
const DEBUG = new URLSearchParams(window.location.search).has("debug");
const COST_SAMPLES = 600;

interface Layout {
  pool: Pool;
  /** The canvas's box on the page (CSS px) and its pixel density. */
  left: number;
  top: number;
  width: number;
  height: number;
  dpr: number;
  rim: CanvasGradient | null;
}

function accent(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--day-accent").trim();
  return value || WARM;
}

/**
 * Light the head bends, pooling on the grid below and behind it: a few thin warm bands that ripple slowly, slide
 * when the head turns, breathe as it nods and tip as it rolls. Static with reduced motion. Drawn from the shared
 * music ticker, into a canvas the size of the pool.
 */
const Caustics: React.FC<{ silhouette: HeadSilhouette }> = ({ silhouette }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layout = useRef<Layout | null>(null);
  const bands = useRef(new Float32Array(BANDS * BAND_STRIDE));
  const colour = useRef(WARM);
  const readyAt = useRef<number | null>(null);
  const drawnStill = useRef(false);
  const costs = useRef<number[]>([]);

  useEffect(() => {
    const resize = () => {
      const el = canvas.current;
      if (!el) return;
      const [width, height] = [window.innerWidth, window.innerHeight];
      const pool = causticPool(headOutline({ width, height }, restPose(width, height, silhouette), silhouette.parts));
      const left = Math.max(0, Math.floor(pool.x - REACH * pool.rx));
      const top = Math.max(0, Math.floor(pool.y - REACH * pool.ry));
      const box = {
        left,
        top,
        width: Math.max(0, Math.min(width, Math.ceil(pool.x + REACH * pool.rx)) - left),
        height: Math.max(0, Math.min(height, Math.ceil(pool.y + REACH * pool.ry)) - top),
      };
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      el.width = Math.round(box.width * dpr);
      el.height = Math.round(box.height * dpr);
      // only on resize, so plain writes (setStyle is for per-frame ones)
      el.style.transform = `translate(${box.left}px, ${box.top}px)`;
      el.style.width = `${box.width}px`;
      el.style.height = `${box.height}px`;
      const context = el.getContext("2d");
      let rim: CanvasGradient | null = null;
      if (context && pool.rx > 0) {
        rim = context.createRadialGradient(0, 0, 0, 0, 0, pool.rx);
        for (const [at, alpha] of RIM) rim.addColorStop(at, `rgba(0, 0, 0, ${alpha})`);
      }
      layout.current = { pool, ...box, dpr, rim };
      drawnStill.current = false;
    };
    resize();
    window.addEventListener("resize", resize);
    const readAccent = () => {
      colour.current = accent();
      drawnStill.current = false;
    };
    readAccent();
    const poll = window.setInterval(readAccent, ACCENT_POLL_MS);
    return () => {
      window.removeEventListener("resize", resize);
      window.clearInterval(poll);
    };
  }, [silhouette]);

  useEffect(() => {
    if (!DEBUG) return;
    (window as Window & { __caustics?: { costs: number[] } }).__caustics = { costs: costs.current };
  }, []);

  useMusicFrame((_frame, now) => {
    const started = DEBUG ? performance.now() : 0;
    const el = canvas.current;
    const box = layout.current;
    if (!el || !box || box.width === 0 || box.height === 0 || !headPose.ready) return;
    const reduced = prefersReducedMotion();
    if (reduced && drawnStill.current) return;
    const context = el.getContext("2d");
    if (!context) return;
    readyAt.current ??= now;
    const fade = reduced ? 1 : Math.min(1, (now - readyAt.current) / FADE_IN_MS);

    const { pool, dpr } = box;
    const pose = reduced ? REST : headPose;
    const light = writeCaustics(bands.current, reduced ? 0 : now / 1000, pose, pool);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, el.width, el.height);
    context.setTransform(dpr, 0, 0, dpr, -box.left * dpr, -box.top * dpr);
    context.globalCompositeOperation = "lighter";
    context.strokeStyle = colour.current;
    context.lineCap = "round";
    context.lineJoin = "round";
    for (const pass of PASSES) {
      context.lineWidth = pass.width;
      for (let b = 0; b < BANDS; b++) {
        const base = b * BAND_STRIDE;
        context.globalAlpha = pass.alpha * light[base] * fade;
        context.beginPath();
        context.moveTo(light[base + 1], light[base + 2]);
        for (let i = 1; i < POINTS; i++) context.lineTo(light[base + 1 + 2 * i], light[base + 2 + 2 * i]);
        context.stroke();
      }
    }
    // keep the light where it lands: fade it out to the pool's elliptical rim
    if (box.rim) {
      context.globalCompositeOperation = "destination-in";
      context.globalAlpha = 1;
      const squash = pool.ry / pool.rx;
      context.translate(pool.x, pool.y);
      context.scale(1, squash);
      context.fillStyle = box.rim;
      context.fillRect(box.left - pool.x, (box.top - pool.y) / squash, box.width, box.height / squash);
    }
    drawnStill.current = reduced;

    if (DEBUG) {
      costs.current.push(performance.now() - started);
      if (costs.current.length > COST_SAMPLES) costs.current.shift();
    }
  });

  return <Styled.Canvas ref={canvas} aria-hidden="true" />;
};

export default Caustics;
