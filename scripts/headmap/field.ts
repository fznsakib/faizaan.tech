/*
 * Fields over a mesh's vertices (one-rings from `vertexNeighbours`): continuing known values across the unknown
 * rest, and smoothing.
 */

/**
 * Fills the unknown vertices (known[i] = 0) with the harmonic interpolation of the known ones: each unknown ends up
 * the average of its neighbours, so values spread smoothly away from where they were measured. `values` holds
 * `stride` components per vertex; known values never change. Unknowns start at their nearest known value (breadth
 * first), then `iterations` Jacobi passes relax them; a region no known value reaches takes `fallback`.
 */
export function harmonicFill(
  values: Float32Array,
  known: Uint8Array,
  rings: Set<number>[],
  stride: number,
  { iterations, fallback }: { iterations: number; fallback?: number[] }
) {
  const n = rings.length;
  let current = values.slice();
  const reached = known.slice();
  let frontier: number[] = [];
  for (let i = 0; i < n; i++) if (known[i]) frontier.push(i);
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const j of rings[i]) {
        if (reached[j]) continue;
        reached[j] = 1;
        current.set(current.subarray(i * stride, i * stride + stride), j * stride);
        next.push(j);
      }
    }
    frontier = next;
  }
  const free: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!reached[i]) current.set(fallback ?? new Array(stride).fill(0), i * stride);
    else if (!known[i] && rings[i].size > 0) free.push(i);
  }
  let next = current.slice();
  for (let it = 0; it < iterations; it++) {
    for (const i of free) {
      for (let k = 0; k < stride; k++) {
        let sum = 0;
        for (const j of rings[i]) sum += current[j * stride + k];
        next[i * stride + k] = sum / rings[i].size;
      }
    }
    [current, next] = [next, current];
  }
  return current;
}

/** `passes` of Laplacian smoothing of a scalar field: each vertex moves halfway to its neighbours' mean. */
export function smoothScalar(values: Float32Array, rings: Set<number>[], passes: number) {
  let current = values.slice();
  let next = values.slice();
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < current.length; i++) {
      if (rings[i].size === 0) {
        next[i] = current[i];
        continue;
      }
      let sum = 0;
      for (const j of rings[i]) sum += current[j];
      next[i] = 0.5 * current[i] + (0.5 * sum) / rings[i].size;
    }
    [current, next] = [next, current];
  }
  return current;
}

/** Shortest distance along the mesh's edges from the nearest source vertex (Dijkstra); Infinity where none reaches. */
export function geodesicDistance(positions: Float32Array, rings: Set<number>[], sources: Uint8Array) {
  const dist = new Float32Array(rings.length).fill(Infinity);
  // A binary min-heap of [distance, vertex]; stale entries are skipped when popped.
  const heap: [number, number][] = [];
  const push = (d: number, v: number) => {
    heap.push([d, v]);
    for (let i = heap.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  for (let i = 0; i < rings.length; i++) {
    if (!sources[i]) continue;
    dist[i] = 0;
    push(0, i);
  }
  while (heap.length > 0) {
    const [d, v] = pop();
    if (d > dist[v]) continue;
    for (const j of rings[v]) {
      const step = Math.hypot(positions[j * 3] - positions[v * 3], positions[j * 3 + 1] - positions[v * 3 + 1], positions[j * 3 + 2] - positions[v * 3 + 2]);
      if (d + step < dist[j]) {
        dist[j] = d + step;
        push(dist[j], j);
      }
    }
  }
  return dist;
}

/** Copies each vertex's canonical twin's `stride` values onto it (seam duplicates share a position, so a value). */
export function copyToTwins(values: Float32Array, canon: Uint32Array, stride: number) {
  for (let i = 0; i < canon.length; i++) {
    if (canon[i] !== i) values.set(values.subarray(canon[i] * stride, canon[i] * stride + stride), i * stride);
  }
  return values;
}
