import { describe, expect, it } from "vitest";

import { TILT_RANGE, TiltCalibration, tiltLook } from "./tilt";

const LEVEL = { beta: 60, gamma: 0 }; // held upright-ish in portrait: the calibration

describe("tiltLook", () => {
  it("is centred at the calibrated attitude", () => {
    const look = tiltLook(LEVEL, LEVEL, 0);
    expect(look.x).toBeCloseTo(0);
    expect(look.y).toBeCloseTo(0);
  });

  it("turns right when the right edge dips (portrait)", () => {
    const look = tiltLook({ beta: 60, gamma: 10 }, LEVEL, 0);
    expect(look.x).toBeCloseTo(10 / TILT_RANGE);
    expect(look.y).toBeCloseTo(0);
  });

  it("looks up when the top tips away, down when it tips back (portrait)", () => {
    expect(tiltLook({ beta: 50, gamma: 0 }, LEVEL, 0).y).toBeCloseTo(10 / TILT_RANGE);
    expect(tiltLook({ beta: 70, gamma: 0 }, LEVEL, 0).y).toBeCloseTo(-10 / TILT_RANGE);
  });

  it("clamps to the mouse-follow range (-1..1)", () => {
    expect(tiltLook({ beta: 60, gamma: 80 }, LEVEL, 0).x).toBe(1);
    expect(tiltLook({ beta: 60, gamma: -80 }, LEVEL, 0).x).toBe(-1);
    expect(tiltLook({ beta: -20, gamma: 0 }, LEVEL, 0).y).toBe(1);
  });

  it("swaps and flips the axes in landscape (top of the phone to the left, angle 90)", () => {
    const level = { beta: 0, gamma: -60 };
    // the screen's right edge is the phone's bottom edge: dipping it raises beta
    expect(tiltLook({ beta: 10, gamma: -60 }, level, 90).x).toBeCloseTo(10 / TILT_RANGE);
    // the screen's top edge is the phone's right edge: tipping it away raises gamma
    expect(tiltLook({ beta: 0, gamma: -50 }, level, 90).y).toBeCloseTo(10 / TILT_RANGE);
    expect(tiltLook({ beta: 0, gamma: -50 }, level, 90).x).toBeCloseTo(0);
  });

  it("mirrors that in the other landscape (top of the phone to the right, angle 270 or -90)", () => {
    const level = { beta: 0, gamma: 60 };
    for (const angle of [270, -90]) {
      expect(tiltLook({ beta: -10, gamma: 60 }, level, angle).x).toBeCloseTo(10 / TILT_RANGE);
      expect(tiltLook({ beta: 0, gamma: 50 }, level, angle).y).toBeCloseTo(10 / TILT_RANGE);
    }
  });

  it("flips both axes upside down (angle 180)", () => {
    const level = { beta: -60, gamma: 0 };
    expect(tiltLook({ beta: -60, gamma: -10 }, level, 180).x).toBeCloseTo(10 / TILT_RANGE);
    expect(tiltLook({ beta: -50, gamma: 0 }, level, 180).y).toBeCloseTo(10 / TILT_RANGE);
  });

  it("measures beta the short way round across ±180°", () => {
    expect(tiltLook({ beta: -175, gamma: 0 }, { beta: 175, gamma: 0 }, 0).y).toBeCloseTo(-10 / TILT_RANGE);
    expect(tiltLook({ beta: 175, gamma: 0 }, { beta: -175, gamma: 0 }, 0).y).toBeCloseTo(10 / TILT_RANGE);
  });
});

describe("TiltCalibration", () => {
  it("takes the first reading as level", () => {
    const calibration = new TiltCalibration();
    expect(calibration.look({ beta: 40, gamma: 12 }, 0).x).toBeCloseTo(0);
    expect(calibration.look({ beta: 40, gamma: 22 }, 0).x).toBeCloseTo(10 / TILT_RANGE);
  });

  it("re-levels on the first reading after calibrate()", () => {
    const calibration = new TiltCalibration();
    calibration.look({ beta: 40, gamma: 0 }, 0);
    calibration.calibrate();
    expect(calibration.look({ beta: 10, gamma: -70 }, 90).y).toBeCloseTo(0);
    expect(calibration.look({ beta: 10, gamma: -60 }, 90).y).toBeCloseTo(10 / TILT_RANGE);
  });

  it("levels at a given reading straight away (the attitude at the moment of entering)", () => {
    const calibration = new TiltCalibration();
    calibration.calibrate({ beta: 30, gamma: 20 });
    expect(calibration.look({ beta: 30, gamma: 30 }, 0).x).toBeCloseTo(10 / TILT_RANGE);
  });
});
