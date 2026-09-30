/**
 * Camera fit: how far back the r3f camera sits so the head suits the viewport. The camera's fov is vertical, so at a
 * fixed distance the head keeps its share of the height and overfills a narrow (portrait) screen's width. Desktop
 * keeps today's distance exactly; phones pull back until the head fits.
 */

/** Today's camera distance, and the nearest the fit ever puts it. */
export const CAMERA_Z = 5;
/** The copper head's on-screen width at CAMERA_Z, as a share of the viewport height (measured, ears included). */
export const HEAD_WIDTH = 0.41;
/** The copper head's on-screen height at CAMERA_Z, as a share of the viewport height (measured, crown to neck). */
export const HEAD_HEIGHT = 0.654;
/** Where the copper head's centre sits at CAMERA_Z, as a share of the viewport height from the top (measured). */
export const HEAD_CENTRE = 0.489;

/** A head's on-screen size and centre at CAMERA_Z, as shares of the viewport height (see HEAD_WIDTH and co). */
export interface HeadFit {
  width: number;
  height: number;
  centre: number;
}

export const COPPER_FIT: HeadFit = { width: HEAD_WIDTH, height: HEAD_HEIGHT, centre: HEAD_CENTRE };
/**
 * The skin head: its hair makes it wider and taller than the copper head. Measured against the copper head in the same
 * idle frame (silhouettes 0.443 vs 0.414 wide, 0.757 vs 0.706 tall, centres 0.507 vs 0.512), scaled onto the copper
 * head's constants so both heads sit the same way in the layout.
 */
export const SKIN_FIT: HeadFit = { width: 0.439, height: 0.701, centre: 0.484 };
/** r3f's default camera: a 75° vertical field of view. */
export const TAN_HALF_FOV = Math.tan((75 / 2) * (Math.PI / 180));
/** Widest share of the viewport width the head may take. */
const MAX_WIDTH = 0.65;
/** Tallest share of the viewport height the head may take in portrait, leaving room for the name and the text. */
const PORTRAIT_HEIGHT = 0.45;
/**
 * Where the head's centre sits in portrait (share of the height from the top): midway between the name and the
 * subtitles stacked above the link dock.
 */
const PORTRAIT_CENTRE = 0.4;
/** Aspect ratios (width / height) over which portrait's limits ease off, gone by 5:4. */
const EASE_FROM = 0.75;
const EASE_TO = 1.25;

/** How portrait the viewport is: 1 up to EASE_FROM, easing to 0 by EASE_TO. */
function portrait(aspect: number): number {
  const t = Math.min(1, Math.max(0, (aspect - EASE_FROM) / (EASE_TO - EASE_FROM)));
  return 1 - t * t * (3 - 2 * t);
}

/**
 * The camera for a `width`×`height` (CSS px) canvas: today's (z = CAMERA_Z, y = 0) unless the head would overfill it.
 * `z` pulls back until the head fits; `y` lowers the camera so the head sits at PORTRAIT_CENTRE in portrait. `head` is
 * the head's measured size (the copper head's by default).
 */
export function fitCamera(width: number, height: number, head: HeadFit = COPPER_FIT): { z: number; y: number } {
  if (width <= 0 || height <= 0) return { z: CAMERA_Z, y: 0 };
  const aspect = width / height;
  const weight = portrait(aspect);
  const maxHeight = head.height + (PORTRAIT_HEIGHT - head.height) * weight;
  const z = CAMERA_Z * Math.max(1, head.width / aspect / MAX_WIDTH, head.height / maxHeight);
  if (weight === 0) return { z, y: 0 };
  const centre = head.centre + (PORTRAIT_CENTRE - head.centre) * weight;
  // the head's centre is fixed in the world; the camera moves so it lands `centre` of the way down the view
  const headY = (0.5 - head.centre) * 2 * CAMERA_Z * TAN_HALF_FOV;
  return { z, y: headY - (0.5 - centre) * 2 * z * TAN_HALF_FOV };
}
