import { describe, expect, it } from "vitest";

import {
  CYCLE_SECONDS,
  cycleHour,
  daylight,
  daylightParams,
  hexToOklab,
  KEYFRAME_HOURS,
  localHour,
  paletteVars,
  SUNRISE,
  SUNSET,
  VARIANT_GAIN,
  withAlpha,
} from "./daylight";

import type { Daylight } from "./daylight";

/** A local date on the day this was written, at `h`:`m`. */
const at = (h: number, m = 0, s = 0) => new Date(2026, 8, 30, h, m, s);

type Lamp = { color: string; intensity: number };

/** Every lamp (colour + intensity) in a state, by name. */
function lamps(day: Daylight): Record<string, Lamp> {
  return {
    key: day.key,
    fill: day.fill,
    rim: day.rim,
    ambient: day.ambient,
    "env.sky": day.env.sky,
    "env.cool": day.env.cool,
    "env.warm": day.env.warm,
    "env.ground": day.env.ground,
  };
}

/** Every colour in a state, by name. */
function colours(day: Daylight): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, lamp] of Object.entries(lamps(day))) out[name] = lamp.color;
  for (const [name, colour] of Object.entries(day.palette)) out[`palette.${name}`] = colour;
  return out;
}

/** Perceptual distance (OKLab ΔE, 0..~1; ≈ 0.02 is a just-noticeable difference). */
function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = hexToOklab(a);
  const [l2, a2, b2] = hexToOklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

function angleBetween(a: number, b: number): number {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return Math.min(d, 2 * Math.PI - d);
}

/** One state per minute of the day, plus 24:00 so the last step wraps into the first. */
const MINUTES = Array.from({ length: 24 * 60 + 1 }, (_, m) => daylight(at(0), m / 60));

describe("daylight at midday", () => {
  it("is exactly today's hard-coded scene (App lights, Head environment and rim, page colours)", () => {
    const day = daylight(at(13));
    expect(day.hour).toBe(13);
    // App.tsx: <ambientLight intensity={0.3} />
    expect(day.ambient).toEqual({ color: "#ffffff", intensity: 0.3 });
    // App.tsx: <pointLight position={[10, 10, 10]} intensity={20} distance={20} decay={2} />
    expect(day.key.color).toBe("#ffffff");
    expect(day.key.intensity).toBe(20);
    day.key.position.forEach((v) => expect(v).toBeCloseTo(10, 9));
    // App.tsx: <pointLight position={[-5, -5, -5]} intensity={5} />
    expect(day.fill).toEqual({ color: "#ffffff", intensity: 5, position: [-5, -5, -5] });
    // Head: <directionalLight position={[0, 2, -6]} intensity={BASE_RIM = 1.5} color="#bfe6ff" />
    expect(day.rim).toEqual({ color: "#bfe6ff", intensity: 1.5 });
    // Head: the four Lightformers, unrotated
    expect(day.env).toEqual({
      rotation: 0,
      sky: { color: "#ffffff", intensity: 2.5 },
      cool: { color: "#9fd3ff", intensity: 4 },
      warm: { color: "#ffe2b8", intensity: 3 },
      ground: { color: "#143d32", intensity: 1.5 },
    });
    // Background: rgb(20, 61, 50) ground, #555555 big plusses, #8AB1EE mini plusses; GlassPanel: white glass
    expect(day.palette).toEqual({
      ground: "#143d32",
      gridBig: "#555555",
      gridMini: "#8ab1ee",
      glassTint: "#ffffff",
      accent: "#ffffff",
    });
  });

  it("holds today's look for the minutes either side of 13:00", () => {
    for (const minutes of [-5, 5]) {
      const near = daylight(at(13), 13 + minutes / 60);
      const noon = daylight(at(13));
      for (const [name, colour] of Object.entries(colours(noon))) {
        expect(deltaE(colours(near)[name], colour), name).toBeLessThan(0.01);
      }
    }
  });
});

