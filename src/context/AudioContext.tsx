import React, { createContext, useContext, useState, useEffect } from "react";

import type { ReactNode } from "react";

interface AudioData {
  bpm: number;
  frequencyBins: Record<string, number[]>; // Generic frequency bins with string keys
  isPlaying: boolean;
}

interface AudioContextType {
  audioData: AudioData;
  setAudioData: React.Dispatch<React.SetStateAction<AudioData>>;
  audioContext: AudioContext | null;
  audioAnalyser: AnalyserNode | null;
  initializeAudio: () => Promise<void>;
  isAudioInitialized: boolean;
}

const defaultAudioData: AudioData = {
  bpm: 0,
  frequencyBins: {},
  isPlaying: false,
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

  // setup event listeners for user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      initializeAudio();

      // remove event listeners after first interaction
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);
    };

    window.addEventListener("click", handleUserInteraction);
    window.addEventListener("touchstart", handleUserInteraction);
    window.addEventListener("keydown", handleUserInteraction);

    return () => {
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("keydown", handleUserInteraction);

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
