import { mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import jpeg from "jpeg-js";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

import { isInside, parseFlags } from "./headmap/cli.ts";
import { smoothstep, transferWeight } from "./headmap/falloff.ts";
import { blurHeightField, sampleBilinear } from "./headmap/heightfield.ts";
import { findChinY, findNoseTip, PointGrid } from "./headmap/landmarks.ts";
import {
  boundaryEdges,
  compactMesh,
  cropTriangles,
  distanceToSegments2D,
  foldedTriangles,
  insideCrop,
  largestComponent,
  vertexNeighbours,
  weldMap,
} from "./headmap/mesh.ts";
import { AxisRayGrid } from "./headmap/ray.ts";
import { applySimilarity, similarityFromPairs } from "./headmap/similarity.ts";
import {
  changedNeighbourhood,
  quantizeNormals,
  quantizePositions,
  smoothMasked,
  smoothRim,
  vertexNormals,
} from "./headmap/surface.ts";
import { dilate, interpolateCorners, normalizedUint, sampleRgb } from "./headmap/texture.ts";
import { fitThinPlate } from "./headmap/thinplate.ts";

import type { CropParams } from "./headmap/mesh.ts";
import type { Vec3 } from "./headmap/ray.ts";
import type { Similarity } from "./headmap/similarity.ts";

/*
 * Everything below works in the "face frame": x = the viewer's right, y = up, +z = toward the camera.
 * The capture is already in it. The stock head's scene space is z-up with the face toward +y, which
 * maps to the face frame by (x, y, z) → (−x, z, y) — the same rotation Head's prepareModel applies,
 * and its own inverse.
 *
 * Crop and blend sizes are in units of L, the nose-tip-to-chin height of each mesh, so they carry over
 * to a rescan at a different scale.
 */

const USAGE = `usage: yarn headmap <capture.glb> [flags]
  --nose x,y,z        capture nose tip (default: most forward point near the middle)
  --chin y            capture chin height (default: where the midline falls away below the nose)
  --chin-depth d      capture units: how far behind the nose tip counts as "under the chin" (0.03)
  --depth k           crop: drop everything more than k·L behind the nose tip (0.9)
  --window rx,ry      crop: elliptical face window half-width, half-height, in L (0.95,1.3)
  --window-y k        crop: window centre k·L above the nose tip (0.2)
  --chin-cut k        crop: drop below k·L under the nose tip (1.02)
  --top k             crop: drop above k·L over the nose tip; the hairline is ~1.1 (1.0)
  --margin k          blend: weight rises 0→1 over k·L inside the crop edge (0.45)
  --tolerance k       blend: weight falls to 0 when the scan is k·L from the head (1.2)
  --icp n             alignment: ICP iterations after the landmark fit (10)
  --rim-smooth n      passes smoothing the crop's rim before measuring the blend from it (20)
  --blur k            Gaussian blur of the scan's height field, sigma in L: calms noise and folds (0.03)
  --erase rx,ry       the stock features erased before the transfer: ellipse radii around its nose, in L (0.8,0.7)
  --relax n           passes relaxing the head's face vertices across x/y before re-projecting (500)
  --face-smooth n     Taubin passes over the transferred face (6)
  --smooth n          Laplacian passes across the blend band (2)
  --debug dir         also write GLBs of the crop (with the capture's photo — keep dir outside the repo),
                      the aligned crop, the erased stock head and a weight map
  --out file          output (src/assets/head.glb; the face texture goes beside it as head-face.jpg)`;

/** Stops with a message naming what to change, instead of a stack trace or a broken head. */
function fail(message: string): never {
  console.error(`headmap: ${message}`);
  process.exit(1);
}

const FLAGS = {
  nose: "vec3",
  chin: "number",
  "chin-depth": "number",
  depth: "number",
  window: "pair",
  "window-y": "number",
  "chin-cut": "number",
  top: "number",
  margin: "number",
  tolerance: "number",
  icp: "count",
  "rim-smooth": "count",
  blur: "number",
  erase: "pair",
  relax: "count",
  "face-smooth": "count",
  smooth: "count",
  debug: "path",
  out: "path",
} as const;
let flags: ReturnType<typeof parseFlags<keyof typeof FLAGS>>;
try {
  flags = parseFlags(process.argv.slice(2), FLAGS);
} catch (error) {
  fail(`${(error as Error).message}\n${USAGE}`);
}
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const basePath = fileURLToPath(new URL("./assets/base-head.glb", import.meta.url));
const out = flags.string("out") ?? fileURLToPath(new URL("../src/assets/head.glb", import.meta.url));
const debugDir = flags.string("debug");
if (debugDir && isInside(debugDir, repoRoot)) fail("--debug writes the capture's photo; point it outside the repo");

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const toFace = ([x, y, z]: Vec3): Vec3 => [-x, z, y];
const identity = (p: Vec3) => p;

// 1. Read both meshes into the face frame.
const captureDoc = await io.read(flags.capture);
const capture = readMesh(captureDoc, identity);
const headDoc = await io.read(basePath);
const head = readMesh(headDoc, toFace);
console.log(`capture: ${count(capture.positions)} vertices, ${capture.indices.length / 3} triangles`);
console.log(`head:    ${count(head.positions)} vertices, ${head.indices.length / 3} triangles`);

// 2. Landmarks: nose tip, chin, and L on each mesh.
const capBox = bounds(capture.positions);
const capNose =
  flags.vec("nose") ??
  findNoseTip(capture.positions, {
    centre: [(capBox.min[0] + capBox.max[0]) / 2, (capBox.min[1] + capBox.max[1]) / 2],
    radii: [(capBox.max[0] - capBox.min[0]) / 4, (capBox.max[1] - capBox.min[1]) / 2],
  });
const capChinY =
  flags.number("chin") ??
  findChinY(capture.positions, capNose, { halfWidth: 0.004, depth: flags.number("chin-depth") ?? 0.03, step: 0.0025 });
const capL = capNose[1] - capChinY;
if (!capNose.every(Number.isFinite)) fail("found no nose tip in the capture; pass --nose x,y,z");
if (!(capL > 0)) fail(`the capture's chin (y ${capChinY}) isn't below its nose tip (y ${capNose[1]}); pass --chin y`);
const headBox = bounds(head.positions);
const headNose = findNoseTip(head.positions, {
  centre: [0, (headBox.min[1] + headBox.max[1]) / 2],
  radii: [(headBox.max[0] - headBox.min[0]) / 4, (headBox.max[1] - headBox.min[1]) / 2],
});
const headChinY = findChinY(head.positions, headNose, { halfWidth: 0.3, depth: 3, step: 0.1 });
const headL = headNose[1] - headChinY;
if (!(headL > 0)) fail(`couldn't find the base head's nose and chin (L ${headL}); is ${basePath} intact?`);
console.log(`capture landmarks: nose ${fmt(capNose)}, chin y ${capChinY.toFixed(4)}, L ${capL.toFixed(4)}`);
console.log(`head landmarks:    nose ${fmt(headNose)}, chin y ${headChinY.toFixed(3)}, L ${headL.toFixed(3)}`);

// 3. Crop the capture to the face: depth cut behind the nose, elliptical window, chin and hair cuts,
//    then the largest connected piece (drops the loose islands and anything the cuts cut off).
const window = flags.pair("window") ?? [0.95, 1.3];
const crop: CropParams = {
  centre: [capNose[0], capNose[1] + (flags.number("window-y") ?? 0.2) * capL],
  radii: [window[0] * capL, window[1] * capL],
  minDepth: capNose[2] - (flags.number("depth") ?? 0.9) * capL,
  minY: capNose[1] - (flags.number("chin-cut") ?? 1.02) * capL,
  maxY: capNose[1] + (flags.number("top") ?? 1.0) * capL,
};
// The scan splits vertices along its texture seams, so connectivity and the crop's rim use welded positions.
const capCanon = weldMap(capture.positions);
const cut = cropTriangles(capture.positions, capture.indices, (p) => insideCrop(p, crop));
const kept = largestComponent(cut, count(capture.positions), capCanon);
const face = compactMesh(capture.positions, kept.map((i) => capCanon[i]));
const photoCrop = compactMesh(capture.positions, kept); // unwelded: keeps the photo's per-corner UVs
console.log(
  `crop: ${cut.length / 3} triangles inside the cuts, ${face.indices.length / 3} in the largest piece, ` +
    `${count(face.positions)} vertices`
);
if (face.indices.length < 300) fail(`the crop kept ${face.indices.length / 3} triangles; loosen --depth, --window, --top or --chin-cut`);
const faceRim = boundaryEdges(face.indices);

// 4. Align: similarity from face-relative landmark samples, then ICP on the central face.
const capGrid = new AxisRayGrid(capture.positions, capture.indices, 2, capL / 20);
const headGrid = new AxisRayGrid(head.positions, head.indices, 2, headL / 20);
const samples: [number, number][] = [[0, -0.9], [0, -0.45], [0, 0.45], [0, 0.9], [-0.5, 0], [0.5, 0]];
const capMarks = [capNose, ...samples.map(([x, y]) => frontPoint(capGrid, capNose, capL, x, y))];
const headMarks = [headNose, ...samples.map(([x, y]) => frontPoint(headGrid, headNose, headL, x, y))];
let align = similarityFromPairs(capMarks, headMarks);
console.log(`landmark fit: ${describe(align)}, rms ${rms(capMarks, headMarks, align).toFixed(3)}`);

const centre: Vec3 = [capNose[0], capNose[1] + 0.2 * capL, 0];
const icpSource: Vec3[] = [];
for (let i = 0; i < count(face.positions); i++) {
  const p = point(face.positions, i);
  if (((p[0] - centre[0]) / (0.6 * capL)) ** 2 + ((p[1] - centre[1]) / (0.95 * capL)) ** 2 <= 1) icpSource.push(p);
}
const headFront = head.positions.filter((_, i) => head.positions[i - (i % 3) + 2] > headNose[2] - 1.2 * headL);
const headPoints = new PointGrid(headFront, headL / 25);
const iterations = flags.number("icp") ?? 10;
for (let it = 0; it < iterations; it++) {
  const pairs: [Vec3, Vec3, number][] = [];
  for (const p of icpSource) {
    const q = applySimilarity(align, p);
    const j = headPoints.nearest(q, 0.3 * headL);
    if (j >= 0) {
      const r = point(headFront, j);
      pairs.push([p, r, Math.hypot(r[0] - q[0], r[1] - q[1], r[2] - q[2])]);
    }
  }
  const median = pairs.map(([, , d]) => d).sort((a, b) => a - b)[pairs.length >> 1];
  const inliers = pairs.filter(([, , d]) => d <= 2.5 * median);
  if (inliers.length < 3) fail(`ICP matched ${inliers.length} points to the head; check the landmarks (--nose, --chin) or pass --icp 0`);
  align = similarityFromPairs(inliers.map(([p]) => p), inliers.map(([, r]) => r));
  if (it === iterations - 1)
    console.log(`icp: ${iterations} iterations, ${inliers.length}/${icpSource.length} pairs, ${describe(align)}, ` +
      `rms ${rms(inliers.map(([p]) => p), inliers.map(([, r]) => r), align).toFixed(3)}`);
}

if (!(align.scale > 0) || !align.translation.every(Number.isFinite)) fail(`the alignment failed (${describe(align)})`);

// 5. Transfer. Each head vertex under the aligned face moves along z to the face's front surface (where the scan
//    folds — the glasses' lens over an eye — the layer the camera saw), by a weight that fades to 0 at the crop's
//    edge and where the face is too far from the head.
const aligned = new Float32Array(face.positions.length);
for (let i = 0; i < count(face.positions); i++) aligned.set(applySimilarity(align, point(face.positions, i)), i * 3);
const faceGrid = new AxisRayGrid(aligned, face.indices, 2, headL / 25);
// The rim follows the scan's triangles (and stray hair at the top): smooth it so the blend's contours are smooth.
const rimPoints = smoothRim(
  aligned.filter((_, i) => i % 3 !== 2),
  faceRim,
  flags.number("rim-smooth") ?? 20
);
const rim = new Float32Array(
  faceRim.flatMap(([a, b]) => [rimPoints[a * 2], rimPoints[a * 2 + 1], rimPoints[b * 2], rimPoints[b * 2 + 1]])
);
const blend = { margin: (flags.number("margin") ?? 0.45) * headL, tolerance: (flags.number("tolerance") ?? 1.2) * headL };
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
const smoothHeights = blurHeightField(heights, present, gw, gh, ((flags.number("blur") ?? 0.03) * headL) / cell);
const scanHeight = (x: number, y: number) =>
  sampleBilinear(smoothHeights, gw, gh, (x - field.min[0]) / cell, (y - field.min[1]) / cell);
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
const [eraseRx, eraseRy] = (flags.pair("erase") ?? [0.8, 0.7]).map((k) => k * headL);
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
console.log(`erase: ${erasedCount} stock face vertices flattened onto a spline through ${ringSamples.length} samples around them`);

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
const relaxed = smoothMasked(base, rings, relaxWeights, {
  passes: flags.number("relax") ?? 500,
  lambda: 0.5,
  planar: true,
});
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
const calmed = smoothMasked(moved, rings, weights, { passes: flags.number("face-smooth") ?? 6, lambda: 0.5, mu: -0.53 });
const band = weights.map((w) => 4 * w * (1 - w));
const smoothed = smoothMasked(calmed, rings, band, { passes: flags.number("smooth") ?? 2, lambda: 0.5 });
for (let i = 0; i < canon.length; i++) {
  smoothed.set(smoothed.subarray(canon[i] * 3, canon[i] * 3 + 3), i * 3);
  weights[i] = weights[canon[i]];
}

// 7. Normals: recompute (welded) wherever the surface changed, keep the stock normals elsewhere.
const fresh = vertexNormals(smoothed, welded);
const normals = readNormals(headDoc);
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
console.log(
  `transfer: ${movedCount} head vertices moved (${pct(movedCount, weights.length)} of the head), ` +
    `${fullCount} fully onto the scan; max shift ${(maxShift / headL).toFixed(3)} L; ` +
    `inside-out face triangles ${foldsBefore} → ${foldsAfter} after relaxing; ${touched} normals recomputed`
);

if (movedCount === 0) fail("no head vertex moved: the aligned capture doesn't cover the head's face");

// 8. The face's skin. Every head vertex gets a UV from a front projection of the face (x, y), which is how the phone
//    saw it: seamless, and no stretch the photo doesn't already have. The texture is re-baked texel by texel through
//    the aligned scan's own triangles and their UVs, so the capture's atlas seams never smear across the face, and
//    only texels on the cropped face are taken from the photo — the rest is the face's colours dilated outward, so
//    nothing of the room ships. `_FACEWEIGHT` (the transfer weight) tells the material where skin gives way to chrome.
const TEXTURE_SIZE = 1024;
const uvBox = bounds(aligned);
const uvSide = Math.max(uvBox.max[0] - uvBox.min[0], uvBox.max[1] - uvBox.min[1]) + 0.2 * headL;
const uvLeft = (uvBox.min[0] + uvBox.max[0] - uvSide) / 2;
const uvTop = (uvBox.min[1] + uvBox.max[1] + uvSide) / 2;
const uvs = new Float32Array(count(smoothed) * 2);
for (let i = 0; i < count(smoothed); i++) {
  uvs[i * 2] = (smoothed[i * 3] - uvLeft) / uvSide;
  uvs[i * 2 + 1] = (uvTop - smoothed[i * 3 + 1]) / uvSide;
}
const photoTexture = captureDoc.getRoot().listMaterials()[0]?.getBaseColorTexture();
const photoUvs = pickUvs(photoCrop.sourceIndex);
if (!photoTexture || !photoUvs) fail("the capture has no base-colour texture and TEXCOORD_0 to take the skin from");
const photo = jpeg.decode(photoTexture.getImage()!, { useTArray: true, maxMemoryUsageInMB: 1024 });
const photoAligned = new Float32Array(photoCrop.positions.length);
for (let i = 0; i < count(photoCrop.positions); i++) photoAligned.set(applySimilarity(align, point(photoCrop.positions, i)), i * 3);
const photoGrid = new AxisRayGrid(photoAligned, photoCrop.indices, 2, headL / 25);
const skin = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE * 3);
const onFace = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);
const inset = 0.05 * headL; // keep clear of the crop's ragged edge, where the photo can show the room behind
for (let ty = 0; ty < TEXTURE_SIZE; ty++) {
  for (let tx = 0; tx < TEXTURE_SIZE; tx++) {
    const x = uvLeft + ((tx + 0.5) / TEXTURE_SIZE) * uvSide, y = uvTop - ((ty + 0.5) / TEXTURE_SIZE) * uvSide;
    const hit = photoGrid.front([x, y, headNose[2]]);
    if (!hit || distanceToSegments2D(x, y, rim) < inset) continue;
    const [a, b, c] = [0, 1, 2].map((k) => photoCrop.indices[hit.triangle * 3 + k]);
    const [u, v] = interpolateCorners(photoUvs, 2, a, b, c, hit.u, hit.v);
    skin.set(sampleRgb(photo.data, photo.width, photo.height, u, v), (ty * TEXTURE_SIZE + tx) * 3);
    onFace[ty * TEXTURE_SIZE + tx] = 1;
  }
}
const padded = dilate(skin, onFace, TEXTURE_SIZE, TEXTURE_SIZE, 24);
const rgba = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
for (let i = 0; i < TEXTURE_SIZE * TEXTURE_SIZE; i++) {
  rgba.set([padded[i * 3], padded[i * 3 + 1], padded[i * 3 + 2], 255].map(Math.round), i * 4);
}
const faceJpeg = jpeg.encode({ data: rgba, width: TEXTURE_SIZE, height: TEXTURE_SIZE }, 85).data;
const faceTextureOut = out.replace(/\.glb$/, "") + "-face.jpg";
console.log(
  `skin: ${pct(onFace.filter(Boolean).length, onFace.length)} of a ${TEXTURE_SIZE}² texture from the photo, ` +
    `UVs span ${uvSide.toFixed(2)} head units`
);

