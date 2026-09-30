import { describe, expect, it } from "vitest";

import { isInside, parseFlags } from "./cli.ts";

const spec = { depth: "number", window: "pair", nose: "vec3", icp: "count", out: "path", copper: "switch" } as const;

describe("parseFlags", () => {
  it("reads the capture and typed flag values", () => {
    const flags = parseFlags(["cap.glb", "--depth", "0.9", "--window", "1,1.3", "--nose", "0,0.25,0.1", "--icp", "4"], spec);
    expect(flags.capture).toBe("cap.glb");
    expect(flags.number("depth")).toBe(0.9);
    expect(flags.pair("window")).toEqual([1, 1.3]);
    expect(flags.vec("nose")).toEqual([0, 0.25, 0.1]);
    expect(flags.number("icp")).toBe(4);
    expect(flags.number("out")).toBeUndefined();
  });

  it("rejects a missing capture", () => {
    expect(() => parseFlags([], spec)).toThrow(/capture/);
    expect(() => parseFlags(["--depth", "1"], spec)).toThrow(/capture/);
  });

  it("rejects unknown flags by name", () => {
    expect(() => parseFlags(["cap.glb", "--dpeth", "0.9"], spec)).toThrow(/--dpeth/);
  });

  it("rejects a flag without a value", () => {
    expect(() => parseFlags(["cap.glb", "--depth"], spec)).toThrow(/--depth/);
  });

  it("rejects values that aren't finite numbers", () => {
    for (const bad of ["abc", "NaN", "Infinity", ""]) expect(() => parseFlags(["cap.glb", "--depth", bad], spec)).toThrow(/--depth/);
    expect(() => parseFlags(["cap.glb", "--window", "1,x"], spec)).toThrow(/--window/);
  });

  it("rejects lists of the wrong length", () => {
    expect(() => parseFlags(["cap.glb", "--nose", "0,0.25"], spec)).toThrow(/--nose/);
    expect(() => parseFlags(["cap.glb", "--window", "1,2,3"], spec)).toThrow(/--window/);
  });

  it("reads switches, which take no value, anywhere among the flags", () => {
    const flags = parseFlags(["cap.glb", "--copper", "--depth", "0.9"], spec);
    expect(flags.on("copper")).toBe(true);
    expect(flags.number("depth")).toBe(0.9);
    expect(parseFlags(["cap.glb", "--depth", "0.9", "--copper"], spec).on("copper")).toBe(true);
    expect(parseFlags(["cap.glb", "--depth", "0.9"], spec).on("copper")).toBe(false);
  });

  it("rejects counts that aren't whole and non-negative", () => {
    expect(() => parseFlags(["cap.glb", "--icp", "2.5"], spec)).toThrow(/--icp/);
    expect(() => parseFlags(["cap.glb", "--icp", "-1"], spec)).toThrow(/--icp/);
  });
});

describe("isInside", () => {
  it("is true for the directory itself and anything under it", () => {
    expect(isInside("/repo", "/repo")).toBe(true);
    expect(isInside("/repo/a/b", "/repo")).toBe(true);
  });

  it("is false for siblings and parents, including name prefixes", () => {
    expect(isInside("/repo-debug", "/repo")).toBe(false);
    expect(isInside("/", "/repo")).toBe(false);
    expect(isInside("/tmp/x", "/repo")).toBe(false);
  });
});
