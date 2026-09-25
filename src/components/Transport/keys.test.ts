import { describe, expect, it } from "vitest";

import { transportKeyAction } from "./keys";

import type { TransportKey } from "./keys";

const press = (overrides: Partial<TransportKey>): TransportKey => ({
  key: " ",
  repeat: false,
  defaultPrevented: false,
  modifier: false,
  unlocked: true,
  onTypingField: false,
  onControl: false,
  ...overrides,
});

describe("transportKeyAction", () => {
  it("toggles on Space and mutes on M", () => {
    expect(transportKeyAction(press({}))).toBe("toggle");
    expect(transportKeyAction(press({ key: "m" }))).toBe("mute");
    expect(transportKeyAction(press({ key: "M" }))).toBe("mute");
  });

  it("ignores auto-repeat from a held key", () => {
    expect(transportKeyAction(press({ repeat: true }))).toBeNull();
    expect(transportKeyAction(press({ key: "m", repeat: true }))).toBeNull();
  });

  it("ignores keys before the visitor has entered or that the splash already handled", () => {
    expect(transportKeyAction(press({ unlocked: false }))).toBeNull();
    expect(transportKeyAction(press({ defaultPrevented: true }))).toBeNull();
  });

  it("leaves Space to a focused control and all keys to typing fields and shortcuts", () => {
    expect(transportKeyAction(press({ onControl: true }))).toBeNull();
    expect(transportKeyAction(press({ onTypingField: true, key: "m" }))).toBeNull();
    expect(transportKeyAction(press({ modifier: true }))).toBeNull();
  });
});
