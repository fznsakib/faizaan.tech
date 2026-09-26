/**
 * Phone tilt → head look. A DeviceOrientationEvent's beta (front-back, about the phone's x axis) and gamma
 * (left-right, about its y axis) are fixed to the phone, so the screen's rotation decides which one means
 * "left/right" on screen. The look is relative to a calibration (the attitude on entering, again after a
 * rotation) and pointer-like, so the head treats it exactly as the mouse: x right, y up, each -1..1.
 */

/** Degrees of tilt from the calibration that turn the head fully (to the mouse-follow's limits). */
export const TILT_RANGE = 25;

/** The phone's attitude, as DeviceOrientationEvent reports it (degrees). */
export interface Attitude {
  beta: number;
  gamma: number;
}

/** A pointer-like look target: x right, y up, each -1..1. */
export interface Look {
  x: number;
  y: number;
}

/** The signed difference a − b, the short way round (−180..180). */
function turn(a: number, b: number): number {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

const clamp = (v: number) => Math.min(1, Math.max(-1, v));

/**
 * Where the head should look for `reading`, relative to `reference`, with the screen rotated by `angle`
 * (`screen.orientation.angle`: 0 portrait, 90 with the phone's top to the left, 180, 270 or -90). The head looks
 * "downhill": right when the screen's right edge dips, up when its top edge tips away.
 */
export function tiltLook(reading: Attitude, reference: Attitude, angle: number): Look {
  const beta = turn(reading.beta, reference.beta);
  const gamma = turn(reading.gamma, reference.gamma);
  // right = the screen's right edge dipping; raise = its top edge coming up toward the viewer
  let right: number;
  let raise: number;
  switch (((Math.round(angle / 90) % 4) + 4) % 4) {
    case 1:
      right = beta;
      raise = -gamma;
      break;
    case 2:
      right = -gamma;
      raise = -beta;
      break;
    case 3:
      right = -beta;
      raise = gamma;
      break;
    default:
      right = gamma;
      raise = beta;
  }
  return { x: clamp(right / TILT_RANGE), y: clamp(-raise / TILT_RANGE) };
}

/** The level attitude, set on entering and again after a rotation. */
export class TiltCalibration {
  private reference: Attitude | null = null;

  /** Level at `reading`, or at the next reading when there isn't one yet. */
  calibrate(reading?: Attitude): void {
    this.reference = reading ? { beta: reading.beta, gamma: reading.gamma } : null;
  }

  look(reading: Attitude, angle: number): Look {
    this.reference ??= { beta: reading.beta, gamma: reading.gamma };
    return tiltLook(reading, this.reference, angle);
  }
}
