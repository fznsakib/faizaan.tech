import { useState } from "react";
import styled from "styled-components";

import { useAudio } from "../../context/AudioContext";
import { SONGS, SONG_INDEX } from "../MusicPlayer/songs";

const Button = styled.button<{ $isPlaying: boolean }>`
  position: fixed;
  right: 2rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;

  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid rgba(255, 165, 0, 0.8);
  background: ${({ $isPlaying }) =>
    $isPlaying ? "rgba(255, 165, 0, 0.2)" : "rgba(0, 0, 0, 0.5)"};

  color: orange;
  font-size: 2rem;
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 165, 0, 0.3);
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 0 20px rgba(255, 165, 0, 0.5);
  }

  &:active {
    transform: translateY(-50%) scale(0.95);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
`;

export const PlayButton = () => {
  const { audioData, startMusic } = useAudio();
  const [hasClicked, setHasClicked] = useState(false);

  const handleClick = async () => {
    if (!hasClicked) {
      console.log("Play button clicked!");
      setHasClicked(true);
      await startMusic(SONGS[SONG_INDEX].bpm);
    }
  };

  return (
    <Button
      onClick={handleClick}
      $isPlaying={audioData.isPlaying}
      disabled={hasClicked}
    >
      {audioData.isPlaying ? "❚❚" : "▶"}
    </Button>
  );
};
