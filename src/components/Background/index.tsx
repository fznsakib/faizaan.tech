import { useEffect, useMemo, useRef } from "react";

import * as Styled from "./Background.styled";
import { grainCosts, grainDpr, paper } from "./paper";
import { useMusicFrame } from "../../audio/react";
import {
  CELL,
  crispOffset,
  cursorTurn,
  easeTurn,
  gridLayout,
  KICK_HISTORY_SPAN,
  miniScale,
  type GridLayout,
} from "../../choreography/grid";
import { KickHistory, SHOCKWAVE_SPEED } from "../../choreography/type";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

const BIG = { color: "#555555", width: 1, inner: 4, outer: 36 }; // arm span within the cell, px
const MINI = { color: "rgba(138, 177, 238, 0.5)", width: 2, half: 5 }; // #8AB1EE @ 0.5, arms 15–25 px
const MAX_DPR = 2;
/** Below this per-cell turn change, and with every mini-plus at rest scale, the frame is identical to last drawn. */
const SETTLED_ANGLE = 1e-4;
const debug = new URLSearchParams(window.location.search).has("debug");

interface View {
  width: number;
  height: number;
  dpr: number;
  layout: GridLayout;
}

/**
 * The plus grid behind everything else, over paper: the ground's own CSS background is a paper-grain texture (built
 * once, in a worker; see `paper.ts`), showing through the grid canvas, which is cleared to transparent on every draw.
 * Big plusses turn to face the cursor within `TURN_RADIUS`; mini plusses pulse in size with the music as a shockwave from the head, reusing the header's `KickHistory` so the grid and
 * the name ripple out together. Redrawn from the shared music ticker — never its own rAF loop.
 */
const Background: React.FC = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ground = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ width: 0, height: 0, dpr: 1, layout: gridLayout(0, 0) });
  const angles = useRef(new Float32Array(0));
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const kicks = useMemo(() => new KickHistory(KICK_HISTORY_SPAN), []);
  const lastNow = useRef(0);
  const dirty = useRef(true);
  /** Whether the last *drawn* frame had any mini plus above rest scale — one more draw is owed to reset it. */
  const wasScaled = useRef(false);
  const perf = useRef<number[]>([]);

  useEffect(() => {
    const resize = () => {
      const el = canvas.current;
      if (!el) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const layout = gridLayout(width, height);
      view.current = { width, height, dpr, layout };
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      angles.current = new Float32Array(layout.columns * layout.rows);
      dirty.current = true;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    let live = true;
    const apply = (dpr: number) =>
      paper(dpr).then((next) => {
        const el = ground.current;
        if (!live || !el || next.dpr !== grainDpr()) return;
        const started = performance.now();
        // once per pixel density, never per frame: the browser rasterises the two images off the main thread
        el.style.backgroundImage = next.image;
        el.style.backgroundSize = next.size;
        el.style.backgroundBlendMode = next.blend;
        grainCosts.applyMs = performance.now() - started;
      });
    let dpr = grainDpr();
    apply(dpr);
    // a window dragged to a screen of another pixel density gets its own tile
    const resize = () => {
      if (grainDpr() === dpr) return;
      dpr = grainDpr();
      apply(dpr);
    };
    window.addEventListener("resize", resize);
    if (debug) (window as unknown as { __grain: typeof grainCosts }).__grain = grainCosts;
    return () => {
      live = false;
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) pointer.current = null;
    };
    const blur = () => {
      pointer.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerout", leave);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", leave);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useMusicFrame((frame, now) => {
    const t0 = debug ? performance.now() : 0;
    const el = canvas.current;
    if (!el) return;
    const { width, height, dpr, layout } = view.current;
    if (width === 0 || height === 0) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    if (reduced) {
      if (dirty.current) {
        draw(ctx, layout, dpr, angles.current, null);
        dirty.current = false;
      }
      return;
    }

    const dt = lastNow.current > 0 ? Math.min(0.1, (now - lastNow.current) / 1000) : 0;
    lastNow.current = now;

    const active = frame.isPlaying || frame.jamming;
    kicks.push(now / 1000, active ? frame.kick : 0);

    const point = pointer.current;
    let settled = true;
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.columns; c++) {
        const i = r * layout.columns + c;
        const cx = layout.originX + c * CELL + CELL / 2;
        const cy = layout.originY + r * CELL + CELL / 2;
        const target = point ? cursorTurn(cx, cy, point.x, point.y) : { angle: 0, weight: 0 };
        const next = easeTurn(angles.current[i], target.angle * target.weight, dt);
        if (Math.abs(next - angles.current[i]) > SETTLED_ANGLE) settled = false;
        angles.current[i] = next;
      }
    }

    const headX = window.innerWidth / 2;
    const headY = window.innerHeight / 2;
    let anyScaled = false;
    const scales = active ? new Float32Array(layout.columns * layout.rows) : null;
    if (active) {
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.columns; c++) {
          const i = r * layout.columns + c;
          const cx = layout.originX + c * CELL + CELL / 2;
          const cy = layout.originY + r * CELL + CELL / 2;
          const dist = Math.hypot(cx - headX, cy - headY);
          const kick = kicks.at(now / 1000 - dist / SHOCKWAVE_SPEED);
          const scale = miniScale(kick, frame.energy);
          scales![i] = scale;
          if (scale !== 1) anyScaled = true;
        }
      }
    }

    // A mini plus that pulsed last draw and is now at rest still owes one more draw to reset it to scale 1.
    if (settled && !anyScaled && !wasScaled.current && !dirty.current) {
      if (debug) perf.current.push(performance.now() - t0);
      return;
    }
    dirty.current = false;
    wasScaled.current = anyScaled;

    draw(ctx, layout, dpr, angles.current, scales);

    if (debug) {
      perf.current.push(performance.now() - t0);
      if (perf.current.length >= 600) {
        const sorted = [...perf.current].sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        console.log(`grid frame cost — p50 ${p50.toFixed(3)}ms, p95 ${p95.toFixed(3)}ms (n=${perf.current.length})`);
        perf.current = [];
      }
      (
        window as unknown as {
          __grid: { angles: Float32Array; layout: GridLayout; scales: Float32Array | null; active: boolean; isPlaying: boolean; jamming: boolean };
        }
      ).__grid = { angles: angles.current, layout, scales, active, isPlaying: frame.isPlaying, jamming: frame.jamming };
    }
  });

  return (
    <Styled.Background ref={ground}>
      <Styled.Canvas ref={canvas} aria-hidden="true" />
    </Styled.Background>
  );
};

