import { Canvas } from "@react-three/fiber";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import AnimatedHeader from "./components/AnimatedHeader";
import AnimatedSubtitle from "./components/AnimatedSubtitle";
import Background from "./components/Background";
import GlassPanel from "./components/GlassPanel";
import Head from "./components/Head";
import MusicPlayer from "./components/MusicPlayer";
import PixelIcon from "./components/PixelIcon";
import { AudioProvider } from "./context/AudioContext";
import { theme } from "./styles/theme";

function App() {
  return (
    <AudioProvider>
      <ThemeProvider theme={theme}>
        <Background />
        <GlassPanel />
        <AnimatedHeader frequencyBins={["software"]}>
          (faiz)aan sakib
        </AnimatedHeader>
        <AnimatedSubtitle bottom="52" left="2" width="20" frequencyBin="senior">
          senior
        </AnimatedSubtitle>
        <AnimatedSubtitle
          bottom="42"
          left="2"
          width="20"
          frequencyBin="software"
        >
          software
        </AnimatedSubtitle>
        <AnimatedSubtitle
          bottom="32"
          left="2"
          width="20"
          frequencyBin="engineer"
        >
          engineer
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="22" left="2" frequencyBin="fullstack">
          fullstack
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="12" left="2" frequencyBin="london">
          london
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="2" left="2" frequencyBin="affirm">
          affirm
        </AnimatedSubtitle>

        <Styled.SocialIconsContainer>
          <PixelIcon
            imagePath="src/assets/linkedin.png"
            link={"https://www.linkedin.com/in/faizaan-sakib/"}
            initialPixelSize={12}
            size={80}
          />
          <PixelIcon
            imagePath="src/assets/gmail.png"
            link={"mailto:fznsakib@gmail.com"}
            initialPixelSize={12}
            size={80}
          />
          <PixelIcon
            imagePath="src/assets/github.png"
            link={"https://github.com/fznsakib"}
            initialPixelSize={12}
            size={80}
          />
          <PixelIcon
            imagePath="src/assets/letterboxd.png"
            link={"https://letterboxd.com/fznsakib/"}
            initialPixelSize={12}
            size={80}
          />
          <PixelIcon
            imagePath="src/assets/strava.png"
            link={"https://strava.app.link/VhdUXhuiWRb"}
            initialPixelSize={12}
            size={80}
          />
        </Styled.SocialIconsContainer>

        <MusicPlayer />

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
      </ThemeProvider>
    </AudioProvider>
  );
}

export default App;
