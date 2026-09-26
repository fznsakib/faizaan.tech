/**
 * Phone tilt → head look. A DeviceOrientationEvent's beta/gamma are Euler angles fixed to the phone, and they flip
 * (gamma by ±180°) as the phone passes upright, the commonest hold. So the look is read from gravity instead: the
 * "up" vector in the screen's own axes (rotated by the screen's angle), from which the right edge's dip and the
 * screen's raise are continuous through upright and flat alike. The look is relative to a calibration (the attitude
 * on entering, again after a rotation) and pointer-like, so the head treats it exactly as the mouse: x right, y up,
 * each -1..1.
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

const D = Math.PI / 180;

/** The signed difference a − b, the short way round (−180..180). */
function turn(a: number, b: number): number {
  return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

const clamp = (v: number) => Math.min(1, Math.max(-1, v));

/**
 * How the screen sits (degrees): `dip`, how far its right edge is below level; `raise`, how far its face is tipped
 * up from flat (90 = upright, past 90 = leaning back toward the viewer).
 */
function screenPose({ beta, gamma }: Attitude, angle: number): { dip: number; raise: number } {
  // gravity's "up" in the phone's axes (x right, y top, z out of the screen), from the W3C Z-X'-Y'' angles
  const ux = -Math.sin(gamma * D) * Math.cos(beta * D);
  const uy = Math.sin(beta * D);
  const uz = Math.cos(gamma * D) * Math.cos(beta * D);
  // the phone's axes → the screen's, turned by `screen.orientation.angle`
  const a = angle * D;
  const x = ux * Math.cos(a) - uy * Math.sin(a);
  const y = ux * Math.sin(a) + uy * Math.cos(a);
  return { dip: Math.asin(Math.max(-1, Math.min(1, -x))) / D, raise: Math.atan2(y, uz) / D };
}

/**
 * Where the head should look for `reading`, relative to `reference`, with the screen rotated by `angle`
 * (`screen.orientation.angle`: 0 portrait, 90 with the phone's top to the left, 180, 270 or -90). The head looks
 * "downhill": right when the screen's right edge dips, up when its top edge tips away.
 */
export function tiltLook(reading: Attitude, reference: Attitude, angle: number): Look {
  const now = screenPose(reading, angle);
  const level = screenPose(reference, angle);
  return {
    x: clamp((now.dip - level.dip) / TILT_RANGE),
    y: clamp(-turn(now.raise, level.raise) / TILT_RANGE),
  };
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
