import styled from "styled-components";

import * as AppStyled from "../../App.styled";

/** The grid's plus, tiled: the plate looks made of the plusses it breaks into. */
const PLUS_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path d='M8 3.5v9M3.5 8h9' stroke='#555555' stroke-width='2'/></svg>"
)}")`;

/** A letter of the name: the app's letter box, as the positioning context for its burst. */
export const Letter = styled(AppStyled.Letter)`
  position: relative;
`;

/** The letter's own white glyph. */
export const Glyph = styled.span``;

/** Everything a burst draws for one letter; out of the render tree until the painter shows it. */
export const Burst = styled.span`
  display: none;
  position: absolute;
  inset: 0;
  pointer-events: none;

  @media (forced-colors: active) {
    display: none !important;
  }
`;

/**
 * A copy of the glyph in plate blue, perforated with the grid's plusses: what breaks apart. The copy is generated
 * content (`data-letter`), so the name's text, copied or crawled, stays "(faiz)aan sakib" once.
 */
export const Plate = styled.span`
  position: absolute;
  inset: 0;
  opacity: 0;

  &::before {
    content: attr(data-letter);
    display: block;
    white-space: pre;
    text-align: center;
    color: transparent;
    -webkit-text-fill-color: transparent;
    -webkit-background-clip: text;
    background-clip: text;
    background-image: ${PLUS_TILE}, linear-gradient(180deg, #dbe7fb 25%, #8ab1ee 80%);
    background-size: 0.16em 0.16em, 100% 100%;
    background-repeat: repeat, no-repeat;
  }
`;

/**
 * A shard: one of the grid's plusses, blue like its mini plusses or grey like its big ones. Its home and size are
 * set inline; it moves by transform and opacity only, on its own layer while it's shown.
 */
export const Shard = styled.span<{ $blue: boolean }>`
  position: absolute;
  display: none;
  will-change: transform, opacity;
  color: ${({ $blue }) => ($blue ? "#8AB1EE" : "#555555")};
  background:
    linear-gradient(currentColor, currentColor) center / 100% max(1.5px, 0.022em) no-repeat,
    linear-gradient(currentColor, currentColor) center / max(1.5px, 0.022em) 100% no-repeat;
`;
