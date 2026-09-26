import type { SkinId } from "./skins";

/** Where bars and cells sit, in CSS px. `rows` 0 means continuous (unstepped) bars. */
export interface Geometry {
  bars: number;
  pitch: number;
  bar: number;
  rows: number;
  row: number;
  height: number;
  /** Oscilloscope columns and the size of one scope mark. */
  cols: number;
  dot: number;
}

export type VisVariant = "full" | "mini";

/** The analyser's grid for a skin: Winamp pixels (base), smooth glass bars (chrome), a dot matrix (faizaan). */
export function geometry(skin: SkinId, variant: VisVariant): Geometry {
  if (variant === "mini") {
    if (skin === "faizaan") return { bars: 12, pitch: 4, bar: 3, rows: 4, row: 3, height: 12, cols: 16, dot: 3 };
    if (skin === "chrome") return { bars: 12, pitch: 4, bar: 3, rows: 0, row: 1, height: 12, cols: 24, dot: 1 };
    return { bars: 12, pitch: 4, bar: 3, rows: 6, row: 2, height: 12, cols: 24, dot: 2 };
  }
  if (skin === "faizaan") return { bars: 24, pitch: 12, bar: 8, rows: 12, row: 4, height: 48, cols: 72, dot: 4 };
  if (skin === "chrome") return { bars: 24, pitch: 12, bar: 9, rows: 0, row: 1, height: 48, cols: 96, dot: 1 };
  return { bars: 24, pitch: 12, bar: 9, rows: 16, row: 3, height: 48, cols: 96, dot: 3 };
}

export const visWidth = (g: Geometry) => g.bars * g.pitch - (g.pitch - g.bar);

interface Palette {
  back: (ctx: CanvasRenderingContext2D, w: number, h: number, u: number, g: Geometry) => void;
  /** Colour of lit cell `t` (0 bottom .. 1 top). */
  lit: (t: number) => string;
  peak: string;
  scope: string;
}

/** Stops for the base skin's bars, bottom (green) to top (red), like a hi-fi meter. */
const BASE_STOPS: [number, [number, number, number]][] = [
  [0, [22, 118, 12]],
  [0.3, [46, 204, 22]],
  [0.55, [186, 222, 40]],
  [0.7, [222, 176, 30]],
  [0.86, [224, 104, 8]],
  [1, [236, 48, 18]],
];

function mix(stops: [number, [number, number, number]][], t: number): string {
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

const PALETTES: Record<SkinId, Palette> = {
  base: {
    back: (ctx, w, h, u) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      // the classic dotted floor: a dim dot on every other cell
      ctx.fillStyle = "#1d2330";
      const step = Math.max(1, Math.round(u)) * 2;
      for (let y = step / 2; y < h; y += step) for (let x = 0; x < w; x += step) ctx.fillRect(x, y, step / 2, step / 2);
    },
    lit: (t) => mix(BASE_STOPS, t),
    peak: "#a7a7b4",
    scope: "#e8e8ef",
  },
  chrome: {
    back: (ctx, w, h) => {
      const glass = ctx.createLinearGradient(0, 0, 0, h);
      glass.addColorStop(0, "#0d3a5c");
      glass.addColorStop(1, "#041726");
      ctx.fillStyle = glass;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(120, 220, 255, 0.07)";
      for (let y = h - 1; y > 0; y -= Math.max(2, Math.round(h / 12))) ctx.fillRect(0, y, w, 1);
    },
    lit: (t) =>
      mix(
        [
          [0, [0, 92, 168]],
          [0.55, [0, 186, 236]],
          [1, [150, 246, 255]],
        ],
        t
      ),
    peak: "#f1feff",
    scope: "#6ff2ff",
  },
  faizaan: {
    back: (ctx, w, h, u, g) => {
      ctx.fillStyle = "#051510";
      ctx.fillRect(0, 0, w, h);
      dotGrid(ctx, g, u, "rgba(138, 177, 238, 0.14)");
    },
    lit: () => "#8AB1EE",
    peak: "#F08A3C",
    scope: "#8AB1EE",
  },
};

/** Every dot of the faizaan matrix (bars are `bar` px wide, `dot` px pitch). */
function dotGrid(ctx: CanvasRenderingContext2D, g: Geometry, u: number, color: string) {
  ctx.fillStyle = color;
  const pitch = g.row * u;
  const radius = pitch * 0.38;
  ctx.beginPath();
  for (let b = 0; b < g.bars; b++) {
    for (let x = b * g.pitch * u; x < (b * g.pitch + g.bar) * u - radius; x += pitch) {
      for (let r = 0; r < g.rows; r++) {
        const cy = g.height * u - (r + 0.5) * pitch;
        ctx.moveTo(x + pitch / 2 + radius, cy);
        ctx.arc(x + pitch / 2, cy, radius, 0, Math.PI * 2);
      }
    }
  }
  ctx.fill();
}

function sprite(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  return canvas;
}

