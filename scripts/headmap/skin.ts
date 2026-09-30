import { azimuth, layoutAtlas, rasterizeTriangle, splitCorners, unwrapTriangle } from "./atlas.ts";
import { colourDistance, fitColourModel, hairness, makeTileable, toYcc } from "./colour.ts";
import { smoothstep } from "./falloff.ts";
import { copyToTwins, geodesicDistance, harmonicFill, smoothScalar } from "./field.ts";
import { scalpPrior } from "./hair.ts";
import { fractalNoise, valueNoise } from "./noise.ts";
import { AxisRayGrid } from "./ray.ts";
import { applySimilarity } from "./similarity.ts";
import { smoothMasked, vertexNormals } from "./surface.ts";
import { keepOnly, splatTexture } from "./synth.ts";
import { dilate, interpolateCorners, sampleRgb } from "./texture.ts";
import { COPPER_TRANSFER, count, point } from "./transfer.ts";

import type { ChartRect } from "./atlas.ts";
import type { Scalp } from "./hair.ts";
import type { Vec3 } from "./ray.ts";
import type { MeshData, Transfer, TransferParams } from "./transfer.ts";

/*
 * The skin head: the owner's whole head, no copper. The face and front hair come from the capture's photo (front
 * projection, as the phone saw them); everything the camera never saw — the crown, the back, the far sides, the neck —
 * is synthesized in his colours: skin continued from the photo's own edges, and hair tiled from a patch of his own
 * curls. The stock skull, which from the front already fills his hair's outline, gets a thin, lumpy hair volume over the
 * scalp. One atlas holds three charts: the face (front projection), the crown (seen from above) and a band around the
 * sides, back and neck (a cylinder, its seam behind the head).
 *
 * Lengths are in units of L, the stock head's nose-tip-to-chin height, unless they say otherwise.
 */

/** The skin head transfers more of the capture than the copper head: up into the front hair and out to the cheeks. */
export const SKIN_TRANSFER: TransferParams = {
  ...COPPER_TRANSFER,
  window: [1.05, 1.45],
  windowY: 0.3,
  top: 1.45,
  depth: 1.0,
  chinCut: 1.1,
};

export interface SkinParams {
  /** Hairline heights above the nose tip, in L: over the forehead, over the ears, at the nape (the photo's own wins in front). */
  hairline: Vec3;
  /** Hair volume over the scalp, and the lumps of curls on it, in L. */
  thickness: number;
  curl: number;
  /** Atlas side in px, and the JPEG quality it is written at. */
  atlasSize: number;
  quality: number;
  seed: number;
}

export const SKIN_DEFAULTS: SkinParams = {
  hairline: [1.1, 0.35, -0.35],
  thickness: 0.1,
  curl: 0.08,
  atlasSize: 2048,
  quality: 82,
  seed: 20260930,
};

export interface Photo {
  /** The capture's whole mesh (positions in its own frame) with its per-vertex UVs. */
  mesh: MeshData;
  uvs: Float32Array;
  /** Its base-colour image, RGBA. */
  image: { data: Uint8Array; width: number; height: number };
}

export interface SkinHead {
  /** Face frame, one entry per (split) vertex. */
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Atlas UVs, glTF style (v down from the top). */
  uvs: Float32Array;
  /** 1 on hair, 0 on skin: the material's roughness follows it. */
  hair: Float32Array;
  atlas: Uint8Array;
  atlasSize: number;
  /** The tile of his curls the synthesis used (for --debug). */
  exemplar: { rgb: Float32Array; size: number };
}

const FRONT = 0, TOP = 1, BAND = 2, BOTTOM = 3;

/** Everything the texture bake reads at a vertex. */
interface VertexPaint {
  photoWeight: Float32Array;
  hair: Float32Array;
  skinFill: Float32Array;
  hairFill: Float32Array;
  core: Float32Array;
  zone: Float32Array;
}

