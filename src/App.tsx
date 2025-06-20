import { Canvas } from "@react-three/fiber";
import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
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
        <Styled.HeaderText>(faiz)aan sakib</Styled.HeaderText>
        <AnimatedSubtitle bottom="52" left="2" width="20" frequencyType="low">
          senior
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="42" left="2" width="20" frequencyType="low">
          software
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="32" left="2" width="20" frequencyType="mid">
          engineer
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="22" left="2" frequencyType="mid">
          fullstack
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="12" left="2" frequencyType="high">
          london
        </AnimatedSubtitle>
        <AnimatedSubtitle bottom="2" left="2" frequencyType="high">
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

        {/* Music visualization elements */}
        {/* <AnimatedElement
          position={{ bottom: "50", left: "80" }}
          frequencyType="low"
        />
        <AnimatedElement
          position={{ bottom: "45", left: "85" }}
          frequencyType="mid"
        />
        <AnimatedElement
          position={{ bottom: "30", left: "90" }}
          frequencyType="high"
        /> */}

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
