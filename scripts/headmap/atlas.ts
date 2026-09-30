/*
 * The skin head's texture atlas: four charts — the face as the phone saw it (front projection), the crown seen from
 * above, the underside of the neck seen from below, and a band around the head (cylinder) for the sides, back and
 * neck — laid out in one square image.
 */

/**
 * Duplicates vertices so each distinct key among a vertex's triangle corners (its chart, and which side of the band's
 * seam it sits on) gets its own copy. `cornerKey` has one key per index. `source[i]` is new vertex i's original vertex
 * and `key[i]` its key; vertices appear in order of first use.
 */
export function splitCorners(indices: Uint32Array, cornerKey: Uint32Array) {
  const copies = new Map<number, number>();
  const source: number[] = [];
  const key: number[] = [];
  const out = new Uint32Array(indices.length);
  for (let c = 0; c < indices.length; c++) {
    const id = indices[c] * 64 + cornerKey[c];
    let v = copies.get(id);
    if (v === undefined) {
      v = source.length;
      copies.set(id, v);
      source.push(indices[c]);
      key.push(cornerKey[c]);
    }
    out[c] = v;
  }
  return { indices: out, source: new Uint32Array(source), key: new Uint32Array(key) };
}

/** Position around a vertical axis through (cx, cz), 0..1: 0.5 straight ahead (+z), the seam (0 = 1) behind the head. */
export function azimuth(x: number, z: number, cx: number, cz: number) {
  return Math.atan2(x - cx, z - cz) / (2 * Math.PI) + 0.5;
}

/** A band triangle's corner azimuths, with the corners just past the seam moved beyond 1 so it never spans the atlas. */
export function unwrapTriangle(us: [number, number, number]) {
  const wraps = Math.max(...us) - Math.min(...us) > 0.5;
  const wrapped = us.map((u) => (wraps && u < 0.5 ? 1 : 0)) as [number, number, number];
  return { u: us.map((u, k) => u + wrapped[k]) as [number, number, number], wrapped };
}

export interface ChartRect {
  /** Pixel rectangle in the atlas (x right, y down). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pixels per chart unit, across and down. */
  scaleU: number;
  scaleV: number;
}

interface Size {
  w: number;
  h: number;
}

/**
 * Lays the charts (sizes in chart units) into a `size`² atlas: the face top-left at `frontDensity` px per unit (less
 * if that would squeeze the others below `minBand` px), the crown and then the underside of the neck in the column to
 * its right (at most `maxDensity`), and the band along the bottom, stretched to fill it. Charts sit at least `gutter`
 * px from each other and the edges.
 */
export function layoutAtlas(
  size: number,
  front: Size,
  top: Size,
  band: Size,
  bottom: Size,
  { frontDensity, maxDensity, gutter, minBand }: { frontDensity: number; maxDensity: number; gutter: number; minBand: number }
) {
  const g = gutter;
  const sF = Math.min(frontDensity, (size - 3 * g - minBand) / front.h, (size - 3 * g - minBand) / front.w);
  const fw = Math.ceil(front.w * sF), fh = Math.ceil(front.h * sF);
  const columnX = g + fw + g, columnW = size - g - columnX;
  const sT = Math.min(maxDensity, columnW / top.w, fh / top.h);
  const th = Math.min(fh, Math.ceil(top.h * sT));
  const sB = Math.min(maxDensity, columnW / bottom.w, (fh - th - g) / bottom.h);
  const bandY = g + fh + g, bandH = size - g - bandY, bandW = size - 2 * g;
  return {
    front: { x: g, y: g, w: fw, h: fh, scaleU: sF, scaleV: sF },
    top: { x: columnX, y: g, w: Math.min(columnW, Math.ceil(top.w * sT)), h: th, scaleU: sT, scaleV: sT },
    bottom: { x: columnX, y: g + th + g, w: Math.min(columnW, Math.ceil(bottom.w * sB)), h: Math.floor(bottom.h * sB), scaleU: sB, scaleV: sB },
    band: { x: g, y: bandY, w: bandW, h: bandH, scaleU: bandW / band.w, scaleV: bandH / band.h },
  } satisfies Record<string, ChartRect>;
}

/**
 * Calls `visit(x, y, w0, w1, w2)` for every texel of a `width`×`height` image whose centre lies inside the triangle
 * a, b, c (pixel coordinates, edges included), with the centre's barycentric weights.
 */
export function rasterizeTriangle(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  width: number,
  height: number,
  visit: (x: number, y: number, w0: number, w1: number, w2: number) => void
) {
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(det) < 1e-12) return;
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) - 0.5));
  const x1 = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0]) - 0.5));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) - 0.5));
  const y1 = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1]) - 0.5));
  const eps = 1e-9;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w1 = ((px - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (py - a[1])) / det;
      const w2 = ((b[0] - a[0]) * (py - a[1]) - (px - a[0]) * (b[1] - a[1])) / det;
      const w0 = 1 - w1 - w2;
      if (w0 < -eps || w1 < -eps || w2 < -eps) continue;
      visit(x, y, w0, w1, w2);
    }
  }
}
