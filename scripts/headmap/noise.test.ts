import { describe, expect, it } from "vitest";

import { fractalNoise, mulberry32, valueNoise } from "./noise.ts";

describe("mulberry32", () => {
  it("repeats the same sequence for the same seed, in 0..1", () => {
    const a = mulberry32(7), b = mulberry32(7);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("gives a different sequence for a different seed", () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("valueNoise", () => {
  const noise = valueNoise(3);

  it("stays within -1..1 and is the same for the same seed", () => {
    const again = valueNoise(3);
    for (let i = 0; i < 500; i++) {
      const p: [number, number, number] = [i * 0.37, i * 0.11 - 20, Math.sin(i) * 9];
      expect(Math.abs(noise(...p))).toBeLessThanOrEqual(1);
      expect(noise(...p)).toBe(again(...p));
    }
  });

  it("is continuous: a tiny step moves it a tiny amount, including across lattice cells", () => {
    for (const x of [0.2, 0.999, 1.0, 5.5, -3.001]) {
      expect(Math.abs(noise(x, 0.4, 0.7) - noise(x + 1e-4, 0.4, 0.7))).toBeLessThan(1e-2);
    }
  });

  it("actually varies, and a different seed gives a different field", () => {
    const samples = Array.from({ length: 50 }, (_, i) => noise(i * 0.73, i * 0.29, 0.5));
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.5);
    expect(valueNoise(4)(1.3, 2.7, 0.2)).not.toBe(noise(1.3, 2.7, 0.2));
  });
});

describe("fractalNoise", () => {
  it("sums octaves into a field still within -1..1", () => {
    const f = fractalNoise(5, 3);
    for (let i = 0; i < 300; i++) expect(Math.abs(f(i * 0.41, i * 0.17, -i * 0.05))).toBeLessThanOrEqual(1);
  });
});