/** One stroke for every big plus, one stroke for every mini plus. `scales` null draws mini plusses at rest (1). */
function draw(
  ctx: CanvasRenderingContext2D,
  layout: GridLayout,
  dpr: number,
  angles: Float32Array,
  scales: Float32Array | null,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // the paper below is the ground
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // At DPR 1 a 1 px stroke straddles two device pixels and blurs; nudge it onto the pixel grid. Which way
  // depends on whether the origin itself is already a half pixel (odd viewport dimension) or not.
  const crispX = crispOffset(layout.originX, dpr);
  const crispY = crispOffset(layout.originY, dpr);
  const bigHalf = (BIG.outer - BIG.inner) / 2;
  ctx.beginPath();
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.columns; c++) {
      const i = r * layout.columns + c;
      const cx = layout.originX + c * CELL + CELL / 2 + crispX;
      const cy = layout.originY + r * CELL + CELL / 2 + crispY;
      const a = angles[i];
      const dx = Math.cos(a) * bigHalf;
      const dy = Math.sin(a) * bigHalf;
      const dx2 = Math.cos(a + Math.PI / 2) * bigHalf;
      const dy2 = Math.sin(a + Math.PI / 2) * bigHalf;
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.moveTo(cx - dx2, cy - dy2);
      ctx.lineTo(cx + dx2, cy + dy2);
    }
  }
  ctx.strokeStyle = BIG.color;
  ctx.lineWidth = BIG.width;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.columns; c++) {
      const i = r * layout.columns + c;
      const cx = layout.originX + c * CELL + CELL / 2;
      const cy = layout.originY + r * CELL + CELL / 2;
      const half = MINI.half * (scales ? scales[i] : 1);
      ctx.moveTo(cx, cy - half);
      ctx.lineTo(cx, cy + half);
      ctx.moveTo(cx - half, cy);
      ctx.lineTo(cx + half, cy);
    }
  }
  ctx.strokeStyle = MINI.color;
  ctx.lineWidth = MINI.width;
  ctx.lineCap = "round";
  ctx.stroke();
}

export default Background;
