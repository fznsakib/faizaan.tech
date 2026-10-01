import { Document } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";

import { quantizeNormals, quantizePositions } from "./surface.ts";
import { normalizedUint } from "./texture.ts";
import { count, point, toFace } from "./transfer.ts";

/** A whole head ready to write: face-frame positions and normals, triangles, atlas UVs and a hair weight per vertex. */
export interface HeadMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  uvs: Float32Array;
  hair: Float32Array;
}

/**
 * The skin head as a glTF document with the stock head's conventions — one node, the stock's scene space (z up, face
 * toward +y), quantised positions and normals, meshopt on write — so `prepareModel` treats it like the copper head.
 * It carries `TEXCOORD_0` into the atlas (glTF style, v down) and `_HAIRWEIGHT` (1 on hair); the material is set in
 * code, and the atlas ships beside it.
 */
export function skinHeadDocument(head: HeadMesh) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const n = count(head.positions);
  const scene = new Float32Array(head.positions.length);
  const normals = new Float32Array(head.normals.length);
  for (let i = 0; i < n; i++) {
    scene.set(toFace(point(head.positions, i)), i * 3);
    normals.set(toFace(point(head.normals, i)), i * 3); // the face-frame map is its own inverse
  }
  const quantized = quantizePositions(scene, 14);
  const accessor = (type: "VEC3" | "VEC2" | "SCALAR", array: ArrayLike<number> & { buffer: ArrayBufferLike }, normalized = false) =>
    doc.createAccessor().setType(type).setArray(array as Float32Array).setNormalized(normalized).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", accessor("VEC3", quantized.array))
    .setAttribute("NORMAL", accessor("VEC3", quantizeNormals(normals), true))
    .setAttribute("TEXCOORD_0", accessor("VEC2", normalizedUint(head.uvs, 16), true))
    .setAttribute("_HAIRWEIGHT", accessor("SCALAR", normalizedUint(head.hair, 8), true))
    .setIndices(accessor("SCALAR", n < 65536 ? Uint16Array.from(head.indices) : head.indices));
  const node = doc
    .createNode("SkinHead")
    .setMesh(doc.createMesh("SkinHead").addPrimitive(prim))
    .setTranslation(quantized.translation)
    .setScale([quantized.scale, quantized.scale, quantized.scale]);
  doc.createScene().addChild(node);
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  return doc;
}
