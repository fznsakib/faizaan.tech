import React, { useEffect, useState } from "react";

import { GlassPanelContainer, GlassShape } from "./GlassPanel.styled";
import { clampedRandom } from "../../utils/random";

const generateRandomBorderRadius = () => {
  const v = () => 30 + Math.floor(Math.random() * 40);
  return `${v()}% ${v()}% ${v()}% ${v()}% / ${v()}% ${v()}% ${v()}% ${v()}%`;
};

interface PanelData {
  id: number;
  borderRadius: string;
  top: string;
  left: string;
  width: string;
  height: string;
  delay: string;
  scale: string;
  animationDuration: string;
  opacity: number;
}

const GlassPanel: React.FC = () => {
  const [panels, setPanels] = useState<PanelData[]>([]);

  useEffect(() => {
    const generatePanels = (numPanels = 10) => {
      const newPanels: PanelData[] = Array.from(
        { length: numPanels },
        (_, i) => ({
          id: i,
          borderRadius: generateRandomBorderRadius(),
          top: `${20 + Math.random() * 50}%`,
          left: `${10 + Math.random() * 70}%`,
          width: `${200 + Math.random() * 200}px`,
          height: `${150 + Math.random() * 150}px`,
          delay: `${i * 0.2}s`,
          scale: `${clampedRandom(0.2, 1)}`,
          animationDuration: `${8 + Math.random() * 6}s`,
          opacity: 0.5 + Math.random() * 0.5,
        })
      );

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
          $borderRadius={panel.borderRadius}
          $top={panel.top}
          $left={panel.left}
          $width={panel.width}
          $height={panel.height}
          $animationDelay={panel.delay}
          $scale={panel.scale}
          $animationDuration={panel.animationDuration}
          $opacity={panel.opacity}
        />
      ))}
    </GlassPanelContainer>
  );
};

export default GlassPanel;
