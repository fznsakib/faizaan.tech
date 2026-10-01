/** A letter's measured box, px. */
export interface LetterBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A pointer event, as the name's hover and tap see it. */
export interface NamePointer {
  x: number;
  y: number;
  pointerType: string;
  button: number;
  /** Whether it landed on the page itself (the head's canvas or the body), not on a control drawn over the name. */
  onPage: boolean;
}

export interface Point {
  x: number;
  y: number;
}

/** Where the pointer came into letter `index`, px. */
export interface Entry {
  index: number;
  x: number;
  y: number;
}

/** A mouse or pen moving over the page (a touch's move is a drag, not a hover). */
export const hovers = (pointer: NamePointer): boolean => pointer.pointerType !== "touch" && pointer.onPage;

/** A touch or pen press on the page: the hover of a device without one. A mouse has already hovered. */
export const taps = (pointer: NamePointer): boolean =>
  pointer.pointerType !== "mouse" && pointer.button === 0 && pointer.onPage;

/** Half-open across, so a shared edge belongs to one letter (the right-hand one). */
const inside = (point: Point, box: LetterBox) =>
  point.x >= box.left && point.x < box.right && point.y >= box.top && point.y <= box.bottom;

/** The letter under (x, y), or -1 (the space has no box). */
export function letterAt(x: number, y: number, boxes: readonly (LetterBox | null)[]): number {
  const point = { x, y };
  return boxes.findIndex((box) => box !== null && inside(point, box));
}

/** Where along from → to (0..1) the segment enters and leaves `box`, or null if it misses (Liang–Barsky). */
function clip(from: Point, to: Point, box: LetterBox): [number, number] | null {
  let enter = 0;
  let leave = 1;
  const edges: [number, number][] = [
    [-(to.x - from.x), from.x - box.left],
    [to.x - from.x, box.right - from.x],
    [-(to.y - from.y), from.y - box.top],
    [to.y - from.y, box.bottom - from.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) enter = Math.max(enter, t);
      else leave = Math.min(leave, t);
    }
  }
  return enter <= leave ? [enter, leave] : null;
}

/**
 * The letters the pointer came into on its way from `from` (null: it has only just appeared) to `to`, in the order
 * it crossed them, each with the point where it crossed in. A fast sweep skips letters between two events; this
 * still gives every one of them, so the burst ripples along the name.
 */
export function entered(from: Point | null, to: Point, boxes: readonly (LetterBox | null)[]): Entry[] {
  if (from === null) {
    const index = letterAt(to.x, to.y, boxes);
    return index < 0 ? [] : [{ index, x: to.x, y: to.y }];
  }
  const hits: (Entry & { t: number })[] = [];
  boxes.forEach((box, index) => {
    if (box === null || inside(from, box)) return;
    const span = clip(from, to, box);
    if (!span || (span[0] >= span[1] && !inside(to, box))) return;
    const t = span[0];
    hits.push({ index, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, t });
  });
  return hits.sort((a, b) => a.t - b.t).map(({ index, x, y }) => ({ index, x, y }));
}
