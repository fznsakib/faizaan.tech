import { Canvas } from "@react-three/fiber";
import { lazy, Suspense } from "react";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import githubIcon from "./assets/github.png";
import gmailIcon from "./assets/gmail.png";
import letterboxdIcon from "./assets/letterboxd.png";
import linkedinIcon from "./assets/linkedin.png";
import stravaIcon from "./assets/strava.png";
import Background from "./components/Background";
import GlassPanel from "./components/GlassPanel";
import Head from "./components/Head";
import PixelIcon from "./components/PixelIcon";
import Splash from "./components/Splash";
import Transport from "./components/Transport";
import { theme } from "./styles/theme";

const MusicDebug = lazy(() => import("./components/MusicDebug"));
const showMusicDebug = new URLSearchParams(window.location.search).has("debug");

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Background />
      <GlassPanel />
      <Styled.HeaderText>(faiz)aan sakib</Styled.HeaderText>
      <Styled.SubtitleText bottom="52" left="2" width="20">
        senior
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="42" left="2" width="20">
        software
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="32" left="2" width="20">
        engineer
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="22" left="2">
        fullstack
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="12" left="2">
        london
      </Styled.SubtitleText>
      <Styled.SubtitleText bottom="2" left="2">
        affirm
      </Styled.SubtitleText>

      <Styled.SocialIconsContainer>
        <PixelIcon
          imagePath={linkedinIcon}
          link={"https://www.linkedin.com/in/faizaan-sakib/"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={gmailIcon}
          link={"mailto:fznsakib@gmail.com"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={githubIcon}
          link={"https://github.com/fznsakib"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={letterboxdIcon}
          link={"https://letterboxd.com/fznsakib/"}
          initialPixelSize={12}
          size={80}
        />
        <PixelIcon
          imagePath={stravaIcon}
          link={"https://strava.app.link/VhdUXhuiWRb"}
          initialPixelSize={12}
          size={80}
        />
      </Styled.SocialIconsContainer>

      {/* three.js canvas */}
      <Styled.AppContainer>
        <Canvas
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 10,
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

      <Transport />
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