// 9. Write: back to the stock scene space, quantised + meshopt like the stock file.
const scene = new Float32Array(smoothed.length);
for (let i = 0; i < count(smoothed); i++) scene.set(toFace(point(smoothed, i)), i * 3);
const quantized = quantizePositions(scene, 14);
const buffer = headDoc.getRoot().listBuffers()[0];
const node = headDoc.getRoot().listNodes()[0];
const prim = node.getMesh()!.listPrimitives()[0];
const oldAccessors = [prim.getAttribute("POSITION")!, prim.getAttribute("NORMAL")!];
prim.setAttribute("POSITION", headDoc.createAccessor().setType("VEC3").setArray(quantized.array).setBuffer(buffer));
prim.setAttribute(
  "NORMAL",
  headDoc.createAccessor().setType("VEC3").setArray(quantizeNormals(normals)).setNormalized(true).setBuffer(buffer)
);
prim.setAttribute(
  "TEXCOORD_0",
  headDoc.createAccessor().setType("VEC2").setArray(normalizedUint(uvs, 16)).setNormalized(true).setBuffer(buffer)
);
prim.setAttribute(
  "_FACEWEIGHT",
  headDoc.createAccessor().setType("SCALAR").setArray(normalizedUint(weights, 8)).setNormalized(true).setBuffer(buffer)
);
oldAccessors.forEach((a) => a.dispose());
node.setTranslation(quantized.translation).setScale([quantized.scale, quantized.scale, quantized.scale]);
headDoc.createExtension(KHRMeshQuantization).setRequired(true);
headDoc
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
// Write beside the target and rename, so a failed write never leaves a half-written head in its place.
for (const [path, bytes] of [[out, await io.writeBinary(headDoc)], [faceTextureOut, faceJpeg]] as const) {
  writeFileSync(`${path}.partial`, bytes);
  renameSync(`${path}.partial`, path);
}
console.log(`wrote ${out}: ${prim.getIndices()!.getCount() / 3} triangles, ${(statSync(out).size / 1024).toFixed(1)} KB`);
console.log(`wrote ${faceTextureOut}: ${TEXTURE_SIZE}×${TEXTURE_SIZE}, ${(statSync(faceTextureOut).size / 1024).toFixed(1)} KB`);

