import type { Vec3 } from "./ray.ts";

/** The face crop, in the scan's own frame (y up, +z toward the camera). */
export interface CropParams {
  /** Centre of the elliptical face window, x/y. */
  centre: [number, number];
  /** Half-width and half-height of the window. */
  radii: [number, number];
  /** Depth cut: points with z below this are background (wall, window, ears, neck). */
  minDepth: number;
  /** Chin cut. */
  minY: number;
  /** Hair cut. */
  maxY: number;
}

export function insideCrop([x, y, z]: Vec3, { centre, radii, minDepth, minY, maxY }: CropParams) {
  const dx = (x - centre[0]) / radii[0];
  const dy = (y - centre[1]) / radii[1];
  return dx * dx + dy * dy <= 1 && z >= minDepth && y >= minY && y <= maxY;
}

/** The triangles whose three corners all pass `keep`. */
export function cropTriangles(positions: Float32Array, indices: Uint32Array, keep: (p: Vec3) => boolean) {
  const pass = new Uint8Array(positions.length / 3);
  for (let i = 0; i < pass.length; i++) pass[i] = keep([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]) ? 1 : 0;
  const out: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    if (pass[indices[t]] && pass[indices[t + 1]] && pass[indices[t + 2]]) out.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return new Uint32Array(out);
}

/**
 * The triangles of the connected component with the most triangles. Triangles connect through shared
 * vertices, or through shared positions when `canon` (from `weldMap`) is given.
 */
export function largestComponent(indices: Uint32Array, vertexCount: number, canon?: Uint32Array) {
  const parent = new Int32Array(vertexCount).map((_, i) => i);
  const find = (v: number): number => {
    let i = canon ? canon[v] : v;
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(indices[t]);
    parent[find(indices[t + 1])] = a;
    parent[find(indices[t + 2])] = a;
  }
  const sizes = new Map<number, number>();
  let best = -1, bestSize = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const root = find(indices[t]);
    const size = (sizes.get(root) ?? 0) + 1;
    sizes.set(root, size);
    if (size > bestSize) {
      best = root;
      bestSize = size;
    }
  }
  const out: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    if (find(indices[t]) === best) out.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return new Uint32Array(out);
}

/** Drops vertices no triangle uses; `sourceIndex[i]` is new vertex i's index in the input. */
export function compactMesh(positions: Float32Array, indices: Uint32Array) {
  const remap = new Map<number, number>();
  const sourceIndex: number[] = [];
  const out = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    let j = remap.get(indices[i]);
    if (j === undefined) {
      j = sourceIndex.length;
      remap.set(indices[i], j);
      sourceIndex.push(indices[i]);
    }
    out[i] = j;
  }
  const compact = new Float32Array(sourceIndex.length * 3);
  sourceIndex.forEach((src, i) => compact.set(positions.subarray(src * 3, src * 3 + 3), i * 3));
  return { positions: compact, indices: out, sourceIndex: new Uint32Array(sourceIndex) };
}

/** Edges used by exactly one triangle: the rim of an open mesh. */
export function boundaryEdges(indices: Uint32Array): [number, number][] {
  const count = new Map<string, [number, number, number]>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k], b = indices[t + ((k + 1) % 3)];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const entry = count.get(key);
      if (entry) entry[2]++;
      else count.set(key, [a, b, 1]);
    }
  }
  return [...count.values()].filter(([, , n]) => n === 1).map(([a, b]) => [a, b]);
}

/** Each vertex's one-ring of neighbours. */
export function vertexNeighbours(indices: Uint32Array, vertexCount: number) {
  const rings = Array.from({ length: vertexCount }, () => new Set<number>());
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k], b = indices[t + ((k + 1) % 3)];
      rings[a].add(b);
      rings[b].add(a);
    }
  }
  return rings;
}

/** For each vertex, the first vertex with exactly the same position (seams split vertices, not surfaces). */
export function weldMap(positions: Float32Array) {
  const first = new Map<string, number>();
  const out = new Uint32Array(positions.length / 3);
  for (let i = 0; i < out.length; i++) {
    const key = `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`;
    const j = first.get(key);
    if (j === undefined) first.set(key, i);
    out[i] = j ?? i;
  }
  return out;
}

/** Distance from (x, y) to the nearest of a list of 2D segments packed as x0, y0, x1, y1. */
export function distanceToSegments2D(x: number, y: number, segments: Float32Array) {
  let best = Infinity;
  for (let i = 0; i < segments.length; i += 4) {
    const ax = segments[i], ay = segments[i + 1];
    const dx = segments[i + 2] - ax, dy = segments[i + 3] - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / lenSq)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** How many of the included triangles face away from +z (negative signed area seen from the front). */
export function foldedTriangles(positions: Float32Array, indices: Uint32Array, include: (triangle: number) => boolean) {
  let folded = 0;
  for (let t = 0; t < indices.length / 3; t++) {
    if (!include(t)) continue;
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const area =
      (positions[b] - positions[a]) * (positions[c + 1] - positions[a + 1]) -
      (positions[c] - positions[a]) * (positions[b + 1] - positions[a + 1]);
    if (area < 0) folded++;
  }
  return folded;
}

/** A mesh's rim as 2D segments packed x0, y0, x1, y1, from per-vertex x, y points. */
export function rimSegments(points: Float32Array, edges: [number, number][]) {
  return new Float32Array(edges.flatMap(([a, b]) => [points[a * 2], points[a * 2 + 1], points[b * 2], points[b * 2 + 1]]));
}
