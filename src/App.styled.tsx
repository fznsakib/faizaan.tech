import styled, { keyframes } from "styled-components";

const logoSpin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

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

export const LogoContainer = styled.div``;

export const Logo = styled.img`
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;

  &:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }
`;

export const ReactLogo = styled(Logo)`
  &:hover {
    filter: drop-shadow(0 0 2em #61dafbaa);
  }

  @media (prefers-reduced-motion: no-preference) {
    animation: ${logoSpin} infinite 20s linear;
  }
`;

export const Title = styled.h1``;

export const Card = styled.div`
  padding: 2em;
`;

export const Button = styled.button`
  margin-bottom: 1em;
`;

export const ReadTheDocs = styled.p`
  color: #888;
`;
