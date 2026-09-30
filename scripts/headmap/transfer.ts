import { smoothstep, transferWeight } from "./falloff.ts";
import { blurHeightField, sampleBilinear } from "./heightfield.ts";
import { findChinY, findNoseTip, PointGrid } from "./landmarks.ts";
import {
  boundaryEdges,
  compactMesh,
  cropTriangles,
  distanceToSegments2D,
  foldedTriangles,
  insideCrop,
  largestComponent,
  rimSegments,
  vertexNeighbours,
  weldMap,
} from "./mesh.ts";
import { AxisRayGrid } from "./ray.ts";
import { applySimilarity, similarityFromPairs } from "./similarity.ts";
import { changedNeighbourhood, smoothMasked, smoothRim, vertexNormals } from "./surface.ts";
import { fitThinPlate } from "./thinplate.ts";

import type { CropParams } from "./mesh.ts";
import type { Vec3 } from "./ray.ts";
import type { Similarity } from "./similarity.ts";

/*
 * The shared first half of `yarn headmap`: find the landmarks, crop the capture to the face, align it to the stock
 * head, erase the stock's own features and transfer the face's shape onto it. Both heads start here; the copper head
 * then bakes the face skin, the skin head goes on to the hair and the whole-head atlas.
 *
 * Everything works in the "face frame": x = the viewer's right, y = up, +z = toward the camera. Crop and blend sizes
 * are in units of L, the nose-tip-to-chin height of each mesh.
 */

export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

export interface TransferParams {
  /** Capture nose tip; found when absent. */
  nose?: Vec3;
  /** Capture chin height; found when absent. */
  chin?: number;
  chinDepth: number;
  depth: number;
  window: [number, number];
  windowY: number;
  chinCut: number;
  top: number;
  margin: number;
  tolerance: number;
  icp: number;
  rimSmooth: number;
  blur: number;
  erase: [number, number];
  relax: number;
  faceSmooth: number;
  smooth: number;
}

/** The copper head's defaults: `yarn headmap --copper` with no other flags reproduces the committed head. */
export const COPPER_TRANSFER: TransferParams = {
  chinDepth: 0.03,
  depth: 0.9,
  window: [0.95, 1.3],
  windowY: 0.2,
  chinCut: 1.02,
  top: 1.0,
  margin: 0.45,
  tolerance: 1.2,
  icp: 10,
  rimSmooth: 20,
  blur: 0.03,
  erase: [0.8, 0.7],
  relax: 500,
  faceSmooth: 6,
  smooth: 2,
};

export interface Transfer {
  capNose: Vec3;
  capL: number;
  headNose: Vec3;
  headL: number;
  /** Capture → head face frame. */
  align: Similarity;
  /** The cropped face, welded (for connectivity), and the same triangles unwelded (keeping the photo's UVs). */
  face: MeshData;
  photoCrop: MeshData & { sourceIndex: Uint32Array };
  /** The welded face crop's positions after the alignment. */
  aligned: Float32Array;
  /** The crop's true, ragged edge in x/y (segments packed x0, y0, x1, y1): where the photo can show the room. */
  rawRim: Float32Array;
  /** The stock head with its face features erased (before the transfer), face frame, welded twins not yet copied. */
  erasedHead: Float32Array;
  /** The head's positions after the transfer, face frame, per (unwelded) vertex. */
  positions: Float32Array;
  /** The transfer weight per vertex: 1 on the scan, 0 on the stock head. */
  weights: Float32Array;
  /** The head's normals in its own scene space (z up), recomputed wherever the surface changed. */
  normals: Float32Array;
  /** Each vertex's first twin at the same stock position, the triangles over those, and their one-rings. */
  canon: Uint32Array;
  welded: Uint32Array;
  rings: Set<number>[];
}

export const toFace = ([x, y, z]: Vec3): Vec3 => [-x, z, y];

/**
 * Crop, align and transfer. `head` is in the face frame, `headNormals` in the stock scene space; `log` gets the
 * progress lines. Throws with a message naming the flag to change when a stage finds nothing to work with.
 */
