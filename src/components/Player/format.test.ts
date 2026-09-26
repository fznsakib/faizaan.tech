import { describe, expect, it } from "vitest";

import { formatTime, initials, marqueeText } from "./format";

import type { TrackInfo } from "../../audio/types";

const track: TrackInfo = {
  id: "bend-tiesto",
  title: "Bend It Like You Don't Care",
  artist: "Tiësto",
  album: "Kaleidoscope",
  year: 2009,
  artwork: "/bend.jpg",
  duration: 203.2,
};

describe("formatTime", () => {
  it("shows elapsed minutes and zero-padded seconds, rounding down", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(187.9)).toBe("3:07");
    expect(formatTime(59.999)).toBe("0:59");
    expect(formatTime(3661)).toBe("61:01");
  });

  it("counts down with a minus sign when asked for the remaining time", () => {
    expect(formatTime(60, { duration: 132 })).toBe("-1:12");
    expect(formatTime(0, { duration: 203.2 })).toBe("-3:23");
    expect(formatTime(250, { duration: 132 })).toBe("-0:00");
  });

  it("shows NaN, infinite or negative input as 0:00", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(-4)).toBe("0:00");
    expect(formatTime(Infinity)).toBe("0:00");
    expect(formatTime(Number.NaN, { duration: Number.NaN })).toBe("-0:00");
  });
});

describe("marqueeText", () => {
  it("reads Artist - Title (Album, Year) with a Winamp-style loop separator", () => {
    expect(marqueeText(track)).toBe("Tiësto - Bend It Like You Don't Care (Kaleidoscope, 2009) *** ");
  });
});

describe("initials", () => {
  it("takes the first letters of the title's first two words", () => {
    expect(initials("Bend It Like You Don't Care")).toBe("BI");
    expect(initials("empty lightning")).toBe("EL");
  });

  it("skips words that don't start with a letter or digit", () => {
    expect(initials("Void ///////(d) [u] [m]")).toBe("V");
    expect(initials("  ")).toBe("♪");
  });
});
