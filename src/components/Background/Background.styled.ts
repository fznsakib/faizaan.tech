import styled from "styled-components";

export const Background = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: -5;
  background-color: rgb(20, 61, 50);
`;

export const GridLayout = styled.div<{
  gridWidth: number;
  gridHeight: number;
  columns: number;
  rows: number;
  zIndex: number;
}>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: ${({ gridWidth }) => gridWidth}px;
  height: ${({ gridHeight }) => gridHeight}px;
  z-index: ${({ zIndex }) => zIndex};
  display: grid;
  grid-template-columns: repeat(${({ columns }) => columns}, 40px);
  grid-template-rows: repeat(${({ rows }) => rows}, 40px);
`;
