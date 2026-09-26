import { describe, expect, it } from "vitest";

import { djKeyVoice, padKeyHits, transportKeyAction } from "./keys";

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

describe("djKeyVoice", () => {
  it("maps A S D F to kick, snare, hat, stab in either case", () => {
    expect(djKeyVoice(press({ key: "a" }))).toBe("kick");
    expect(djKeyVoice(press({ key: "S" }))).toBe("snare");
    expect(djKeyVoice(press({ key: "d" }))).toBe("hat");
    expect(djKeyVoice(press({ key: "f" }))).toBe("stab");
    expect(djKeyVoice(press({ key: "g" }))).toBeNull();
    expect(djKeyVoice(press({ key: "constructor" }))).toBeNull();
  });

  it("ignores auto-repeat, modifiers, typing and the splash", () => {
    expect(djKeyVoice(press({ key: "a", repeat: true }))).toBeNull();
    expect(djKeyVoice(press({ key: "a", modifier: true }))).toBeNull();
    expect(djKeyVoice(press({ key: "a", onTypingField: true }))).toBeNull();
    expect(djKeyVoice(press({ key: "a", unlocked: false }))).toBeNull();
    expect(djKeyVoice(press({ key: "a", defaultPrevented: true }))).toBeNull();
  });

  it("still plays while a control has focus", () => {
    expect(djKeyVoice(press({ key: "a", onControl: true }))).toBe("kick");
  });
});

describe("padKeyHits", () => {
  it("hits once per Enter press and ignores a held Enter's auto-repeat", () => {
    expect(padKeyHits("Enter", false)).toBe(true);
    expect(padKeyHits("Enter", true)).toBe(false);
  });

  it("leaves Space to the button's own click (it activates once, on keyup)", () => {
    expect(padKeyHits(" ", false)).toBe(false);
  });
});
