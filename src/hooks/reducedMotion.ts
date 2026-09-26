const media =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

/** The visitor's reduced-motion preference. Cheap: safe to read every frame, and live if it changes. */
export function prefersReducedMotion(): boolean {
  return media?.matches ?? false;
}
