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
  color: white;
  z-index: 1;
  font-weight: bold;
  /* animation: fontCycle 1s linear infinite; */

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
