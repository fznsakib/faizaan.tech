import { describe, expect, it } from "vitest";

import { createFFT } from "./fft.ts";

describe("createFFT", () => {
  it("puts a cosine's energy in its bin and the mirror bin", () => {
    const n = 16;
    const fft = createFFT(n);
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 4 * i) / n);
    fft(re, im);
    const magnitude = Array.from(re, (r, k) => Math.hypot(r, im[k]));
    expect(magnitude[4]).toBeCloseTo(8, 6);
    expect(magnitude[12]).toBeCloseTo(8, 6);
    magnitude.forEach((m, k) => {
      if (k !== 4 && k !== 12) expect(m).toBeCloseTo(0, 6);
    });
  });

  it("rejects sizes that are not powers of two", () => {
    expect(() => createFFT(12)).toThrow(/power of two/);
  });
});
