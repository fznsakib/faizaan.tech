import styled from "styled-components";

/**
 * Full-viewport layer at z 9: just beneath the head's canvas (10), so the head stands in front of the glass, and
 * above the name/subtitles (1) and grid, which it refracts. Transport and icons (20) sit above it. Never takes a
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

/** One piece of glass. Its backdrop-filter (refraction or frost) is set inline, per piece. */
export const Pane = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  overflow: hidden;
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.02) 42%,
    rgba(255, 255, 255, 0.05) 100%
  );
  box-shadow:
    0 28px 50px -22px rgba(3, 18, 14, 0.55),
    0 3px 10px -4px rgba(3, 18, 14, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.55),
    inset 0 -1px 1px rgba(255, 255, 255, 0.14),
    inset 0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 22px 32px -26px rgba(255, 255, 255, 0.4),
    inset 0 -22px 32px -24px rgba(0, 0, 0, 0.3);
`;

/** Bright bevelled edge: a gradient ring, lit from the upper right like the head. */
export const Rim = styled.div`
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.5px;
  background: linear-gradient(
    215deg,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(255, 255, 255, 0.12) 32%,
    rgba(255, 255, 255, 0.05) 60%,
    rgba(255, 255, 255, 0.45) 100%
  );
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
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
    rgba(255, 255, 255, 0.34),
    rgba(255, 255, 255, 0.12) 30%,
    rgba(255, 255, 255, 0.03) 62%,
    rgba(255, 255, 255, 0) 100%
  );
`;

/** Diagonal flare that flashes on beats and DJ stabs; its own layer, for the same reason as Sheen. */
export const Glint = styled.div`
  position: absolute;
  inset: 0;
  opacity: 0;
  will-change: opacity;
  background: linear-gradient(
    118deg,
    rgba(255, 255, 255, 0) 30%,
    rgba(255, 255, 255, 0.55) 47%,
    rgba(255, 255, 255, 0.12) 55%,
    rgba(255, 255, 255, 0) 68%
  );
`;
