import React, { useRef, useEffect, useMemo, useCallback } from "react";

import * as Styled from "../../App.styled";
import { useAudio } from "../../context/AudioContext";
import { calculateRMS, normalizeRMS } from "../../utils/audio";

interface AnimatedSubtitleProps {
  bottom: string;
  left: string;
  width?: string;
  size?: "lg" | "md";
  frequencyBin: string; // Generic frequency bin name
  children: React.ReactNode;
}

const AnimatedSubtitle: React.FC<AnimatedSubtitleProps> = ({
  bottom,
  left,
  width,
  size,
  frequencyBin,
  children,
}) => {
  const { audioData } = useAudio();
  const ref = useRef<HTMLHeadingElement>(null);
  const lastValueRef = useRef(0);

  // Calculate RMS for this subtitle's specific frequency bin
  const rmsIntensity = useMemo(() => {
    const frequencyData = audioData.frequencyBins[frequencyBin] || [];
    if (frequencyData.length === 0) return 0;

    const rms = calculateRMS(frequencyData);
    return normalizeRMS(rms);
  }, [audioData.frequencyBins, frequencyBin]);

  // Memoize the animation calculation
  const updateAnimation = useCallback((intensity: number) => {
    if (!ref.current) return;

    // Use exponential curve for more dramatic response at high intensity
    // Cubic function: x^3 ramps slowly at low values, dramatically at high values
    const exponentialIntensity = Math.pow(intensity, 3);

    // Simplified and more controlled animations
    // Letter spacing: -0.3em to 0.8em (reduced range for stability)
    const letterSpacingValue = exponentialIntensity * 1.1 - 0.3;
    ref.current.style.letterSpacing = `${letterSpacingValue}em`;

    // Font weight: 300 to 700 (reduced range for stability)
    const fontWeight = `${Math.floor(exponentialIntensity * 400 + 300)}`;
    ref.current.style.fontWeight = fontWeight;

    // Bring back scale and opacity with controlled ranges
    // Subtle scale: 0.55 to 0.85 (controlled range)
    const scaleValue = 0.55 + exponentialIntensity * 0.3;
    ref.current.style.transform = `scale(${scaleValue})`;

    // Controlled opacity: 0.6 to 1.0 (subtle variation)
    const opacityValue = 0.6 + exponentialIntensity * 0.4;
    ref.current.style.opacity = `${opacityValue}`;
  }, []);

  useEffect(() => {
    // Apply smoothing to the RMS intensity
    const smoothingFactor = 0.15;
    const smoothedValue =
      lastValueRef.current * (1 - smoothingFactor) +
      rmsIntensity * smoothingFactor;
    lastValueRef.current = smoothedValue;

    updateAnimation(smoothedValue);
  }, [rmsIntensity, updateAnimation]);

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