describe("daylight over the day", () => {
  it("never jumps between consecutive minutes, including across midnight", () => {
    const maxIntensity: Record<string, number> = {};
    for (const day of MINUTES) {
      for (const [name, lamp] of Object.entries(lamps(day))) {
        maxIntensity[name] = Math.max(maxIntensity[name] ?? 0, lamp.intensity);
      }
    }
    for (let m = 1; m < MINUTES.length; m++) {
      const [a, b] = [MINUTES[m - 1], MINUTES[m]];
      const where = `${Math.floor((m - 1) / 60)}:${String((m - 1) % 60).padStart(2, "0")}`;
      for (const [name, colour] of Object.entries(colours(a))) {
        expect(deltaE(colour, colours(b)[name]), `${name} at ${where}`).toBeLessThanOrEqual(0.015);
      }
      for (const [name, lamp] of Object.entries(lamps(a))) {
        const step = Math.abs(lamp.intensity - lamps(b)[name].intensity);
        expect(step, `${name} intensity at ${where}`).toBeLessThanOrEqual(0.02 * maxIntensity[name]);
      }
      const move = Math.hypot(...a.key.position.map((v, i) => v - b.key.position[i]));
      expect(move, `key position at ${where}`).toBeLessThanOrEqual(0.2);
      expect(angleBetween(a.sun.azimuth, b.sun.azimuth), `sun azimuth at ${where}`).toBeLessThan(0.01);
      expect(Math.abs(a.sun.elevation - b.sun.elevation), `sun elevation at ${where}`).toBeLessThan(0.01);
      expect(angleBetween(a.env.rotation, b.env.rotation), `env rotation at ${where}`).toBeLessThan(0.01);
    }
  });

  it("wraps: 24:00 is 00:00, and out-of-range overrides fold into the day", () => {
    expect(daylight(at(0), 24)).toEqual(daylight(at(0), 0));
    expect(daylight(at(0), 25.5)).toEqual(daylight(at(0), 1.5));
    expect(daylight(at(0), -1)).toEqual(daylight(at(0), 23));
  });

  it("gives every keyframe a clearly different look from its neighbours and from midday", () => {
    const keys = KEYFRAME_HOURS.map((h) => daylight(at(0), h));
    const noon = daylight(at(13));
    keys.forEach((day, i) => {
      const next = keys[(i + 1) % keys.length];
      const apart = Math.max(...Object.entries(colours(day)).map(([name, c]) => deltaE(c, colours(next)[name])));
      expect(apart, `${day.hour} vs ${next.hour}`).toBeGreaterThan(0.06);
      if (day.hour !== 13) {
        const fromNoon = Math.max(...Object.entries(colours(day)).map(([name, c]) => deltaE(c, colours(noon)[name])));
        expect(fromNoon, `${day.hour} vs 13`).toBeGreaterThan(0.08);
      }
    });
  });

  it("keeps the ground recognisably the site's green: dark, low-chroma, green-to-teal hue", () => {
    for (const day of MINUTES) {
      const [L, a, b] = hexToOklab(day.palette.ground);
      const chroma = Math.hypot(a, b);
      const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
      expect(L, `${day.hour}`).toBeGreaterThan(0.22);
      expect(L, `${day.hour}`).toBeLessThan(0.38);
      expect(chroma, `${day.hour}`).toBeGreaterThan(0.03);
      expect(chroma, `${day.hour}`).toBeLessThan(0.07);
      expect(hue, `${day.hour}`).toBeGreaterThan(140);
      expect(hue, `${day.hour}`).toBeLessThan(215);
      expect(deltaE(day.palette.ground, "#143d32"), `${day.hour}`).toBeLessThan(0.1);
    }
  });

  it("reflects the page's ground in the head's floor ring", () => {
    for (const day of MINUTES) expect(day.env.ground.color).toBe(day.palette.ground);
  });

  it("warms toward golden hour and cools at night", () => {
    const warmth = (hex: string) => hexToOklab(hex)[2]; // OKLab b: + yellow/orange, − blue
    const golden = daylight(at(18, 30));
    const noon = daylight(at(13));
    const night = daylight(at(22, 30));
    const dawn = daylight(at(6, 30));
    expect(warmth(golden.key.color)).toBeGreaterThan(warmth(noon.key.color) + 0.05);
    expect(warmth(golden.env.warm.color)).toBeGreaterThan(warmth(noon.env.warm.color));
    expect(warmth(dawn.key.color)).toBeLessThan(warmth(noon.key.color));
    expect(warmth(night.rim.color)).toBeLessThan(0);
    expect(night.rim.intensity).toBeGreaterThan(noon.rim.intensity);
  });
});

