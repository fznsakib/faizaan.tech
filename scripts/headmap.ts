import { mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import jpeg from "jpeg-js";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

import { isInside, parseFlags } from "./headmap/cli.ts";
import { skinHeadDocument } from "./headmap/glb.ts";
import { distanceToSegments2D } from "./headmap/mesh.ts";
import { AxisRayGrid } from "./headmap/ray.ts";
import { applySimilarity } from "./headmap/similarity.ts";
import { buildSkinHead, SKIN_DEFAULTS, SKIN_TRANSFER } from "./headmap/skin.ts";
import { quantizeNormals, quantizePositions } from "./headmap/surface.ts";
import { dilate, interpolateCorners, normalizedUint, sampleRgb } from "./headmap/texture.ts";
import { bounds, count, COPPER_TRANSFER, pct, point, toFace, transferFace } from "./headmap/transfer.ts";

import type { Vec3 } from "./headmap/ray.ts";
import type { SkinHead, SkinParams } from "./headmap/skin.ts";
import type { MeshData, Transfer, TransferParams } from "./headmap/transfer.ts";

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
  Builds the skin head (src/assets/skin-head.glb + skin-head.jpg): the whole head in the owner's skin and hair.
  --copper            build the copper head instead (src/assets/head.glb + head-face.jpg): the face on chrome
  --nose x,y,z        capture nose tip (default: most forward point near the middle)
  --chin y            capture chin height (default: where the midline falls away below the nose)
  --chin-depth d      capture units: how far behind the nose tip counts as "under the chin" (0.03)
  --depth k           crop: drop everything more than k·L behind the nose tip (skin 1.0, copper 0.9)
  --window rx,ry      crop: elliptical face window half-width, half-height, in L (skin 1.05,1.45; copper 0.95,1.3)
  --window-y k        crop: window centre k·L above the nose tip (skin 0.3, copper 0.2)
  --chin-cut k        crop: drop below k·L under the nose tip (skin 1.1, copper 1.02)
  --top k             crop: drop above k·L over the nose tip; the hairline is ~1.1 (skin 1.45, copper 1.0)
  --margin k          blend: weight rises 0→1 over k·L inside the crop edge (0.45)
  --tolerance k       blend: weight falls to 0 when the scan is k·L from the head (1.2)
  --icp n             alignment: ICP iterations after the landmark fit (10)
  --rim-smooth n      passes smoothing the crop's rim before measuring the blend from it (20)
  --blur k            Gaussian blur of the scan's height field, sigma in L: calms noise and folds (0.03)
  --erase rx,ry       the stock features erased before the transfer: ellipse radii around its nose, in L (0.8,0.7)
  --relax n           passes relaxing the head's face vertices across x/y before re-projecting (500)
  --face-smooth n     Taubin passes over the transferred face (6)
  --smooth n          Laplacian passes across the blend band (2)
  --hairline f,s,b    skin: synthesized hairline over the forehead, ears and nape, in L above the nose tip (1.1,0.35,-0.35)
  --thickness k       skin: hair volume over the scalp, in L (0.1)
  --curl k            skin: lumps of curls on it, in L (0.08)
  --quality n         skin: the atlas's JPEG quality (82)
  --debug dir         also write debug GLBs (copper: the crop with the capture's photo — keep dir outside the repo —
                      the aligned crop, the erased stock head and a weight map; skin: a hair map)
  --out file          output .glb; the texture goes beside it`;

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
  hairline: "vec3",
  thickness: "number",
  curl: "number",
  quality: "count",
  copper: "switch",
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
const copper = flags.on("copper");
const out = flags.string("out") ?? fileURLToPath(new URL(copper ? "../src/assets/head.glb" : "../src/assets/skin-head.glb", import.meta.url));
const debugDir = flags.string("debug");
if (debugDir && isInside(debugDir, repoRoot)) fail("--debug writes the capture's photo; point it outside the repo");

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const identity = (p: Vec3) => p;

// 1. Read both meshes into the face frame.
const captureDoc = await io.read(flags.capture);
const capture = readMesh(captureDoc, identity);
const headDoc = await io.read(basePath);
const head = readMesh(headDoc, toFace);
console.log(`capture: ${count(capture.positions)} vertices, ${capture.indices.length / 3} triangles`);
console.log(`head:    ${count(head.positions)} vertices, ${head.indices.length / 3} triangles`);

// 2–7. Landmarks, crop, alignment, erase, transfer, smoothing and normals (scripts/headmap/transfer.ts).
const defaults = copper ? COPPER_TRANSFER : SKIN_TRANSFER;
const params: TransferParams = {
  nose: flags.vec("nose"),
  chin: flags.number("chin"),
  chinDepth: flags.number("chin-depth") ?? defaults.chinDepth,
  depth: flags.number("depth") ?? defaults.depth,
  window: flags.pair("window") ?? defaults.window,
  windowY: flags.number("window-y") ?? defaults.windowY,
  chinCut: flags.number("chin-cut") ?? defaults.chinCut,
  top: flags.number("top") ?? defaults.top,
  margin: flags.number("margin") ?? defaults.margin,
  tolerance: flags.number("tolerance") ?? defaults.tolerance,
  icp: flags.number("icp") ?? defaults.icp,
  rimSmooth: flags.number("rim-smooth") ?? defaults.rimSmooth,
  blur: flags.number("blur") ?? defaults.blur,
  erase: flags.pair("erase") ?? defaults.erase,
  relax: flags.number("relax") ?? defaults.relax,
  faceSmooth: flags.number("face-smooth") ?? defaults.faceSmooth,
  smooth: flags.number("smooth") ?? defaults.smooth,
};
let transfer: Transfer;
try {
  transfer = transferFace(capture, head, readNormals(headDoc), params, (line) => console.log(line));
} catch (error) {
  fail((error as Error).message);
}
const { headNose, headL, align, aligned, face, photoCrop, rawRim, erasedHead: base, canon, positions: smoothed, weights, normals } = transfer;

if (copper) await writeCopper();
else await writeSkin();

/** The copper head: the stock head with the face transferred, its photo skin in a front-projected face texture. */
async function writeCopper() {
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
  let closestToEdge = Infinity;
  for (let ty = 0; ty < TEXTURE_SIZE; ty++) {
    for (let tx = 0; tx < TEXTURE_SIZE; tx++) {
      const x = uvLeft + ((tx + 0.5) / TEXTURE_SIZE) * uvSide, y = uvTop - ((ty + 0.5) / TEXTURE_SIZE) * uvSide;
      const hit = photoGrid.front([x, y, headNose[2]]);
      if (!hit) continue;
      const edge = distanceToSegments2D(x, y, rawRim);
      if (edge < inset) continue;
      const [a, b, c] = [0, 1, 2].map((k) => photoCrop.indices[hit.triangle * 3 + k]);
      const [u, v] = interpolateCorners(photoUvs, 2, a, b, c, hit.u, hit.v);
      skin.set(sampleRgb(photo.data, photo.width, photo.height, u, v), (ty * TEXTURE_SIZE + tx) * 3);
      onFace[ty * TEXTURE_SIZE + tx] = 1;
      closestToEdge = Math.min(closestToEdge, edge);
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
      `none closer than ${(closestToEdge / headL).toFixed(3)} L to the crop's edge; UVs span ${uvSide.toFixed(2)} head units`
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
}

