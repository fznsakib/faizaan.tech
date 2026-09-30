import styled from "styled-components";

/**
 * Full-viewport layer at z 9: just beneath the head's canvas (10), so the head stands in front of the glass, and
 * above the name/subtitles (1) and grid, which it refracts. The player and icons (20) sit above it. Never takes a
 * click, and never becomes a backdrop root: no filter, opacity, mask, clip-path or blend here, or the glass would
 * stop seeing the page behind it.
 */
export const GlassLayer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  perspective: 1200px;
  overflow: hidden;
`;

export const FilterDefs = styled.svg`
  position: absolute;
  width: 0;
  height: 0;
`;

/**
 * One piece: moved, tilted and squashed as a whole by a per-frame transform pivoting on the body's centre. A
 * transform is not a backdrop root, so the glass inside still sees the page.
 */
export const Piece = styled.div`
  position: absolute;
  left: 0;
  top: 0;
`;

/** The time of day's tints (see `startDaylight`): the glass's body takes the sky, its highlights the light. White at midday. */
const TINT = "var(--day-glass-tint, #fff)";
const LIGHT = "var(--day-accent, #fff)";
const tint = (colour: string, percent: number) => `color-mix(in srgb, ${colour} ${percent}%, transparent)`;

/**
 * The glass: clipped to the outline (on itself, never an ancestor), with its backdrop-filter (refraction or frost)
 * set inline.
 */
export const Pane = styled.div`
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(
    145deg,
    ${tint(TINT, 10)} 0%,
    ${tint(TINT, 2)} 42%,
    ${tint(TINT, 5)} 100%
  );
`;

/** Bevel shading and the bright edge, stroked along the outline and lit from the upper right like the head. */
export const RimArt = styled.svg`
  position: absolute;
  left: 0;
  top: 0;
  fill: none;

  /* the bright edge takes the light's colour, the bevel glow the glass's (over the stops' white) */
  & stop[data-tint="light"] {
    stop-color: ${LIGHT};
  }

  & stop[data-tint="glass"] {
    stop-color: ${TINT};
  }
`;

/**
 * Specular hotspot, twice the pane's size so it can slide with the tilt. Moved by transform, dimmed by opacity, on
 * its own layer so the pane (and its big shadows) never re-rasterise per frame.
 */
export const Sheen = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 200%;
  height: 200%;
  will-change: transform, opacity;
  background: radial-gradient(
    closest-side,
    ${tint(LIGHT, 34)},
    ${tint(LIGHT, 12)} 30%,
    ${tint(LIGHT, 3)} 62%,
    transparent 100%
  );
`;

/** Diagonal flare, tinted per piece, that flashes on beats, DJ stabs and wall hits; its own layer, like Sheen. */
export const Glint = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0;
  will-change: opacity;
`;
