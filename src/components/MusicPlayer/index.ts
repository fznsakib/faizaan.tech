import { useCallback, useEffect, useRef } from "react";

import { MusicAnalyser } from "./MusicAnalyser";
import { SONGS, SONG_INDEX } from "./songs";
import { useAudio } from "../../context/AudioContext";
import { BASE_NOD_INTENSITY } from "../Head";

const MusicPlayer = () => {
  const { setAudioData, audioContext, isAudioInitialized, shouldStartMusic } =
    useAudio();

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyzerRef = useRef<MusicAnalyser | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasStarted = useRef(false);
  const smoothedBassIntensity = useRef(BASE_NOD_INTENSITY); // Start at minimum (10%)

  const startAnalyzing = useCallback(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) return;

    let lastFrequencyBins: Record<string, number[]> = {};

    const analyzeFrame = () => {
      if (!analyzer) return;

      const frequencyData = analyzer.getFrequencyData();

      // Calculate bass intensity from bass frequencies (senior + software bins)
      const seniorBass = frequencyData.frequencyBins["senior"] || [];
      const softwareBass = frequencyData.frequencyBins["software"] || [];
      const allBass = [...seniorBass, ...softwareBass];

      // Calculate RMS (root mean square) of bass frequencies
      let bassRMS = 0;
      if (allBass.length > 0) {
        const sumSquares = allBass.reduce((sum, val) => sum + val * val, 0);
        bassRMS = Math.sqrt(sumSquares / allBass.length);
      }

      // Normalize to 0-1 range (assuming max value is ~255 from byte frequency data)
      const normalizedBass = Math.min(bassRMS / 255, 1);

      // Apply exponential smoothing to avoid jitter (smoothing factor 0.15 = very smooth)
      const smoothingFactor = 0.15;
      smoothedBassIntensity.current =
        smoothedBassIntensity.current * (1 - smoothingFactor) +
        normalizedBass * smoothingFactor;

      // Only update state if data has actually changed
      const frequencyBinsChanged =
        JSON.stringify(frequencyData.frequencyBins) !==
        JSON.stringify(lastFrequencyBins);

      if (frequencyBinsChanged) {
        setAudioData((prev) => ({
          ...prev,
          // Keep the static BPM, don't overwrite with detected BPM
          frequencyBins: frequencyData.frequencyBins,
          bassIntensity: smoothedBassIntensity.current,
        }));

        lastFrequencyBins = frequencyData.frequencyBins;
      }

      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    };

    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  }, [setAudioData]);

  // Load and play audio when instructed
  useEffect(() => {
    if (
      !audioContext ||
      !isAudioInitialized ||
      !shouldStartMusic ||
      hasStarted.current
    ) {
      return;
    }

    hasStarted.current = true;

    const loadAudio = async () => {
      try {
        console.log("Loading audio...");
        const audioFile = SONGS[SONG_INDEX].file;
        const response = await fetch(audioFile);
        const arrayBuffer = await response.arrayBuffer();

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const analyzer = new MusicAnalyser(audioContext, source);
        analyzerRef.current = analyzer;
        audioSourceRef.current = source;

        // set audio to beginning
        source.start(0);
        startAnalyzing();

        // handle end of track
        source.onended = () => {
          setAudioData((prev) => ({ ...prev, bpm: 0, isPlaying: false }));
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        };
      } catch (error) {
        console.error("Error loading audio:", error);
        hasStarted.current = false; // Allow retry
      }
    };

    loadAudio();

    return () => {
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
          audioSourceRef.current.disconnect();
        } catch {
          // Already stopped
        }
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    audioContext,
    setAudioData,
    isAudioInitialized,
    shouldStartMusic,
    startAnalyzing,
  ]);

  return null;
};

export default MusicPlayer;
