import styled, { keyframes } from "styled-components";

const highlightDrift = keyframes`
  0% {
    transform: translate(0%, 0%);
  }
  33% {
    transform: translate(15%, 8%);
  }
  66% {
    transform: translate(-8%, 12%);
  }
  100% {
    transform: translate(0%, 0%);
  }
`;

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
  $borderRadius: string;
  $top: string;
  $left: string;
  $width: string;
  $height: string;
  $animationDelay: string;
  $scale: string;
  $animationDuration: string;
  $opacity: number;
  $bounceOvershoot: number;
  $transitionDuration: number;
}>`
  position: absolute;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(32px) saturate(1.2);
  -webkit-backdrop-filter: blur(32px) saturate(1.2);
  overflow: hidden;

  border-radius: ${({ $borderRadius }) => $borderRadius};
  top: ${({ $top }) => $top};
  left: ${({ $left }) => $left};
  width: ${({ $width }) => $width};
  height: ${({ $height }) => $height};
  animation-delay: ${({ $animationDelay }) => $animationDelay};
  scale: ${({ $scale }) => $scale};

  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 1px rgba(255, 255, 255, 0.15),
    inset 0 -1px 2px rgba(0, 0, 0, 0.1);

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 60%;
    height: 60%;
    background: radial-gradient(
      ellipse at 30% 30%,
      rgba(255, 255, 255, 0.2),
      transparent 70%
    );
    border-radius: inherit;
    pointer-events: none;
    animation: ${highlightDrift} 6s ease-in-out infinite;
  }

  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    right: 0;
    width: 50%;
    height: 50%;
    background: radial-gradient(
      ellipse at 70% 70%,
      rgba(255, 255, 255, 0.08),
      transparent 70%
    );
    border-radius: inherit;
    pointer-events: none;
  }

  animation: ${float} 10s ease-in-out infinite;
  animation-duration: ${({ $animationDuration }) => $animationDuration};

  opacity: ${({ $opacity }) => $opacity};
  transition:
    top ${({ $transitionDuration }) => $transitionDuration}s cubic-bezier(0.34, ${({ $bounceOvershoot }) => $bounceOvershoot}, 0.64, 1),
    left ${({ $transitionDuration }) => $transitionDuration}s cubic-bezier(0.34, ${({ $bounceOvershoot }) => $bounceOvershoot}, 0.64, 1),
    width ${({ $transitionDuration }) => $transitionDuration}s cubic-bezier(0.34, ${({ $bounceOvershoot }) => $bounceOvershoot}, 0.64, 1),
    height ${({ $transitionDuration }) => $transitionDuration}s cubic-bezier(0.34, ${({ $bounceOvershoot }) => $bounceOvershoot}, 0.64, 1),
    border-radius ${({ $transitionDuration }) => $transitionDuration}s cubic-bezier(0.34, ${({ $bounceOvershoot }) => $bounceOvershoot}, 0.64, 1);

  transform-style: preserve-3d;
  perspective: 1000px;
  will-change: transform;

  @media (prefers-reduced-motion: reduce) {
    animation-play-state: paused;

    &::before {
      animation-play-state: paused;
    }
  }
`;
