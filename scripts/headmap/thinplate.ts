import type { Vec3 } from "./ray.ts";

const kernel = (r2: number) => (r2 > 0 ? 0.5 * r2 * Math.log(r2) : 0); // r² log r, from r²

/**
 * Thin-plate spline z = f(x, y) through (x, y, z) samples: the surface with the least bending that fits them.
 * `smoothing` > 0 trades exact interpolation for smoothness (it is added to the kernel's diagonal).
 */
export function fitThinPlate(samples: Vec3[], smoothing: number) {
  const n = samples.length;
  const size = n + 3;
  // [K + smoothing·I, P; Pᵀ, 0] · [w; a] = [z; 0], with P = [1, x, y]
  const A = Array.from({ length: size }, () => new Float64Array(size + 1));
  for (let i = 0; i < n; i++) {
    const [xi, yi, zi] = samples[i];
    for (let j = 0; j < n; j++) {
      const dx = xi - samples[j][0], dy = yi - samples[j][1];
      A[i][j] = kernel(dx * dx + dy * dy) + (i === j ? smoothing : 0);
    }
    A[i][n] = A[n][i] = 1;
    A[i][n + 1] = A[n + 1][i] = xi;
    A[i][n + 2] = A[n + 2][i] = yi;
    A[i][size] = zi;
  }
  const solution = solve(A);
  const w = solution.subarray(0, n);
  const [a0, ax, ay] = solution.subarray(n);
  return (x: number, y: number) => {
    let z = a0 + ax * x + ay * y;
    for (let i = 0; i < n; i++) {
      const dx = x - samples[i][0], dy = y - samples[i][1];
      z += w[i] * kernel(dx * dx + dy * dy);
    }
    return z;
  };
}

/** Gaussian elimination with partial pivoting on an augmented matrix (last column = right-hand side). */
function solve(A: Float64Array[]) {
  const n = A.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / A[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) A[r][c] -= f * A[col][c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let sum = A[r][n];
    for (let c = r + 1; c < n; c++) sum -= A[r][c] * x[c];
    x[r] = sum / A[r][r];
  }
  return x;
}
