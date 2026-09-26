import styled from "styled-components";

export const Crate = styled.div`
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: flex-start;
`;

export const Record = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  max-width: 7rem;
`;

export const Sleeve = styled.button<{ $current: boolean }>`
  all: unset;
  cursor: pointer;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 4px;
  background: #0e2a22;
  border: 1px solid ${({ $current }) => ($current ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.3)")};
  box-shadow: ${({ $current }) => ($current ? "0 0 0 2px rgba(255, 138, 28, 0.8)" : "none")};

  &:focus-visible {
    outline: 1px dashed rgba(255, 255, 255, 0.6);
    outline-offset: 0.2rem;
  }
`;

export const Art = styled.img`
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
`;

export const Initials = styled.span`
  font-family: "Doto", monospace;
  font-weight: 900;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
`;

export const Credit = styled.a`
  font-family: "Doto", monospace;
  font-size: 0.7rem;
  line-height: 1.2;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);

  &:hover {
    color: #ffffff;
  }
`;
