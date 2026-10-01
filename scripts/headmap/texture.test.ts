import { describe, expect, it } from "vitest";

import { dilate, interpolateCorners, normalizedUint, sampleRgb } from "./texture.ts";

describe("interpolateCorners", () => {
  // Three corners with 2-component values (UVs), stride 2.
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);

  it("weights the corners by the hit's barycentric coordinates", () => {
    expect(interpolateCorners(uvs, 2, 0, 1, 2, 0.25, 0.5)).toEqual([0.25, 0.5]);
    expect(interpolateCorners(uvs, 2, 0, 1, 2, 0, 0)).toEqual([0, 0]);
  });
});

describe("sampleRgb", () => {
  // 2×1 RGBA image: left texel red, right texel blue.
  const image = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]);

  it("reads texel centres exactly (u = (i + 0.5) / width, v down from the top)", () => {
    expect(sampleRgb(image, 2, 1, 0.25, 0.5)).toEqual([255, 0, 0]);
    expect(sampleRgb(image, 2, 1, 0.75, 0.5)).toEqual([0, 0, 255]);
  });

  it("blends between texel centres and clamps at the borders", () => {
    expect(sampleRgb(image, 2, 1, 0.5, 0.5)).toEqual([127.5, 0, 127.5]);
    expect(sampleRgb(image, 2, 1, -1, 3)).toEqual([255, 0, 0]);
  });
});

describe("dilate", () => {
  it("grows filled texels outward by averaging their filled neighbours, one ring per pass", () => {
    // 5×1: only the middle texel is filled.
    const rgb = new Float32Array([0, 0, 0, 0, 0, 0, 90, 60, 30, 0, 0, 0, 0, 0, 0]);
    const filled = new Uint8Array([0, 0, 1, 0, 0]);
    const once = dilate(rgb, filled, 5, 1, 1);
    expect([...once.subarray(3, 6)]).toEqual([90, 60, 30]);
    expect([...once.subarray(0, 3)]).toEqual([90, 60, 30]); // unreached texels fall back to the mean
  });

  it("never changes texels that were filled", () => {
    const rgb = new Float32Array([10, 10, 10, 200, 200, 200, 0, 0, 0]);
    const out = dilate(rgb, new Uint8Array([1, 1, 0]), 3, 1, 4);
    expect([...out.subarray(0, 6)]).toEqual([10, 10, 10, 200, 200, 200]);
    expect([...out.subarray(6, 9)]).toEqual([200, 200, 200]);
  });
});

describe("normalizedUint", () => {
  it("packs 0..1 into the full unsigned range, clamping outside it", () => {
    expect([...normalizedUint(new Float32Array([0, 0.5, 1, -0.2, 1.3]), 8)]).toEqual([0, 128, 255, 0, 255]);
    expect([...normalizedUint(new Float32Array([0, 1]), 16)]).toEqual([0, 65535]);
  });
});