if (debugDir) {
  mkdirSync(debugDir, { recursive: true });
  await writeDebug(join(debugDir, "crop.glb"), photoCrop.positions, photoCrop.indices, { uvs: photoUvs });
  const alignedScene = new Float32Array(aligned.length);
  for (let i = 0; i < count(aligned); i++) alignedScene.set(toFace(point(aligned, i)), i * 3);
  await writeDebug(join(debugDir, "aligned.glb"), alignedScene, face.indices, {});
  const heat = new Float32Array(weights.length * 3);
  weights.forEach((w, i) => heat.set([w, 0.15 + 0.5 * (1 - Math.abs(2 * w - 1)), 1 - w], i * 3));
  await writeDebug(join(debugDir, "weights.glb"), scene, head.indices, { colors: heat });
  const mannequinHead = new Float32Array(base.length);
  for (let i = 0; i < count(base); i++) mannequinHead.set(toFace(point(base, canon[i])), i * 3);
  await writeDebug(join(debugDir, "erased.glb"), mannequinHead, head.indices, {});
  console.log(`debug meshes in ${debugDir}`);
}

// ————————————————————————————————————————————————————————————————————————————————————————————

interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
}

/** The first mesh's positions with its node transform applied, mapped into the face frame. */
function readMesh(doc: Document, frame: (p: Vec3) => Vec3): MeshData {
  const node = doc.getRoot().listNodes().find((n) => n.getMesh())!;
  const m = node.getWorldMatrix();
  const prim = node.getMesh()!.listPrimitives()[0];
  const attr = prim.getAttribute("POSITION")!;
  const positions = new Float32Array(attr.getCount() * 3);
  const el: number[] = [];
  for (let i = 0; i < attr.getCount(); i++) {
    const [x, y, z] = attr.getElement(i, el);
    positions.set(
      frame([
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ]),
      i * 3
    );
  }
  return { positions, indices: new Uint32Array(prim.getIndices()!.getArray()!) };
}

