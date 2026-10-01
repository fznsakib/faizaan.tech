import styled, { css } from "styled-components";

/** The site blue of the background grid's mini plusses: every glyph's dots at rest. */
const DOT_BLUE = "#8AB1EE";
/** The page background (Background, with the time of day), so a glyph's pool reads as clear floor, not a disc. */
const POOL = "var(--day-ground, rgb(20, 61, 50))";
const GLYPH = 28;
const TARGET = 48;

/** Bottom-right, above the glass (9) and the head (10). */
export const Dock = styled.nav`
  position: fixed;
  right: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 20;
`;

export const Row = styled.ul`
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const Link = styled.a`
  position: relative;
  display: grid;
  place-items: center;
  width: ${TARGET}px;
  height: ${TARGET}px;
  border-radius: 6px;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;

  /* the link itself is the hit target, whatever its glyph is doing */
  & > * {
    pointer-events: none;
  }

  /* a pool of the page's green that clears the grid (and anything else) from under the glyph */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(closest-side, ${POOL} 64%, transparent 86%);
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 1px dashed rgba(255, 255, 255, 0.6);
    outline-offset: -3px;
  }
`;

/** Styles for a link that's resolved: hovered with a real pointer, or keyboard-focused. */
const resolved = (rules: ReturnType<typeof css>) => css`
  @media (hover: hover) {
    ${Link}:hover & {
      ${rules}
    }
  }

  ${Link}:focus-visible & {
    ${rules}
  }
`;

/** Leans toward the pointer and swells on the kick (per-frame transform). */
export const Lean = styled.span`
  display: grid;
  width: ${GLYPH}px;
  height: ${GLYPH}px;
`;

/** Gives under a press. */
export const Face = styled.span`
  display: grid;

  & > * {
    grid-area: 1 / 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    transition: transform 180ms cubic-bezier(0.3, 0.7, 0.4, 1);

    ${Link}:active &,
    ${Link}[data-pressed] & {
      transform: scale(0.84);
      transition-duration: 60ms;
    }
  }

  /* still answers a press without motion: dims instead of giving */
  @media (prefers-reduced-motion: reduce) {
    ${Link}:active &,
    ${Link}[data-pressed] & {
      opacity: 0.55;
    }
  }
`;

/** The dot-matrix layer (per-frame opacity: the beat glow, or the touch shimmer). */
export const Rest = styled.span`
  display: grid;
  opacity: 0.85;

  @media (hover: none) {
    opacity: 0;
  }

  /* The 2 px dot pitch puts dot centres on pixel corners, which a 1x screen smears into a flat tint: shift them onto
     pixel centres. */
  @media (max-resolution: 1.49dppx), (-webkit-max-device-pixel-ratio: 1.49) {
    transform: translate(0.5px, 0.5px);
  }
`;

/** The resolved layer (per-frame opacity on touch, where the shimmer dims it). */
export const Solid = styled.span`
  display: grid;
`;

export const Dots = styled.svg`
  display: block;
  width: ${GLYPH}px;
  height: ${GLYPH}px;
  overflow: visible;

  circle {
    fill: ${DOT_BLUE};
    transform-box: fill-box;
    transform-origin: center;
  }

  @media (hover: none) {
    circle {
      fill: #ffffff;
    }
  }

  ${resolved(css`
    opacity: 0;

    circle {
      fill: var(--c);
    }
  `)}

  @media (prefers-reduced-motion: no-preference) {
    transition: opacity 120ms ease;

    circle {
      transition:
        transform 280ms cubic-bezier(0.2, 0.8, 0.3, 1),
        fill 220ms ease;
    }

    ${resolved(css`
      transition: opacity 160ms ease 180ms;

      circle {
        transform: scale(2.1);
        transition-delay: var(--d);
      }
    `)}
  }
`;

export const Mark = styled.svg`
  display: block;
  width: ${GLYPH}px;
  height: ${GLYPH}px;
  opacity: 0;

  @media (hover: none) {
    opacity: 1;
  }

  ${resolved(css`
    opacity: 1;
  `)}

  @media (prefers-reduced-motion: no-preference) {
    transition: opacity 120ms ease;

    ${resolved(css`
      transition: opacity 200ms ease 120ms;
    `)}
  }
`;

export const Label = styled.span`
  position: absolute;
  left: 50%;
  bottom: calc(100% - 1px);
  transform: translate(-50%, 4px);
  font-family: "Doto", monospace;
  font-size: 0.8rem;
  font-weight: 800;
  line-height: 1;
  color: rgba(255, 255, 255, 0.9);
  text-shadow:
    0 0 2px ${POOL},
    0 0 4px ${POOL};
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;

  ${resolved(css`
    opacity: 1;
    transform: translate(-50%, 0);
  `)}

  @media (prefers-reduced-motion: no-preference) {
    transition:
      opacity 120ms ease,
      transform 160ms ease;

    ${resolved(css`
      transition:
        opacity 180ms ease 60ms,
        transform 240ms cubic-bezier(0.2, 0.8, 0.3, 1) 60ms;
    `)}
  }
`;
