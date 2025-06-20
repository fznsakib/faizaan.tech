import React, { useRef, useEffect, useState } from "react";

import * as Styled from "../../App.styled";
import { useAudio } from "../../context/AudioContext";

interface AnimatedSubtitleProps {
  bottom: string;
  left: string;
  width?: string;
  size?: "lg" | "md";
  frequencyType: "low" | "mid" | "high";
  children: React.ReactNode;
}

const AnimatedSubtitle: React.FC<AnimatedSubtitleProps> = ({
  bottom,
  left,
  width,
  size,
  frequencyType,
  children,
}) => {
  const { audioData } = useAudio();
  const ref = useRef<HTMLHeadingElement>(null);
  const [lastValue, setLastValue] = useState(0);

  useEffect(() => {
    if (!ref.current) return;

    let frequencyData: number[] = [];
    switch (frequencyType) {
      case "low":
        frequencyData = audioData.lowFrequency;
        break;
      case "mid":
        frequencyData = audioData.midFrequency;
        break;
      case "high":
        frequencyData = audioData.highFrequency;
        break;
    }
    if (!frequencyData || frequencyData.length === 0) return;

    // Use maximum value for more dynamic response instead of average
    const maxValue = Math.max(...frequencyData);
    const normalizedValue = maxValue / 255;

    // Increased smoothing to reduce erratic behavior
    const smoothingFactor = 0.15; // Reduced from 0.3 for more stability
    const smoothedValue =
      lastValue * (1 - smoothingFactor) + normalizedValue * smoothingFactor;
    setLastValue(smoothedValue);

    // Simplified and more controlled animations
    // Letter spacing: -0.3em to 0.8em (reduced range for stability)
    const letterSpacingValue = smoothedValue * 1.1 - 0.3;
    ref.current.style.letterSpacing = `${letterSpacingValue}em`;

    // Font weight: 300 to 700 (reduced range for stability)
    const fontWeight = `${Math.floor(smoothedValue * 400 + 300)}`;
    ref.current.style.fontWeight = fontWeight;

    // Bring back scale and opacity with controlled ranges
    // Subtle scale: 0.95 to 1.05 (very controlled range)
    const scaleValue = 0.55 + smoothedValue * 0.3;
    ref.current.style.transform = `scale(${scaleValue})`;

    // Controlled opacity: 0.8 to 1.0 (subtle variation)
    const opacityValue = 0.6 + smoothedValue * 0.4;
    ref.current.style.opacity = `${opacityValue}`;
  }, [audioData, frequencyType, lastValue]);

  return (
    <Styled.SubtitleText
      ref={ref}
      bottom={bottom}
      left={left}
      width={width}
      size={size}
      style={{
        transition: "none", // Remove CSS transitions to allow frame-by-frame updates
        transformOrigin: "left center",
      }}
    >
      {children}
    </Styled.SubtitleText>
  );
};

export default AnimatedSubtitle;
