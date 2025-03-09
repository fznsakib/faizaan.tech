import { Canvas } from "@react-three/fiber";
import styled from "styled-components";

export const AppContainer = styled.div`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const ThreeCanvas = styled(Canvas)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

export const HeaderText = styled.h1`
  position: fixed;
  top: 2rem;
  width: 110%;
  text-align: center;
  font-size: 12rem;
  z-index: 1;
  font-weight: bold;
  font-family: "Golos Text", sans-serif;
  /* animation: fontCycle 2s linear infinite; */

  @keyframes fontCycle {
    0%,
    19.99% {
      font-family: "Helvetica Neue", sans-serif;
      font-size: 12rem;
      font-weight: 100;
      letter-spacing: 0;
      transform: skew(0deg);
    }
    20%,
    39.99% {
      font-family: "Georgia", serif;
      font-size: 8rem;
      font-weight: 300;
      letter-spacing: 0.5rem;
      transform: skew(5deg);
    }
    40%,
    59.99% {
      font-family: "Courier New", monospace;
      font-size: 11rem;
      font-weight: 600;
      letter-spacing: -0.3rem;
      transform: skew(-5deg);
    }
    60%,
    79.99% {
      font-family: "Arial Black", sans-serif;
      font-size: 10rem;
      font-weight: 800;
      letter-spacing: 0.8rem;
      transform: skew(10deg);
    }
    80%,
    99.99% {
      font-family: "Impact", sans-serif;
      font-size: 7rem;
      font-weight: 900;
      letter-spacing: -0.1rem;
      transform: skew(-10deg);
    }
    100% {
      font-family: "Helvetica Neue", sans-serif;
      font-size: 12rem;
      font-weight: 100;
      letter-spacing: 0;
      transform: skew(0deg);
    }
  }
`;

export const SubtitleText = styled.h2<{
  bottom: string;
  left: string;
  width?: string;
  size?: "lg" | "md";
}>`
  position: fixed;
  left: ${(props) => props.left}%;
  bottom: ${(props) => props.bottom}%;
  width: ${(props) => props.width}%;
  font-size: ${(props) => (props.size === "md" ? "5em" : "6em")};
  line-height: 1;
  text-align: left;
  margin: 0;
  font-family: "Doto", sans-serif;
  /* font-weight: 400; */
  animation: fontWeightAndSpacingAnimation 1s infinite alternate;

  @keyframes fontWeightAndSpacingAnimation {
    0%,
    19.99% {
      font-weight: 500;
    }
    20%,
    39.99% {
      font-weight: 100;
    }
    40%,
    59.99% {
      font-weight: 300;
    }
    60%,
    79.99% {
      font-weight: 900;
    }
    80%,
    100% {
      font-weight: 800;
    }
  }

  @keyframes letterSpacingAnimation {
    0% {
      letter-spacing: ${() =>
        Math.max(-0.8, Math.min(0.12, Math.random() * 0.2 - 0.08))}em;
    }
    25% {
      letter-spacing: ${() =>
        Math.max(-0.8, Math.min(0.12, Math.random() * 0.2 - 0.08))}em;
    }
    50% {
      letter-spacing: ${() =>
        Math.max(-0.8, Math.min(0.12, Math.random() * 0.2 - 0.08))}em;
    }
    75% {
      letter-spacing: ${() =>
        Math.max(-0.8, Math.min(0.12, Math.random() * 0.2 - 0.08))}em;
    }
    100% {
      letter-spacing: ${() =>
        Math.max(-0.8, Math.min(0.12, Math.random() * 0.2 - 0.08))}em;
    }
  }

  animation: fontWeightAndSpacingAnimation 1s infinite alternate,
    letterSpacingAnimation 1.3s infinite alternate;
`;

export const SocialIconsContainer = styled.div`
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 20;
  display: flex;
  gap: 15px;
`;
