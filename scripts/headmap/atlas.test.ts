import { describe, expect, it } from "vitest";

import { azimuth, layoutAtlas, rasterizeTriangle, splitCorners, unwrapTriangle } from "./atlas.ts";

describe("splitCorners", () => {
  // Two triangles sharing the edge 1–2: (0, 1, 2) and (2, 1, 3).
  const indices = new Uint32Array([0, 1, 2, 2, 1, 3]);

  it("keeps shared vertices shared when their corners carry the same key", () => {
    const out = splitCorners(indices, new Uint32Array(6));
    expect(out.source.length).toBe(4);
    expect([...out.indices].map((i) => out.source[i])).toEqual([...indices]);
  });

  it("gives each key of a vertex its own copy, pointing back at the original", () => {
    const out = splitCorners(indices, new Uint32Array([0, 0, 0, 1, 1, 1]));
    expect(out.source.length).toBe(6);
    expect([...out.indices].map((i) => out.source[i])).toEqual([...indices]);
    expect(out.indices[1]).not.toBe(out.indices[4]); // vertex 1 split between the triangles
    expect([...out.indices].map((i) => out.key[i])).toEqual([0, 0, 0, 1, 1, 1]);
  });
});

describe("azimuth", () => {
  it("is 0.5 straight ahead (+z), 0.75 to the viewer's right (+x) and wraps behind the head", () => {
    expect(azimuth(0, 1, 0, 0)).toBeCloseTo(0.5);
    expect(azimuth(1, 0, 0, 0)).toBeCloseTo(0.75);
    expect(azimuth(-1, 0, 0, 0)).toBeCloseTo(0.25);
    expect(azimuth(1e-9, -1, 0, 0)).toBeCloseTo(1);
    expect(azimuth(-1e-9, -1, 0, 0)).toBeCloseTo(0);
  });
});

describe("unwrapTriangle", () => {
  it("leaves a triangle away from the seam alone", () => {
    expect(unwrapTriangle([0.4, 0.45, 0.5])).toEqual({ u: [0.4, 0.45, 0.5], wrapped: [0, 0, 0] });
  });

  it("moves the corners on the near side of the seam past 1, so the triangle never spans the atlas", () => {
    const { u, wrapped } = unwrapTriangle([0.98, 0.02, 0.99]);
    expect(u[0]).toBeCloseTo(0.98);
    expect(u[1]).toBeCloseTo(1.02);
    expect(u[2]).toBeCloseTo(0.99);
    expect(wrapped).toEqual([0, 1, 0]);
  });
});

describe("layoutAtlas", () => {
  const options = { frontDensity: 88, maxDensity: 60, gutter: 8, minBand: 640 };
  const layout = layoutAtlas(2048, { w: 13, h: 14 }, { w: 13, h: 15 }, { w: 44, h: 16 }, { w: 7, h: 6 }, options);
  const rects = [layout.front, layout.top, layout.band, layout.bottom];

  it("keeps every chart inside the atlas, apart by at least the gutter", () => {
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(8);
      expect(r.y).toBeGreaterThanOrEqual(8);
      expect(r.x + r.w).toBeLessThanOrEqual(2048 - 8);
      expect(r.y + r.h).toBeLessThanOrEqual(2048 - 8);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const [a, b] = [rects[i], rects[j]];
        const apart = a.x + a.w + 8 <= b.x || b.x + b.w + 8 <= a.x || a.y + a.h + 8 <= b.y || b.y + b.h + 8 <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it("gives the face its target density and the rest what's left, the band at least its minimum height", () => {
    expect(layout.front.scaleU).toBeCloseTo(88);
    expect(layout.front.scaleV).toBeCloseTo(88);
    expect(layout.top.scaleU).toBe(layout.top.scaleV);
    expect(layout.top.scaleU).toBeLessThanOrEqual(60);
    expect(layout.top.w).toBeLessThanOrEqual(Math.ceil(13 * layout.top.scaleU));
    expect(layout.bottom.scaleU).toBe(layout.bottom.scaleV);
    expect(layout.bottom.scaleU).toBeGreaterThan(20);
    expect(layout.band.h).toBeGreaterThanOrEqual(640);
    expect(layout.band.scaleU * 44).toBeLessThanOrEqual(layout.band.w + 1e-9);
  });

  it("keeps room for the under-neck chart when the crown is taller than the face chart", () => {
    const tall = layoutAtlas(2048, { w: 13, h: 10 }, { w: 5, h: 30 }, { w: 44, h: 16 }, { w: 7, h: 6 }, options);
    for (const r of [tall.front, tall.top, tall.band, tall.bottom]) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
      expect(r.scaleU).toBeGreaterThan(0);
      expect(r.scaleV).toBeGreaterThan(0);
    }
    expect(tall.bottom.y).toBeGreaterThanOrEqual(tall.top.y + tall.top.h + 8);
    expect(tall.bottom.y + tall.bottom.h).toBeLessThanOrEqual(tall.front.y + tall.front.h);
  });

  it("refuses a layout with no room for a chart instead of overlapping them", () => {
    expect(() => layoutAtlas(64, { w: 13, h: 14 }, { w: 13, h: 15 }, { w: 44, h: 16 }, { w: 7, h: 6 }, { ...options, minBand: 60 })).toThrow(/atlas/);
  });

  it("gives up face density before the band's minimum when the face is too big", () => {
    const tight = layoutAtlas(2048, { w: 18, h: 18 }, { w: 13, h: 15 }, { w: 44, h: 16 }, { w: 7, h: 6 }, options);
    expect(tight.front.scaleU).toBeLessThan(88);
    expect(tight.band.h).toBeGreaterThanOrEqual(640);
  });
});

describe("rasterizeTriangle", () => {
  it("visits exactly the texels whose centres fall inside, with barycentrics that rebuild the centre", () => {
    const seen: [number, number][] = [];
    rasterizeTriangle([0, 0], [4, 0], [0, 4], 8, 8, (x, y, w0, w1, w2) => {
      seen.push([x, y]);
      expect(w0 + w1 + w2).toBeCloseTo(1);
      expect(w1 * 4).toBeCloseTo(x + 0.5);
      expect(w2 * 4).toBeCloseTo(y + 0.5);
    });
    // centres (x + 0.5, y + 0.5) with x + y + 1 <= 4
    expect(seen.length).toBe(10);
  });

  it("covers a square split into two triangles without a gap", () => {
    const hits = new Uint8Array(16);
    const mark = (x: number, y: number) => void hits[y * 4 + x]++;
    rasterizeTriangle([0, 0], [4, 0], [0, 4], 4, 4, mark);
    rasterizeTriangle([4, 0], [4, 4], [0, 4], 4, 4, mark);
    expect([...hits].every((h) => h >= 1)).toBe(true);
  });

  it("stays inside the image", () => {
    let count = 0;
    rasterizeTriangle([-5, -5], [20, -5], [-5, 20], 4, 4, (x, y) => {
      expect(x >= 0 && y >= 0 && x < 4 && y < 4).toBe(true);
      count++;
    });
    expect(count).toBe(16);
  });
});
