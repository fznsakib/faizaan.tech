/** Barycentric blend of three corners' values (`stride` components each): (1 − u − v)·a + u·b + v·c. */
export function interpolateCorners(values: Float32Array, stride: number, a: number, b: number, c: number, u: number, v: number) {
  return Array.from({ length: stride }, (_, k) => (1 - u - v) * values[a * stride + k] + u * values[b * stride + k] + v * values[c * stride + k]);
}

/** Bilinear RGB sample of an RGBA image at glTF UV (u right, v down from the top), clamped at the borders. */
export function sampleRgb(data: Uint8Array, width: number, height: number, u: number, v: number): [number, number, number] {
  const x = Math.min(width - 1, Math.max(0, u * width - 0.5));
  const y = Math.min(height - 1, Math.max(0, v * height - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const at = (xx: number, yy: number, k: number) => data[(yy * width + xx) * 4 + k];
  return [0, 1, 2].map(
    (k) => (at(x0, y0, k) * (1 - fx) + at(x1, y0, k) * fx) * (1 - fy) + (at(x0, y1, k) * (1 - fx) + at(x1, y1, k) * fx) * fy
  ) as [number, number, number];
}

/**
 * Grows the filled texels of an RGB image outward, one ring per pass (each empty texel next to filled ones takes
 * their average), then fills whatever is still empty with the mean filled colour. Filled texels never change.
 */
export function dilate(rgb: Float32Array, filled: Uint8Array, width: number, height: number, passes: number) {
  const out = rgb.slice();
  let done = filled.slice();
  const mean = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < filled.length; i++) {
    if (!filled[i]) continue;
    for (let k = 0; k < 3; k++) mean[k] += rgb[i * 3 + k];
    count++;
  }
  for (let pass = 0; pass < passes; pass++) {
    const next = done.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (done[i]) continue;
        const sum = [0, 0, 0];
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height || !done[yy * width + xx]) continue;
          for (let k = 0; k < 3; k++) sum[k] += out[(yy * width + xx) * 3 + k];
          n++;
        }
        if (n === 0) continue;
        for (let k = 0; k < 3; k++) out[i * 3 + k] = sum[k] / n;
        next[i] = 1;
      }
    }
    done = next;
  }
  for (let i = 0; i < done.length; i++) if (!done[i]) for (let k = 0; k < 3; k++) out[i * 3 + k] = mean[k] / Math.max(1, count);
  return out;
}

/** Values in 0..1 as normalised unsigned integers (glTF UNSIGNED_BYTE / UNSIGNED_SHORT, normalized). */
export function normalizedUint(values: Float32Array, bits: 8 | 16) {
  const max = bits === 8 ? 255 : 65535;
  const out = bits === 8 ? new Uint8Array(values.length) : new Uint16Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, values[i])) * max);
  return out;
}