function readNormals(doc: Document) {
  const attr = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute("NORMAL")!;
  const out = new Float32Array(attr.getCount() * 3);
  const el: number[] = [];
  for (let i = 0; i < attr.getCount(); i++) out.set(attr.getElement(i, el), i * 3);
  return out;
}

function pickUvs(sourceIndex: Uint32Array) {
  const attr = captureDoc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute("TEXCOORD_0");
  if (!attr) return undefined;
  const out = new Float32Array(sourceIndex.length * 2);
  const el: number[] = [];
  sourceIndex.forEach((src, i) => out.set(attr.getElement(src, el), i * 2));
  return out;
}

/** A plain (uncompressed) GLB for inspecting a stage in a viewer; the crop keeps the scan's photo. */
async function writeDebug(path: string, positions: Float32Array, indices: Uint32Array, extra: { uvs?: Float32Array; colors?: Float32Array }) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buf))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buf));
  if (extra.colors) prim.setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(extra.colors).setBuffer(buf));
  if (extra.uvs) {
    prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(extra.uvs).setBuffer(buf));
    const photo = captureDoc.getRoot().listMaterials()[0]?.getBaseColorTexture();
    if (photo) {
      const tex = doc.createTexture().setImage(photo.getImage()!).setMimeType(photo.getMimeType());
      prim.setMaterial(doc.createMaterial().setBaseColorTexture(tex));
    }
  }
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  await new NodeIO().write(path, doc);
}

