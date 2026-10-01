import type { Vec3 } from "./ray.ts";

/** The most forward (+z) point inside an elliptical x/y window. */
export function findNoseTip(positions: Float32Array, { centre, radii }: { centre: [number, number]; radii: [number, number] }): Vec3 {
  let best: Vec3 = [NaN, NaN, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    const dx = (positions[i] - centre[0]) / radii[0];
    const dy = (positions[i + 1] - centre[1]) / radii[1];
    if (dx * dx + dy * dy <= 1 && positions[i + 2] > best[2]) best = [positions[i], positions[i + 1], positions[i + 2]];
  }
  return best;
}

/**
 * Walks down the midline from the nose tip in `step` bands and returns the height of the last band
 * whose front surface is still within `depth` of the nose tip: below it the surface falls away under
 * the chin (or the mesh ends). NaN when the nose tip is not a real point.
 */
export function findChinY(positions: Float32Array, nose: Vec3, { halfWidth, depth, step }: { halfWidth: number; depth: number; step: number }) {
  let bottom = Infinity;
  for (let i = 1; i < positions.length; i += 3) bottom = Math.min(bottom, positions[i]);
  let chin = nose.every(Number.isFinite) ? nose[1] : NaN;
  for (let y = chin - step; y >= bottom - step / 2; y -= step) {
    let front = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      if (Math.abs(positions[i] - nose[0]) < halfWidth && Math.abs(positions[i + 1] - y) <= step / 2) front = Math.max(front, positions[i + 2]);
    }
    if (front < nose[2] - depth) return chin;
    chin = y;
  }
  return chin;
}

/** Nearest-point queries over a point cloud, bucketed into cubic cells. */
export class PointGrid {
  private readonly cells = new Map<string, number[]>();
  private readonly points: Float32Array;
  private readonly cellSize: number;

  constructor(points: Float32Array, cellSize: number) {
    this.points = points;
    this.cellSize = cellSize;
    for (let i = 0; i < points.length / 3; i++) {
      const key = this.key(this.cell(points[i * 3]), this.cell(points[i * 3 + 1]), this.cell(points[i * 3 + 2]));
      const list = this.cells.get(key);
      if (list) list.push(i);
      else this.cells.set(key, [i]);
    }
  }

  /** Index of the point nearest `p`, or -1 if none is within `maxRadius`. */
  nearest(p: Vec3, maxRadius: number) {
    const [ci, cj, ck] = [this.cell(p[0]), this.cell(p[1]), this.cell(p[2])];
    let best = -1, bestDistSq = maxRadius * maxRadius;
    for (let r = 0; (r - 1) * this.cellSize <= Math.sqrt(bestDistSq); r++) {
      for (let a = -r; a <= r; a++) {
        for (let b = -r; b <= r; b++) {
          for (let c = -r; c <= r; c++) {
            if (Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) !== r) continue;
            const list = this.cells.get(this.key(ci + a, cj + b, ck + c));
            if (!list) continue;
            for (const i of list) {
              const dx = this.points[i * 3] - p[0], dy = this.points[i * 3 + 1] - p[1], dz = this.points[i * 3 + 2] - p[2];
              const d = dx * dx + dy * dy + dz * dz;
              if (d <= bestDistSq) {
                bestDistSq = d;
                best = i;
              }
            }
          }
        }
      }
    }
    return best;
  }

  private cell(x: number) {
    return Math.floor(x / this.cellSize);
  }

  private key(i: number, j: number, k: number) {
    return `${i},${j},${k}`;
  }
}