export function buildSkinHead(t: Transfer, head: MeshData, photo: Photo, p: SkinParams, log: (line: string) => void): SkinHead {
  const L = t.headL, nose = t.headNose;
  const n = count(t.positions);
  const canonical = (i: number) => t.canon[i] === i;

  // 1. The photo as seen from the front: the whole capture, aligned. A head point takes the photo only where it is the
  //    front-most layer of the head, faces the camera, and the capture's front surface there is the same surface
  //    (not the room behind, nor the shirt in front of the neck).
  const capture = new Float32Array(photo.mesh.positions.length);
  for (let i = 0; i < count(capture); i++) capture.set(applySimilarity(t.align, point(photo.mesh.positions, i)), i * 3);
  const photoGrid = new AxisRayGrid(capture, photo.mesh.indices, 2, L / 25);
  const photoAt = (x: number, y: number) => {
    const hit = photoGrid.front([x, y, nose[2]]);
    if (!hit) return null;
    const [a, b, c] = [0, 1, 2].map((k) => photo.mesh.indices[hit.triangle * 3 + k]);
    const [u, v] = interpolateCorners(photo.uvs, 2, a, b, c, hit.u, hit.v);
    return { z: hit.point[2], rgb: sampleRgb(photo.image.data, photo.image.width, photo.image.height, u, v) };
  };

  const faceNormals = vertexNormals(t.positions, t.welded);
  const headFront = new AxisRayGrid(t.positions, t.welded, 2, L / 25);
  // The photo stops at the chin: below it the capture has the necklace and the shirt's collar.
  const neckTop = nose[1] - 0.95 * L, neckBottom = nose[1] - 1.1 * L;
  /** The face proper (eyes, brows, nose, mouth): always the photo, never judged by colour, never grown hair. */
  const coreOf = (x: number, y: number) =>
    1 - smoothstep(0.85, 1, Math.hypot((x - nose[0]) / (0.72 * L), (y - nose[1] - 0.12 * L) / (1.02 * L)));
  const rgbAt = new Float32Array(n * 3);
  const geometric = new Float32Array(n);
  const core = new Float32Array(n);
  /** Hair at a grazing angle to the camera is where the photo blends in the room behind: hair needs to face it more. */
  const facingSkin = (nz: number) => smoothstep(0.2, 0.45, nz), facingHair = (nz: number) => smoothstep(0.45, 0.75, nz);
  for (let i = 0; i < n; i++) {
    if (!canonical(i)) continue;
    const [x, y, z] = point(t.positions, i);
    const front = headFront.front([x, y, z]);
    if (!front || front.point[2] > z + 0.01 * L) continue;
    if (faceNormals[i * 3 + 2] > 0) core[i] = coreOf(x, y);
    const seen = photoAt(x, y);
    if (!seen) continue;
    rgbAt.set(seen.rgb, i * 3);
    const agree = 1 - smoothstep(0.12 * L, 0.25 * L, Math.abs(seen.z - z));
    geometric[i] = agree * smoothstep(neckBottom, neckTop, y); // × facing, once we know whether it's hair
  }

  // 2. Colour models from the photo: skin from the forehead and cheeks, hair from above the forehead.
  const skinSamples: number[][] = [], hairSamples: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (!canonical(i) || geometric[i] * facingSkin(faceNormals[i * 3 + 2]) < 0.9) continue;
    const [x, y] = point(t.positions, i);
    const dx = Math.abs(x - nose[0]) / L, dy = (y - nose[1]) / L;
    const rgb = [...rgbAt.subarray(i * 3, i * 3 + 3)];
    if ((dx < 0.3 && dy > 0.6 && dy < 0.85) || (dx > 0.35 && dx < 0.6 && dy > -0.35 && dy < 0.0)) skinSamples.push(rgb);
    if (dx < 0.8 && dy > 1.3 && dy < 1.9) hairSamples.push(rgb);
  }
  const byLuma = (a: number[], b: number[]) => toYcc(a)[0] - toYcc(b)[0];
  skinSamples.sort(byLuma);
  hairSamples.sort(byLuma);
  const skinModel = fitColourModel(skinSamples.slice(Math.floor(skinSamples.length * 0.1), Math.ceil(skinSamples.length * 0.9)));
  const hairModel = fitColourModel(hairSamples.slice(0, Math.ceil(hairSamples.length * 0.6)));
  if (skinSamples.length < 50 || hairSamples.length < 50)
    throw new Error(`found ${skinSamples.length} skin and ${hairSamples.length} hair samples in the photo; check the landmarks (--nose, --chin)`);
  const meanOf = (samples: number[][]) => [0, 1, 2].map((k) => samples.reduce((sum, c) => sum + c[k], 0) / samples.length);
  const hairTone = meanOf(hairSamples);
  log(`colour: skin ${fmtRgb(meanOf(skinSamples))} from ${skinSamples.length} samples, hair ${fmtRgb(hairTone)} from ${hairSamples.length}`);

  // 3. Where the photo is used: the geometric weight, and outside the face proper only where the colour is plausibly
  //    his skin or hair (never the wall, the window or the shirt) — in the hair, only where it is plausibly hair, since
  //    the pale wall behind the curls is not far from skin. Smoothed, then pulled in from its edge.
  const photoHair = new Float32Array(n);
  for (let i = 0; i < n; i++) if (canonical(i) && geometric[i] > 0) photoHair[i] = hairness([...rgbAt.subarray(i * 3, i * 3 + 3)], skinModel, hairModel);
  const smoothPhotoHair = smoothScalar(photoHair, t.rings, 6);
  const plausible = (rgb: number[], hairZone: number) => {
    const any = 1 - smoothstep(3, 5, Math.min(colourDistance(skinModel, rgb), colourDistance(hairModel, rgb)));
    const hairOnly = 1 - smoothstep(2.5, 4, colourDistance(hairModel, rgb));
    return any + (hairOnly - any) * hairZone;
  };
  const zone = smoothPhotoHair.map((h) => smoothstep(0.35, 0.6, h));
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!canonical(i) || geometric[i] === 0) continue;
    const nz = faceNormals[i * 3 + 2];
    const facing = facingSkin(nz) + (facingHair(nz) - facingSkin(nz)) * zone[i] * (1 - core[i]);
    raw[i] = geometric[i] * facing * (core[i] + (1 - core[i]) * plausible([...rgbAt.subarray(i * 3, i * 3 + 3)], zone[i]));
  }
  const photoWeight = smoothScalar(raw, t.rings, 4).map((w, i) => (canonical(i) ? smoothstep(0.35, 0.85, w) * Math.min(1, raw[i] * 4 + core[i]) : 0));

  // 4. Hair: the photo's own where it is used, a hairline around the scalp elsewhere.
  const ears = findEars(t.positions, n, canonical, L);
  const scalp: Scalp = {
    centre: [nose[0], 0, earMidZ(ears)],
    front: nose[1] + p.hairline[0] * L,
    side: nose[1] + p.hairline[1] * L,
    back: nose[1] + p.hairline[2] * L,
    band: 0.08 * L,
    ears: ears.map((e) => ({ centre: e.centre, radius: e.radius })),
  };
  const hairRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!canonical(i)) continue;
    const w = photoWeight[i];
    hairRaw[i] = (1 - core[i]) * (w * smoothstep(0.35, 0.65, smoothPhotoHair[i]) + (1 - w) * scalpPrior(scalp, point(t.positions, i)));
  }
  const hair = smoothScalar(hairRaw, t.rings, 4);

  // 5. Colour to continue into what the camera never saw: skin and hair each carried outward from where the photo
  //    shows them clearly (low-passed first, so no single curl or pore sets the colour of the back of the head).
  const lowPass = new Float32Array(n * 3);
  for (let k = 0; k < 3; k++) {
    const channel = new Float32Array(n);
    const mask = new Float32Array(n);
    for (let i = 0; i < n; i++) [channel[i], mask[i]] = [rgbAt[i * 3 + k] * photoWeight[i], photoWeight[i]];
    const num = smoothScalar(channel, t.rings, 8), den = smoothScalar(mask, t.rings, 8);
    for (let i = 0; i < n; i++) lowPass[i * 3 + k] = den[i] > 1e-3 ? num[i] / den[i] : 0;
  }
  // His overall skin tone: the well-lit half of all the skin the photo shows (stubble and all), since the renderer
  // shades the synthesized skin itself and it should start from skin as it looks in the light.
  const visibleSkin: number[][] = [];
  for (let i = 0; i < n; i++) if (canonical(i) && photoWeight[i] > 0.9 && smoothPhotoHair[i] < 0.3) visibleSkin.push([...rgbAt.subarray(i * 3, i * 3 + 3)]);
  visibleSkin.sort(byLuma);
  const skinTone = meanOf(visibleSkin.slice(Math.floor(visibleSkin.length * 0.5), Math.ceil(visibleSkin.length * 0.95)));
  log(`tones: skin ${fmtRgb(skinTone)} from ${visibleSkin.length} vertices of the face, hair ${fmtRgb(hairTone)}`);
  const skinKnown = new Uint8Array(n), hairKnown = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!canonical(i) || photoWeight[i] < 0.9) continue;
    if (smoothPhotoHair[i] < 0.25 && core[i] < 0.5) skinKnown[i] = 1;
    if (smoothPhotoHair[i] > 0.75) hairKnown[i] = 1;
  }
  const skinFill = harmonicFill(lowPass, skinKnown, t.rings, 3, { iterations: 400, fallback: skinTone });
  const hairFill = harmonicFill(lowPass, hairKnown, t.rings, 3, { iterations: 400, fallback: hairTone });
  // The photo's own edge is its periphery, seen in shadow and at a grazing angle; further from it the synthesis turns to
  // his overall tones (the lighting the renderer adds does the shading), so the neck and the back of the head match the face.
  const fromPhoto = geodesicDistance(t.positions, t.rings, Uint8Array.from(photoWeight, (w) => (w > 0.5 ? 1 : 0)));
  for (let i = 0; i < n; i++) {
    const fade = smoothstep(0.1 * L, 0.6 * L, fromPhoto[i]);
    for (let k = 0; k < 3; k++) {
      skinFill[i * 3 + k] += (skinTone[k] - skinFill[i * 3 + k]) * fade;
      hairFill[i * 3 + k] += (hairTone[k] - hairFill[i * 3 + k]) * fade;
    }
  }
  log(`photo: ${pct(photoWeight, (w) => w > 0.5, canonical)} of the head from the photo; hair on ${pct(hair, (h) => h > 0.5, canonical)}; ` +
    `${skinKnown.reduce((s, v) => s + v, 0)} skin and ${hairKnown.reduce((s, v) => s + v, 0)} hair vertices seed the synthesis`);

  // 6. The hair's volume: a thin shell over the scalp, lumpy like curls, never on the face or where the capture's own
  //    front hair was transferred.
  const lumps = fractalNoise(p.seed, 3);
  const offsetNormals = smoothMasked(faceNormals, t.rings, new Float32Array(n).fill(1), { passes: 10, lambda: 0.5 });
  const shelled = t.positions.slice();
  let maxOffset = 0;
  for (let i = 0; i < n; i++) {
    if (!canonical(i)) continue;
    const [x, y, z] = point(t.positions, i);
    const grow = smoothstep(0.3, 0.8, hair[i]) * (1 - t.weights[i]) * smoothstep(nose[1] + 0.1 * L, nose[1] + 0.5 * L, y);
    if (grow === 0) continue;
    const s = 1 / (0.25 * L);
    const offset = grow * L * (p.thickness + p.curl * lumps(x * s, y * s, z * s));
    const nn = normalise(point(offsetNormals, i));
    for (let k = 0; k < 3; k++) shelled[i * 3 + k] += offset * nn[k];
    maxOffset = Math.max(maxOffset, offset);
  }
  const shellBand = hair.map((h) => 4 * h * (1 - h));
  const positions = smoothMasked(shelled, t.rings, shellBand, { passes: 3, lambda: 0.5 });
  // Seam duplicates take their canonical twin's values, so both sides of every stock seam paint the same.
  for (const field of [positions, skinFill, hairFill]) copyToTwins(field, t.canon, 3);
  for (const field of [photoWeight, hair, core, zone]) copyToTwins(field, t.canon, 1);
  log(`hair volume: up to ${(maxOffset / L).toFixed(3)} L over the scalp`);

  // 7. Charts: the face where the photo reaches (the front-most layer only, so the projection never overlaps), the
  //    crown where the surface faces up, the neck's underside where it faces down, the band everywhere else.
  const normals = copyToTwins(vertexNormals(positions, t.welded), t.canon, 3);
  const finalFront = new AxisRayGrid(positions, t.welded, 2, L / 25);
  const finalTop = new AxisRayGrid(positions, t.welded, 1, L / 25);
  const flipped = positions.map((v, i) => (i % 3 === 1 ? -v : v));
  const finalBottom = new AxisRayGrid(flipped, t.welded, 1, L / 25);
  const triangles = head.indices.length / 3;
  const chart = new Uint8Array(triangles);
  let dropped = 0;
  for (let f = 0; f < triangles; f++) {
    const ids = [0, 1, 2].map((k) => head.indices[f * 3 + k]);
    const P = ids.map((i) => point(positions, i));
    const tn = triangleNormal(P);
    const centroid: Vec3 = [0, 1, 2].map((k) => (P[0][k] + P[1][k] + P[2][k]) / 3) as Vec3;
    const photoed = ids.some((i) => photoWeight[i] > 0);
    const frontMost = tn[2] > 0.05 && (finalFront.front(centroid)?.point[2] ?? -Infinity) <= centroid[2] + 0.01 * L;
    if (photoed && frontMost) chart[f] = FRONT;
    else {
      if (photoed) dropped++;
      const topMost = tn[1] > 0.5 && (finalTop.front(centroid)?.point[1] ?? -Infinity) <= centroid[1] + 0.01 * L;
      const below: Vec3 = [centroid[0], -centroid[1], centroid[2]];
      const bottomMost = tn[1] < -0.5 && (finalBottom.front(below)?.point[1] ?? -Infinity) <= below[1] + 0.01 * L;
      chart[f] = topMost ? TOP : bottomMost ? BOTTOM : BAND;
    }
  }
  // A vertex only keeps the photo if every triangle around it is on the face chart.
  const offFace = new Uint8Array(n);
  for (let f = 0; f < triangles; f++) if (chart[f] !== FRONT) for (let k = 0; k < 3; k++) offFace[t.canon[head.indices[f * 3 + k]]] = 1;
  for (let i = 0; i < n; i++) if (offFace[t.canon[i]]) photoWeight[i] = 0;

  // 8. UVs: each chart's own projection in L-free head units, laid out in the atlas.
  const axis: Vec3 = [scalp.centre[0], 0, scalp.centre[2]];
  const radii: number[] = [];
  for (let i = 0; i < n; i++) if (canonical(i)) radii.push(Math.hypot(positions[i * 3] - axis[0], positions[i * 3 + 2] - axis[2]));
  radii.sort((a, b) => a - b);
  const circumference = 2 * Math.PI * radii[radii.length >> 1];
  const cornerKey = new Uint32Array(head.indices.length);
  const cornerLocal = new Float32Array(head.indices.length * 2);
  for (let f = 0; f < triangles; f++) {
    const ids = [0, 1, 2].map((k) => head.indices[f * 3 + k]);
    if (chart[f] === BAND) {
      const us = ids.map((i) => azimuth(positions[i * 3], positions[i * 3 + 2], axis[0], axis[2])) as Vec3;
      const { u, wrapped } = unwrapTriangle(us);
      ids.forEach((i, k) => {
        cornerKey[f * 3 + k] = BAND * 2 + wrapped[k];
        cornerLocal.set([u[k] * circumference, -positions[i * 3 + 1]], (f * 3 + k) * 2);
      });
    } else {
      ids.forEach((i, k) => {
        cornerKey[f * 3 + k] = chart[f] * 2;
        const local = chart[f] === FRONT ? [positions[i * 3], -positions[i * 3 + 1]] : chart[f] === TOP ? [positions[i * 3], positions[i * 3 + 2]] : [positions[i * 3], -positions[i * 3 + 2]];
        cornerLocal.set(local, (f * 3 + k) * 2);
      });
    }
  }
  const box = [FRONT, TOP, BAND, BOTTOM].map(() => ({ minU: Infinity, minV: Infinity, maxU: -Infinity, maxV: -Infinity }));
  for (let c = 0; c < head.indices.length; c++) {
    const b = box[cornerKey[c] >> 1];
    b.minU = Math.min(b.minU, cornerLocal[c * 2]);
    b.maxU = Math.max(b.maxU, cornerLocal[c * 2]);
    b.minV = Math.min(b.minV, cornerLocal[c * 2 + 1]);
    b.maxV = Math.max(b.maxV, cornerLocal[c * 2 + 1]);
  }
  const size = (b: (typeof box)[number]) => ({ w: b.maxU - b.minU, h: b.maxV - b.minV });
  const S = p.atlasSize;
  const layout = layoutAtlas(S, size(box[FRONT]), size(box[TOP]), size(box[BAND]), size(box[BOTTOM]), {
    frontDensity: (88 * 5.2) / L,
    maxDensity: (60 * 5.2) / L,
    gutter: 8,
    minBand: Math.round(S * 0.3),
  });
  const rects: ChartRect[] = [layout.front, layout.top, layout.band, layout.bottom];
  const toPixel = (c: number) => {
    const chartId = cornerKey[c] >> 1, r = rects[chartId], b = box[chartId];
    return [r.x + (cornerLocal[c * 2] - b.minU) * r.scaleU, r.y + (cornerLocal[c * 2 + 1] - b.minV) * r.scaleV] as [number, number];
  };
  log(
    `atlas: ${S}², face ${fmtRect(layout.front)}, crown ${fmtRect(layout.top)}, band ${fmtRect(layout.band)}, ` +
      `under the neck ${fmtRect(layout.bottom)} (px per unit); ` +
      `${[FRONT, TOP, BAND, BOTTOM].map((c) => chart.filter((x) => x === c).length).join("/")} triangles; ` +
      `${dropped} photo triangles hidden behind others left to the synthesis`
  );

  // 9. Bake.
  const paint: VertexPaint = { photoWeight, hair, skinFill, hairFill, core, zone };
  const exemplar = hairExemplar(photoAt, finalFront, nose, L, (rgb) => hairness(rgb, skinModel, hairModel));
  log(
    `hair tile: ${exemplar.size}² px of his curls from (${exemplar.at.map((v) => v.toFixed(2)).join(", ")}), ` +
      `${exemplar.tile.toFixed(2)} units a tile; ${exemplar.clean ? "every sample hair" : "no square was all hair"}, ` +
      `${exemplar.replaced} non-hair texels replaced by the hair's mean`
  );
  const rgb = new Float32Array(S * S * 3);
  const filled = new Uint8Array(S * S);
  const skinLow = valueNoise(p.seed + 1), skinFine = valueNoise(p.seed + 2), hairLow = valueNoise(p.seed + 3);
  const curls = splatTexture(exemplar, { seed: p.seed + 4, spacing: 0.35 * L });
  const cornerPx: [number, number][] = [[0, 0], [0, 0], [0, 0]];
  for (let f = 0; f < triangles; f++) {
    const ids = [0, 1, 2].map((k) => head.indices[f * 3 + k]);
    for (let k = 0; k < 3; k++) cornerPx[k] = toPixel(f * 3 + k);
    rasterizeTriangle(cornerPx[0], cornerPx[1], cornerPx[2], S, S, (x, y, w0, w1, w2) => {
      const ws = [w0, w1, w2];
      const at = (field: Float32Array, stride: number, k: number) => ws.reduce((s, w, j) => s + w * field[ids[j] * stride + k], 0);
      const q: Vec3 = [at(positions, 3, 0), at(positions, 3, 1), at(positions, 3, 2)];
      const nq = normalise([at(normals, 3, 0), at(normals, 3, 1), at(normals, 3, 2)]);
      const skin = [0, 1, 2].map((k) => at(paint.skinFill, 3, k));
      const shade =
        1 +
        0.05 * skinLow(q[0] / (0.5 * L), q[1] / (0.5 * L), q[2] / (0.5 * L)) +
        0.03 * skinLow(q[0] / (0.08 * L), q[1] / (0.08 * L), q[2] / (0.08 * L)) +
        0.04 * skinFine(q[0] / (0.02 * L), q[1] / (0.02 * L), q[2] / (0.02 * L));
      const skinColour = skin.map((c) => c * shade);
      const h = at(paint.hair, 1, 0);
      let hairColour = skinColour;
      if (h > 1e-3) {
        const curl = curls(q, nq);
        const hairTone = 1 + 0.12 * hairLow(q[0] / (0.6 * L), q[1] / (0.6 * L), q[2] / (0.6 * L));
        hairColour = [0, 1, 2].map((k) => (curl[k] * at(paint.hairFill, 3, k) * hairTone) / exemplar.mean[k]);
      }
      let colour = skinColour.map((c, k) => c + (hairColour[k] - c) * h);
      const w = at(paint.photoWeight, 1, 0);
      if (w > 0) {
        const seen = photoAt(q[0], q[1]);
        if (seen) {
          const c = at(paint.core, 1, 0);
          const trust = w * (c + (1 - c) * plausible(seen.rgb, at(paint.zone, 1, 0)));
          colour = colour.map((v, k) => v + (seen.rgb[k] - v) * trust);
        }
      }
      rgb.set(colour, (y * S + x) * 3);
      filled[y * S + x] = 1;
    });
  }
  const padded = dilate(rgb, filled, S, S, 8);
  const atlas = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) atlas.set([padded[i * 3], padded[i * 3 + 1], padded[i * 3 + 2], 255].map((v) => Math.max(0, Math.min(255, Math.round(v)))), i * 4);

  // 10. Split the vertices along the charts' edges and the band's seam.
  const split = splitCorners(head.indices, cornerKey);
  const m = split.source.length;
  const out = { positions: new Float32Array(m * 3), normals: new Float32Array(m * 3), uvs: new Float32Array(m * 2), hair: new Float32Array(m) };
  const firstCorner = new Int32Array(m).fill(-1);
  for (let c = 0; c < split.indices.length; c++) if (firstCorner[split.indices[c]] < 0) firstCorner[split.indices[c]] = c;
  for (let v = 0; v < m; v++) {
    const src = split.source[v];
    out.positions.set(positions.subarray(src * 3, src * 3 + 3), v * 3);
    out.normals.set(normals.subarray(t.canon[src] * 3, t.canon[src] * 3 + 3), v * 3);
    const [px, py] = toPixel(firstCorner[v]);
    out.uvs.set([px / S, py / S], v * 2);
    out.hair[v] = hair[src];
  }
  log(`mesh: ${m} vertices after splitting ${count(t.positions)} along the charts, ${split.indices.length / 3} triangles`);
  return { ...out, indices: split.indices, atlas, atlasSize: S, exemplar };
}

