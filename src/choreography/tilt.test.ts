import { describe, expect, it } from "vitest";

import { TILT_RANGE, TiltCalibration, tiltLook } from "./tilt";

import type { Attitude } from "./tilt";

const D = Math.PI / 180;

/**
 * The beta/gamma a phone reports (W3C conventions: beta −180..180, gamma −90..90) when its screen is raised `raise°`
 * from flat (90 = upright), its right edge dips `dip°`, and the screen is rotated by `angle` — built from gravity, so
 * it has the real sensor's flips near upright.
 */
function hold(raise: number, dip: number, angle = 0): Attitude {
  // gravity's "up" in screen axes (x right, y up, z out of the screen)
  const xs = -Math.sin(dip * D);
  const ys = Math.cos(dip * D) * Math.sin(raise * D);
  const zs = Math.cos(dip * D) * Math.cos(raise * D);
  // screen axes → the phone's own axes
  const a = angle * D;
  const ux = xs * Math.cos(a) + ys * Math.sin(a);
  const uy = -xs * Math.sin(a) + ys * Math.cos(a);
  const sign = zs < 0 ? -1 : 1;
  return {
    beta: Math.atan2(uy, sign * Math.hypot(ux, zs)) / D,
    gamma: Math.atan(-ux / (zs === 0 ? 1e-9 : zs)) / D,
  };
}

describe("tiltLook", () => {
  it("is centred at the calibrated attitude", () => {
    const look = tiltLook(hold(60, 0), hold(60, 0), 0);
    expect(look.x).toBeCloseTo(0);
    expect(look.y).toBeCloseTo(0);
  });

  it("turns right as the right edge dips, however far back the phone is held (portrait)", () => {
    for (const raise of [30, 60, 80, 90]) {
      expect(tiltLook(hold(raise, 10), hold(raise, 0), 0).x).toBeCloseTo(10 / TILT_RANGE);
    }
  });

  it("looks up when the top tips away, down when it tips back (portrait)", () => {
    expect(tiltLook(hold(50, 0), hold(60, 0), 0).y).toBeCloseTo(10 / TILT_RANGE);
    expect(tiltLook(hold(70, 0), hold(60, 0), 0).y).toBeCloseTo(-10 / TILT_RANGE);
  });

  it("clamps to the mouse-follow range (-1..1)", () => {
    expect(tiltLook(hold(60, 50), hold(60, 0), 0).x).toBe(1);
    expect(tiltLook(hold(60, -50), hold(60, 0), 0).x).toBe(-1);
    expect(tiltLook(hold(0, 0), hold(60, 0), 0).y).toBe(1);
  });

  it.each([90, 180, 270, -90])("reads the same gestures the same way with the screen at %i°", (angle) => {
    const level = hold(60, 0, angle);
    expect(tiltLook(hold(60, 10, angle), level, angle).x).toBeCloseTo(10 / TILT_RANGE);
    expect(tiltLook(hold(60, 10, angle), level, angle).y).toBeCloseTo(0);
    expect(tiltLook(hold(50, 0, angle), level, angle).y).toBeCloseTo(10 / TILT_RANGE);
    expect(tiltLook(hold(50, 0, angle), level, angle).x).toBeCloseTo(0);
  });

  it("maps the landscape axes from the raw sensor (phone's top to the left, angle 90)", () => {
    const level = { beta: 0, gamma: -60 };
    // the screen's right edge is the phone's bottom edge: dipping it raises beta
    expect(tiltLook({ beta: 10, gamma: -60 }, level, 90).x).toBeCloseTo(10 / TILT_RANGE);
    // the screen's top edge is the phone's right edge: tipping it away raises gamma
    expect(tiltLook({ beta: 0, gamma: -50 }, level, 90).y).toBeCloseTo(10 / TILT_RANGE);
  });

  it.each([0, 90, 180, 270])("has no jumps as the phone passes upright (screen at %i°)", (angle) => {
    const level = hold(60, 0, angle);
    for (const dip of [-3, 1, 3]) {
      let last = tiltLook(hold(60, dip, angle), level, angle);
      for (let raise = 60.5; raise <= 130; raise += 0.5) {
        const look = tiltLook(hold(raise, dip, angle), level, angle);
        expect(Math.abs(look.x - last.x)).toBeLessThan(0.05);
        expect(Math.abs(look.y - last.y)).toBeLessThan(0.05);
        last = look;
      }
    }
  });

  it("doesn't whip round when a landscape hold tips just past vertical", () => {
    const level = hold(60, 0, 90);
    const look = tiltLook(hold(91, 0.5, 90), level, 90);
    expect(Math.abs(look.x)).toBeLessThan(0.1);
    expect(look.y).toBe(-1);
  });

  it("measures the tip the short way round across face-down (±180°)", () => {
    expect(tiltLook({ beta: -175, gamma: 0 }, { beta: 175, gamma: 0 }, 0).y).toBeCloseTo(-10 / TILT_RANGE);
    expect(tiltLook({ beta: 175, gamma: 0 }, { beta: -175, gamma: 0 }, 0).y).toBeCloseTo(10 / TILT_RANGE);
  });
});

describe("TiltCalibration", () => {
  it("takes the first reading as level", () => {
    const calibration = new TiltCalibration();
    expect(calibration.look(hold(40, 5), 0).x).toBeCloseTo(0);
    expect(calibration.look(hold(40, 15), 0).x).toBeCloseTo(10 / TILT_RANGE);
  });

  it("re-levels on the first reading after calibrate()", () => {
    const calibration = new TiltCalibration();
    calibration.look(hold(40, 0), 0);
    calibration.calibrate();
    expect(calibration.look(hold(70, 0, 90), 90).y).toBeCloseTo(0);
    expect(calibration.look(hold(60, 0, 90), 90).y).toBeCloseTo(10 / TILT_RANGE);
  });

  it("levels at a given reading straight away (the attitude at the moment of entering)", () => {
    const calibration = new TiltCalibration();
    calibration.calibrate(hold(30, 20));
    expect(calibration.look(hold(30, 30), 0).x).toBeCloseTo(10 / TILT_RANGE);
  });
});
