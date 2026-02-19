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
  top: number;
  left: number;
  width: number;
  height: number;
  delay: string;
  scale: number;
  animationDuration: string;
  opacity: number;
  bounceOvershoot: number;
  transitionDuration: number;
}

const PANEL_COUNT = 5;
const MAX_OVERLAP = 0.2;

const getOverlapFraction = (
  a: { top: number; left: number; width: number; height: number; scale: number },
  b: { top: number; left: number; width: number; height: number; scale: number }
): number => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const ax = (a.left / 100) * vw;
  const ay = (a.top / 100) * vh;
  const aw = a.width * a.scale;
  const ah = a.height * a.scale;

  const bx = (b.left / 100) * vw;
  const by = (b.top / 100) * vh;
  const bw = b.width * b.scale;
  const bh = b.height * b.scale;

  const overlapX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const overlapY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));

  const overlapArea = overlapX * overlapY;
  const smallerArea = Math.min(aw * ah, bw * bh);

  if (smallerArea === 0) return 0;
  return overlapArea / smallerArea;
};

const generateRandomPosition = () => ({
  top: 20 + Math.random() * 50,
  left: 10 + Math.random() * 70,
  width: 200 + Math.random() * 200,
  height: 150 + Math.random() * 150,
  borderRadius: generateRandomBorderRadius(),
});

const generateNonOverlappingPosition = (
  placed: Array<{ top: number; left: number; width: number; height: number; scale: number }>,
  scale: number,
  maxAttempts = 30
) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateRandomPosition();
    const hasExcessiveOverlap = placed.some(
      (p) =>
        getOverlapFraction({ ...candidate, scale }, p) > MAX_OVERLAP
    );
    if (!hasExcessiveOverlap) return candidate;
  }
  return generateRandomPosition();
};

const generatePanel = (
  id: number,
  placed: Array<{ top: number; left: number; width: number; height: number; scale: number }>
): PanelData => {
  const scale = clampedRandom(0.2, 1);
  const pos = generateNonOverlappingPosition(placed, scale);
  return {
    id,
    ...pos,
    delay: `${id * 0.2}s`,
    scale,
    animationDuration: `${8 + Math.random() * 6}s`,
    opacity: 0.5 + Math.random() * 0.5,
    bounceOvershoot: 1.2 + Math.random() * 0.6,
    transitionDuration: 1.0 + Math.random() * 0.5,
  };
};

const GlassPanel: React.FC = () => {
  const [panels, setPanels] = useState<PanelData[]>(() => {
    const initial: PanelData[] = [];
    for (let i = 0; i < PANEL_COUNT; i++) {
      const placed = initial.map((p) => ({
        top: p.top,
        left: p.left,
        width: p.width,
        height: p.height,
        scale: p.scale,
      }));
      initial.push(generatePanel(i, placed));
    }
    return initial;
  });

  useEffect(() => {
    const intervalId = setInterval(() => {
      setPanels((prev) => {
        const updated: PanelData[] = [];
        for (const panel of prev) {
          const placed = updated.map((p) => ({
            top: p.top,
            left: p.left,
            width: p.width,
            height: p.height,
            scale: p.scale,
          }));
          const pos = generateNonOverlappingPosition(placed, panel.scale);
          updated.push({ ...panel, ...pos });
        }
        return updated;
      });
    }, 4000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <GlassPanelContainer>
      {panels.map((panel) => (
        <GlassShape
          key={panel.id}
          $borderRadius={panel.borderRadius}
          $top={`${panel.top}%`}
          $left={`${panel.left}%`}
          $width={`${panel.width}px`}
          $height={`${panel.height}px`}
          $animationDelay={panel.delay}
          $scale={`${panel.scale}`}
          $animationDuration={panel.animationDuration}
          $opacity={panel.opacity}
          $bounceOvershoot={panel.bounceOvershoot}
          $transitionDuration={panel.transitionDuration}
        />
      ))}
    </GlassPanelContainer>
  );
};

export default GlassPanel;
