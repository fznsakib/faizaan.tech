import { Canvas } from "@react-three/fiber";
import styled from "styled-components";

import { colors } from "./styles/colors";

export const AppContainer = styled.div`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const ThreeCanvas = styled(Canvas)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

/** Narrowest widths where the subtitles take the phone layout: portrait phones, and landscape phones (short). */
const PHONE = "(max-width: 767px)";
const SHORT = "(max-height: 500px)";

/**
 * The name is ≈ 7.1 em wide: 12.5vw on phones fits it on one line (≈ 89% of the width), rising linearly to 12rem at
 * 1280 px wide and staying there, so desktop is untouched. Landscape phones are also capped by the height.
 */
export const HeaderText = styled.h1`
  position: fixed;
  top: max(2rem, env(safe-area-inset-top));
  width: 110%;
  text-align: center;
  font-size: min(12rem, max(12.5vw, calc(19.1667vw - 53.33px)));
  z-index: 1;
  font-weight: 700;
  font-family: "Golos Text", sans-serif;
  white-space: nowrap;
  color: ${colors.site.text};

  @media ${SHORT} {
    font-size: min(12.5vw, 24vh);
    font-size: min(12.5vw, 24svh); /* with the toolbars showing */
  }
`;

/** One character of the name; width is locked at runtime so weight changes never reflow neighbours. */
export const Letter = styled.span`
  display: inline-block;
  white-space: pre;
  text-align: center;
  font-variation-settings: "wght" 700;
`;

/**
 * One subtitle line. `$index` counts up from the bottom line; on phones the lines stack from there in steps of their
 * own size: above the link dock in portrait (below the head's chin, clear of the drawer tab), from the bottom-left
 * corner in landscape (the dock is bottom-right).
 */
export const SubtitleText = styled.h2<{ $bottom: number; $left: number; $width?: number; $index: number }>`
  position: fixed;
  left: ${({ $left }) => $left}%;
  bottom: ${({ $bottom }) => $bottom}%;
  width: ${({ $width }) => ($width === undefined ? "auto" : `${$width}%`)};
  font-size: 6em;
  line-height: 1;
  text-align: left;
  margin: 0;
  color: ${colors.site.text};
  font-family: "Doto", sans-serif;
  font-variation-settings: "wght" 500, "ROND" 0;

  @media ${PHONE} {
    left: max(16px, env(safe-area-inset-left));
    bottom: calc(max(16px, env(safe-area-inset-bottom)) + 60px + ${({ $index }) => $index} * 1.1em);
    width: auto;
    font-size: clamp(20px, 8vw, 40px);
  }

  @media ${SHORT} {
    left: max(16px, env(safe-area-inset-left));
    bottom: calc(max(16px, env(safe-area-inset-bottom)) + ${({ $index }) => $index} * 1.1em);
    width: auto;
    font-size: clamp(16px, 8.5vh, 40px);
    font-size: clamp(16px, 8.5svh, 40px);
  }
`;
