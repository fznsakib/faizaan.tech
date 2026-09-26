import { describe, expect, it } from "vitest";

import {
  CELL,
  crispOffset,
  cursorTurn,
  easeTurn,
  gridLayout,
  KICK_HISTORY_SPAN,
  miniScale,
  TURN_RADIUS,
  wrapQuarter,
} from "./grid";
import { SHOCKWAVE_SPEED } from "./type";

describe("gridLayout", () => {
  it("fits whole 40 px cells and centres the grid", () => {
    expect(CELL).toBe(40);
    expect(gridLayout(1450, 806)).toEqual({ columns: 36, rows: 20, originX: 5, originY: 3 });
  });
});

describe("crispOffset", () => {
  it("nudges a whole-pixel origin by 0.5 at DPR 1, so a 1 px stroke lands on a whole pixel", () => {
    expect(crispOffset(5, 1)).toBe(0.5);
  });

  it("leaves a half-pixel origin alone at DPR 1 (it's already crisp)", () => {
    expect(crispOffset(5.5, 1)).toBe(0);
  });

  it("never offsets above DPR 1 (the backing store already has sub-CSS-pixel resolution)", () => {
    expect(crispOffset(5, 2)).toBe(0);
    expect(crispOffset(5.5, 2)).toBe(0);
  });
});

describe("KICK_HISTORY_SPAN", () => {
  it("covers a shockwave delay to any screen corner, not just small viewports", () => {
    // Half-diagonal of a generous ultrawide/4K desktop, px.
    expect(KICK_HISTORY_SPAN * SHOCKWAVE_SPEED).toBeGreaterThanOrEqual(3000);
  });
});

describe("wrapQuarter", () => {
  it("folds any angle into (-π/4, π/4] (a plus looks the same every quarter turn)", () => {
    expect(wrapQuarter(0)).toBeCloseTo(0);
    expect(wrapQuarter(Math.PI / 2)).toBeCloseTo(0);
    expect(wrapQuarter((3 * Math.PI) / 4)).toBeCloseTo(Math.PI / 4);
    expect(wrapQuarter(-Math.PI / 3)).toBeCloseTo(Math.PI / 6);
  });
});

describe("cursorTurn", () => {
  it("turns fully at the cursor and fades to nothing at the radius", () => {
    expect(cursorTurn(100, 100, 100, 100).weight).toBe(1);
    expect(cursorTurn(100, 100, 100 + TURN_RADIUS / 2, 100).weight).toBeCloseTo(0.5);
    expect(cursorTurn(100, 100, 100 + TURN_RADIUS, 100).weight).toBe(0);
    expect(cursorTurn(100, 100, 100 + TURN_RADIUS * 3, 100).weight).toBe(0);
  });

  it("points an arm at the cursor", () => {
    expect(cursorTurn(0, 0, 50, 0).angle).toBeCloseTo(0); // right: already pointing
    expect(cursorTurn(0, 0, 0, 50).angle).toBeCloseTo(0); // below: the vertical arm points
    expect(Math.abs(cursorTurn(0, 0, 50, 50).angle)).toBeCloseTo(Math.PI / 4); // diagonal: an X
  });
});

describe("easeTurn", () => {
  it("is frame-rate independent", () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = easeTurn(at60, 0.5, 1 / 60);
    let at120 = 0;
    for (let i = 0; i < 120; i++) at120 = easeTurn(at120, 0.5, 1 / 120);
    expect(at60).toBeCloseTo(at120, 6);
    expect(at60).toBeGreaterThan(0.49);
  });

  it("takes the short way round the quarter-turn wrap", () => {
    const next = easeTurn(0.7, -0.7, 1 / 120);
    // -0.7 is 0.17 rad *ahead* of 0.7 modulo π/2, so the plus keeps turning forward
    expect(wrapQuarter(next - 0.7)).toBeGreaterThan(0);
  });

  it("settles back upright when the target is 0", () => {
    let angle = 0.6;
    for (let i = 0; i < 240; i++) angle = easeTurn(angle, 0, 1 / 120);
    expect(Math.abs(angle)).toBeLessThan(1e-3);
  });
});

describe("miniScale", () => {
  it("rests at 1 and pulses with the kick, more in energetic passages", () => {
    expect(miniScale(0, 1)).toBe(1);
    expect(miniScale(1, 0)).toBeCloseTo(1.4);
    expect(miniScale(1, 1)).toBeCloseTo(1.8);
    expect(miniScale(2, 2)).toBeCloseTo(1.8); // inputs clamp to 0..1
  });
});
