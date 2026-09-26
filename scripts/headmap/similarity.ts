import type { Vec3 } from "./ray.ts";

/** p ↦ scale · rotation · p + translation, with `rotation` a row-major 3×3 matrix. */
export interface Similarity {
  scale: number;
  rotation: number[];
  translation: Vec3;
}

export const IDENTITY: Similarity = { scale: 1, rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] };

export function applySimilarity({ scale, rotation: r, translation: t }: Similarity, [x, y, z]: Vec3): Vec3 {
  return [
    scale * (r[0] * x + r[1] * y + r[2] * z) + t[0],
    scale * (r[3] * x + r[4] * y + r[5] * z) + t[1],
    scale * (r[6] * x + r[7] * y + r[8] * z) + t[2],
  ];
}

/** The transform that applies `inner`, then `outer`. */
export function composeSimilarity(outer: Similarity, inner: Similarity): Similarity {
  const a = outer.rotation, b = inner.rotation;
  const rotation = new Array<number>(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) rotation[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return { scale: outer.scale * inner.scale, rotation, translation: applySimilarity(outer, inner.translation) };
}

/**
 * Least-squares similarity mapping each `src[i]` onto `dst[i]` (Horn's quaternion method, with
 * Umeyama's scale). Needs at least three non-collinear pairs.
 */
export function similarityFromPairs(src: Vec3[], dst: Vec3[], { scale = true } = {}): Similarity {
  const n = src.length;
  const ms = centroid(src), md = centroid(dst);
  // Cross-covariance S[a][b] = Σ (src − ms)[a] · (dst − md)[b]
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let srcSpread = 0;
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < 3; a++) {
      const sa = src[i][a] - ms[a];
      srcSpread += sa * sa;
      for (let b = 0; b < 3; b++) S[a * 3 + b] += sa * (dst[i][b] - md[b]);
    }
  }
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const [w, x, y, z] = largestEigenvector(N);
  const rotation = [
    w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z,
  ];
  let s = 1;
  if (scale) {
    // Σ (dst − md) · R (src − ms) = Σ_ab R[b][a] S[a][b]
    let dot = 0;
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) dot += rotation[b * 3 + a] * S[a * 3 + b];
    s = dot / srcSpread;
  }
  const rotated = applySimilarity({ scale: s, rotation, translation: [0, 0, 0] }, ms);
  return { scale: s, rotation, translation: [md[0] - rotated[0], md[1] - rotated[1], md[2] - rotated[2]] };
}

function centroid(points: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const p of points) for (let k = 0; k < 3; k++) c[k] += p[k] / points.length;
  return c;
}

/** Cyclic Jacobi eigen-decomposition of a symmetric 4×4 matrix; returns the unit eigenvector of the largest eigenvalue. */
function largestEigenvector(input: number[][]): number[] {
  const a = input.map((row) => [...row]);
  const v = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p][q] * a[p][q];
    if (off < 1e-30) break;
    for (let p = 0; p < 4; p++) {
      for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 4; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 4; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 4; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i][i] > a[best][best]) best = i;
  const vec = v.map((row) => row[best]);
  const len = Math.hypot(...vec);
  return vec.map((x) => x / len);
}
