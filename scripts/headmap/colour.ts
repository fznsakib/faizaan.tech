import type { Vec3 } from "./ray.ts";

/*
 * Colour for the skin head's synthesis: telling skin, hair and the room apart in the photo, and a seamless tile of the
 * owner's own hair to cover what the camera never saw.
 */

/** JPEG's YCbCr (0..255): brightness apart from the two colour axes, so lighting mostly moves only Y. */
export function toYcc([r, g, b]: number[]): Vec3 {
  return [
    0.299 * r + 0.587 * g + 0.114 * b,
    128 - 0.168736 * r - 0.331264 * g + 0.5 * b,
    128 + 0.5 * r - 0.418688 * g - 0.081312 * b,
  ];
}

export interface ColourModel {
  mean: Vec3;
  /** Inverse covariance (row-major 3×3) in YCbCr. */
  inverse: number[];
}

/**
 * A Gaussian over RGB samples in YCbCr. `floor` (per axis, in 0..255 units) is added to the spread so a tight
 * cluster still accepts its own near neighbours.
 */
export function fitColourModel(samples: number[][], floor = 6): ColourModel {
  const ycc = samples.map(toYcc);
  const mean = [0, 1, 2].map((k) => ycc.reduce((s, c) => s + c[k], 0) / ycc.length) as Vec3;
  const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const c of ycc) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cov[a * 3 + b] += ((c[a] - mean[a]) * (c[b] - mean[b])) / ycc.length;
  for (let a = 0; a < 3; a++) cov[a * 4] += floor * floor;
  return { mean, inverse: invert3(cov) };
}

/** Mahalanobis distance of an RGB colour from a model: ~1 per standard deviation. */
export function colourDistance({ mean, inverse }: ColourModel, rgb: number[]) {
  const c = toYcc(rgb);
  const d = [c[0] - mean[0], c[1] - mean[1], c[2] - mean[2]];
  let sum = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sum += d[a] * inverse[a * 3 + b] * d[b];
  return Math.sqrt(Math.max(0, sum));
}

/** How much more a colour looks like hair than skin, 0..1. */
export function hairness(rgb: number[], skin: ColourModel, hair: ColourModel) {
  const ds = colourDistance(skin, rgb) ** 2, dh = colourDistance(hair, rgb) ** 2;
  return ds + dh > 0 ? ds / (ds + dh) : 0.5;
}

/**
 * A seamless (wrapping) tile from a square RGB patch: four copies of it, shifted by half a tile across, down and both,
 * cross-faded so each copy's own seam sits where its weight is 0, and re-contrasted so the blend keeps the patch's
 * texture instead of washing it out.
 */
export function makeTileable(rgb: Float32Array, size: number) {
  const mean = [0, 0, 0];
  for (let i = 0; i < size * size; i++) for (let k = 0; k < 3; k++) mean[k] += rgb[i * 3 + k] / (size * size);
  const window = (x: number) => Math.sin((Math.PI * (x + 0.5)) / size) ** 2;
  const half = size >> 1;
  const out = new Float32Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ax = window(x), ay = window(y);
      const copies: [number, number, number][] = [
        [x, y, ax * ay],
        [(x + half) % size, y, (1 - ax) * ay],
        [x, (y + half) % size, ax * (1 - ay)],
        [(x + half) % size, (y + half) % size, (1 - ax) * (1 - ay)],
      ];
      const norm = Math.sqrt(copies.reduce((s, [, , w]) => s + w * w, 0));
      for (let k = 0; k < 3; k++) {
        let sum = 0;
        for (const [sx, sy, w] of copies) sum += w * (rgb[(sy * size + sx) * 3 + k] - mean[k]);
        out[(y * size + x) * 3 + k] = mean[k] + sum / norm;
      }
    }
  }
  return out;
}

/** Bilinear RGB sample of a wrapping `width`×`height` tile at (u, v) in tiles (texel centres at (i + 0.5) / width). */
export function sampleWrapped(rgb: Float32Array, width: number, height: number, u: number, v: number): Vec3 {
  const x = u * width - 0.5, y = v * height - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const wrap = (i: number, n: number) => ((i % n) + n) % n;
  const xa = wrap(x0, width), xb = wrap(x0 + 1, width), ya = wrap(y0, height), yb = wrap(y0 + 1, height);
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const top = rgb[(ya * width + xa) * 3 + k] * (1 - fx) + rgb[(ya * width + xb) * 3 + k] * fx;
    const bottom = rgb[(yb * width + xa) * 3 + k] * (1 - fx) + rgb[(yb * width + xb) * 3 + k] * fx;
    out[k] = top * (1 - fy) + bottom * fy;
  }
  return out;
}

/** Triplanar blend weights for a unit normal: |n|^sharpness per axis, summing to 1. */
export function triplanarWeights(n: Vec3, sharpness: number): Vec3 {
  const w = n.map((c) => Math.abs(c) ** sharpness) as Vec3;
  const sum = w[0] + w[1] + w[2] || 1;
  return [w[0] / sum, w[1] / sum, w[2] / sum];
}

function invert3(m: number[]) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
}
