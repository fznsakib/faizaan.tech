import styled, { css, keyframes } from "styled-components";

const pulse = keyframes`
  0%, 100% { font-variation-settings: "wght" 300; opacity: 0.7; }
  50% { font-variation-settings: "wght" 900; opacity: 1; }
`;

const dots = keyframes`
  0% { content: ""; }
  25% { content: "."; }
  50% { content: ".."; }
  75% { content: "..."; }
`;

const bareButton = css`
  all: unset;
  cursor: pointer;
  font-family: "Doto", monospace;
  color: rgba(255, 255, 255, 0.92);

  &:focus-visible {
    outline: 2px dashed rgba(255, 255, 255, 0.6);
    outline-offset: 0.5rem;
  }
`;

export const Veil = styled.div<{ $leaving: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  background: color-mix(in srgb, var(--day-ground, rgb(20, 61, 50)) 82%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  cursor: pointer;
  opacity: ${({ $leaving }) => ($leaving ? 0 : 1)};
  pointer-events: ${({ $leaving }) => ($leaving ? "none" : "auto")};
  transition: opacity 600ms ease;
`;

export const EnterButton = styled.button`
  ${bareButton}
  font-size: clamp(3rem, 12vw, 9rem);
  line-height: 1;
  animation: ${pulse} 2.4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export const Loading = styled.span`
  &::after {
    content: "";
    display: inline-block;
    width: 3ch;
    text-align: left;
    animation: ${dots} 1.2s steps(1) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      animation: none;
      content: "...";
    }
  }
`;

export const SilentButton = styled.button`
  ${bareButton}
  font-size: clamp(1rem, 2vw, 1.4rem);
  opacity: 0.75;

  &:hover {
    opacity: 1;
  }

  /* a full-size touch target: the text alone is ~24 px tall */
  @media (pointer: coarse) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 12px;
  }
`;
