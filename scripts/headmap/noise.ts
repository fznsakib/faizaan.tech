/*
 * Seeded randomness for the skin head's synthesis: the same capture and flags always bake the same bytes.
 */

/** A small, fast seeded PRNG: each call returns the next number in 0..1. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash → 0..1, mixed with the seed. */
export function hash3(seed: number, x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const lattice = (seed: number, x: number, y: number, z: number) => hash3(seed, x, y, z) * 2 - 1;

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Smooth 3D value noise in -1..1, one lattice cell per unit, continuous everywhere. */
export function valueNoise(seed: number) {
  return (x: number, y: number, z: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
    const fx = fade(x - x0), fy = fade(y - y0), fz = fade(z - z0);
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const corner = (dx: number, dy: number, dz: number) => lattice(seed, x0 + dx, y0 + dy, z0 + dz);
    return mix(
      mix(mix(corner(0, 0, 0), corner(1, 0, 0), fx), mix(corner(0, 1, 0), corner(1, 1, 0), fx), fy),
      mix(mix(corner(0, 0, 1), corner(1, 0, 1), fx), mix(corner(0, 1, 1), corner(1, 1, 1), fx), fy),
      fz
    );
  };
}

/** `octaves` of value noise, each twice the frequency and half the amplitude of the last, normalised to -1..1. */
export function fractalNoise(seed: number, octaves: number) {
  const layers = Array.from({ length: octaves }, (_, k) => valueNoise(seed + k * 7919));
  const norm = layers.reduce((sum, _, k) => sum + 0.5 ** k, 0);
  return (x: number, y: number, z: number) => {
    let sum = 0;
    for (let k = 0; k < octaves; k++) sum += 0.5 ** k * layers[k](x * 2 ** k, y * 2 ** k, z * 2 ** k);
    return sum / norm;
  };
}
