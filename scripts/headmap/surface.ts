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
 * of the way toward its neighbours' average. Weight-0 vertices never move. With `mu` (negative,
 * slightly larger than `lambda`), each pass adds an inflating step: Taubin smoothing, which removes
 * noise without shrinking the surface. With `planar`, only x and y move (z is left for re-projection).
 */
export function smoothMasked(
  positions: Float32Array,
  rings: Set<number>[],
  weights: Float32Array,
  { passes, lambda, mu, planar = false }: { passes: number; lambda: number; mu?: number; planar?: boolean }
) {
  // Flatten the weighted vertices' rings once: hundreds of passes over Sets are slow.
  const active: number[] = [];
  for (let i = 0; i < weights.length; i++) if (weights[i] !== 0 && rings[i].size > 0) active.push(i);
  const offsets = new Int32Array(active.length + 1);
  active.forEach((v, k) => (offsets[k + 1] = offsets[k] + rings[v].size));
  const neighbours = new Int32Array(offsets[active.length]);
  active.forEach((v, k) => neighbours.set([...rings[v]], offsets[k]));
  const axes = planar ? 2 : 3;

  let current = positions.slice();
  let next = positions.slice();
  const step = (factor: number) => {
    for (let k = 0; k < active.length; k++) {
      const i = active[k], w = weights[i] * factor, n = offsets[k + 1] - offsets[k];
      for (let axis = 0; axis < axes; axis++) {
        let sum = 0;
        for (let e = offsets[k]; e < offsets[k + 1]; e++) sum += current[neighbours[e] * 3 + axis];
        next[i * 3 + axis] = current[i * 3 + axis] + w * (sum / n - current[i * 3 + axis]);
      }
    }
    [current, next] = [next, current];
  };
  for (let pass = 0; pass < passes; pass++) {
    step(lambda);
    if (mu !== undefined) step(mu);
  }
  return current;
}

/**
 * Smooths a mesh's rim in 2D: each pass moves every rim vertex with two rim neighbours halfway to
 * their midpoint. `points` holds x, y per vertex; open ends and off-rim vertices stay put.
 */
export function smoothRim(points: Float32Array, edges: [number, number][], passes: number) {
  const links = new Map<number, number[]>();
  for (const [a, b] of edges) {
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  }
  let current = points.slice();
  for (let pass = 0; pass < passes; pass++) {
    const next = current.slice();
    for (const [v, ns] of links) {
      if (ns.length !== 2) continue;
      const [a, b] = ns;
      next[v * 2] = 0.5 * current[v * 2] + 0.25 * (current[a * 2] + current[b * 2]);
      next[v * 2 + 1] = 0.5 * current[v * 2 + 1] + 0.25 * (current[a * 2 + 1] + current[b * 2 + 1]);
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
