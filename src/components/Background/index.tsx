import React, { useState, useEffect } from "react";

import * as Styled from "./Background.styled";
import PlusIcon from "../Icon/PlusIcon";
import PlusMiniIcon from "../Icon/PlusMiniIcon";

const Background: React.FC = () => {
  // State for the viewport dimensions
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Update dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate columns and rows that completely fit 40x40 icons.
  // Using Math.floor ensures the grid fits entirely within the viewport.
  const columns = Math.floor(dimensions.width / 40);
  const rows = Math.floor(dimensions.height / 40);
  const gridWidth = columns * 40;
  const gridHeight = rows * 40;
  const totalIcons = columns * rows;

  return (
    <Styled.Background>
      {/* big plus */}
      <Styled.GridLayout
        zIndex={-2}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        columns={columns}
        rows={rows}
      >
        {Array.from({ length: totalIcons }, (_, index) => (
          <PlusIcon key={index} color="#555555" />
        ))}
      </Styled.GridLayout>

      {/* mini plus */}
      <Styled.GridLayout
        zIndex={-1}
        gridWidth={gridWidth}
        gridHeight={gridHeight}
        columns={columns}
        rows={rows}
      >
        {Array.from({ length: totalIcons }, (_, index) => (
          <PlusMiniIcon key={index} color="#8AB1EE" opacity={0.5} />
        ))}
      </Styled.GridLayout>
    </Styled.Background>
  );
};

export default Background;
