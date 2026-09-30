import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { engine } from "./audio/engine";
import { startMusicTicker } from "./audio/ticker";
import { startDaylight } from "./hooks/useDaylight";
import { GlobalStyle } from "./styles/global";

// Before React renders, so the ticker's rAF callback precedes r3f's every frame.
startMusicTicker(engine);
// Before the first paint, so the page opens in the visitor's time of day, not midday.
startDaylight();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalStyle />
    <App />
  </StrictMode>
);
