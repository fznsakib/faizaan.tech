/**
 * Camera fit: how far back the r3f camera sits so the head suits the viewport. The camera's fov is vertical, so at a
 * fixed distance the head keeps its share of the height and overfills a narrow (portrait) screen's width. Desktop
 * keeps today's distance exactly; phones pull back until the head fits.
 */

/** Today's camera distance, and the nearest the fit ever puts it. */
export const CAMERA_Z = 5;
/** The head's on-screen width at CAMERA_Z, as a share of the viewport height (measured, ears included). */
export const HEAD_WIDTH = 0.41;
/** The head's on-screen height at CAMERA_Z, as a share of the viewport height (measured, crown to neck). */
export const HEAD_HEIGHT = 0.654;
/** Widest share of the viewport width the head may take. */
const MAX_WIDTH = 0.65;
/** Tallest share of the viewport height the head may take in portrait, leaving room for the name and the text. */
const PORTRAIT_HEIGHT = 0.45;
/** Aspect ratios over which the height limit eases from PORTRAIT_HEIGHT to none (above HEAD_HEIGHT). */
const EASE_FROM = 0.75;
const EASE_TO = 1.25;

/** Largest share of the viewport height the head may fill at this aspect ratio (width / height). */
function maxHeight(aspect: number): number {
  const t = Math.min(1, Math.max(0, (aspect - EASE_FROM) / (EASE_TO - EASE_FROM)));
  const eased = t * t * (3 - 2 * t);
  return PORTRAIT_HEIGHT + (HEAD_HEIGHT - PORTRAIT_HEIGHT) * eased;
}

/** Camera distance for a `width`×`height` (CSS px) canvas: CAMERA_Z unless the head would overfill it. */
export function fitCamera(width: number, height: number): number {
  if (width <= 0 || height <= 0) return CAMERA_Z;
  const aspect = width / height;
  const widthShare = HEAD_WIDTH / aspect;
  return CAMERA_Z * Math.max(1, widthShare / MAX_WIDTH, HEAD_HEIGHT / maxHeight(aspect));
}
