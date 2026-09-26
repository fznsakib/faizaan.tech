export type Vec3 = [number, number, number];

export interface TriangleHit {
  /** Signed distance along the ray; negative when the triangle is behind the origin. */
  t: number;
  /** Barycentric weights of the second and third vertex. */
  u: number;
  v: number;
}

const EPSILON = 1e-12;
/** Barycentric slack, so a ray exactly on a shared edge or vertex hits a triangle instead of slipping between both. */
const EDGE = 1e-9;

/** Möller–Trumbore, two-sided, along the whole line (both directions); edges and corners count as inside. */
export function intersectRayTriangle(origin: Vec3, dir: Vec3, a: Vec3, b: Vec3, c: Vec3): TriangleHit | null {
  const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
  const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  const px = dir[1] * e2z - dir[2] * e2y;
  const py = dir[2] * e2x - dir[0] * e2z;
  const pz = dir[0] * e2y - dir[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < EPSILON) return null;
  const inv = 1 / det;
  const sx = origin[0] - a[0], sy = origin[1] - a[1], sz = origin[2] - a[2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < -EDGE || u > 1 + EDGE) return null;
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = (dir[0] * qx + dir[1] * qy + dir[2] * qz) * inv;
  if (v < -EDGE || u + v > 1 + EDGE) return null;
  return { t: (e2x * qx + e2y * qy + e2z * qz) * inv, u, v };
}

export interface GridHit extends TriangleHit {
  triangle: number;
  point: Vec3;
}

/**
 * Casts rays parallel to one coordinate axis against a triangle mesh. Triangles are binned by
 * their footprint on the plane across that axis, so each ray only tests the triangles under it.
 */
export class AxisRayGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly dir: Vec3 = [0, 0, 0];
  private readonly a: Vec3 = [0, 0, 0];
  private readonly b: Vec3 = [0, 0, 0];
  private readonly c: Vec3 = [0, 0, 0];
  private readonly positions: Float32Array;
  private readonly indices: Uint32Array;
  private readonly axis: 0 | 1 | 2;
  private readonly cellSize: number;

  constructor(positions: Float32Array, indices: Uint32Array, axis: 0 | 1 | 2, cellSize: number) {
    this.positions = positions;
    this.indices = indices;
    this.axis = axis;
    this.cellSize = cellSize;
    this.dir[axis] = 1;
    const [p, q] = this.across();
    for (let tri = 0; tri < indices.length / 3; tri++) {
      let minP = Infinity, maxP = -Infinity, minQ = Infinity, maxQ = -Infinity;
      for (let k = 0; k < 3; k++) {
        const i = indices[tri * 3 + k] * 3;
        minP = Math.min(minP, positions[i + p]);
        maxP = Math.max(maxP, positions[i + p]);
        minQ = Math.min(minQ, positions[i + q]);
        maxQ = Math.max(maxQ, positions[i + q]);
      }
      for (let cp = this.cell(minP); cp <= this.cell(maxP); cp++) {
        for (let cq = this.cell(minQ); cq <= this.cell(maxQ); cq++) {
          const key = this.key(cp, cq);
          const list = this.cells.get(key);
          if (list) list.push(tri);
          else this.cells.set(key, [tri]);
        }
      }
    }
  }

  /** The hit closest to `origin` on the line through it along the axis, or null if the line misses. */
  nearest(origin: Vec3): GridHit | null {
    return this.pick(origin, (hit, best) => Math.abs(hit.t) < Math.abs(best.t));
  }

  /** The hit furthest along the axis on the line through `origin` (the surface seen from that end). */
  front(origin: Vec3): GridHit | null {
    return this.pick(origin, (hit, best) => hit.t > best.t);
  }

  private pick(origin: Vec3, better: (hit: TriangleHit, best: TriangleHit) => boolean): GridHit | null {
    const [p, q] = this.across();
    const list = this.cells.get(this.key(this.cell(origin[p]), this.cell(origin[q])));
    if (!list) return null;
    let best: GridHit | null = null;
    for (const tri of list) {
      this.load(tri);
      const hit = intersectRayTriangle(origin, this.dir, this.a, this.b, this.c);
      if (hit && (!best || better(hit, best))) {
        const point: Vec3 = [origin[0], origin[1], origin[2]];
        point[this.axis] += hit.t;
        best = { ...hit, triangle: tri, point };
      }
    }
    return best;
  }

  private across(): [number, number] {
    return [(this.axis + 1) % 3, (this.axis + 2) % 3];
  }

  private cell(x: number) {
    return Math.floor(x / this.cellSize);
  }

  private key(cp: number, cq: number) {
    return (cp + 32768) * 65536 + (cq + 32768);
  }

  private load(tri: number) {
    const ids = this.indices, pos = this.positions;
    for (const [k, out] of [this.a, this.b, this.c].entries()) {
      const i = ids[tri * 3 + k] * 3;
      out[0] = pos[i];
      out[1] = pos[i + 1];
      out[2] = pos[i + 2];
    }
  }
}
