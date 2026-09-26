import { describe, expect, it } from "vitest";

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

  it("joins triangles whose corners share a position when given a weld map", () => {
    // Two 2-triangle pieces split along a UV seam (vertices 3/4 are the same points as 1/2), and a 3-triangle piece.
    const split = new Uint32Array([0, 1, 2, 0, 2, 11, 3, 5, 4, 4, 5, 10, 6, 7, 8, 6, 8, 9, 6, 9, 12]);
    const canon = new Uint32Array([0, 1, 2, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect([...largestComponent(split, 13)]).toEqual([6, 7, 8, 6, 8, 9, 6, 9, 12]);
    expect([...largestComponent(split, 13, canon)]).toEqual([0, 1, 2, 0, 2, 11, 3, 5, 4, 4, 5, 10]);
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

describe("weldMap", () => {
  it("maps every vertex to the first vertex at the same position", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0]);
    expect([...weldMap(positions)]).toEqual([0, 1, 0, 1, 4]);
  });
});

describe("distanceToSegments2D", () => {
  // Segments as x0, y0, x1, y1 quadruples: the bottom and right sides of the unit square.
  const rim = new Float32Array([0, 0, 1, 0, 1, 0, 1, 1]);

  it("measures to the nearest point on the nearest segment", () => {
    expect(distanceToSegments2D(0.5, 0.25, rim)).toBeCloseTo(0.25, 6);
    expect(distanceToSegments2D(0.9, 0.5, rim)).toBeCloseTo(0.1, 6);
  });

  it("measures to an endpoint when the point is past the segment's end", () => {
    expect(distanceToSegments2D(-3, 4, rim)).toBeCloseTo(5, 6);
  });

  it("is infinite with no segments", () => {
    expect(distanceToSegments2D(0, 0, new Float32Array())).toBe(Infinity);
  });
});

describe("foldedTriangles", () => {
  // Two triangles of a quad facing +z, plus one wound the other way (facing -z).
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
  const tris = new Uint32Array([0, 1, 2, 0, 2, 3, 0, 3, 2]);

  it("counts the triangles facing away from +z", () => {
    expect(foldedTriangles(positions, tris, () => true)).toBe(1);
  });

  it("only counts the triangles the filter includes", () => {
    expect(foldedTriangles(positions, tris, (t) => t < 2)).toBe(0);
  });
});

describe("rimSegments", () => {
  it("packs each rim edge as x0, y0, x1, y1 from per-vertex x, y points", () => {
    const points = new Float32Array([0, 0, 1, 0, 1, 2]);
    expect([...rimSegments(points, [[0, 1], [1, 2]])]).toEqual([0, 0, 1, 0, 1, 0, 1, 2]);
  });
});