export function transferFace(capture: MeshData, head: MeshData, headNormals: Float32Array, p: TransferParams, log: (line: string) => void): Transfer {
  // 2. Landmarks: nose tip, chin, and L on each mesh.
  const capBox = bounds(capture.positions);
  const capNose =
    p.nose ??
    findNoseTip(capture.positions, {
      centre: [(capBox.min[0] + capBox.max[0]) / 2, (capBox.min[1] + capBox.max[1]) / 2],
      radii: [(capBox.max[0] - capBox.min[0]) / 4, (capBox.max[1] - capBox.min[1]) / 2],
    });
  const capChinY = p.chin ?? findChinY(capture.positions, capNose, { halfWidth: 0.004, depth: p.chinDepth, step: 0.0025 });
  const capL = capNose[1] - capChinY;
  if (!capNose.every(Number.isFinite)) throw new Error("found no nose tip in the capture; pass --nose x,y,z");
  if (!(capL > 0)) throw new Error(`the capture's chin (y ${capChinY}) isn't below its nose tip (y ${capNose[1]}); pass --chin y`);
  const headBox = bounds(head.positions);
  const headNose = findNoseTip(head.positions, {
    centre: [0, (headBox.min[1] + headBox.max[1]) / 2],
    radii: [(headBox.max[0] - headBox.min[0]) / 4, (headBox.max[1] - headBox.min[1]) / 2],
  });
  const headChinY = findChinY(head.positions, headNose, { halfWidth: 0.3, depth: 3, step: 0.1 });
  const headL = headNose[1] - headChinY;
  if (!(headL > 0)) throw new Error(`couldn't find the base head's nose and chin (L ${headL}); is the base head intact?`);
  log(`capture landmarks: nose ${fmt(capNose)}, chin y ${capChinY.toFixed(4)}, L ${capL.toFixed(4)}`);
  log(`head landmarks:    nose ${fmt(headNose)}, chin y ${headChinY.toFixed(3)}, L ${headL.toFixed(3)}`);

  // 3. Crop the capture to the face: depth cut behind the nose, elliptical window, chin and hair cuts,
  //    then the largest connected piece (drops the loose islands and anything the cuts cut off).
  const crop: CropParams = {
    centre: [capNose[0], capNose[1] + p.windowY * capL],
    radii: [p.window[0] * capL, p.window[1] * capL],
    minDepth: capNose[2] - p.depth * capL,
    minY: capNose[1] - p.chinCut * capL,
    maxY: capNose[1] + p.top * capL,
  };
  // The scan splits vertices along its texture seams, so connectivity and the crop's rim use welded positions.
  const capCanon = weldMap(capture.positions);
  const cut = cropTriangles(capture.positions, capture.indices, (q) => insideCrop(q, crop));
  const kept = largestComponent(cut, count(capture.positions), capCanon);
  const face = compactMesh(capture.positions, kept.map((i) => capCanon[i]));
  const photoCrop = compactMesh(capture.positions, kept); // unwelded: keeps the photo's per-corner UVs
  log(`crop: ${cut.length / 3} triangles inside the cuts, ${face.indices.length / 3} in the largest piece, ${count(face.positions)} vertices`);
  if (face.indices.length < 300) throw new Error(`the crop kept ${face.indices.length / 3} triangles; loosen --depth, --window, --top or --chin-cut`);
  const faceRim = boundaryEdges(face.indices);

  // 4. Align: similarity from face-relative landmark samples, then ICP on the central face.
  const capGrid = new AxisRayGrid(capture.positions, capture.indices, 2, capL / 20);
  const headGrid = new AxisRayGrid(head.positions, head.indices, 2, headL / 20);
  const samples: [number, number][] = [[0, -0.9], [0, -0.45], [0, 0.45], [0, 0.9], [-0.5, 0], [0.5, 0]];
  const capMarks = [capNose, ...samples.map(([x, y]) => frontPoint(capGrid, capNose, capL, x, y))];
  const headMarks = [headNose, ...samples.map(([x, y]) => frontPoint(headGrid, headNose, headL, x, y))];
  let align = similarityFromPairs(capMarks, headMarks);
  log(`landmark fit: ${describe(align)}, rms ${rms(capMarks, headMarks, align).toFixed(3)}`);

  const centre: Vec3 = [capNose[0], capNose[1] + 0.2 * capL, 0];
  const icpSource: Vec3[] = [];
  for (let i = 0; i < count(face.positions); i++) {
    const q = point(face.positions, i);
    if (((q[0] - centre[0]) / (0.6 * capL)) ** 2 + ((q[1] - centre[1]) / (0.95 * capL)) ** 2 <= 1) icpSource.push(q);
  }
  const headFront = head.positions.filter((_, i) => head.positions[i - (i % 3) + 2] > headNose[2] - 1.2 * headL);
  const headPoints = new PointGrid(headFront, headL / 25);
  for (let it = 0; it < p.icp; it++) {
    const pairs: [Vec3, Vec3, number][] = [];
    for (const q of icpSource) {
      const moved = applySimilarity(align, q);
      const j = headPoints.nearest(moved, 0.3 * headL);
      if (j >= 0) {
        const r = point(headFront, j);
        pairs.push([q, r, Math.hypot(r[0] - moved[0], r[1] - moved[1], r[2] - moved[2])]);
      }
    }
    const median = pairs.map(([, , d]) => d).sort((a, b) => a - b)[pairs.length >> 1];
    const inliers = pairs.filter(([, , d]) => d <= 2.5 * median);
    if (inliers.length < 3) throw new Error(`ICP matched ${inliers.length} points to the head; check the landmarks (--nose, --chin) or pass --icp 0`);
    align = similarityFromPairs(inliers.map(([q]) => q), inliers.map(([, r]) => r));
    if (it === p.icp - 1)
      log(`icp: ${p.icp} iterations, ${inliers.length}/${icpSource.length} pairs, ${describe(align)}, ` +
        `rms ${rms(inliers.map(([q]) => q), inliers.map(([, r]) => r), align).toFixed(3)}`);
  }

  if (!(align.scale > 0) || !align.translation.every(Number.isFinite)) throw new Error(`the alignment failed (${describe(align)})`);

  // 5. Transfer. Each head vertex under the aligned face moves along z to the face's front surface (where the scan
  //    folds — the glasses' lens over an eye — the layer the camera saw), by a weight that fades to 0 at the crop's
  //    edge and where the face is too far from the head.
  const aligned = new Float32Array(face.positions.length);
  for (let i = 0; i < count(face.positions); i++) aligned.set(applySimilarity(align, point(face.positions, i)), i * 3);
  const faceGrid = new AxisRayGrid(aligned, face.indices, 2, headL / 25);
  // The rim follows the scan's triangles (and stray hair at the top): smooth it so the blend's contours are smooth.
  const rimPoints = smoothRim(aligned.filter((_, i) => i % 3 !== 2), faceRim, p.rimSmooth);
  const rim = rimSegments(rimPoints, faceRim);
  const rawRim = rimSegments(aligned.filter((_, i) => i % 3 !== 2), faceRim);
  const blend = { margin: p.margin * headL, tolerance: p.tolerance * headL };
  // The scan's front surface as a height field over its footprint, blurred: the transfer reads heights from it, so
  // the scan's folds (the glasses' lens over one eye) become slopes instead of cliffs, and its noise is calmed.
  const cell = headL / 60;
  const field = bounds(aligned);
  const gw = Math.ceil((field.max[0] - field.min[0]) / cell) + 1;
  const gh = Math.ceil((field.max[1] - field.min[1]) / cell) + 1;
  const heights = new Float32Array(gw * gh);
  const present = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const hit = faceGrid.front([field.min[0] + gx * cell, field.min[1] + gy * cell, 0]);
      if (hit) [heights[gy * gw + gx], present[gy * gw + gx]] = [hit.point[2], 1];
    }
  }
  const smoothHeights = blurHeightField(heights, present, gw, gh, (p.blur * headL) / cell);
  const scanHeight = (x: number, y: number) => sampleBilinear(smoothHeights, gw, gh, (x - field.min[0]) / cell, (y - field.min[1]) / cell);
  /** The blend weight, and the scan's height, for a point at (x, y) on a head surface at height z. */
  const sample = (x: number, y: number, z: number) => {
    if (!faceGrid.front([x, y, z])) return { w: 0, z };
    const height = scanHeight(x, y);
    return { w: transferWeight(distanceToSegments2D(x, y, rim), height - z, blend), z: height };
  };

  // Work on the welded head, so seam duplicates always move together; they copy their twin at the end.
  const canon = weldMap(head.positions);
  const welded = head.indices.map((i) => canon[i]);
  const rings = vertexNeighbours(welded, count(head.positions));

  // Erase the stock face's own features (eyes, nostrils, lips) first: otherwise wherever the blend is partial — the
  // owner's face is narrower than the stock's, so the stock's outer eye corners sit in the blend band — half a stock eye
  // shows through. Inside an ellipse over the stock's eyes, nose and mouth, its front surface is replaced by a
  // thin-plate spline through a ring of stock samples around the ellipse (forehead, cheeks, jaw): a featureless
  // mannequin face that continues its surroundings.
  const [eraseRx, eraseRy] = p.erase.map((k) => k * headL);
  /** Elliptical radius around the stock nose tip: 1 on the erase ellipse. */
  const rho = (x: number, y: number) => Math.hypot((x - headNose[0]) / eraseRx, (y - headNose[1]) / eraseRy);
  const stockFront = new AxisRayGrid(head.positions, welded, 2, headL / 25);
  const frontZ = (x: number, y: number) => stockFront.front([x, y, headNose[2]])?.point[2];
  const ringSamples: Vec3[] = [];
  for (let x = headNose[0] - 1.25 * eraseRx; x <= headNose[0] + 1.25 * eraseRx; x += headL / 15) {
    for (let y = headNose[1] - 1.25 * eraseRy; y <= headNose[1] + 1.25 * eraseRy; y += headL / 15) {
      const z = frontZ(x, y);
      if (rho(x, y) >= 1 && rho(x, y) <= 1.25 && z !== undefined) ringSamples.push([x, y, z]);
    }
  }
  const mannequin = fitThinPlate(ringSamples, 0);
  const base = head.positions.slice();
  const erased = new Float32Array(count(base));
  let erasedCount = 0;
  for (let i = 0; i < count(base); i++) {
    if (canon[i] !== i) continue;
    const [x, y, z] = point(head.positions, i);
    const e = 1 - smoothstep(0.85, 1, rho(x, y));
    const front = frontZ(x, y);
    // The face's front layer and its folds (eyelids, the eyeballs behind them, nostrils), never the back of the head.
    if (e <= 0 || front === undefined || front - z > 0.6 * headL) continue;
    base[i * 3 + 2] = z + e * (mannequin(x, y) - z);
    erased[i] = e;
    erasedCount++;
  }
  log(`erase: ${erasedCount} stock face vertices flattened onto a spline through ${ringSamples.length} samples around them`);

  const weights = new Float32Array(count(head.positions));
  const naive = base.slice();
  for (let i = 0; i < weights.length; i++) {
    if (canon[i] !== i) continue;
    const s = sample(naive[i * 3], naive[i * 3 + 1], naive[i * 3 + 2]);
    weights[i] = s.w;
    naive[i * 3 + 2] += s.w * (s.z - naive[i * 3 + 2]);
  }
  // The stock eyelids, nostrils and lips fold over themselves, so dropped straight onto the scan they turn inside
  // out (dark gashes). Inside the face, first relax the head's vertices across x/y — which untangles the folds and
  // evens out their spacing — then drop each onto the scan again, blending with the stock surface under it.
  // Erased folds are flattened too, so they need untangling even where the scan's weight is low.
  const relaxWeights = weights.map((w, i) => Math.max(smoothstep(0.4, 0.9, w), erased[i]));
  const relaxed = smoothMasked(base, rings, relaxWeights, { passes: p.relax, lambda: 0.5, planar: true });
  const stockSurface = new AxisRayGrid(base, welded, 2, headL / 25);
  const moved = naive.slice();
  for (let i = 0; i < weights.length; i++) {
    if (canon[i] !== i || relaxWeights[i] === 0) continue;
    const x = relaxed[i * 3], y = relaxed[i * 3 + 1];
    const stockZ = stockSurface.front([x, y, base[i * 3 + 2]])?.point[2] ?? base[i * 3 + 2];
    const s = sample(x, y, stockZ);
    weights[i] = s.w;
    moved.set([x, y, stockZ + s.w * (s.z - stockZ)], i * 3);
  }
  const inFace = (t: number) => [0, 1, 2].every((k) => relaxWeights[welded[t * 3 + k]] > 0.5);
  const foldsBefore = foldedTriangles(naive, welded, inFace);
  const foldsAfter = foldedTriangles(moved, welded, inFace);

  // 6. Smooth: Taubin over the transferred face to calm what's left of the scan's noise, then Laplacian across the
  //    blend band (0 < w < 1).
  const calmed = smoothMasked(moved, rings, weights, { passes: p.faceSmooth, lambda: 0.5, mu: -0.53 });
  const band = weights.map((w) => 4 * w * (1 - w));
  const smoothed = smoothMasked(calmed, rings, band, { passes: p.smooth, lambda: 0.5 });
  for (let i = 0; i < canon.length; i++) {
    smoothed.set(smoothed.subarray(canon[i] * 3, canon[i] * 3 + 3), i * 3);
    weights[i] = weights[canon[i]];
  }

  // 7. Normals: recompute (welded) wherever the surface changed, keep the stock normals elsewhere.
  const fresh = vertexNormals(smoothed, welded);
  const normals = headNormals.slice();
  // Wherever the transfer, the erase or the relaxing moved a vertex or one of its neighbours.
  const changed = changedNeighbourhood(head.positions, smoothed, rings);
  let touched = 0;
  for (let i = 0; i < canon.length; i++) {
    const c = canon[i];
    if (!changed[c]) continue;
    touched++;
    normals.set(toFace(point(fresh, c)), i * 3); // the face-frame map is its own inverse
  }

  const movedCount = weights.filter((w) => w > 1e-3).length;
  const fullCount = weights.filter((w) => w > 0.99).length;
  let maxShift = 0;
  for (let i = 0; i < weights.length; i++) {
    const shift = Math.hypot(...[0, 1, 2].map((k) => smoothed[i * 3 + k] - head.positions[i * 3 + k]));
    maxShift = Math.max(maxShift, shift);
  }
  log(
    `transfer: ${movedCount} head vertices moved (${pct(movedCount, weights.length)} of the head), ` +
      `${fullCount} fully onto the scan; max shift ${(maxShift / headL).toFixed(3)} L; ` +
      `inside-out face triangles ${foldsBefore} → ${foldsAfter} after relaxing; ${touched} normals recomputed`
  );
  if (movedCount === 0) throw new Error("no head vertex moved: the aligned capture doesn't cover the head's face");

  return { capNose, capL, headNose, headL, align, face, photoCrop, aligned, rawRim, erasedHead: base, positions: smoothed, weights, normals, canon, welded, rings };
}

