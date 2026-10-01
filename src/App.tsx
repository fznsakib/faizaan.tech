import { Canvas } from "@react-three/fiber";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import { COPPER_FIT, fitCamera, SKIN_FIT } from "./choreography/fit";
import Background from "./components/Background";
import Caustics from "./components/Caustics";
import GlassPanel from "./components/GlassPanel";
import NameHeader from "./components/NameHeader";
import Player from "./components/Player";
import SocialLinks from "./components/SocialLinks";
import Splash from "./components/Splash";
import SubtitleStack from "./components/SubtitleStack";
import { theme } from "./styles/theme";

const MusicDebug = lazy(() => import("./components/MusicDebug"));
const params = new URLSearchParams(window.location.search);
const showMusicDebug = params.has("debug");
/** The owner's whole head by default; `?head=copper` brings back the chrome head with his face. Each loads only its own assets. */
const copper = params.get("head") === "copper";
const HeadModel = copper ? lazy(() => import("./components/Head")) : lazy(() => import("./components/SkinHead"));
const headFit = copper ? COPPER_FIT : SKIN_FIT;

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
          camera={{ position: [0, 0, fitCamera(window.innerWidth, window.innerHeight, headFit).z] }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
          }}
        >
          <Suspense fallback={null}>
            <HeadModel />
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
