import React, { useRef, useEffect, useMemo, useCallback } from "react";

import * as Styled from "../../App.styled";
import { useAudio } from "../../context/AudioContext";

interface AnimatedHeaderProps {
  frequencyBins: string[]; // Array of frequency bin names to respond to
  children: React.ReactNode;
}

const CHANGE_THRESHOLD = 0.03;
const FORCE_CYCLE_DURATION = 2000;
const RANDOM_CHANGE_CHANCE = 0.15;

const fontFamilies = [
  '"Didot", serif',
  '"SF Mono", monospace',
  '"Futura", sans-serif',
  '"Luminari", fantasy',
  '"Marker Felt", fantasy',
  '"Rubik Iso", cursive',
  '"Lacquer", cursive',
  '"Permanent Marker", cursive',
  '"Protest Guerrilla", cursive',
  '"Audiowide", cursive',
  '"Syne Mono", monospace',
  '"Bytesized", sans-serif',
  '"Kode Mono", monospace',
];

const fontWeights = ["100", "300", "600", "800", "900"];
const fontSizes = ["7", "8", "9", "10", "11"];
const letterSpacings = ["0", "1.2", "-0.8", "1.5", "-0.5"];
const skewValues = ["0", "5", "-5", "10", "-10"];

const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  frequencyBins,
  children,
}) => {
  const { audioData } = useAudio();
  const ref = useRef<HTMLHeadingElement>(null);
  const lastValueRef = useRef(0);
  const fontIndexRef = useRef(0);

  // Keep track of when we last changed the font
  const lastFontChangeRef = useRef(Date.now());

  const frequencyData = useMemo(() => {
    // Combine the frequency bins into a single array
    return frequencyBins.flatMap((bin) => audioData.frequencyBins[bin] || []);
  }, [audioData.frequencyBins, frequencyBins]);

  // Helper function to update the font style with a given index
  const applyFontStyle = useCallback((index: number) => {
    if (!ref.current) return;

    ref.current.style.fontFamily = fontFamilies[index];
    ref.current.style.fontWeight = fontWeights[index];
    ref.current.style.fontSize = `${fontSizes[index]}rem`;
    ref.current.style.letterSpacing = `${letterSpacings[index]}rem`;
    ref.current.style.transform = `skew(${skewValues[index]}deg)`;
  }, []);

  // Helper function to potentially trigger consecutive font changes
  const triggerConsecutiveChanges = useCallback(() => {
    // 25% chance of triggering consecutive changes
    if (Math.random() < RANDOM_CHANGE_CHANCE) {
      // Schedule 1-3 additional rapid changes
      const numChanges = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < numChanges; i++) {
        setTimeout(() => {
          fontIndexRef.current = Math.floor(
            Math.random() * fontFamilies.length
          );
          applyFontStyle(fontIndexRef.current);

          // Last change in the sequence - potentially trigger another sequence
          if (i === numChanges - 1) {
            triggerConsecutiveChanges();
          }
        }, 100 + i * 150); // Staggered changes, starting after 100ms
      }
    }
  }, [applyFontStyle]);

  const updateFont = useCallback(
    (smoothedValue: number) => {
      if (!ref.current) return;

      const now = Date.now();

      // Make it much more responsive - lower threshold and shorter time delay
      // Only change font if there's a significant change in the audio data and enough time has passed
      if (
        Math.abs(smoothedValue - lastValueRef.current) > CHANGE_THRESHOLD &&
        now - lastFontChangeRef.current > 100
      ) {
        fontIndexRef.current = Math.floor(Math.random() * fontFamilies.length);
        lastFontChangeRef.current = now;

        applyFontStyle(fontIndexRef.current);
        triggerConsecutiveChanges();
      }

      // Save the current value for comparison in the next frame
      lastValueRef.current = smoothedValue;
    },
    [applyFontStyle, triggerConsecutiveChanges]
  );

  useEffect(() => {
    if (frequencyData.length === 0) {
      return;
    }

    // Use maximum value for more dynamic response
    const maxValue = Math.max(...frequencyData);
    const normalizedValue = maxValue / 255;

    // Less smoothing for more responsive behavior
    // const smoothingFactor = 0.9; // Increased from 0.15 for more responsiveness
    const smoothingFactor = 0.6; // Increased from 0.15 for more responsiveness
    const smoothedValue =
      lastValueRef.current * (1 - smoothingFactor) +
      normalizedValue * smoothingFactor;

    // cycle if nothing is happening
    const now = Date.now();
    if (now - lastFontChangeRef.current > FORCE_CYCLE_DURATION) {
      fontIndexRef.current = (fontIndexRef.current + 1) % fontFamilies.length;
      lastFontChangeRef.current = now;

      if (ref.current) {
        const i = fontIndexRef.current;
        applyFontStyle(i);
        triggerConsecutiveChanges();
      }
    } else {
      updateFont(smoothedValue);
    }
  }, [frequencyData, updateFont, applyFontStyle, triggerConsecutiveChanges]);

  // cycle if no audio data
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastFontChangeRef.current > FORCE_CYCLE_DURATION) {
        console.log("No audio activity detected, forcing font cycle");

        if (ref.current) {
          fontIndexRef.current =
            (fontIndexRef.current + 1) % fontFamilies.length;
          const now = Date.now();
          lastFontChangeRef.current = now;

          const i = fontIndexRef.current;
          applyFontStyle(i);
          triggerConsecutiveChanges();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [applyFontStyle, triggerConsecutiveChanges]);

  return (
    <Styled.HeaderText
      ref={ref}
      style={{
        transition:
          "letterSpacing 0.3s ease, transform 0.3s ease, fontSize 0.3s ease, letterSpacing 0.3s ease, skew 0.3s ease",
      }}
    >
      {children}
    </Styled.HeaderText>
  );
};

export default AnimatedHeader;
