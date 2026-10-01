import styled from "styled-components";

/** z 0, not below: a body background (ours, or a host page's) would otherwise paint over it. */
export const Background = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  background-color: rgb(20, 61, 50);
`;

export const Canvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;
