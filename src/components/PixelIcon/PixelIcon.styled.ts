import styled from "styled-components";

export const PixelIconContainer = styled.a`
  display: inline-block;
  cursor: pointer;
  transition: transform 0.2s ease;
  overflow: hidden;
  border-radius: 12px;
  background-clip: padding-box;

  &:hover {
    transform: scale(1.05);
  }
`;

export const PixelCanvas = styled.canvas`
  display: block;
  cursor: pointer;
  width: 100%;
  height: 100%;
`;
