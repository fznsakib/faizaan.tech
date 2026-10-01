import {
  grainField,
  MAX_GRAIN_DPR,
  MOTTLE_CELLS,
  MOTTLE_STEP,
  mottleRange,
  paintGrain,
  paintMottle,
  parseRgb,
  TILE_CSS,
} from "../../choreography/grain";
import { colors } from "../../styles/colors";

export interface PaperRequest {
  tileSize: number;
  scale: number;
  seed: number;
  ground: [number, number, number];
  gain: number;
}

/** Either encoded images (from a worker with `OffscreenCanvas`) or raw RGBA to encode here. */
export interface PaperResponse {
  tileSize: number;
  mottleSize: number;
  tile: Blob | Uint8ClampedArray;
  mottle: Blob | Uint8ClampedArray;
  ms: number;
}

const SEED = 1;
/** The tile is lifted by the mottle's range, which the multiply then takes back on average. */
const GAIN = 1 + mottleRange();

/** `?debug` reads the one-off costs from `window.__grain`: the build (ms, and on which thread), and the dpr. */
export const grainCosts: { build?: number; thread?: "worker" | "main"; dpr?: number; applyMs?: number } = {};

/** The grain's pixel density for this screen: the device's, capped. */
export const grainDpr = () => Math.min(window.devicePixelRatio || 1, MAX_GRAIN_DPR);

/** The tile's side in device px at `dpr`. */
export const tileSize = (dpr: number) => Math.round(TILE_CSS * dpr);

/** Both layers' pixels: the grain tile (ground colour baked in) and the mottle grid. Pure; runs in the worker. */
export function buildPaper(request: PaperRequest) {
  const field = grainField(request.tileSize, request.scale, request.seed);
  const tile = new Uint8ClampedArray(request.tileSize * request.tileSize * 4);
  paintGrain(tile, field, request.ground, request.gain);
  const mottle = new Uint8ClampedArray(MOTTLE_CELLS * MOTTLE_CELLS * 4);
  paintMottle(mottle);
  return { tileSize: request.tileSize, mottleSize: MOTTLE_CELLS, tile, mottle };
}

function toBlob(pixels: Uint8ClampedArray, size: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels), size, size), 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("grain: no blob"))), "image/png"));
}

const asBlob = (image: Blob | Uint8ClampedArray, size: number) => (image instanceof Blob ? Promise.resolve(image) : toBlob(image, size));

/** A data: URL rather than a blob: one: sandboxed hosts and strict CSPs often allow `img-src data:` but not `blob:`. */
const asDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

function build(request: PaperRequest): Promise<PaperResponse> {
  return new Promise((resolve) => {
    const onMain = () =>
      setTimeout(() => {
        const started = performance.now();
        const paper = buildPaper(request);
        grainCosts.thread = "main";
        resolve({ ...paper, ms: performance.now() - started });
      }, 0);
    let worker: Worker;
    try {
      worker = new Worker(new URL("./grain.worker.ts", import.meta.url), { type: "module" });
    } catch {
      onMain();
      return;
    }
    worker.onmessage = ({ data }: MessageEvent<PaperResponse>) => {
      grainCosts.thread = "worker";
      worker.terminate();
      resolve(data);
    };
    worker.onerror = () => {
      worker.terminate();
      onMain();
    };
    worker.postMessage(request);
  });
}

export interface Paper {
  /** CSS `background-image`, `-size` and `-blend-mode` for the ground's element. */
  image: string;
  size: string;
  blend: string;
  dpr: number;
}

const papers = new Map<number, Promise<Paper>>();

/** The paper for `dpr`: built once (in a worker where there is one) as two images, and kept. */
export function paper(dpr: number): Promise<Paper> {
  const size = tileSize(dpr);
  const cached = papers.get(size);
  if (cached) return cached;
  const request: PaperRequest = {
    tileSize: size,
    scale: size / TILE_CSS,
    seed: SEED,
    ground: parseRgb(colors.site.background),
    gain: GAIN,
  };
  const next = build(request).then(async (response) => {
    grainCosts.build = response.ms;
    grainCosts.dpr = dpr;
    const [tile, mottle] = await Promise.all([
      asBlob(response.tile, response.tileSize).then(asDataUrl),
      asBlob(response.mottle, response.mottleSize).then(asDataUrl),
    ]);
    const mottleCss = MOTTLE_CELLS * MOTTLE_STEP;
    return {
      // the mottle multiplied over the grain tile, both repeating from the page's top left
      image: `url("${mottle}"), url("${tile}")`,
      size: `${mottleCss}px ${mottleCss}px, ${TILE_CSS}px ${TILE_CSS}px`,
      blend: "multiply, normal",
      dpr,
    };
  });
  papers.set(size, next);
  return next;
}
