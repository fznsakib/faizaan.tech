import { describe, expect, it } from "vitest";

import { nearestSixteenth } from "./quantize";

describe("nearestSixteenth", () => {
  it("snaps to the closest 16th in either direction", () => {
    expect(nearestSixteenth(0.1, 0, 120)).toBeCloseTo(0.125);
    expect(nearestSixteenth(0.06, 0, 120)).toBeCloseTo(0.0);
    expect(nearestSixteenth(1.02, 0, 120)).toBeCloseTo(1.0);
  });

  it("follows the track's first beat, including before it", () => {
    expect(nearestSixteenth(0.5, 0.03, 113.01)).toBeCloseTo(0.03 + 4 * (60 / 113.01 / 4));
    expect(nearestSixteenth(-0.3, 0.5, 120)).toBeCloseTo(-0.25);
  });
});
