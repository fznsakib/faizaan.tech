import type { Vec3 } from "./ray.ts";
import type { MeshData } from "./transfer.ts";
import type { Document } from "@gltf-transform/core";

/** The first mesh's positions with its node transform applied, mapped into the face frame. */
export function readMesh(doc: Document, frame: (p: Vec3) => Vec3): MeshData {
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

/**
 * A phone capture: its one mesh (positions in its own frame, y up, face toward +z), its UVs and its photo. Scanning apps
 * can split a scan over several primitives, one per texture; reading only the first would quietly lose most of the
 * head, so such a scan is refused with a message saying how to export it.
 */
export function readCapture(doc: Document) {
  const parts = doc.getRoot().listMeshes().reduce((n, mesh) => n + mesh.listPrimitives().length, 0);
  if (parts !== 1) {
    const textures = doc.getRoot().listTextures().length;
    throw new Error(
      `the capture is split over ${parts} parts (${textures} textures); export it as one mesh with one texture ` +
        `(in the scanning app, or merge it in Blender and bake one texture) and run again`
    );
  }
  const mesh = readMesh(doc, (p) => p);
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const uvs = prim.getAttribute("TEXCOORD_0")?.getArray();
  const texture = prim.getMaterial()?.getBaseColorTexture();
  return {
    ...mesh,
    uvs: uvs ? new Float32Array(uvs) : undefined,
    photo: texture ? { image: texture.getImage()!, mimeType: texture.getMimeType() } : undefined,
  };
}
