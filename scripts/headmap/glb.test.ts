import { describe, expect, it } from "vitest";

import { skinHeadDocument } from "./glb.ts";

// Two triangles in the face frame (y up, face toward +z).
const head = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 2, 0.5, 1, 2, -0.5]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0.6, 0.8, 0, -0.6, 0.8]),
  indices: new Uint32Array([0, 1, 2, 2, 1, 3]),
  uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
  hair: new Float32Array([0, 0.5, 1, 0.25]),
};

describe("skinHeadDocument", () => {
  const doc = skinHeadDocument(head);
  const node = doc.getRoot().listNodes()[0];
  const prim = node.getMesh()!.listPrimitives()[0];

  it("stores positions quantised in the stock's scene space (x, y, z) → (−x, z, y), undone by the node transform", () => {
    const pos = prim.getAttribute("POSITION")!;
    expect(pos.getComponentSize()).toBe(2);
    expect(pos.getNormalized()).toBe(false);
    const t = node.getTranslation(), s = node.getScale()[0];
    const el: number[] = [];
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = pos.getElement(i, el).map((v, k) => v * s + t[k]);
      const [fx, fy, fz] = head.positions.subarray(i * 3, i * 3 + 3);
      expect(x).toBeCloseTo(-fx, 3);
      expect(y).toBeCloseTo(fz, 3);
      expect(z).toBeCloseTo(fy, 3);
    }
  });

  it("packs normals, UVs and the hair weight as normalised integers", () => {
    const normal = prim.getAttribute("NORMAL")!, uv = prim.getAttribute("TEXCOORD_0")!, hair = prim.getAttribute("_HAIRWEIGHT")!;
    expect([normal.getComponentSize(), uv.getComponentSize(), hair.getComponentSize()]).toEqual([1, 2, 1]);
    expect([normal.getNormalized(), uv.getNormalized(), hair.getNormalized()]).toEqual([true, true, true]);
    expect(normal.getElement(2, [])[2]).toBeCloseTo(0.6, 1); // face-frame y → scene z
    expect(uv.getElement(3, [])).toEqual([1, 1]);
    expect(hair.getElement(1, [])[0]).toBeCloseTo(0.5, 2);
  });

  it("keeps the triangles, in 16-bit indices when they fit, and requires the stock's extensions", () => {
    expect([...prim.getIndices()!.getArray()!]).toEqual([0, 1, 2, 2, 1, 3]);
    expect(prim.getIndices()!.getComponentSize()).toBe(2);
    const used = doc.getRoot().listExtensionsUsed().map((e) => [e.extensionName, e.isRequired()]);
    expect(used).toEqual(expect.arrayContaining([["KHR_mesh_quantization", true], ["EXT_meshopt_compression", true]]));
  });
});
