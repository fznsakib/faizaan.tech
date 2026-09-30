import { createGlobalStyle } from "styled-components";

import { colors } from "./colors";

/**
 * One palette whatever the visitor's colour scheme or a host page's styles (e.g. an embedding viewer's body colour).
 * The ground follows the visitor's time of day (`--day-ground`, written by `startDaylight`); text stays white.
 */
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
    background-color: var(--day-ground, ${colors.site.background});

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
    min-height: 100dvh; /* iOS: 100vh is the viewport without its toolbars, so the page would scroll */
    color: ${colors.site.text};
    background-color: var(--day-ground, ${colors.site.background});
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
