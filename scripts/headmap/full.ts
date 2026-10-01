import { MeshoptSimplifier } from "meshoptimizer";

import { rasterizeTriangle } from "./atlas.ts";
import { fitColourModel, hairness } from "./colour.ts";
import { smoothstep } from "./falloff.ts";
import { smoothScalar } from "./field.ts";
import { findChinY, findNoseTip } from "./landmarks.ts";
import { compactMesh, largestComponent, vertexNeighbours, weldMap } from "./mesh.ts";
import { vertexNormals } from "./surface.ts";
import { dilate, sampleRgb } from "./texture.ts";
import { bounds, count, point } from "./transfer.ts";

import type { Vec3 } from "./ray.ts";

/*
 * The full-capture path: a 360° scan already has the whole head, so it ships as it is — cropped to the head and neck,
 * scaled and placed like the stock head, with its own texture (masked to the head, so nothing of the room or the shirt
 * ships) — and nothing is synthesized.
 */

/**
 * The share of directions around `centre` (y up) in which the mesh has surface within `radius`: equal-area bins over the
 * sphere, leaving out the downward cone where a head scan opens into the neck. A closed head is ~1; a front-only capture,
 * which has nothing behind the head, ~0.5 (a room behind it is further than `radius`).
 */
export function directionalCoverage(positions: Float32Array, indices: Uint32Array, centre: Vec3, radius: number, [cols, rows] = [64, 32]) {
  const covered = new Uint8Array(cols * rows);
  const counted = (row: number) => row < rows * 0.75; // cos θ ≥ −0.5
  const mark = (x: number, y: number, z: number) => {
    const dx = x - centre[0], dy = y - centre[1], dz = z - centre[2];
    const d = Math.hypot(dx, dy, dz);
    if (d === 0 || d > radius) return;
    const row = Math.min(rows - 1, Math.floor(((1 - dy / d) / 2) * rows));
    const col = Math.min(cols - 1, Math.floor(((Math.atan2(dx, dz) + Math.PI) / (2 * Math.PI)) * cols));
    covered[row * cols + col] = 1;
  };
  const steps = 4;
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => point(positions, indices[t + k]));
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; i + j <= steps; j++) {
        const u = i / steps, v = j / steps, w = 1 - u - v;
        mark(w * a[0] + u * b[0] + v * c[0], w * a[1] + u * b[1] + v * c[1], w * a[2] + u * b[2] + v * c[2]);
      }
    }
  }
  let hit = 0, all = 0;
  for (let row = 0; row < rows; row++) {
    if (!counted(row)) continue;
    for (let col = 0; col < cols; col++) {
      all++;
      hit += covered[row * cols + col];
    }
  }
  return hit / all;
}

/**
 * A sphere around a head, from its nose tip and L (nose tip to chin, y up, face toward +z): by the usual proportions the
 * crown is ~2.6 L above the nose tip and the back of the head ~4.6 L behind it, so the centre sits 0.8 L up and 2.4 L
 * back, and 3.3 L holds the head with its hair while leaving out a wall behind it.
 */
export function headBounds(nose: Vec3, L: number, radius = 3.3) {
  return { centre: [nose[0], nose[1] + 0.8 * L, nose[2] - 2.4 * L] as Vec3, radius: radius * L };
}

/**
 * A scan's nose tip, chin height and L, unless given: on its largest connected piece (so a floating room or floor never
 * counts), the most forward point in the upper part of it (a head-and-shoulders scan's chest can reach further forward
 * than the nose, but it sits lower).
 */
