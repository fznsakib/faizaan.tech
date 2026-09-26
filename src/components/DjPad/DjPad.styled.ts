import styled from "styled-components";

export const Pad = styled.div`
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-family: "Doto", monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
`;

export const PadButton = styled.button`
  all: unset;
  cursor: pointer;
  padding: 0.2rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 4px;
  touch-action: manipulation;
  user-select: none;

  @media (pointer: coarse) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
  }

  &:active {
    background: rgba(255, 255, 255, 0.15);
  }

  &:focus-visible {
    outline: 1px dashed rgba(255, 255, 255, 0.6);
    outline-offset: 0.2rem;
  }
`;

export const Key = styled.span`
  opacity: 0.55;
`;
