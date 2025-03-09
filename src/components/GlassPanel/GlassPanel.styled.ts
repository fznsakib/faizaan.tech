import styled, { keyframes } from "styled-components";

const float = keyframes`
  0% {
    transform: translateY(0px) translateX(0px) rotateX(0deg) rotateY(0deg);
  }
  50% {
    transform: translateY(-15px) translateX(5px) rotateX(5deg) rotateY(-2deg);
  }
  100% {
    transform: translateY(0px) translateX(0px) rotateX(0deg) rotateY(0deg);
  }
`;

export const GlassPanelContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
`;

export const GlassShape = styled.div<{
  clipPath: string;
  transform: string;
  top: string;
  left: string;
  width: string;
  height: string;
  animationDelay: string;
  scale: string;
}>`
  position: absolute;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  clip-path: ${({ clipPath }) => clipPath};
  transform: ${({ transform }) => transform};
  top: ${({ top }) => top};
  left: ${({ left }) => left};
  width: ${({ width }) => width};
  height: ${({ height }) => height};
  animation-delay: ${({ animationDelay }) => animationDelay};
  scale: ${({ scale }) => scale};

  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 0 30px rgba(255, 255, 255, 0.05);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40%;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.1),
      rgba(255, 255, 255, 0)
    );
    pointer-events: none;
  }

  animation: ${float} 10s ease-in-out infinite;
  animation-duration: ${() => 8 + Math.random() * 6}s;

  opacity: ${0.5 + Math.random() * 0.5};
  transition: opacity 0.8s ease-out;

  transform-style: preserve-3d;
  perspective: 1000px;
`;
