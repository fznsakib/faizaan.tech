import { describe, expect, it } from "vitest";

import { boundaryEdges, compactMesh, cropTriangles, insideCrop, largestComponent, vertexNeighbours } from "./mesh.ts";

import type { CropParams } from "./mesh.ts";

// A quad (triangles 0, 1) sharing an edge, a triangle touching the quad at one vertex (2),
// and a separate triangle (3).
const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 2, 4, 5, 6, 7, 8]);

describe("largestComponent", () => {
  it("keeps the triangles connected through shared vertices and drops the loose ones", () => {
    expect([...largestComponent(indices, 9)]).toEqual([0, 1, 2, 0, 2, 3, 2, 4, 5]);
  });

  it("picks the component with the most triangles", () => {
    const loose = new Uint32Array([0, 1, 2, 3, 4, 5, 3, 5, 6, 3, 6, 7]);
    expect([...largestComponent(loose, 8)]).toEqual([3, 4, 5, 3, 5, 6, 3, 6, 7]);
  });

  it("returns nothing for an empty mesh", () => {
    expect(largestComponent(new Uint32Array(), 0).length).toBe(0);
  });
});

describe("insideCrop", () => {
  const crop: CropParams = { centre: [0, 0], radii: [2, 1], minDepth: -1, minY: -0.5, maxY: 0.8 };

  it("keeps points inside the elliptical face window and in front of the depth cut", () => {
    expect(insideCrop([0, 0, 0], crop)).toBe(true);
    expect(insideCrop([1.9, 0, 0], crop)).toBe(true);
  });

  it("drops points outside the window", () => {
    expect(insideCrop([1.5, 0.7, 0], crop)).toBe(false);
    expect(insideCrop([2.1, 0, 0], crop)).toBe(false);
  });

  it("drops points behind the depth cut", () => {
    expect(insideCrop([0, 0, -1.01], crop)).toBe(false);
  });

  it("drops points below the chin cut and above the top cut", () => {
    expect(insideCrop([0, -0.6, 0], crop)).toBe(false);
    expect(insideCrop([0, 0.85, 0], crop)).toBe(false);
  });
});

describe("cropTriangles", () => {
  it("keeps a triangle only when all three corners pass", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 0]);
    const tris = new Uint32Array([0, 1, 2, 1, 3, 2]);
    expect([...cropTriangles(positions, tris, ([x]) => x < 2)]).toEqual([0, 1, 2]);
  });
});

describe("compactMesh", () => {
  it("drops unused vertices and renumbers the triangles", () => {
    const positions = new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]);
    const out = compactMesh(positions, new Uint32Array([3, 1, 3]));
    expect([...out.positions]).toEqual([3, 3, 3, 1, 1, 1]);
    expect([...out.indices]).toEqual([0, 1, 0]);
    expect([...out.sourceIndex]).toEqual([3, 1]);
  });
});

describe("boundaryEdges", () => {
  it("lists the edges used by exactly one triangle", () => {
    const edges = boundaryEdges(new Uint32Array([0, 1, 2, 0, 2, 3]));
    const sorted = edges.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join("-")).sort();
    expect(sorted).toEqual(["0-1", "0-3", "1-2", "2-3"]);
  });
});

describe("vertexNeighbours", () => {
  it("lists each vertex's one-ring once", () => {
    const rings = vertexNeighbours(new Uint32Array([0, 1, 2, 0, 2, 3]), 4);
    expect([...rings[0]].sort()).toEqual([1, 2, 3]);
    expect([...rings[1]].sort()).toEqual([0, 2]);
  });
});
