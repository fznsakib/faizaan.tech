/** Small pixel-grid glyphs (10×8) for the transport; drawn in currentColor. */
const Glyph = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 10 8" width="10" height="8" aria-hidden="true" shapeRendering="crispEdges">
    {children}
  </svg>
);

export const PrevIcon = () => (
  <Glyph>
    <path d="M0 0h2v8H0zM2 4l4-4v8zM6 4l4-4v8z" />
  </Glyph>
);

export const PlayIcon = () => (
  <Glyph>
    <path d="M2 0l7 4-7 4z" />
  </Glyph>
);

export const PauseIcon = () => (
  <Glyph>
    <path d="M2 0h2v8H2zM6 0h2v8H6z" />
  </Glyph>
);

export const StopIcon = () => (
  <Glyph>
    <path d="M1.5 0.5h7v7h-7z" />
  </Glyph>
);

export const NextIcon = () => (
  <Glyph>
    <path d="M0 0l4 4-4 4zM4 0l4 4-4 4zM8 0h2v8H8z" />
  </Glyph>
);

/** The title bar's skin switch: three swatches. */
export const SkinIcon = () => (
  <Glyph>
    <path d="M0 1h3v6H0zM3.5 1h3v6h-3zM7 1h3v6H7z" opacity="0.9" />
  </Glyph>
);

/** Windowshade: a bar (collapse) or an open window (expand). */
export const ShadeIcon = ({ shaded }: { shaded: boolean }) => (
  <Glyph>{shaded ? <path d="M1 1h8v6H1zM2 3v3h6V3z" fillRule="evenodd" /> : <path d="M1 5h8v2H1z" />}</Glyph>
);

export const CloseIcon = () => (
  <Glyph>
    <path d="M1.5 0.5l3.5 3.5 3.5-3.5 1 1-3.5 3.5 3.5 3.5-1 1-3.5-3.5-3.5 3.5-1-1 3.5-3.5-3.5-3.5z" />
  </Glyph>
);

/** The site's plus, as the player's mark. */
export const MarkIcon = () => (
  <Glyph>
    <path d="M4 0h2v3h3v2H6v3H4V5H1V3h3z" />
  </Glyph>
);
