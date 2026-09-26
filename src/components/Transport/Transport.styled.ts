import styled from "styled-components";

/** Fixed top row holding the transport and (when open) the jam pad; wraps to two rows on narrow screens. */
export const Dock = styled.div`
  position: fixed;
  top: 0.75rem;
  left: 1rem;
  right: 1rem;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem 1.25rem;
  pointer-events: none;
`;

export const Bar = styled.div`
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1.25rem;
  font-family: "Doto", monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
`;

export const Control = styled.button`
  all: unset;
  cursor: pointer;

  &:hover {
    color: #ffffff;
  }

  /* global.ts outlines every focused button; keep the ring for keyboard focus only */
  &:focus:not(:focus-visible) {
    outline: none;
  }

  &:focus-visible {
    outline: 1px dashed rgba(255, 255, 255, 0.6);
    outline-offset: 0.25rem;
  }
`;

export const Label = styled.span`
  opacity: 0.7;
`;
