import { describe, expect, it } from "vitest";

import { colourDistance, fitColourModel, hairness, makeTileable, sampleWrapped, triplanarWeights } from "./colour.ts";

const skinSamples = Array.from({ length: 60 }, (_, i) => [190 + (i % 7) * 3, 140 + (i % 5) * 3, 115 + (i % 3) * 3]);
const hairSamples = Array.from({ length: 60 }, (_, i) => [35 + (i % 7) * 4, 28 + (i % 5) * 3, 24 + (i % 3) * 3]);

describe("fitColourModel / colourDistance", () => {
  const skin = fitColourModel(skinSamples);

  it("is near 0 at the model's mean and grows away from it", () => {
    const mean = skinSamples.reduce((m, s) => m.map((v, k) => v + s[k] / skinSamples.length), [0, 0, 0]);
    expect(colourDistance(skin, mean)).toBeLessThan(0.5);
    expect(colourDistance(skin, [200, 150, 120])).toBeLessThan(colourDistance(skin, [230, 225, 215]));
  });

  it("puts a pale wall, a red shirt and a green window far from the skin", () => {
    for (const room of [[222, 214, 200], [170, 30, 45], [120, 170, 90]]) expect(colourDistance(skin, room)).toBeGreaterThan(4);
  });
});

describe("hairness", () => {
  const skin = fitColourModel(skinSamples), hair = fitColourModel(hairSamples);

  it("is ~1 for hair colours, ~0 for skin, and in between for a mid shadow", () => {
    expect(hairness([45, 35, 28], skin, hair)).toBeGreaterThan(0.9);
    expect(hairness([195, 145, 118], skin, hair)).toBeLessThan(0.1);
    const mid = hairness([110, 80, 65], skin, hair);
    expect(mid).toBeGreaterThan(0.1);
    expect(mid).toBeLessThan(0.9);
  });
});

describe("makeTileable", () => {
  // A ramp across x: the least tileable patch there is (its left and right edges differ the most).
  const size = 32;
  const ramp = new Float32Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) ramp.set([x * 8, 100, 50], (y * size + x) * 3);
  const tile = makeTileable(ramp, size);

  it("wraps without a seam: across the edge it steps no more than it does inside", () => {
    let inside = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size - 1; x++) inside = Math.max(inside, Math.abs(tile[(y * size + x + 1) * 3] - tile[(y * size + x) * 3]));
    for (let y = 0; y < size; y++) {
      const across = Math.abs(tile[(y * size) * 3] - tile[(y * size + size - 1) * 3]);
      expect(across).toBeLessThanOrEqual(inside + 1e-6);
    }
  });

  it("keeps the patch's mean colour", () => {
    const mean = (img: Float32Array, k: number) => img.filter((_, i) => i % 3 === k).reduce((s, v) => s + v, 0) / (size * size);
    for (const k of [0, 1, 2]) expect(mean(tile, k)).toBeCloseTo(mean(ramp, k), 0);
  });
});

describe("sampleWrapped", () => {
  it("wraps around the tile and blends bilinearly", () => {
    const img = new Float32Array([0, 0, 0, 100, 100, 100]); // 2×1 as a 2-wide tile, height 1
    expect(sampleWrapped(img, 2, 1, 0.25, 0.5)).toEqual([0, 0, 0]);
    expect(sampleWrapped(img, 2, 1, 1.25, 0.5)).toEqual([0, 0, 0]);
    expect(sampleWrapped(img, 2, 1, 0.5, 0.5)[0]).toBeCloseTo(50);
    expect(sampleWrapped(img, 2, 1, 0, 0.5)[0]).toBeCloseTo(50); // between the last texel and the first
  });
});

describe("triplanarWeights", () => {
  it("sums to 1 and picks the facing axis for an axis-aligned normal", () => {
    expect(triplanarWeights([0, 1, 0], 4)).toEqual([0, 1, 0]);
    const w = triplanarWeights([0.6, 0, -0.8], 4);
    expect(w[0] + w[1] + w[2]).toBeCloseTo(1);
    expect(w[2]).toBeGreaterThan(w[0]);
  });
});