/** The front-most point on a mesh at face-relative offset (x, y)·L from the nose tip. */
function frontPoint(grid: AxisRayGrid, nose: Vec3, L: number, x: number, y: number): Vec3 {
  const hit = grid.front([nose[0] + x * L, nose[1] + y * L, nose[2]]);
  if (!hit) throw new Error(`no surface at (${x}, ${y})·L from the nose tip — pass --nose/--chin`);
  return hit.point;
}

function rms(src: Vec3[], dst: Vec3[], s: Similarity) {
  let sum = 0;
  src.forEach((p, i) => {
    const q = applySimilarity(s, p);
    sum += (q[0] - dst[i][0]) ** 2 + (q[1] - dst[i][1]) ** 2 + (q[2] - dst[i][2]) ** 2;
  });
  return Math.sqrt(sum / src.length);
}

function describe({ scale, rotation: r, translation }: Similarity) {
  const deg = (v: number) => ((v * 180) / Math.PI).toFixed(1);
  // XYZ Euler angles of the row-major rotation: pitch about x, yaw about y, roll about z.
  const yaw = Math.asin(Math.max(-1, Math.min(1, r[2])));
  return `scale ${scale.toFixed(2)}, pitch ${deg(Math.atan2(-r[5], r[8]))}°, yaw ${deg(yaw)}°, ` +
    `roll ${deg(Math.atan2(-r[1], r[0]))}°, translation ${fmt(translation)}`;
}

function point(positions: Float32Array, i: number): Vec3 {
  return [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
}

function count(positions: Float32Array) {
  return positions.length / 3;
}

function bounds(positions: Float32Array) {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], positions[i]);
    max[i % 3] = Math.max(max[i % 3], positions[i]);
  }
  return { min, max };
}

function fmt(p: Vec3) {
  return `(${p.map((v) => v.toFixed(4)).join(", ")})`;
}

function pct(n: number, of: number) {
  return `${((100 * n) / Math.max(1, of)).toFixed(1)}%`;
}
