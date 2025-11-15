import React, { createContext, useContext, useState, useEffect } from "react";

import type { ReactNode } from "react";

interface AudioData {
  bpm: number;
  frequencyBins: Record<string, number[]>; // Generic frequency bins with string keys
  isPlaying: boolean;
  bassIntensity: number; // 0-1 scale for bass loudness
}

interface AudioContextType {
  audioData: AudioData;
  setAudioData: React.Dispatch<React.SetStateAction<AudioData>>;
  audioContext: AudioContext | null;
  audioAnalyser: AnalyserNode | null;
  initializeAudio: () => Promise<void>;
  isAudioInitialized: boolean;
  shouldStartMusic: boolean;
  startMusic: (bpm: number) => void;
}

const defaultAudioData: AudioData = {
  bpm: 0,
  frequencyBins: {},
  isPlaying: false,
  bassIntensity: 0,
};

const AudioContext = createContext<AudioContextType | undefined>(undefined);

interface AudioProviderProps {
  children: ReactNode;
}

export const AudioProvider = ({ children }: AudioProviderProps) => {
  const [audioData, setAudioData] = useState<AudioData>(defaultAudioData);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [shouldStartMusic, setShouldStartMusic] = useState(false);

  const initializeAudio = async () => {
    if (audioContext) {
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      return;
    }

    const context = new (window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;

    setAudioContext(context);
    setAudioAnalyser(analyser);
    setIsAudioInitialized(true);
  };

  const startMusic = async (bpm: number) => {
    console.log("startMusic called with BPM:", bpm);

    // Initialize audio if not already initialized
    await initializeAudio();

    // Set the BPM and isPlaying state
    setAudioData((prev) => ({
      ...prev,
      bpm,
      isPlaying: true,
    }));

    // Trigger the music player to start
    setShouldStartMusic(true);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, [audioContext]);

  return (
    <AudioContext.Provider
      value={{
        audioData,
        setAudioData,
        audioContext,
        audioAnalyser,
        initializeAudio,
        isAudioInitialized,
        shouldStartMusic,
        startMusic,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = (): AudioContextType => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
};
