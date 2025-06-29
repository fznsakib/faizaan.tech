import { useEffect, useRef, useState } from "react";

import { MusicAnalyser } from "./MusicAnalyser";
import audioFile from "../../assets/audio/bend-tiesto.mp3";
import { useAudio } from "../../context/AudioContext";

const MusicPlayer = () => {
  const { setAudioData, audioContext, isAudioInitialized, initializeAudio } =
    useAudio();
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyzerRef = useRef<MusicAnalyser | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [playAttempted, setPlayAttempted] = useState(false);

  // attempt to initialize audio on component mount
  useEffect(() => {
    const attemptInitialization = async () => {
      try {
        await initializeAudio();
      } catch {
        console.log(
          "Audio context initialization deferred until user interaction"
        );
      }
    };

    attemptInitialization();
  }, [initializeAudio]);

  // TODO: Add a button for mobile devices that might need explicit user interaction
  useEffect(() => {
    const triggerButton = document.createElement("button");
    triggerButton.textContent = "Click to Play Music";
    triggerButton.style.position = "fixed";
    triggerButton.style.bottom = "20px";
    triggerButton.style.right = "20px";
    triggerButton.style.zIndex = "1000";
    triggerButton.style.padding = "10px";
    triggerButton.style.backgroundColor = "rgba(0,0,0,0.5)";
    triggerButton.style.color = "white";
    triggerButton.style.border = "none";
    triggerButton.style.borderRadius = "5px";
    triggerButton.style.cursor = "pointer";
    triggerButton.style.display = "none"; // Hidden initially

    // Show the button if audio hasn't started after 2 seconds
    const showButtonTimeout = setTimeout(() => {
      if (!playAttempted) {
        triggerButton.style.display = "block";
      }
    }, 2000);

    triggerButton.addEventListener("click", async () => {
      await initializeAudio();
      triggerButton.style.display = "none";
      setPlayAttempted(true);
    });

    document.body.appendChild(triggerButton);

    return () => {
      clearTimeout(showButtonTimeout);
      document.body.removeChild(triggerButton);
    };
  }, [initializeAudio, playAttempted]);

  useEffect(() => {
    if (!audioContext || !isAudioInitialized) return;

    const loadAudio = async () => {
      try {
        const response = await fetch(audioFile);
        const arrayBuffer = await response.arrayBuffer();

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const analyzer = new MusicAnalyser(audioContext, source);
        analyzerRef.current = analyzer;
        audioSourceRef.current = source;

        // start playing
        source.start(0);
        startAnalyzing();

        setPlayAttempted(true);
        setAudioData((prev) => ({ ...prev, isPlaying: true }));

        // handle end of track
        source.onended = () => {
          setAudioData((prev) => ({ ...prev, isPlaying: false }));
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        };
      } catch (error) {
        console.error("Error loading audio:", error);
      }
    };

    loadAudio();

    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioContext, setAudioData, isAudioInitialized]);

  const startAnalyzing = () => {
    const analyzer = analyzerRef.current;
    if (!analyzer) return;

    let lastFrequencyBins: Record<string, number[]> = {};
    let lastBpm = 0;

    const analyzeFrame = () => {
      if (!analyzer) return;

      const frequencyData = analyzer.getFrequencyData();
      const bpm = analyzer.detectBPM();

      // Only update state if data has actually changed
      const frequencyBinsChanged =
        JSON.stringify(frequencyData.frequencyBins) !==
        JSON.stringify(lastFrequencyBins);
      const bpmChanged = bpm !== lastBpm;

      if (frequencyBinsChanged || bpmChanged) {
        setAudioData((prev) => ({
          ...prev,
          bpm,
          frequencyBins: frequencyData.frequencyBins,
        }));

        lastFrequencyBins = frequencyData.frequencyBins;
        lastBpm = bpm;
      }

      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    };

    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  };

  return null;
};

export default MusicPlayer;