/** Draws one skin's analyser and scope into a canvas at `u` device px per CSS px. */
export class Painter {
  private readonly back: HTMLCanvasElement;
  private readonly lit: HTMLCanvasElement;
  private readonly peak: HTMLCanvasElement;
  private readonly palette: Palette;
  readonly width: number;
  readonly height: number;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly skin: SkinId,
    private readonly g: Geometry,
    private readonly u: number
  ) {
    this.palette = PALETTES[skin];
    this.width = Math.round(visWidth(g) * u);
    this.height = Math.round(g.height * u);
    const { width: w, height: h } = this;
    this.back = sprite(w, h, (c) => this.palette.back(c, w, h, u, g));
    this.lit = sprite(w, h, (c) => this.drawCells(c, false));
    this.peak = sprite(w, h, (c) => this.drawCells(c, true));
  }

  /** Every cell lit, in its lit colour (or the peak colour). Frames blit slices of these. */
  private drawCells(c: CanvasRenderingContext2D, peak: boolean) {
    const { g, u } = this;
    const h = this.height;
    if (this.skin === "faizaan") {
      dotGrid(c, g, u, peak ? this.palette.peak : this.palette.lit(0));
      return;
    }
    for (let b = 0; b < g.bars; b++) {
      const x = Math.round(b * g.pitch * u);
      const w = Math.round(g.bar * u);
      if (g.rows === 0) {
        // chrome: one smooth glass column with a specular edge
        const grad = c.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, peak ? this.palette.peak : this.palette.lit(0));
        grad.addColorStop(0.55, peak ? this.palette.peak : this.palette.lit(0.55));
        grad.addColorStop(1, peak ? this.palette.peak : this.palette.lit(1));
        c.fillStyle = grad;
        c.fillRect(x, 0, w, h);
        if (!peak) {
          c.fillStyle = "rgba(255, 255, 255, 0.38)";
          c.fillRect(x + Math.round(u), 0, Math.max(1, Math.round(w * 0.22)), h);
        }
        continue;
      }
      for (let r = 0; r < g.rows; r++) {
        c.fillStyle = peak ? this.palette.peak : this.palette.lit(r / (g.rows - 1));
        const y = Math.round(h - (r + 1) * g.row * u);
        c.fillRect(x, y, w, Math.round(g.row * u));
      }
    }
  }

  /** Bars and peak caps, both 0..1 per bar. */
  bars(levels: Float32Array, peaks: Float32Array) {
    const { ctx, g, u, height: h } = this;
    ctx.drawImage(this.back, 0, 0);
    const cell = g.rows === 0 ? 0 : g.row * u;
    const w = Math.round(g.bar * u);
    for (let b = 0; b < g.bars; b++) {
      const x = Math.round(b * g.pitch * u);
      const top = this.top(levels[b]);
      if (top < h) ctx.drawImage(this.lit, x, top, w, h - top, x, top, w, h - top);
      if (peaks[b] <= 0) continue;
      const capTop = Math.min(this.top(peaks[b]), h - Math.max(cell, u * 2));
      const capH = cell || Math.max(1, Math.round(u * 2));
      ctx.drawImage(this.peak, x, capTop, w, capH, x, capTop, w, capH);
    }
  }

  /** Device-px y of a level's top edge: whole cells when stepped. */
  private top(level: number): number {
    const { g, u, height: h } = this;
    if (g.rows === 0) return Math.round(h - level * h);
    return Math.round(h - Math.round(level * g.rows) * g.row * u);
  }

  /** The oscilloscope: samples −1..1, one mark per column. */
  scope(wave: Float32Array) {
    const { ctx, g, u, height: h } = this;
    ctx.drawImage(this.back, 0, 0);
    const span = this.width / wave.length;
    if (this.skin === "chrome") {
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i < wave.length; i++) {
        const y = h / 2 - wave[i] * (h / 2 - u * 2);
        if (i === 0) ctx.moveTo(0, y);
        else ctx.lineTo(i * span + span / 2, y);
      }
      ctx.strokeStyle = "rgba(111, 242, 255, 0.25)";
      ctx.lineWidth = u * 4;
      ctx.stroke();
      ctx.strokeStyle = this.palette.scope;
      ctx.lineWidth = u * 1.25;
      ctx.stroke();
      return;
    }
    const mark = g.dot * u;
    const rows = Math.floor(g.height / g.dot);
    ctx.fillStyle = this.palette.scope;
    if (this.skin === "faizaan") ctx.beginPath();
    for (let i = 0; i < wave.length; i++) {
      const row = Math.round(((1 - wave[i]) / 2) * (rows - 1));
      const x = i * span;
      const y = row * mark + (h - rows * mark) / 2;
      if (this.skin === "faizaan") {
        const r = mark * 0.38;
        ctx.moveTo(x + mark / 2 + r, y + mark / 2);
        ctx.arc(x + mark / 2, y + mark / 2, r, 0, Math.PI * 2);
      } else {
        ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(span), Math.round(mark));
      }
    }
    if (this.skin === "faizaan") ctx.fill();
  }
}
