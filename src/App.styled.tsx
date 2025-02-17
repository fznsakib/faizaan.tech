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
