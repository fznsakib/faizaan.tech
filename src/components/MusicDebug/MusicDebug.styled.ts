import styled from "styled-components";

export const Panel = styled.div`
  position: fixed;
  top: 3rem;
  right: 1rem;
  z-index: 90;
  width: 280px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #eeeeee;
  font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
`;

export const Row = styled.div`
  display: flex;
  gap: 10px;
`;

export const Lamp = styled.div<{ $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  opacity: 0;
`;

export const Meter = styled.div`
  display: grid;
  grid-template-columns: 60px 1fr;
  align-items: center;
`;

export const Track = styled.div`
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
`;

export const Fill = styled.div`
  height: 100%;
  background: #8ab1ee;
  transform-origin: left;
  transform: scaleX(0);
`;

export const Bands = styled.div`
  display: flex;
  gap: 4px;
  height: 48px;
`;

export const Band = styled.div`
  flex: 1;
  background: #ff8a1c;
  transform-origin: bottom;
  transform: scaleY(0);
`;

export const Readout = styled.div`
  min-height: 2.6em;
  white-space: pre-wrap;
`;
