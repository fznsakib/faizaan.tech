/** The name's measured box, px. */
export interface NameBounds {
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

const overName = (pointer: NamePointer, box: NameBounds | null) =>
  box !== null &&
  pointer.onPage &&
  pointer.x >= box.left &&
  pointer.x <= box.right &&
  pointer.y >= box.top &&
  pointer.y <= box.bottom;

/** A mouse or pen over the name (a touch's move is a drag, not a hover). */
export const hovers = (pointer: NamePointer, box: NameBounds | null): boolean =>
  pointer.pointerType !== "touch" && overName(pointer, box);

/** A primary press or a tap on the name. */
export const presses = (pointer: NamePointer, box: NameBounds | null): boolean =>
  pointer.button === 0 && overName(pointer, box);
