/**
 * Gaussian blur of a height field with holes (normalised convolution): masked-out cells neither contribute nor
 * receive values beyond what their neighbours imply. `sigma` is in cells. Row-major, `width` × `height`.
 */
export function blurHeightField(values: Float32Array, mask: Uint8Array, width: number, height: number, sigma: number) {
  const radius = Math.ceil(3 * sigma);
  const kernel = Float32Array.from({ length: 2 * radius + 1 }, (_, k) => Math.exp(-((k - radius) ** 2) / (2 * sigma * sigma)));
  const pass = (src: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const xx = horizontal ? x + k : x, yy = horizontal ? y : y + k;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          sum += kernel[k + radius] * src[yy * width + xx];
        }
        out[y * width + x] = sum;
      }
    }
    return out;
  };
  const weighted = Float32Array.from(values, (v, i) => (mask[i] ? v : 0));
  const weights = Float32Array.from(mask);
  const num = pass(pass(weighted, true), false);
  const den = pass(pass(weights, true), false);
  return num.map((n, i) => (den[i] > 1e-6 ? n / den[i] : values[i]));
}

/** Bilinear sample at fractional cell coordinates (cell centres at integers), clamped to the grid. */
export function sampleBilinear(values: Float32Array, width: number, height: number, gx: number, gy: number) {
  const x = Math.min(width - 1, Math.max(0, gx)), y = Math.min(height - 1, Math.max(0, gy));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const top = values[y0 * width + x0] * (1 - fx) + values[y0 * width + x1] * fx;
  const bottom = values[y1 * width + x0] * (1 - fx) + values[y1 * width + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}
