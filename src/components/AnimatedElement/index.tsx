import { useRef, useEffect } from "react";

import * as Styled from "./AnimatedElement.styled";
import { useAudio } from "../../context/AudioContext";

// const SCALE_MULTIPLIER = 2;
const SCALE_MULTIPLIER = 5;

interface AnimatedElementProps {
  position: { bottom: string; left: string };
  frequencyType: "low" | "mid" | "high";
}

const AnimatedElement: React.FC<AnimatedElementProps> = ({
  position,
  frequencyType,
}) => {
  const { audioData } = useAudio();
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;

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

    const average =
      frequencyData.reduce((sum, val) => sum + val, 0) / frequencyData.length;
    const normalizedAverage = average / 255;

    // apply animation based on the frequency
    const scale = 1 + normalizedAverage * SCALE_MULTIPLIER;
    elementRef.current.style.transform = `scale(${scale})`;
  }, [audioData, frequencyType]);

  return (
    <Styled.AnimatedDiv
      ref={elementRef}
      style={{
        bottom: `${position.bottom}vh`,
        left: `${position.left}vw`,
      }}
    />
  );
};

export default AnimatedElement;
