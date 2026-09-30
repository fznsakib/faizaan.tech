import { describe, expect, it } from "vitest";

import { CAMERA_Z, COPPER_FIT, fitCamera, HEAD_CENTRE, HEAD_HEIGHT, HEAD_WIDTH, SKIN_FIT, TAN_HALF_FOV } from "./fit";

import type { HeadFit } from "./fit";

/** The head's on-screen share of the viewport's width and height, and its centre (from the top), for a fit. */
function onScreen(width: number, height: number, head: HeadFit = COPPER_FIT, fit = fitCamera(width, height, head)) {
  const scale = CAMERA_Z / fit.z;
  const centreY = (0.5 - head.centre) * 2 * CAMERA_Z * TAN_HALF_FOV; // world height of the head's centre
  const centre = 0.5 - (centreY - fit.y) / (2 * fit.z * TAN_HALF_FOV);
  return { w: (head.width * height * scale) / width, h: head.height * scale, centre };
}

describe("fitCamera", () => {
  it.each([
    [1440, 900],
    [1280, 800],
    [1920, 1080],
    [1024, 768],
    [2560, 1440],
  ])("keeps desktop %i×%i at exactly today's camera", (width, height) => {
    expect(fitCamera(width, height)).toEqual({ z: CAMERA_Z, y: 0 });
  });

  it.each([
    ["iPhone 15", 393, 852],
    ["Android", 412, 915],
  ])("fits the head to 60–70%% of the width and at most 45%% of the height on %s", (_, width, height) => {
    const { w, h } = onScreen(width, height);
    expect(w).toBeGreaterThanOrEqual(0.6);
    expect(w).toBeLessThanOrEqual(0.7);
    expect(h).toBeLessThanOrEqual(0.451);
  });

  it("lets the height bind on a squatter phone (iPhone SE)", () => {
    const { w, h } = onScreen(375, 667);
    expect(h).toBeCloseTo(0.45, 2);
    expect(w).toBeLessThanOrEqual(0.7);
  });

  it("keeps a landscape phone's head no bigger than desktop's share of the height", () => {
    const { w, h, centre } = onScreen(852, 393);
    expect(h).toBeLessThanOrEqual(HEAD_HEIGHT);
    expect(w).toBeLessThanOrEqual(0.7);
    expect(centre).toBeCloseTo(HEAD_CENTRE, 5);
  });

  it.each([
    ["iPhone 15", 393, 852],
    ["iPhone SE", 375, 667],
    ["Android", 412, 915],
  ])("raises the head in portrait to sit between the name and the subtitles (%s)", (_, width, height) => {
    expect(onScreen(width, height).centre).toBeCloseTo(0.4, 2);
  });

  it("never brings the camera closer than today", () => {
    for (let width = 280; width <= 3000; width += 40) {
      for (let height = 280; height <= 1600; height += 40) {
        expect(fitCamera(width, height).z).toBeGreaterThanOrEqual(CAMERA_Z);
      }
    }
  });

  it("changes smoothly through a resize or rotation, with no jumps", () => {
    let last = fitCamera(360, 900);
    for (let width = 362; width <= 1800; width += 2) {
      const fit = fitCamera(width, 900);
      expect(Math.abs(fit.z - last.z)).toBeLessThan(0.05);
      expect(Math.abs(fit.y - last.y)).toBeLessThan(0.05);
      last = fit;
    }
  });

  it("fits the copper head by default, from the measured constants", () => {
    expect(COPPER_FIT).toEqual({ width: HEAD_WIDTH, height: HEAD_HEIGHT, centre: HEAD_CENTRE });
    expect(fitCamera(393, 852)).toEqual(fitCamera(393, 852, COPPER_FIT));
  });

  it.each([
    ["iPhone 15", 393, 852],
    ["iPhone SE", 375, 667],
    ["Android", 412, 915],
  ])("fits the skin head by its own measurements on %s", (_, width, height) => {
    const { w, h, centre } = onScreen(width, height, SKIN_FIT);
    expect(w).toBeLessThanOrEqual(0.651);
    expect(h).toBeLessThanOrEqual(0.451);
    expect(centre).toBeCloseTo(0.4, 2);
  });

  it("keeps desktop at today's camera for the skin head too", () => {
    for (const [width, height] of [[1440, 900], [1280, 800], [1920, 1080], [2560, 1440]]) {
      expect(fitCamera(width, height, SKIN_FIT)).toEqual({ z: CAMERA_Z, y: 0 });
    }
  });

  it("falls back to today's distance for an unmeasured (zero-size) canvas", () => {
    expect(fitCamera(0, 0)).toEqual({ z: CAMERA_Z, y: 0 });
    expect(fitCamera(390, 0)).toEqual({ z: CAMERA_Z, y: 0 });
  });
});
