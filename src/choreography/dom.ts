export type StyleProp =
  | "fontVariationSettings"
  | "transform"
  | "fontFamily"
  | "fontSize"
  | "opacity"
  | "backgroundPosition"
  | "visibility"
  | "display";

const written = new WeakMap<HTMLElement, Partial<Record<StyleProp, string>>>();

/** Write an inline style only if it differs from the last value written through here (per-frame writes stay cheap). */
export function setStyle(el: HTMLElement, prop: StyleProp, value: string): void {
  let entry = written.get(el);
  if (!entry) {
    entry = {};
    written.set(el, entry);
  }
  if (entry[prop] === value) return;
  entry[prop] = value;
  el.style[prop] = value;
}

/** Forget cached values for an element whose styles were changed elsewhere. */
export function forgetStyles(el: HTMLElement): void {
  written.delete(el);
}
