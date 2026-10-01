import { Document } from "@gltf-transform/core";
import { describe, expect, it } from "vitest";

import { readCapture } from "./capture.ts";

/** A document with `count` one-triangle primitives on one node translated by (1, 2, 3), each with its own textured material. */
function scan(count: number) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mesh = doc.createMesh();
  for (let k = 0; k < count; k++) {
    const texture = doc.createTexture().setImage(new Uint8Array([255, 216, 255, k])).setMimeType("image/jpeg");
    mesh.addPrimitive(
      doc
        .createPrimitive()
        .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])).setBuffer(buffer))
        .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array([0, 0, 1, 0, 0, 1])).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array([0, 1, 2])).setBuffer(buffer))
        .setMaterial(doc.createMaterial().setBaseColorTexture(texture))
    );
  }
  doc.createScene().addChild(doc.createNode().setMesh(mesh).setTranslation([1, 2, 3]));
  return doc;
}

describe("readCapture", () => {
  it("reads the one primitive with its node transform, its UVs and its own material's photo", () => {
    const capture = readCapture(scan(1));
    expect([...capture.positions]).toEqual([1, 2, 3, 2, 2, 3, 1, 3, 3]);
    expect([...capture.indices]).toEqual([0, 1, 2]);
    expect([...capture.uvs!]).toEqual([0, 0, 1, 0, 0, 1]);
    expect(capture.photo?.mimeType).toBe("image/jpeg");
  });

  it("refuses a scan split over several primitives, instead of reading a fragment of it", () => {
    expect(() => readCapture(scan(3))).toThrow(/3 parts/);
  });
});
