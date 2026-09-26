import { Canvas } from "@react-three/fiber";
import styled from "styled-components";

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

export const HeaderText = styled.h1`
  position: fixed;
  top: 2rem;
  width: 110%;
  text-align: center;
  font-size: 12rem;
  z-index: 1;
  font-weight: 700;
  font-family: "Golos Text", sans-serif;
  white-space: nowrap;
`;

/** One character of the name; width is locked at runtime so weight changes never reflow neighbours. */
export const Letter = styled.span`
  display: inline-block;
  white-space: pre;
  text-align: center;
  font-variation-settings: "wght" 700;
`;

export const SubtitleText = styled.h2<{ $bottom: number; $left: number; $width?: number }>`
  position: fixed;
  left: ${({ $left }) => $left}%;
  bottom: ${({ $bottom }) => $bottom}%;
  width: ${({ $width }) => ($width === undefined ? "auto" : `${$width}%`)};
  font-size: 6em;
  line-height: 1;
  text-align: left;
  margin: 0;
  font-family: "Doto", sans-serif;
  font-variation-settings: "wght" 500, "ROND" 0;
`;
