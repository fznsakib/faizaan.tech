/** Returns an in-place iterative radix-2 FFT for arrays of length `size` (a power of two). */
export function createFFT(size: number): (re: Float64Array, im: Float64Array) => void {
  const bits = Math.log2(size);
  if (!Number.isInteger(bits)) {
    throw new Error(`FFT size must be a power of two, got ${size}`);
  }
  const reversed = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let r = 0;
    for (let j = 0; j < bits; j++) r |= ((i >> j) & 1) << (bits - 1 - j);
    reversed[i] = r;
  }

  return (re, im) => {
    for (let i = 0; i < size; i++) {
      const j = reversed[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    for (let span = 2; span <= size; span <<= 1) {
      const half = span >> 1;
      const angle = (-2 * Math.PI) / span;
      const wr = Math.cos(angle);
      const wi = Math.sin(angle);
      for (let start = 0; start < size; start += span) {
        let cr = 1;
        let ci = 0;
        for (let j = 0; j < half; j++) {
          const u = start + j;
          const v = u + half;
          const tr = re[v] * cr - im[v] * ci;
          const ti = re[v] * ci + im[v] * cr;
          re[v] = re[u] - tr;
          im[v] = im[u] - ti;
          re[u] += tr;
          im[u] += ti;
          const next = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = next;
        }
      }
    }
  };
}
