import { describe, expect, it } from "vitest";

import { GLYPHS } from "./glyphs";
import { LINKS, linkTarget } from "./links";

describe("LINKS", () => {
  it("lists the five links in order, with their exact hrefs and accessible names", () => {
    expect(LINKS.map(({ label, name, href }) => [label, name, href])).toEqual([
      ["linkedin", "LinkedIn", "https://www.linkedin.com/in/faizaan-sakib/"],
      ["email", "Email", "mailto:fznsakib@gmail.com"],
      ["github", "GitHub", "https://github.com/fznsakib"],
      ["letterboxd", "Letterboxd", "https://letterboxd.com/fznsakib/"],
      ["strava", "Strava", "https://strava.app.link/VhdUXhuiWRb"],
    ]);
  });

  it("gives every link a unique lowercase label and an https or mailto href", () => {
    const labels = LINKS.map((link) => link.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const link of LINKS) {
      expect(link.label).toBe(link.label.toLowerCase());
      expect(link.href).toMatch(/^(https:\/\/|mailto:)/);
    }
  });

  it("has a glyph for every link, drawn in a square viewBox with non-empty paths", () => {
    for (const link of LINKS) {
      const glyph = GLYPHS[link.label];
      expect(glyph, link.label).toBeDefined();
      const [, , width, height] = glyph.viewBox.split(" ").map(Number);
      expect(width).toBeGreaterThan(0);
      expect(width).toBe(height);
      expect(glyph.parts.length).toBeGreaterThan(0);
      for (const part of glyph.parts) {
        expect(part.d.trim()).toMatch(/^M/i);
        expect(part.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(glyph.source.length).toBeGreaterThan(0);
    }
  });

  it("has no Gmail logo: the email glyph is a generic envelope", () => {
    expect(Object.keys(GLYPHS)).not.toContain("gmail");
    expect(GLYPHS.email.source).not.toMatch(/gmail/i);
  });
});

describe("linkTarget", () => {
  it("opens external links in a new tab without leaking the opener or referrer", () => {
    expect(linkTarget("https://github.com/fznsakib")).toEqual({ target: "_blank", rel: "noopener noreferrer" });
  });

  it("opens mailto links normally", () => {
    expect(linkTarget("mailto:fznsakib@gmail.com")).toEqual({});
  });
});
