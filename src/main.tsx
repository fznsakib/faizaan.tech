import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { engine } from "./audio/engine";
import { startMusicTicker } from "./audio/ticker";
import { GlobalStyle } from "./styles/global";

// Before React renders, so the ticker's rAF callback precedes r3f's every frame.
startMusicTicker(engine);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalStyle />
    <App />
  </StrictMode>
);
