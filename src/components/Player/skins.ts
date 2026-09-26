export type SkinId = "base" | "chrome" | "faizaan";

export interface Skin {
  id: SkinId;
  /** Shown in the title bar: `faizaan.tech — <name>`. */
  name: string;
}

/** Same layout, three looks: a Winamp 2 homage, Y2K chrome, and the site's own. */
export const SKINS: readonly Skin[] = [
  { id: "base", name: "base skin" },
  { id: "chrome", name: "chrome" },
  { id: "faizaan", name: "faizaan" },
];

export const SKIN_STORAGE_KEY = "player.skin";

const isSkinId = (value: unknown): value is SkinId => SKINS.some((skin) => skin.id === value);

export function skinById(id: SkinId): Skin {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0];
}

/** The skin after `id`, wrapping around. */
export function nextSkin(id: SkinId): SkinId {
  const index = SKINS.findIndex((skin) => skin.id === id);
  return SKINS[(index + 1) % SKINS.length].id;
}

/** The remembered skin, or `base` if there's none, it's unknown, or storage is unavailable. */
export function loadSkin(storage: Pick<Storage, "getItem"> | null): SkinId {
  try {
    const value = storage?.getItem(SKIN_STORAGE_KEY);
    return isSkinId(value) ? value : "base";
  } catch {
    return "base";
  }
}

/** Remember the skin; storage that refuses (private mode, quota) is ignored. */
export function saveSkin(storage: Pick<Storage, "setItem"> | null, id: SkinId): void {
  try {
    storage?.setItem(SKIN_STORAGE_KEY, id);
  } catch {
    // not remembered: the next visit starts on base
  }
}