/** The stock ears: the head's widest points on each side, and how big they are. */
function findEars(positions: Float32Array, n: number, canonical: (i: number) => boolean, L: number) {
  return [-1, 1].map((side) => {
    let widest = 0;
    for (let i = 0; i < n; i++) if (canonical(i)) widest = Math.max(widest, side * positions[i * 3]);
    const centre: Vec3 = [0, 0, 0];
    let found = 0;
    for (let i = 0; i < n; i++) {
      if (!canonical(i) || side * positions[i * 3] < widest - 0.12 * L) continue;
      for (let k = 0; k < 3; k++) centre[k] += positions[i * 3 + k];
      found++;
    }
    for (let k = 0; k < 3; k++) centre[k] /= Math.max(1, found);
    centre[0] -= side * 0.05 * L; // from the rim toward the head
    return { centre, radius: 0.36 * L };
  });
}

function earMidZ(ears: { centre: Vec3 }[]) {
  return ears.reduce((s, e) => s + e.centre[2], 0) / ears.length;
}

/**
 * A seamless tile of the owner's curls, cut from the photo where the front hair is thickest: of the squares (in head
 * units) above the forehead whose samples are all on the head and all hair-coloured, the most hair-coloured one. Any
 * texel of it that still isn't hair (a speck of the wall between curls) is replaced by the hair's mean before tiling,
 * since the tile is splatted over the whole head.
 */
