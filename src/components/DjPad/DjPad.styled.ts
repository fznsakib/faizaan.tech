import styled from "styled-components";

export const Pad = styled.div`
  position: fixed;
  top: 0.75rem;
  right: 1rem;
  z-index: 20;
  display: flex;
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
