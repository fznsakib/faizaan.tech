export interface GlassMap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** How hard the glass bends at depth `s` into the bevel: 0 at the rim … 1 in the flat middle. */
const bend = (s: number) => (1 - s) ** 2;

/**
 * feDisplacementMap source for a rounded slab of thick glass: flat (128, 128) in the middle, and toward the rim
 * each pixel samples from further inward, along minus the outward normal of the rounded rectangle.
 * R/G = x/y sampling offset (128 = none), B = 128, A = 255.
 */
export function glassMap(width: number, height: number, radius: number, bevel: number): GlassMap {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  const innerX = width / 2 - r;
  const innerY = height / 2 - r;
  for (let y = 0; y < height; y++) {
    const py = y + 0.5 - height / 2;
    const qy = Math.abs(py) - innerY;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - width / 2;
      const qx = Math.abs(px) - innerX;
      // signed distance to the rounded rectangle (negative inside) and its gradient, the outward normal
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const outside = Math.hypot(ox, oy);
      const sd = outside + Math.min(Math.max(qx, qy), 0) - r;
      let nx: number;
      let ny: number;
      if (outside > 0) {
        nx = ox / outside;
        ny = oy / outside;
      } else if (qx > qy) {
        nx = 1;
        ny = 0;
      } else {
        nx = 0;
        ny = 1;
      }
      const m = bend(clamp(-sd / bevel, 0, 1));
      const i = (y * width + x) * 4;
      data[i] = Math.round(128 - 127 * Math.sign(px) * nx * m);
      data[i + 1] = Math.round(128 - 127 * Math.sign(py) * ny * m);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}
