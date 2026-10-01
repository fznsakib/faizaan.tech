import styled, { css } from "styled-components";

import * as AppStyled from "../../App.styled";
import { mulberry32 } from "../../choreography/matter";

/** Phones and touch-first screens get the lighter variant: no SVG filters, fewer shards, drips and sparkles. */
export const LITE = "(max-width: 767px), (max-height: 500px), (pointer: coarse)";

const svg = (body: string, size: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`
  )}")`;

/** The grid's plus, tiled: the shatter glyph looks made of the plusses it breaks into. */
const PLUS_TILE = svg("<path d='M8 3.5v9M3.5 8h9' stroke='#555555' stroke-width='2'/>", 16);

/** Hairline ice: short strokes at hexagonal angles, 1 CSS px at any size. */
const FROST_TILE = (() => {
  const random = mulberry32(11);
  const lines: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = random() * 60;
    const y = random() * 60;
    const angle = (Math.floor(random() * 3) * 60 + (random() - 0.5) * 12) * (Math.PI / 180);
    const length = 5 + random() * 16;
    const dx = (Math.cos(angle) * length) / 2;
    const dy = (Math.sin(angle) * length) / 2;
    const stroke = i % 3 === 0 ? "rgba(70,110,190,0.55)" : "rgba(255,255,255,0.95)";
    lines.push(
      `<path d='M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}' ` +
        `stroke='${stroke}' stroke-width='1' vector-effect='non-scaling-stroke'/>`
    );
  }
  return svg(lines.join(""), 60);
})();

/**
 * A letter of the name: the app's letter box, as the positioning context for its material layers. During a run on
 * desktop each letter is its own compositor layer, so the kick's per-frame transform moves it without repainting its
 * materials and re-running their filters (1440×900: 55–57 → 60 fps). Phones have no filters to spare, only layers.
 */
export const Letter = styled(AppStyled.Letter)`
  position: relative;

  [data-running] > & {
    will-change: transform;
  }

  @media ${LITE} {
    [data-running] > & {
      will-change: auto;
    }
  }
`;

/** The letter's own white glyph. */
export const Glyph = styled.span``;

/** Everything a run draws for one letter; not rendered at all between runs. */
export const Matter = styled.span`
  display: none;
  position: absolute;
  inset: 0;
  pointer-events: none;

  [data-running] & {
    display: block;
  }
`;

/**
 * A copy of the glyph, filled with a material (the fill is clipped to the glyph). Out of the render tree unless it's
 * showing, so the kick's per-frame font changes don't restyle and reshape four hidden copies of every letter.
 */
const layer = css`
  position: absolute;
  inset: 0;
  white-space: pre;
  text-align: center;
  color: transparent;
  -webkit-text-fill-color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  background-repeat: no-repeat;
  display: none;
`;

/** Mirror chrome, like the head: sky above a hard horizon, warm ground below, and a moving highlight. */
export const Chrome = styled.span`
  ${layer}
  background-image:
    linear-gradient(105deg, transparent 43%, rgba(255, 255, 255, 0.95) 50%, transparent 57%),
    linear-gradient(
      180deg,
      #f2f9ff 22%,
      #9fd3ff 42%,
      #f7fcff 55%,
      #27333c 56.5%,
      #5f707c 63%,
      #d8bf9c 74%,
      #fff0da 82%
    );
  background-size: 300% 100%, 100% 100%;
  background-position: 100% 0%, 0% 0%;
  filter: url(#name-bevel);

  @media ${LITE} {
    filter: none;
  }
`;

/** Molten copper, warped by the melt filter; sags from its top. */
export const Molten = styled.span`
  ${layer}
  background-image: linear-gradient(180deg, #fff3c4 24%, #ffc14f 40%, #ff8a1c 55%, #e2531a 70%, #b53b12 84%);
  transform-origin: 50% 20%;
  filter: url(#name-melt);

  @media ${LITE} {
    filter: none;
  }

  /* Firefox: no feImage of an element, so no ramp; without it the warp would shift the letters, not melt them. */
  @supports (-moz-appearance: none) {
    filter: none;
  }
`;

/** Plate blue, perforated with the grid's plusses: what shatters. */
export const Shatter = styled.span`
  ${layer}
  background-image: ${PLUS_TILE}, linear-gradient(180deg, #dbe7fb 25%, #8ab1ee 80%);
  background-size: 0.16em 0.16em, 100% 100%;
  background-repeat: repeat, no-repeat;
`;

/** Frost: cool white-blue with hairline ice. */
export const Frost = styled.span`
  ${layer}
  background-image: ${FROST_TILE}, linear-gradient(175deg, #ffffff 22%, #e3f2ff 42%, #b9dcff 62%, #8ab1ee 86%);
  background-size: 1.1em 1.1em, 100% 100%;
  background-repeat: repeat, no-repeat;
`;

/**
 * A shard of the shatter, in the grid's plus look. Its home and size are set inline; it moves by transform only.
 * Shards, drips and sparkles are out of the render tree until the painter shows them (phones use only a share).
 */
export const Shard = styled.span<{ $blue: boolean }>`
  position: absolute;
  display: none;
  color: ${({ $blue }) => ($blue ? "#8AB1EE" : "#555555")};
  background:
    linear-gradient(currentColor, currentColor) center / 100% max(1.5px, 0.022em) no-repeat,
    linear-gradient(currentColor, currentColor) center / max(1.5px, 0.022em) 100% no-repeat;
`;

/** A drop of molten copper at the letter's foot. */
export const Drip = styled.span`
  position: absolute;
  top: 0.8em;
  display: none;
  border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
  background: radial-gradient(circle at 40% 35%, #ffe08a, #ff8a1c 45%, #b53b12);
  transform-origin: 50% 0;
`;

/** A glint on the frost. */
export const Sparkle = styled.span`
  position: absolute;
  display: none;
  background:
    radial-gradient(circle, #ffffff 0 8%, rgba(210, 235, 255, 0.7) 16%, transparent 42%),
    linear-gradient(90deg, transparent, #ffffff 50%, transparent) center / 100% 9% no-repeat,
    linear-gradient(0deg, transparent, #ffffff 50%, transparent) center / 9% 100% no-repeat;
`;

/** Holds the header's SVG filters; takes no space. */
export const Defs = styled.svg`
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
`;
