import { ThemeProvider } from "styled-components";

import * as Styled from "./App.styled";
import Background from "./components/Background";
import { theme } from "./styles/theme";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Background />
      <Styled.AppContainer></Styled.AppContainer>
    </ThemeProvider>
  );
}

export default App;