function hairExemplar(
  photoAt: (x: number, y: number) => { z: number; rgb: Vec3 } | null,
  front: AxisRayGrid,
  nose: Vec3,
  L: number,
  hairLike: (rgb: number[]) => number
) {
  const tile = 0.62 * L, size = 256;
  let best = { score: -Infinity, at: [nose[0], nose[1] + 1.5 * L] as [number, number], clean: false };
  for (let cy = nose[1] + 1.25 * L; cy <= nose[1] + 1.75 * L; cy += 0.05 * L) {
    for (let cx = nose[0] - 0.6 * L; cx <= nose[0] + 0.6 * L; cx += 0.05 * L) {
      let score = 0, clean = true;
      for (let j = 0; j < 8; j++) {
        for (let i = 0; i < 8; i++) {
          const x = cx + ((i + 0.5) / 8 - 0.5) * tile, y = cy + ((j + 0.5) / 8 - 0.5) * tile;
          const seen = photoAt(x, y);
          if (!seen || !front.front([x, y, nose[2]])) {
            score -= 10;
            clean = false;
            continue;
          }
          const h = hairLike(seen.rgb);
          if (h < 0.5) clean = false;
          score += h;
        }
      }
      // A square that is all hair beats any that isn't; among equals, the more hair-coloured.
      if ((clean && !best.clean) || (clean === best.clean && score > best.score)) best = { score, at: [cx, cy], clean };
    }
  }
  const patch = new Float32Array(size * size * 3);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = best.at[0] + ((i + 0.5) / size - 0.5) * tile, y = best.at[1] - ((j + 0.5) / size - 0.5) * tile;
      patch.set(photoAt(x, y)?.rgb ?? [0, 0, 0], (j * size + i) * 3);
    }
  }
  const { rgb: hairOnly, replaced } = keepOnly(patch, hairLike, 0.5);
  const tiled = makeTileable(hairOnly, size);
  const mean = [0, 1, 2].map((k) => tiled.filter((_, i) => i % 3 === k).reduce((s, v) => s + v, 0) / (size * size));
  return { rgb: tiled, size, tile, mean, at: best.at, clean: best.clean, replaced };
}

function triangleNormal([a, b, c]: Vec3[]): Vec3 {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return normalise([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
}

function normalise(v: Vec3 | number[]): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function fmtRgb(rgb: number[]) {
  return `rgb(${rgb.map((v) => Math.round(v)).join(", ")})`;
}

function fmtRect(r: ChartRect) {
  return `${r.w}×${r.h} @ ${r.scaleU.toFixed(0)}${r.scaleV.toFixed(0) === r.scaleU.toFixed(0) ? "" : `/${r.scaleV.toFixed(0)}`}`;
}

function pct(values: Float32Array, test: (v: number) => boolean, canonical: (i: number) => boolean) {
  let hit = 0, all = 0;
  values.forEach((v, i) => {
    if (!canonical(i)) return;
    all++;
    if (test(v)) hit++;
  });
  return `${((100 * hit) / Math.max(1, all)).toFixed(1)}%`;
}
