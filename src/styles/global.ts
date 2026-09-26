import { createGlobalStyle } from "styled-components";

import { colors } from "./colors";

/** One palette whatever the visitor's colour scheme or a host page's styles (e.g. an embedding viewer's body colour). */
export const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :root {
    font-family: 'Golos Text', Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    font-weight: 400;

    color-scheme: dark;
    color: ${colors.site.text};
    background-color: ${colors.site.background};

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  html, body, #root {
    width: 100%;
    height: 100%;
  }

  body {
    margin: 0;
    display: flex;
    min-width: 320px;
    min-height: 100vh;
    color: ${colors.site.text};
    background-color: ${colors.site.background};
  }

  #root {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    color: ${colors.site.text};
  }

  a {
    font-weight: 500;
    color: inherit;
    text-decoration: inherit;
  }

  h1 {
    font-size: 3.2em;
    line-height: 1.1;
  }

  button {
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 0.6em 1.2em;
    font-size: 1em;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;

    &:focus,
    &:focus-visible {
      outline: 4px auto -webkit-focus-ring-color;
    }
  }
`;
