import type { Vec3 } from "./ray.ts";

/** Area-weighted unit vertex normals, following the triangles' winding. */
export function vertexNormals(positions: Float32Array, indices: Uint32Array) {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const e1x = positions[b] - positions[a], e1y = positions[b + 1] - positions[a + 1], e1z = positions[b + 2] - positions[a + 2];
    const e2x = positions[c] - positions[a], e2y = positions[c + 1] - positions[a + 1], e2z = positions[c + 2] - positions[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      normals[v] += nx;
      normals[v + 1] += ny;
      normals[v + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len;
    normals[i + 1] /= len;
    normals[i + 2] /= len;
  }
  return normals;
}

/**
 * Laplacian smoothing restricted by per-vertex weights: each pass moves a vertex `lambda · weight`
 * of the way toward its neighbours' average. Weight-0 vertices never move.
 */
export function smoothMasked(
  positions: Float32Array,
  rings: Set<number>[],
  weights: Float32Array,
  { passes, lambda }: { passes: number; lambda: number }
) {
  let current = positions.slice();
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice();
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] * lambda;
      if (w <= 0 || rings[i].size === 0) continue;
      let x = 0, y = 0, z = 0;
      for (const j of rings[i]) {
        x += current[j * 3];
        y += current[j * 3 + 1];
        z += current[j * 3 + 2];
      }
      const n = rings[i].size;
      next[i * 3] += w * (x / n - current[i * 3]);
      next[i * 3 + 1] += w * (y / n - current[i * 3 + 1]);
      next[i * 3 + 2] += w * (z / n - current[i * 3 + 2]);
    }
    current = next;
  }
  return current;
}

export interface QuantizedPositions {
  /** Integer positions (KHR_mesh_quantization, SHORT, not normalised). */
  array: Int16Array;
  /** Node translation and uniform node scale that turn the integers back into positions. */
  translation: Vec3;
  scale: number;
}

/** Quantises positions to `bits` of precision across the bounding box's longest half-extent. */
export function quantizePositions(positions: Float32Array, bits: number): QuantizedPositions {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  const translation: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const halfExtent = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
  const range = 2 ** (bits - 1) - 1;
  const scale = halfExtent / range;
  const array = new Int16Array(positions.length);
  for (let i = 0; i < positions.length; i++) array[i] = Math.round((positions[i] - translation[i % 3]) / scale);
  return { array, translation, scale };
}

export function dequantizePosition({ array, translation, scale }: QuantizedPositions, i: number): Vec3 {
  return [0, 1, 2].map((k) => array[i * 3 + k] * scale + translation[k]) as Vec3;
}

/** Unit normals as normalised int8 (the meshopt octahedral filter re-encodes them on write). */
export function quantizeNormals(normals: Float32Array) {
  return Int8Array.from(normals, (n) => Math.round(n * 127));
}
