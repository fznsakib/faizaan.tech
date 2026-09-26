/** Dot-matrix resolution: cells across (and down) a glyph's viewBox. */
export const DOT_CELLS = 14;
/** Dot radius as a fraction of the cell pitch: a gap between neighbours at rest, room to fuse when they swell. */
export const DOT_FILL = 0.36;
/** Cells covered less than this (canvas antialiasing dust) get no dot. */
const DUST = 0.004;
/** Resolve delay of the outermost dot, ms: the resolve ripples out from the glyph's centre. */
export const RIPPLE_MS = 90;

export interface Dot {
  cx: number;
  cy: number;
  r: number;
  /** Index of the glyph part whose silhouette clips this dot. */
  part: number;
  /** ms after the resolve starts that this dot swells. */
  delay: number;
}

/** Mean alpha (0..1) of each cell of a square RGBA raster `size` px wide, cut into cells × cells, row by row. */
export function cellCoverage(rgba: Uint8ClampedArray, size: number, cells: number): Float32Array {
  const coverage = new Float32Array(cells * cells);
  const cell = size / cells;
  for (let y = 0; y < size; y++) {
    const row = Math.min(cells - 1, Math.floor(y / cell));
    for (let x = 0; x < size; x++) {
      coverage[row * cells + Math.min(cells - 1, Math.floor(x / cell))] += rgba[(y * size + x) * 4 + 3];
    }
  }
  const scale = 1 / (255 * cell * cell);
  for (let i = 0; i < coverage.length; i++) coverage[i] *= scale;
  return coverage;
}

/**
 * A glyph as a dot screen: for each part, one equal dot on every cell the part touches, to be clipped to the part's
 * exact silhouette (so edges stay true while the dots read as a matrix). `coverage` holds one cells × cells grid per
 * part.
 */
export function dotScreen(coverage: Float32Array[], cells: number, viewSize: number): Dot[] {
  const pitch = viewSize / cells;
  const r = pitch * DOT_FILL;
  const middle = (cells - 1) / 2;
  const farthest = Math.hypot(middle, middle) || 1;
  const dots: Dot[] = [];
  coverage.forEach((grid, part) => {
    for (let i = 0; i < cells * cells; i++) {
      if (grid[i] < DUST) continue;
      const col = i % cells;
      const row = Math.floor(i / cells);
      dots.push({
        cx: (col + 0.5) * pitch,
        cy: (row + 0.5) * pitch,
        r,
        part,
        delay: Math.round((RIPPLE_MS * Math.hypot(col - middle, row - middle)) / farthest),
      });
    }
  });
  return dots;
}
