import { Canvas } from "@react-three/fiber";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import { fitCamera } from "./choreography/fit";
import Background from "./components/Background";
import Caustics from "./components/Caustics";
import GlassPanel from "./components/GlassPanel";
import Head from "./components/Head";
import NameHeader from "./components/NameHeader";
import Player from "./components/Player";
import SocialLinks from "./components/SocialLinks";
import Splash from "./components/Splash";
import SubtitleStack from "./components/SubtitleStack";
import { theme } from "./styles/theme";

const MusicDebug = lazy(() => import("./components/MusicDebug"));
const showMusicDebug = new URLSearchParams(window.location.search).has("debug");

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Background />
      {/* z 0 like the grid, and after it: light on the grid, under the name */}
      <Caustics />
      <GlassPanel />
      <NameHeader />
      <SubtitleStack />

      <SocialLinks />

      {/* three.js canvas */}
      <Styled.AppContainer>
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [0, 0, fitCamera(window.innerWidth, window.innerHeight).z] }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
          }}
        >
          <ambientLight intensity={0.3} />
          <pointLight
            position={[10, 10, 10]}
            intensity={20}
            distance={20}
            decay={2}
          />
          <pointLight position={[-5, -5, -5]} intensity={5} />

          <Suspense fallback={null}>
            <Head />
          </Suspense>
        </Canvas>
      </Styled.AppContainer>

      <Player />
      <Splash />
      {showMusicDebug && (
        <Suspense fallback={null}>
          <MusicDebug />
        </Suspense>
      )}
    </ThemeProvider>
  );
}

export default App;
