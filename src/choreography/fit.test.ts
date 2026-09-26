import { describe, expect, it } from "vitest";

import { CAMERA_Z, fitCamera, HEAD_HEIGHT, HEAD_WIDTH } from "./fit";

/** The head's on-screen share of the viewport's width and height with the camera at `z`. */
function onScreen(width: number, height: number, z: number) {
  const scale = CAMERA_Z / z;
  return { w: (HEAD_WIDTH * height * scale) / width, h: HEAD_HEIGHT * scale };
}

describe("fitCamera", () => {
  it.each([
    [1440, 900],
    [1280, 800],
    [1920, 1080],
    [1024, 768],
    [2560, 1440],
  ])("keeps desktop %i×%i at exactly today's camera distance", (width, height) => {
    expect(fitCamera(width, height)).toBe(CAMERA_Z);
  });

  it.each([
    ["iPhone 15", 393, 852],
    ["Android", 412, 915],
  ])("fits the head to 60–70%% of the width and at most 45%% of the height on %s", (_, width, height) => {
    const { w, h } = onScreen(width, height, fitCamera(width, height));
    expect(w).toBeGreaterThanOrEqual(0.6);
    expect(w).toBeLessThanOrEqual(0.7);
    expect(h).toBeLessThanOrEqual(0.451);
  });

  it("lets the height bind on a squatter phone (iPhone SE)", () => {
    const { w, h } = onScreen(375, 667, fitCamera(375, 667));
    expect(h).toBeCloseTo(0.45, 2);
    expect(w).toBeLessThanOrEqual(0.7);
  });

  it("keeps a landscape phone's head no bigger than desktop's share of the height", () => {
    const { w, h } = onScreen(852, 393, fitCamera(852, 393));
    expect(h).toBeLessThanOrEqual(HEAD_HEIGHT);
    expect(w).toBeLessThanOrEqual(0.7);
  });

  it("never brings the camera closer than today", () => {
    for (let width = 280; width <= 3000; width += 40) {
      for (let height = 280; height <= 1600; height += 40) {
        expect(fitCamera(width, height)).toBeGreaterThanOrEqual(CAMERA_Z);
      }
    }
  });

  it("changes smoothly through a resize or rotation, with no jumps", () => {
    let last = fitCamera(360, 900);
    for (let width = 362; width <= 1800; width += 2) {
      const z = fitCamera(width, 900);
      expect(Math.abs(z - last)).toBeLessThan(0.05);
      last = z;
    }
  });

  it("falls back to today's distance for an unmeasured (zero-size) canvas", () => {
    expect(fitCamera(0, 0)).toBe(CAMERA_Z);
    expect(fitCamera(390, 0)).toBe(CAMERA_Z);
  });
});
