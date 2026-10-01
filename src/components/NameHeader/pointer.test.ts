import { describe, expect, it } from "vitest";

import { hovers, presses } from "./pointer";

import type { NamePointer } from "./pointer";

const box = { left: 40, right: 1400, top: 32, bottom: 243 };
const at = (overrides: Partial<NamePointer> = {}): NamePointer => ({
  x: 300,
  y: 120,
  pointerType: "mouse",
  button: 0,
  onPage: true,
  ...overrides,
});

describe("name hover", () => {
  it("is a mouse or pen over the name, on the page itself", () => {
    expect(hovers(at(), box)).toBe(true);
    expect(hovers(at({ pointerType: "pen" }), box)).toBe(true);
  });

  it("ignores a touch (its move is a drag), a pointer outside the name, and an unmeasured name", () => {
    expect(hovers(at({ pointerType: "touch" }), box)).toBe(false);
    expect(hovers(at({ x: 20 }), box)).toBe(false);
    expect(hovers(at({ y: 260 }), box)).toBe(false);
    expect(hovers(at(), null)).toBe(false);
  });

  it("ignores a pointer over a control in the name's band (the desktop jam pad, the player, links)", () => {
    expect(hovers(at({ onPage: false }), box)).toBe(false);
  });
});

describe("name press", () => {
  it("is a primary press or a tap on the name", () => {
    expect(presses(at(), box)).toBe(true);
    expect(presses(at({ pointerType: "touch" }), box)).toBe(true);
    expect(presses(at({ pointerType: "pen" }), box)).toBe(true);
  });

  it("ignores right and middle clicks", () => {
    expect(presses(at({ button: 2 }), box)).toBe(false);
    expect(presses(at({ button: 1 }), box)).toBe(false);
  });

  it("ignores presses on controls and outside the name", () => {
    expect(presses(at({ onPage: false }), box)).toBe(false);
    expect(presses(at({ x: 1500 }), box)).toBe(false);
  });
});
