import React, { useEffect, useState } from "react";

import { GlassPanelContainer, GlassShape } from "./GlassPanel.styled";
const generateRandomPolygon = (points: number = 6) => {
  let polygon = "";

  // Create a series of points that form a somewhat circular but jagged shape
  for (let i = 0; i < points; i++) {
    // Calculate base position on a circle
    const angle = (i / points) * Math.PI * 2;
    // Add some randomness to the radius (between 40% and 100%)
    const radius = 40 + Math.random() * 60;

    // Convert to x,y coordinates (50,50 is center)
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);

    polygon += `${x}% ${y}% `;
  }

  // Close the polygon by ensuring we have the exact number of points requested
  // and not just a rectangle with 4 corners
  return `polygon(${polygon.trim()})`;
};

// Function to generate a random rotation
const generateRandomRotation = () => {
  return `rotateX(${Math.random() * 20 - 10}) 
          rotateY(${Math.random() * 20 - 10}) 
          rotateZ(${Math.random() * 5 - 2.5})`;
};

const GlassPanel: React.FC = () => {
  const [panels, setPanels] = useState<
    Array<{
      id: number;
      clipPath: string;
      transform: string;
      top: string;
      left: string;
      width: string;
      height: string;
      delay: string;
    }>
  >([]);

  useEffect(() => {
    const generatePanels = () => {
      const newPanels = Array.from({ length: 3 }, (_, i) => ({
        id: i,
        clipPath: generateRandomPolygon(6 + Math.floor(Math.random() * 4)),
        transform: generateRandomRotation(),
        top: `${20 + Math.random() * 50}%`,
        left: `${10 + Math.random() * 70}%`,
        width: `${200 + Math.random() * 200}px`,
        height: `${150 + Math.random() * 150}px`,
        delay: `${i * 0.2}s`,
      }));

      setPanels(newPanels);
    };

    generatePanels();

    const intervalId = setInterval(generatePanels, 4000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <GlassPanelContainer>
      {panels.map((panel) => (
        <GlassShape
          key={panel.id}
          clipPath={panel.clipPath}
          transform={panel.transform}
          top={panel.top}
          left={panel.left}
          width={panel.width}
          height={panel.height}
          animationDelay={panel.delay}
        />
      ))}
    </GlassPanelContainer>
  );
};

export default GlassPanel;