export function headLandmarks(positions: Float32Array, indices: Uint32Array, p: Pick<FullParams, "nose" | "chin" | "chinDepth">, canon = weldMap(positions)) {
  const piece = compactMesh(positions, largestComponent(indices, count(positions), canon));
  const box = bounds(piece.positions);
  const h = box.max[1] - box.min[1];
  const nose =
    p.nose ??
    findNoseTip(piece.positions, {
      centre: [(box.min[0] + box.max[0]) / 2, box.min[1] + 0.7 * h],
      radii: [(box.max[0] - box.min[0]) / 4, 0.3 * h],
    });
  const chinY = p.chin ?? findChinY(piece.positions, nose, { halfWidth: 0.004, depth: p.chinDepth, step: 0.0025 });
  const L = nose[1] - chinY;
  if (!nose.every(Number.isFinite) || !(L > 0)) throw new Error(`couldn't find the capture's nose and chin (L ${L}); pass --nose x,y,z and --chin y`);
  return { nose, chinY, L };
}

export interface FullParams {
  nose?: Vec3;
  chin?: number;
  chinDepth: number;
  /** Crop below the chin by this many L (the shoulders go). */
  neck: number;
  /** Crop beyond this many L from the head's centre (the room goes); see headBounds. */
  radius: number;
  maxTriangles: number;
  maxTexture: number;
}

export const FULL_DEFAULTS: FullParams = { chinDepth: 0.03, neck: 0.9, radius: 3.3, maxTriangles: 100000, maxTexture: 2048 };

export interface CaptureWithPhoto {
  positions: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array;
  image: { data: Uint8Array; width: number; height: number };
}

/**
 * A closed capture as the skin head: `target` is the stock head's nose tip and L (face frame, its units), which the
 * capture's are scaled and moved onto (the capture must be upright and face +z, as the scanning apps export it).
 */
