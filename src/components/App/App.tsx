import { useState } from "react";

import viteLogo from "/vite.svg";

import * as Styled from "./App.styled";
import reactLogo from "../../assets/react.svg";

function App() {
  const [count, setCount] = useState(0);

  return (
    <Styled.AppContainer>
      <Styled.LogoContainer>
        <a href="https://vite.dev" target="_blank">
          <Styled.Logo src={viteLogo} alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <Styled.ReactLogo src={reactLogo} alt="React logo" />
        </a>
      </Styled.LogoContainer>
      <Styled.Title>Vite + React</Styled.Title>
      <Styled.Card>
        <Styled.Button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </Styled.Button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </Styled.Card>
      <Styled.ReadTheDocs>
        Click on the Vite and React logos to learn more
      </Styled.ReadTheDocs>
    </Styled.AppContainer>
  );
}

export default App;
