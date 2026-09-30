import { sampleWrapped } from "./colour.ts";
import { hash3 } from "./noise.ts";

import type { Vec3 } from "./ray.ts";

/*
 * Texture for surfaces the camera never saw, from a small tile of what it did see: splats of the tile scattered over
 * the surface in 3D, each shifted and slightly turned at random, so nothing repeats and no chart seam shows.
 */

/**
 * Two unit tangents at a surface normal: the second points down the surface (the way hair falls), the first across.
 * Continuous everywhere but straight up or down, where hair has its whorl anyway.
 */
export function tangentFrame(n: Vec3): [Vec3, Vec3] {
  const down = -1;
  // (0, −1, 0) minus its part along n
  let b: Vec3 = [-n[1] * down * n[0], down - n[1] * down * n[1], -n[1] * down * n[2]];
  let len = Math.hypot(...b);
  if (len < 1e-6) {
    b = [0, 0, -1];
    len = 1;
  }
  b = [b[0] / len, b[1] / len, b[2] / len];
  const t: Vec3 = [b[1] * n[2] - b[2] * n[1], b[2] * n[0] - b[0] * n[2], b[0] * n[1] - b[1] * n[0]];
  const tl = Math.hypot(...t) || 1;
  return [[t[0] / tl, t[1] / tl, t[2] / tl], b];
}

export interface Tile {
  rgb: Float32Array;
  size: number;
  /** How many surface units one tile spans. */
  tile: number;
}

/**
 * The tile splatted over a surface: splat centres jittered on a 3D grid `spacing` apart, each covering 1.4 spacings
 * with a smooth falloff, mapped through the surface's tangent frame with its own random offset and a small turn.
 * Overlapping splats are blended keeping the tile's contrast (variance-preserving), so the result is as crisp as the
 * tile and has its mean colour.
 */
export function splatTexture(tile: Tile, { seed, spacing, turn = 0.5 }: { seed: number; spacing: number; turn?: number }) {
  const mean = [0, 1, 2].map((k) => tile.rgb.filter((_, i) => i % 3 === k).reduce((s, v) => s + v, 0) / (tile.size * tile.size));
  const radius = 1.4 * spacing;
  return (q: Vec3, n: Vec3): Vec3 => {
    const [t, b] = tangentFrame(n);
    const cx = Math.floor(q[0] / spacing), cy = Math.floor(q[1] / spacing), cz = Math.floor(q[2] / spacing);
    const sum = [0, 0, 0];
    let norm = 0;
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let j = cy - 1; j <= cy + 1; j++) {
        for (let k = cz - 1; k <= cz + 1; k++) {
          const c = [
            (i + 0.5 + 0.7 * (hash3(seed, i, j, k) - 0.5)) * spacing,
            (j + 0.5 + 0.7 * (hash3(seed + 1, i, j, k) - 0.5)) * spacing,
            (k + 0.5 + 0.7 * (hash3(seed + 2, i, j, k) - 0.5)) * spacing,
          ];
          const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
          const r2 = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) / (radius * radius);
          if (r2 >= 1) continue;
          const w = (1 - r2) * (1 - r2);
          const angle = turn * (hash3(seed + 3, i, j, k) - 0.5) * 2;
          const x = d[0] * t[0] + d[1] * t[1] + d[2] * t[2], y = d[0] * b[0] + d[1] * b[1] + d[2] * b[2];
          const u = hash3(seed + 4, i, j, k) + (Math.cos(angle) * x - Math.sin(angle) * y) / tile.tile;
          const v = hash3(seed + 5, i, j, k) + (Math.sin(angle) * x + Math.cos(angle) * y) / tile.tile;
          const s = sampleWrapped(tile.rgb, tile.size, tile.size, u, v);
          for (let ch = 0; ch < 3; ch++) sum[ch] += w * (s[ch] - mean[ch]);
          norm += w * w;
        }
      }
    }
    const scale = norm > 0 ? 1 / Math.sqrt(norm) : 0;
    return [mean[0] + sum[0] * scale, mean[1] + sum[1] * scale, mean[2] + sum[2] * scale];
  };
}

/**
 * A patch with every texel that isn't `wanted` enough (below `threshold`) replaced by the mean of those that are — so
 * a speck of the wall between two curls can never be splatted over the whole head. Throws if nothing is wanted.
 */
export function keepOnly(rgb: Float32Array, wanted: (rgb: number[]) => number, threshold: number) {
  const n = rgb.length / 3;
  const keep = new Uint8Array(n);
  const mean = [0, 0, 0];
  let kept = 0;
  for (let i = 0; i < n; i++) {
    if (wanted([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]) < threshold) continue;
    keep[i] = 1;
    kept++;
    for (let k = 0; k < 3; k++) mean[k] += rgb[i * 3 + k];
  }
  if (kept === 0) throw new Error("the hair tile has no hair in it; check the landmarks (--nose, --chin)");
  const out = rgb.slice();
  for (let i = 0; i < n; i++) if (!keep[i]) out.set(mean.map((v) => v / kept), i * 3);
  return { rgb: out, replaced: n - kept };
}
