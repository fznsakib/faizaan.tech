import { describe, expect, it } from "vitest";

import { entered, hovers, letterAt, taps } from "./pointer";

import type { LetterBox, NamePointer } from "./pointer";

const at = (overrides: Partial<NamePointer> = {}): NamePointer => ({
  x: 300,
  y: 120,
  pointerType: "mouse",
  button: 0,
  onPage: true,
  ...overrides,
});

/** "ab c": three 100 px letters and a 40 px space, on one line. */
const boxes: (LetterBox | null)[] = [
  { left: 0, right: 100, top: 50, bottom: 250 },
  { left: 100, right: 200, top: 50, bottom: 250 },
  null,
  { left: 240, right: 340, top: 50, bottom: 250 },
];

describe("name hover", () => {
  it("is a mouse or pen moving over the page itself", () => {
    expect(hovers(at())).toBe(true);
    expect(hovers(at({ pointerType: "pen" }))).toBe(true);
  });

  it("ignores a touch (its move is a drag, not a hover)", () => {
    expect(hovers(at({ pointerType: "touch" }))).toBe(false);
  });

  it("ignores a pointer over a control in the name's band (the desktop jam pad, the player, links)", () => {
    expect(hovers(at({ onPage: false }))).toBe(false);
  });
});

describe("name tap", () => {
  it("is a touch or pen press on the page: the hover of a device without one", () => {
    expect(taps(at({ pointerType: "touch" }))).toBe(true);
    expect(taps(at({ pointerType: "pen" }))).toBe(true);
  });

  it("ignores mouse clicks (the mouse already hovered), other buttons and controls", () => {
    expect(taps(at())).toBe(false);
    expect(taps(at({ pointerType: "touch", button: 1 }))).toBe(false);
    expect(taps(at({ pointerType: "touch", onPage: false }))).toBe(false);
  });
});

describe("letterAt", () => {
  it("finds the letter under a point, and none over the space, between lines or off the name", () => {
    expect(letterAt(50, 100, boxes)).toBe(0);
    expect(letterAt(100, 100, boxes)).toBe(1); // a shared edge belongs to the right-hand letter
    expect(letterAt(300, 249, boxes)).toBe(3);
    expect(letterAt(220, 100, boxes)).toBe(-1);
    expect(letterAt(50, 20, boxes)).toBe(-1);
    expect(letterAt(400, 100, boxes)).toBe(-1);
  });
});

describe("entered", () => {
  it("is the letter under a pointer that has just appeared, entered where it is", () => {
    expect(entered(null, { x: 150, y: 120 }, boxes)).toEqual([{ index: 1, x: 150, y: 120 }]);
    expect(entered(null, { x: 220, y: 120 }, boxes)).toEqual([]);
  });

  it("is nothing while the pointer stays in one letter or off the name", () => {
    expect(entered({ x: 10, y: 100 }, { x: 90, y: 200 }, boxes)).toEqual([]);
    expect(entered({ x: 10, y: 10 }, { x: 400, y: 20 }, boxes)).toEqual([]);
  });

  it("is every letter a fast sweep crossed, in order, each entered at its near edge", () => {
    expect(entered({ x: -20, y: 100 }, { x: 300, y: 100 }, boxes)).toEqual([
      { index: 0, x: 0, y: 100 },
      { index: 1, x: 100, y: 100 },
      { index: 3, x: 240, y: 100 },
    ]);
    expect(entered({ x: 300, y: 100 }, { x: 50, y: 100 }, boxes)).toEqual([
      { index: 1, x: 200, y: 100 },
      { index: 0, x: 100, y: 100 },
    ]);
  });

  it("enters from above or below where the pointer crossed the line", () => {
    expect(entered({ x: 150, y: 0 }, { x: 150, y: 100 }, boxes)).toEqual([{ index: 1, x: 150, y: 50 }]);
    expect(entered({ x: 50, y: 300 }, { x: 50, y: 200 }, boxes)).toEqual([{ index: 0, x: 50, y: 250 }]);
  });

  it("doesn't count a letter the pointer only left along its edge", () => {
    expect(entered({ x: 100, y: 100 }, { x: 150, y: 100 }, boxes)).toEqual([]);
    expect(entered({ x: 99, y: 100 }, { x: 150, y: 100 }, boxes)).toEqual([{ index: 1, x: 100, y: 100 }]);
  });
});