describe("the sun", () => {
  it("is above the horizon only between sunrise and sunset", () => {
    for (const day of MINUTES) {
      const h = day.hour;
      if (h > SUNRISE + 1e-9 && h < SUNSET - 1e-9) expect(day.sun.elevation, `${h}`).toBeGreaterThan(0);
      else expect(day.sun.elevation, `${h}`).toBeLessThanOrEqual(1e-9);
    }
    expect(daylight(at(6, 30)).sun.elevation).toBeCloseTo(0, 9);
    expect(daylight(at(19, 30)).sun.elevation).toBeCloseTo(0, 9);
  });

  it("peaks at 13:00, where the key light sits at today's [10, 10, 10]", () => {
    const peak = MINUTES.reduce((best, day) => (day.sun.elevation > best.sun.elevation ? day : best));
    expect(peak.hour).toBe(13);
    expect(peak.sun.elevation).toBeCloseTo(Math.asin(1 / Math.sqrt(3)), 9);
  });

  it("rises on the left and sets on the right, and the key light follows it", () => {
    const morning = daylight(at(9));
    const golden = daylight(at(18, 30));
    expect(morning.key.position[0]).toBeLessThan(0);
    expect(golden.key.position[0]).toBeGreaterThan(0);
    expect(golden.key.position[1]).toBeLessThan(morning.key.position[1]); // lower in the sky
  });

  it("never lights the head from below: the key stays at or above the horizon at night", () => {
    for (const day of MINUTES) expect(day.key.position[1]).toBeGreaterThanOrEqual(-1e-9);
  });

  it("puts the key light out at deep night", () => {
    expect(daylight(at(2)).key.intensity).toBe(0);
    expect(daylight(at(22, 30)).key.intensity).toBe(0);
  });
});

describe("localHour", () => {
  it("reads the visitor's local clock as a fractional hour", () => {
    expect(localHour(at(18, 30))).toBe(18.5);
    expect(localHour(at(0, 0, 36))).toBeCloseTo(0.01, 9);
    expect(daylight(at(18, 30)).hour).toBe(18.5);
  });

  it("gives way to an override", () => {
    expect(daylight(at(9), 20).hour).toBe(20);
  });
});

describe("variants", () => {
  it("leaves the chrome head at full strength, so midday stays today's scene", () => {
    expect(Object.values(VARIANT_GAIN.chrome).every((g) => g === 1)).toBe(true);
  });

  it("lights the skin head more gently", () => {
    const skin = VARIANT_GAIN.skin;
    expect(skin.key).toBeLessThan(1);
    expect(skin.rim).toBeLessThan(1);
    expect(skin.env).toBeLessThan(1);
  });
});

describe("daylightParams", () => {
  it("reads ?hour as a preview time, folded into the day", () => {
    expect(daylightParams("?hour=18.5", false)).toEqual({ hour: 18.5, cycle: false });
    expect(daylightParams("?hour=25", false)).toEqual({ hour: 1, cycle: false });
    expect(daylightParams("?hour=0", false)).toEqual({ hour: 0, cycle: false });
  });

  it("ignores a missing or unreadable ?hour", () => {
    expect(daylightParams("", false)).toEqual({ hour: null, cycle: false });
    expect(daylightParams("?hour=", false)).toEqual({ hour: null, cycle: false });
    expect(daylightParams("?hour=noon", false)).toEqual({ hour: null, cycle: false });
  });

  it("turns on ?daycycle, but never under reduced motion", () => {
    expect(daylightParams("?daycycle", false)).toEqual({ hour: null, cycle: true });
    expect(daylightParams("?daycycle&hour=6", false)).toEqual({ hour: 6, cycle: true });
    expect(daylightParams("?daycycle", true)).toEqual({ hour: null, cycle: false });
  });
});

describe("cycleHour", () => {
  it("sweeps the whole day in CYCLE_SECONDS and wraps", () => {
    expect(CYCLE_SECONDS).toBe(60);
    expect(cycleHour(6, 0)).toBe(6);
    expect(cycleHour(6, 15_000)).toBeCloseTo(12, 9);
    expect(cycleHour(6, 60_000)).toBeCloseTo(6, 9);
    expect(cycleHour(22, 10_000)).toBeCloseTo(2, 9);
  });
});

describe("paletteVars", () => {
  it("names a CSS custom property for every page token", () => {
    expect(paletteVars(daylight(at(13)).palette)).toEqual({
      "--day-ground": "#143d32",
      "--day-grid-big": "#555555",
      "--day-grid-mini": "#8ab1ee",
      "--day-glass-tint": "#ffffff",
      "--day-accent": "#ffffff",
    });
  });
});

describe("withAlpha", () => {
  it("turns a palette colour into a canvas rgba() at an opacity", () => {
    expect(withAlpha("#8ab1ee", 0.5)).toBe("rgba(138, 177, 238, 0.5)"); // today's mini plus
    expect(withAlpha("#143d32", 1)).toBe("rgba(20, 61, 50, 1)");
  });
});
