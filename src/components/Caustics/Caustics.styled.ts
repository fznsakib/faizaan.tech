import styled from "styled-components";

/**
 * The caustics' canvas, sized to the light pool under the head (never the whole viewport) and placed there. z 0,
 * mounted after `Background` so it paints over the grid, and under the name and subtitles (1), the glass (9) and
 * the head (10). Never takes a click.
 */
export const Canvas = styled.canvas`
  position: fixed;
  left: 0;
  top: 0;
  z-index: 0;
  pointer-events: none;
`;
