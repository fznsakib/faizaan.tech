import { describe, expect, it } from "vitest";

import { SKIN_STORAGE_KEY, SKINS, loadSkin, nextSkin, saveSkin, skinById } from "./skins";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const throwing = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("skins", () => {
  it("offers base, chrome and faizaan, each with a name", () => {
    expect(SKINS.map((skin) => skin.id)).toEqual(["base", "chrome", "faizaan"]);
    SKINS.forEach((skin) => expect(skinById(skin.id)).toBe(skin));
  });

  it("cycles through the skins and back to the first", () => {
    expect(nextSkin("base")).toBe("chrome");
    expect(nextSkin("chrome")).toBe("faizaan");
    expect(nextSkin("faizaan")).toBe("base");
  });

  it("remembers the choice under player.skin", () => {
    const storage = memoryStorage();
    saveSkin(storage, "faizaan");
    expect(SKIN_STORAGE_KEY).toBe("player.skin");
    expect(storage.data.get("player.skin")).toBe("faizaan");
    expect(loadSkin(storage)).toBe("faizaan");
  });

  it("falls back to base for a missing, garbage or unreadable value", () => {
    expect(loadSkin(memoryStorage())).toBe("base");
    expect(loadSkin(memoryStorage({ "player.skin": "winamp5-modern" }))).toBe("base");
    expect(loadSkin(memoryStorage({ "player.skin": "__proto__" }))).toBe("base");
    expect(loadSkin(null)).toBe("base");
    expect(loadSkin(throwing)).toBe("base");
    expect(() => saveSkin(throwing, "chrome")).not.toThrow();
  });
});
