import { Canvas } from "@react-three/fiber";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import Background from "./components/Background";
import Head from "./components/Head";
import { theme } from "./styles/theme";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Background />
      <Styled.AppContainer>
        <Canvas
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <ambientLight intensity={5} />
          <pointLight
            position={[10, 10, 10]}
            intensity={20}
            distance={20}
            decay={2}
          />
          <pointLight position={[-5, -5, -5]} intensity={5} />
          <Head />
        </Canvas>
      </Styled.AppContainer>
    </ThemeProvider>
  );
}

export default App;