export async function fullCapture(capture: CaptureWithPhoto, target: { nose: Vec3; L: number }, p: FullParams, log: (line: string) => void) {
  await MeshoptSimplifier.ready;
  const n = count(capture.positions);
  const canon = weldMap(capture.positions);

  // 1. Landmarks.
  const { nose, chinY, L } = headLandmarks(capture.positions, capture.indices, p, canon);
  log(`full capture: nose ${nose.map((v) => v.toFixed(4)).join(", ")}, chin y ${chinY.toFixed(4)}, L ${L.toFixed(4)}`);

  // 2. Crop: the head and the top of the neck, nothing further from the head's centre than `radius`.
  const { centre, radius } = headBounds(nose, L, p.radius);
  const keep = (i: number) => {
    const [x, y, z] = point(capture.positions, i);
    return y >= chinY - p.neck * L && Math.hypot(x - centre[0], y - centre[1], z - centre[2]) <= radius;
  };
  const cut: number[] = [];
  for (let t = 0; t < capture.indices.length; t += 3) {
    if (keep(capture.indices[t]) && keep(capture.indices[t + 1]) && keep(capture.indices[t + 2])) cut.push(capture.indices[t], capture.indices[t + 1], capture.indices[t + 2]);
  }
  let kept = largestComponent(new Uint32Array(cut), n, canon);
  log(`crop: ${kept.length / 3} of ${capture.indices.length / 3} triangles (head and neck)`);
  if (kept.length === 0) throw new Error("the crop kept nothing of the capture; check --nose and --chin");

  // 3. Fewer triangles if the scan is denser than the stock head (UV seams stay put).
  if (kept.length / 3 > p.maxTriangles) {
    const [simplified] = MeshoptSimplifier.simplify(kept, capture.positions, 3, p.maxTriangles * 3, 0.005);
    log(`simplify: ${kept.length / 3} → ${simplified.length / 3} triangles`);
    kept = simplified;
  }
  const mesh = compactMesh(capture.positions, kept);
  const m = count(mesh.positions);

  // 4. Onto the stock head: nose tip on its nose tip, L to its L.
  const s = target.L / L;
  const positions = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < 3; k++) positions[i * 3 + k] = target.nose[k] + (mesh.positions[i * 3 + k] - nose[k]) * s;
  }
  const uvs = new Float32Array(m * 2);
  mesh.sourceIndex.forEach((src, i) => uvs.set(capture.uvs.subarray(src * 2, src * 2 + 2), i * 2));
  const meshCanon = weldMap(positions);
  const welded = mesh.indices.map((i) => meshCanon[i]);
  const smooth = vertexNormals(positions, welded);
  const normals = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) normals.set(smooth.subarray(meshCanon[i] * 3, meshCanon[i] * 3 + 3), i * 3);

  // 5. The texture: at most maxTexture, and only what lies under the kept triangles (the rest dilated from its edge).
  let image = capture.image;
  while (image.width > p.maxTexture || image.height > p.maxTexture) image = halve(image);
  const size = image.width;
  const rgb = new Float32Array(size * image.height * 3);
  const under = new Uint8Array(size * image.height);
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => [uvs[mesh.indices[t + k] * 2] * size, uvs[mesh.indices[t + k] * 2 + 1] * image.height] as [number, number]);
    rasterizeTriangle(a, b, c, size, image.height, (x, y) => {
      const i = y * size + x;
      under[i] = 1;
      rgb.set(image.data.subarray(i * 4, i * 4 + 3), i * 3);
    });
  }
  // A texel's worth of margin around every triangle, so filtering at the chart edges reads the photo, not the fill.
  const grown = under.slice();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < size; x++) {
      if (under[y * size + x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= size || yy >= image.height || !under[yy * size + xx]) continue;
        grown[y * size + x] = 1;
        rgb.set(image.data.subarray((y * size + x) * 4, (y * size + x) * 4 + 3), (y * size + x) * 3);
        break;
      }
    }
  }
  const padded = dilate(rgb, grown, size, image.height, 8);
  const atlas = new Uint8Array(size * image.height * 4);
  for (let i = 0; i < size * image.height; i++) atlas.set([padded[i * 3], padded[i * 3 + 1], padded[i * 3 + 2], 255].map(Math.round), i * 4);

  // 6. Hair: the capture's own colours, told apart by models of its skin (around the nose) and hair (the crown).
  const skinSamples: number[][] = [], hairSamples: number[][] = [];
  const colourAt = (i: number) => sampleRgb(atlas, size, image.height, uvs[i * 2], uvs[i * 2 + 1]);
  for (let i = 0; i < m; i++) {
    const [x, y] = [positions[i * 3] - target.nose[0], positions[i * 3 + 1] - target.nose[1]];
    if (normals[i * 3 + 2] > 0.5 && Math.abs(x) < 0.5 * target.L && y > -0.3 * target.L && y < 0.5 * target.L) skinSamples.push(colourAt(i));
    if (y > 1.8 * target.L) hairSamples.push(colourAt(i));
  }
  let hair = new Float32Array(m);
  if (skinSamples.length >= 30 && hairSamples.length >= 30) {
    const skin = fitColourModel(skinSamples), hairModel = fitColourModel(hairSamples);
    for (let i = 0; i < m; i++) hair[i] = smoothstep(0.35, 0.65, hairness(colourAt(i), skin, hairModel));
    hair = smoothScalar(hair, vertexNeighbours(welded, m), 4);
    for (let i = 0; i < m; i++) hair[i] = hair[meshCanon[i]];
  }
  log(`full capture: ${m} vertices, ${mesh.indices.length / 3} triangles, ${size}×${image.height} texture from the capture's own`);
  return { positions, normals, indices: mesh.indices, uvs, hair, atlas, atlasSize: size, atlasHeight: image.height, captureL: L };
}

/** Half the size, averaging each 2×2 block. */
function halve(image: { data: Uint8Array; width: number; height: number }) {
  const width = image.width >> 1, height = image.height >> 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 4; k++) {
        const at = (dx: number, dy: number) => image.data[((2 * y + dy) * image.width + 2 * x + dx) * 4 + k];
        data[(y * width + x) * 4 + k] = Math.round((at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4);
      }
    }
  }
  return { data, width, height };
}