/** The front-most point on a mesh at face-relative offset (x, y)·L from the nose tip. */
function frontPoint(grid: AxisRayGrid, nose: Vec3, L: number, x: number, y: number): Vec3 {
  const hit = grid.front([nose[0] + x * L, nose[1] + y * L, nose[2]]);
  if (!hit) throw new Error(`no surface at (${x}, ${y})·L from the nose tip — pass --nose/--chin`);
  return hit.point;
}

function rms(src: Vec3[], dst: Vec3[], s: Similarity) {
  let sum = 0;
  src.forEach((q, i) => {
    const r = applySimilarity(s, q);
    sum += (r[0] - dst[i][0]) ** 2 + (r[1] - dst[i][1]) ** 2 + (r[2] - dst[i][2]) ** 2;
  });
  return Math.sqrt(sum / src.length);
}

export function describe({ scale, rotation: r, translation }: Similarity) {
  const deg = (v: number) => ((v * 180) / Math.PI).toFixed(1);
  // XYZ Euler angles of the row-major rotation: pitch about x, yaw about y, roll about z.
  const yaw = Math.asin(Math.max(-1, Math.min(1, r[2])));
  return `scale ${scale.toFixed(2)}, pitch ${deg(Math.atan2(-r[5], r[8]))}°, yaw ${deg(yaw)}°, ` +
    `roll ${deg(Math.atan2(-r[1], r[0]))}°, translation ${fmt(translation)}`;
}

export function point(positions: Float32Array, i: number): Vec3 {
  return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
}

export function count(positions: Float32Array) {
  return positions.length / 3;
}

export function bounds(positions: Float32Array) {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  return { min, max };
}

export function fmt(q: Vec3) {
  return `(${q.map((v) => v.toFixed(4)).join(", ")})`;
}

export function pct(n: number, of: number) {
  return `${((100 * n) / Math.max(1, of)).toFixed(1)}%`;
}