/** The skin head: the whole head in the owner's skin and hair, one atlas (scripts/headmap/skin.ts). */
async function writeSkin() {
  const texture = captureDoc.getRoot().listMaterials()[0]?.getBaseColorTexture();
  const photoUvs = captureDoc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute("TEXCOORD_0");
  if (!texture || !photoUvs) fail("the capture has no base-colour texture and TEXCOORD_0 to take the skin from");
  const image = jpeg.decode(texture.getImage()!, { useTArray: true, maxMemoryUsageInMB: 1024 });
  const skinParams: SkinParams = {
    ...SKIN_DEFAULTS,
    hairline: flags.vec("hairline") ?? SKIN_DEFAULTS.hairline,
    thickness: flags.number("thickness") ?? SKIN_DEFAULTS.thickness,
    curl: flags.number("curl") ?? SKIN_DEFAULTS.curl,
    quality: flags.number("quality") ?? SKIN_DEFAULTS.quality,
  };
  let result: SkinHead;
  try {
    result = buildSkinHead(transfer, head, { mesh: capture, uvs: new Float32Array(photoUvs.getArray()!), image }, skinParams, (line) => console.log(line));
  } catch (error) {
    fail((error as Error).message);
  }
  const doc = skinHeadDocument(result);
  const atlasJpeg = jpeg.encode({ data: result.atlas, width: result.atlasSize, height: result.atlasSize }, skinParams.quality).data;
  const atlasOut = out.replace(/\.glb$/, "") + ".jpg";
  writeAtomically(out, await io.writeBinary(doc));
  writeAtomically(atlasOut, atlasJpeg);
  console.log(`wrote ${out}: ${result.indices.length / 3} triangles, ${count(result.positions)} vertices, ${(statSync(out).size / 1024).toFixed(1)} KB`);
  console.log(`wrote ${atlasOut}: ${result.atlasSize}×${result.atlasSize}, ${(statSync(atlasOut).size / 1024).toFixed(1)} KB`);
  if (debugDir) {
    mkdirSync(debugDir, { recursive: true });
    const heat = new Float32Array(result.hair.length * 3);
    result.hair.forEach((h, i) => heat.set([0.9 - 0.7 * h, 0.7 - 0.5 * h, 0.6 - 0.4 * h], i * 3));
    const scene = new Float32Array(result.positions.length);
    for (let i = 0; i < count(scene); i++) scene.set(toFace(point(result.positions, i)), i * 3);
    await writeDebug(join(debugDir, "hair.glb"), scene, result.indices, { colors: heat });
    const { rgb: tile, size: tileSize } = result.exemplar;
    const tileRgba = new Uint8Array(tileSize * tileSize * 4);
    for (let i = 0; i < tileSize * tileSize; i++) tileRgba.set([tile[i * 3], tile[i * 3 + 1], tile[i * 3 + 2], 255].map((v) => Math.max(0, Math.min(255, Math.round(v)))), i * 4);
    writeFileSync(join(debugDir, "hair-tile.jpg"), jpeg.encode({ data: tileRgba, width: tileSize, height: tileSize }, 90).data);
    console.log(`debug meshes in ${debugDir}`);
  }
}

/** Write beside the target and rename, so a failed write never leaves a half-written file in its place. */
function writeAtomically(path: string, bytes: Uint8Array) {
  writeFileSync(`${path}.partial`, bytes);
  renameSync(`${path}.partial`, path);
}

// ————————————————————————————————————————————————————————————————————————————————————————————

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
