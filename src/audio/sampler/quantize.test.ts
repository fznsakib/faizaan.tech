import { describe, expect, it } from "vitest";

import { nextSixteenth } from "./quantize";

describe("nextSixteenth", () => {
  it("snaps forward to the next 16th at least 10 ms ahead", () => {
    expect(nextSixteenth(0.1, 0, 120)).toBeCloseTo(0.125);
    expect(nextSixteenth(0.12, 0, 120)).toBeCloseTo(0.25);
    expect(nextSixteenth(1.02, 0, 120)).toBeCloseTo(1.125);
  });

  it("follows the track's first beat, including before it", () => {
    expect(nextSixteenth(0.5, 0.03, 113.01)).toBeCloseTo(0.03 + 4 * (60 / 113.01 / 4));
    expect(nextSixteenth(-0.3, 0.5, 120)).toBeCloseTo(-0.25);
  });
});
