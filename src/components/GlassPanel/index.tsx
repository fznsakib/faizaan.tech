import React, { useEffect, useState } from "react";

import { GlassPanelContainer, GlassShape } from "./GlassPanel.styled";
import { clamp } from "../../utils/random";
import { clampedRandom } from "../../utils/random";

const generateRandomPolygon = (points: number = 6) => {
  let polygon = "";

  for (let i = 0; i < points; i++) {
    // Calculate base position on a circle
    const angle = (i / points) * Math.PI * 2;
    // Add some randomness to the radius (between 40% and 100%)
    const radius = 40 + Math.random() * 60;

    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);

    polygon += `${clamp(x, 0, 100)}% ${clamp(y, 0, 100)}%`;

    if (i < points - 1) {
      polygon += ", ";
    }
  }

  polygon = `polygon(${polygon.trim()})`;
  return polygon;
};

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
      scale: string;
    }>
  >([]);

  useEffect(() => {
    const generatePanels = (numPanels = 10) => {
      const newPanels = Array.from({ length: numPanels }, (_, i) => ({
        id: i,
        clipPath: generateRandomPolygon(clampedRandom(3, 8)),
        transform: generateRandomRotation(),
        top: `${20 + Math.random() * 50}%`,
        left: `${10 + Math.random() * 70}%`,
        width: `${200 + Math.random() * 200}px`,
        height: `${150 + Math.random() * 150}px`,
        delay: `${i * 0.2}s`,
        scale: `${clampedRandom(0.2, 1)}`,
      }));

      setPanels(newPanels);
    };

    generatePanels(10);

    const intervalId = setInterval(
      () => generatePanels(clampedRandom(3, 5)),
      4000
    );

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
          scale={panel.scale}
        />
      ))}
    </GlassPanelContainer>
  );
};

export default GlassPanel;
