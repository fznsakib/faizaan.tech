import styled, { css } from "styled-components";

import type { SkinId } from "./skins";

/*
 * Three skins over one layout. Each skin is a set of custom properties on the Shell (colours, bevels, fonts), plus
 * a few per-skin rules below keyed on `[data-skin]`. Everything is CSS/SVG/canvas: an homage, no skin bitmaps.
 */

const COPPER = "#e8873a";
const DOT_BLUE = "#8AB1EE";

const TOKENS: Record<SkinId, Record<string, string>> = {
  // Winamp 2.x: gunmetal chrome, black LCD with green segments, small beveled grey buttons.
  base: {
    "win-bg": "linear-gradient(180deg, #3a3b4f 0%, #2b2c3c 38%, #232431 100%)",
    "win-light": "#6d6f88",
    "win-dark": "#0d0d14",
    "win-edge": "#07070b",
    "win-radius": "0px",
    "win-shadow": "0 10px 28px rgba(0, 0, 0, 0.45)",
    "title-bg": "linear-gradient(180deg, #2c2d3d, #1d1e29)",
    "title-fg": "#d8cfa6",
    "title-ridge": "#c8b66e",
    "title-font": "'Silkscreen', 'Courier New', monospace",
    "title-size": "8px",
    "lcd-bg": "#000000",
    "lcd-fg": "#2cf22c",
    "lcd-ghost": "#0b2a0e",
    "lcd-dim": "#1b6a1f",
    "lcd-glow": "none",
    "lcd-light": "#4a4b60",
    "lcd-dark": "#0a0a10",
    "lcd-radius": "0px",
    "lcd-font": "'Silkscreen', 'Courier New', monospace",
    "lcd-size": "8px",
    "btn-bg": "linear-gradient(180deg, #d9d9e2 0%, #b7b7c3 55%, #a3a3b0 100%)",
    "btn-down": "linear-gradient(180deg, #8d8d9b, #a9a9b6)",
    "btn-fg": "#1c1c28",
    "btn-light": "#f4f4fa",
    "btn-dark": "#4b4b5b",
    "btn-radius": "0px",
    "btn-font": "'Silkscreen', 'Courier New', monospace",
    "btn-size": "8px",
    "play-bg": "var(--btn-bg)",
    "play-fg": "var(--btn-fg)",
    "lamp-on": "#39ff39",
    "lamp-off": "#113a14",
    "groove-bg": "#101119",
    "groove-light": "#50526a",
    "groove-dark": "#050508",
    "thumb-bg": "linear-gradient(180deg, #ece2b6, #bfae72)",
    "thumb-light": "#fff7d6",
    "thumb-dark": "#6e6030",
    "thumb-w": "26px",
    "vol-thumb-w": "14px",
    "thumb-h": "10px",
    "thumb-radius": "0px",
    "pl-bg": "#000000",
    "pl-fg": "#2cf22c",
    "pl-dim": "#1fa51f",
    "pl-current": "#ffffff",
    "pl-cursor-bg": "#0a1ac2",
    "pl-stripe": "transparent",
    "pl-font": "Arial, Helvetica, sans-serif",
    "pl-size": "11px",
    focus: "#f3e27a",
  },
  // Y2K brushed silver and aqua (Winamp 3 / WMP 9 / iTunes Aqua): glossy pills, an ice-blue LCD, cyan bars.
  chrome: {
    "win-bg":
      "repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0 1px, rgba(0, 0, 0, 0.025) 1px 3px), linear-gradient(180deg, #f6f8fa 0%, #d7dce2 46%, #c3c9d1 54%, #e2e6eb 100%)",
    "win-light": "#ffffff",
    "win-dark": "#8b949f",
    "win-edge": "#5d6773",
    "win-radius": "12px",
    "win-shadow": "0 14px 32px rgba(0, 12, 30, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
    "title-bg": "linear-gradient(180deg, #fbfcfd 0%, #dfe4ea 50%, #cdd3db 51%, #e6eaee 100%)",
    "title-fg": "#26323f",
    "title-ridge": "rgba(38, 50, 63, 0.18)",
    "title-font": "Tahoma, Verdana, 'Segoe UI', sans-serif",
    "title-size": "10.5px",
    "lcd-bg": "linear-gradient(180deg, #eef9ff 0%, #cfeaf8 55%, #b6dcef 100%)",
    "lcd-fg": "#0e2a44",
    "lcd-ghost": "rgba(14, 42, 68, 0.07)",
    "lcd-dim": "rgba(14, 42, 68, 0.38)",
    "lcd-glow": "none",
    "lcd-light": "#ffffff",
    "lcd-dark": "#6f93ab",
    "lcd-radius": "7px",
    "lcd-font": "Tahoma, Verdana, 'Segoe UI', sans-serif",
    "lcd-size": "10.5px",
    "btn-bg": "linear-gradient(180deg, #ffffff 0%, #e9edf1 48%, #cfd5dc 52%, #eef1f4 100%)",
    "btn-down": "linear-gradient(180deg, #c3cbd4 0%, #d9dee4 100%)",
    "btn-fg": "#2a3746",
    "btn-light": "#ffffff",
    "btn-dark": "#8a939e",
    "btn-radius": "999px",
    "btn-font": "Tahoma, Verdana, 'Segoe UI', sans-serif",
    "btn-size": "9.5px",
    "play-bg": "linear-gradient(180deg, #b9e6ff 0%, #52b6f5 48%, #1c8fe3 52%, #5fc3ff 100%)",
    "play-fg": "#ffffff",
    "lamp-on": "#29d8ff",
    "lamp-off": "#a9b3be",
    "groove-bg": "linear-gradient(180deg, #8f9aa6, #c5ccd4)",
    "groove-light": "#ffffff",
    "groove-dark": "#76818d",
    "thumb-bg": "radial-gradient(circle at 50% 30%, #ffffff 0%, #bfe7ff 35%, #3aa6ee 70%, #1b7fd0 100%)",
    "thumb-light": "#e8f6ff",
    "thumb-dark": "#1566a8",
    "thumb-w": "14px",
    "vol-thumb-w": "14px",
    "thumb-h": "14px",
    "thumb-radius": "50%",
    "pl-bg": "#fbfcfe",
    "pl-fg": "#1d2733",
    "pl-dim": "#6b7785",
    "pl-current": "#0b5fbf",
    "pl-cursor-bg": "linear-gradient(180deg, #6db8f7, #2d86dc)",
    "pl-stripe": "#edf3fa",
    "pl-font": "Tahoma, Verdana, 'Segoe UI', sans-serif",
    "pl-size": "11px",
    focus: "#2d86dc",
  },
  // The site's own: deep green, a Doto dot-matrix LCD in the grid's blue, copper like the head, pixel bevels.
  faizaan: {
    "win-bg": "rgb(22, 66, 54)",
    "win-light": "#3d8a70",
    "win-dark": "#0a241c",
    "win-edge": "#051410",
    "win-radius": "0px",
    "win-shadow": "6px 6px 0 rgba(3, 14, 11, 0.55)",
    "title-bg": "#0f3027",
    "title-fg": DOT_BLUE,
    "title-ridge": "rgba(138, 177, 238, 0.35)",
    "title-font": "'Doto', monospace",
    "title-size": "12px",
    "lcd-bg": "#05130f",
    "lcd-fg": DOT_BLUE,
    "lcd-ghost": "rgba(138, 177, 238, 0.1)",
    "lcd-dim": "rgba(138, 177, 238, 0.42)",
    "lcd-glow": "0 0 6px rgba(138, 177, 238, 0.55)",
    "lcd-light": "#2b6653",
    "lcd-dark": "#020a08",
    "lcd-radius": "0px",
    "lcd-font": "'Doto', monospace",
    "lcd-size": "12px",
    "btn-bg": "#1e5445",
    "btn-down": "#123a30",
    "btn-fg": "#e5eefb",
    "btn-light": "#4b9c80",
    "btn-dark": "#08201a",
    "btn-radius": "0px",
    "btn-font": "'Doto', monospace",
    "btn-size": "12px",
    "play-bg": COPPER,
    "play-fg": "#2a1204",
    "lamp-on": COPPER,
    "lamp-off": "#0b2a22",
    "groove-bg": "#06170f",
    "groove-light": "#2e7560",
    "groove-dark": "#020a07",
    "thumb-bg": COPPER,
    "thumb-light": "#ffc189",
    "thumb-dark": "#8a4212",
    "thumb-w": "12px",
    "vol-thumb-w": "12px",
    "thumb-h": "12px",
    "thumb-radius": "0px",
    "pl-bg": "#05130f",
    "pl-fg": "#c9d9f2",
    "pl-dim": "rgba(138, 177, 238, 0.6)",
    "pl-current": COPPER,
    "pl-cursor-bg": "rgba(138, 177, 238, 0.16)",
    "pl-stripe": "transparent",
    "pl-font": "'Golos Text', sans-serif",
    "pl-size": "12px",
    focus: COPPER,
  },
};

const tokens = (skin: SkinId) =>
  Object.entries(TOKENS[skin])
    .map(([name, value]) => `--${name}: ${value};`)
    .join("\n");

/** A 3D edge: light on the top/left, dark on the bottom/right (or the reverse when sunk). */
const bevel = (light: string, dark: string, width = 1, sunk = false) => css`
  border: ${width}px solid;
  border-color: ${sunk ? `${dark} ${light} ${light} ${dark}` : `${light} ${dark} ${dark} ${light}`};
`;

/** global.ts turns every hovered button's border blue: keep a bevel's own colours under the pointer. */
const holdBevel = (light: string, dark: string, sunk = false) => css`
  &:hover {
    border-color: ${sunk ? `${dark} ${light} ${light} ${dark}` : `${light} ${dark} ${dark} ${light}`};
  }
`;

const focusRing = css`
  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
`;

const DRAWER = '[data-layout="drawer"]';

/* ---------- placement ---------- */

/** Desktop: bottom-right above the link dock. Mobile: a drawer at the right edge, mid-height, with a tab. */
export const Shell = styled.section`
  ${tokens("base")}

  &[data-skin="chrome"] {
    ${tokens("chrome")}
  }

  &[data-skin="faizaan"] {
    ${tokens("faizaan")}
  }

  position: fixed;
  z-index: 20;
  color: var(--btn-fg);
  -webkit-tap-highlight-color: transparent;

  &[data-layout="dock"] {
    right: max(16px, env(safe-area-inset-right));
    bottom: calc(max(16px, env(safe-area-inset-bottom)) + 60px);
  }

  &${DRAWER} {
    top: 50%;
    right: 0;
    display: flex;
    align-items: center;
    transform: translate(var(--drawer-shift, 0px), -50%);

    &:not([data-open]) {
      --drawer-shift: var(--drawer-width);
    }

    @media (prefers-reduced-motion: no-preference) {
      transition: transform 320ms cubic-bezier(0.2, 0.85, 0.25, 1);
    }
  }
`;

/** The mobile handle: always visible at the right edge; carries the drawer out and back. */
export const Tab = styled.button`
  all: unset;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 44px;
  height: 116px;
  padding: 10px 0;
  margin-right: -2px;
  cursor: pointer;
  touch-action: manipulation;
  background: var(--win-bg);
  ${bevel("var(--win-light)", "var(--win-dark)", 2)}
  ${holdBevel("var(--win-light)", "var(--win-dark)")}
  border-right: 0;
  box-shadow: -4px 4px 14px rgba(0, 0, 0, 0.35);
  color: var(--title-fg);
  font-family: var(--title-font);
  font-size: calc(var(--title-size) + 3px);
  font-weight: 700;
  letter-spacing: 0.1em;

  [data-skin="chrome"] & {
    border-radius: 12px 0 0 12px;
  }

  [data-skin="base"] & {
    text-transform: uppercase;
  }

  svg {
    width: 16px;
    height: auto;
    fill: currentColor;
  }

  ${focusRing}
`;

export const TabLabel = styled.span`
  writing-mode: vertical-rl;
`;

/** The windows, stacked like Winamp's: main above the playlist. */
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  width: 318px;

  ${DRAWER} & {
    width: var(--drawer-width);
    max-height: calc(100dvh - 32px);
  }
`;

/* ---------- windows ---------- */

const windowChrome = css`
  position: relative;
  background: var(--win-bg);
  ${bevel("var(--win-light)", "var(--win-dark)", 2)}
  outline: 1px solid var(--win-edge);
  border-radius: var(--win-radius);
  box-shadow: var(--win-shadow);

  [data-skin="chrome"] & {
    outline: none;
    border: 1px solid var(--win-edge);
  }
`;

export const Window = styled.div`
  ${windowChrome}
  z-index: 1;
`;

export const PlaylistWindow = styled.div`
  ${windowChrome}
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-top: 2px;

  [data-skin="chrome"] & {
    margin-top: 6px;
  }
`;

export const TitleBar = styled.div<{ $small?: boolean }>`
  display: flex;
  align-items: center;
  gap: 5px;
  height: ${({ $small }) => ($small ? 15 : 18)}px;
  padding: 0 3px 0 5px;
  background: var(--title-bg);
  color: var(--title-fg);
  font-family: var(--title-font);
  font-size: var(--title-size);
  line-height: 1;
  white-space: nowrap;
  user-select: none;

  [data-skin="base"] & {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  [data-skin="chrome"] & {
    border-radius: 11px 11px 0 0;
    border-bottom: 1px solid rgba(93, 103, 115, 0.45);
    font-weight: 700;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.85);
  }

  [data-skin="faizaan"] & {
    font-weight: 800;
    border-bottom: 2px solid ${COPPER};
  }

  ${DRAWER} & {
    height: ${({ $small }) => ($small ? 22 : 44)}px;
    font-size: calc(var(--title-size) + 2px);
  }
`;

export const Mark = styled.span`
  display: inline-flex;
  color: var(--title-ridge);

  svg {
    width: 10px;
    height: 8px;
    fill: currentColor;
  }

  [data-skin="base"] & {
    color: var(--title-fg);
  }

  [data-skin="faizaan"] & {
    color: ${COPPER};
  }

  [data-skin="chrome"] & {
    color: #1f8fe3;
  }
`;

/** The title bar's grooves either side of the title. */
export const Ridges = styled.span`
  flex: 1;
  height: 7px;
  min-width: 8px;
  background: repeating-linear-gradient(180deg, var(--title-ridge) 0 1px, transparent 1px 3px);

  [data-skin="chrome"] & {
    height: 5px;
    background: repeating-linear-gradient(
      180deg,
      var(--title-ridge) 0 1px,
      rgba(255, 255, 255, 0.9) 1px 2px,
      transparent 2px 3px
    );
  }

  [data-skin="faizaan"] & {
    height: 4px;
    background: radial-gradient(circle, var(--title-ridge) 0.9px, transparent 1.2px) 0 0 / 4px 4px;
  }
`;

export const Title = styled.span`
  flex: none;
`;

export const TitleButton = styled.button`
  all: unset;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 13px;
  cursor: pointer;
  color: var(--btn-fg);
  background: var(--btn-bg);
  ${bevel("var(--btn-light)", "var(--btn-dark)")}
  ${holdBevel("var(--btn-light)", "var(--btn-dark)")}
  border-radius: var(--btn-radius);

  svg {
    width: 8px;
    height: 7px;
    fill: currentColor;
  }

  &:active {
    background: var(--btn-down);
    ${bevel("var(--btn-light)", "var(--btn-dark)", 1, true)}
  }

  [data-skin="chrome"] &,
  [data-skin="chrome"] &:hover {
    width: 15px;
    height: 15px;
    border: 1px solid var(--btn-dark);
  }

  [data-skin="faizaan"] &,
  [data-skin="faizaan"] &:hover {
    color: var(--title-fg);
    background: transparent;
    border: 1px solid rgba(138, 177, 238, 0.4);
  }

  ${DRAWER} & {
    width: 44px;
    height: 36px;

    svg {
      width: 12px;
      height: 10px;
    }
  }

  ${focusRing}
`;

/* ---------- main window body ---------- */

export const Body = styled.div`
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 7px 8px;
  padding: 7px 8px 8px;

  ${DRAWER} & {
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 10px;
    padding: 10px;
  }
`;

const sunkPanel = css`
  ${bevel("var(--lcd-light)", "var(--lcd-dark)", 2, true)}
  border-radius: var(--lcd-radius);

  [data-skin="chrome"] & {
    border: 1px solid #6f93ab;
    box-shadow:
      inset 0 2px 4px rgba(0, 30, 60, 0.28),
      0 1px 0 rgba(255, 255, 255, 0.8);
  }
`;

export const ArtFrame = styled.div`
  position: relative;
  width: 78px;
  height: 78px;
  overflow: hidden;
  background: var(--lcd-bg);
  ${sunkPanel}

  ${DRAWER} & {
    width: 96px;
    height: 96px;
  }
`;

export const Art = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  -webkit-user-drag: none;

  [data-skin="faizaan"] & {
    filter: saturate(0.9) contrast(1.05);
  }
`;

/** Shown when a cover is missing or fails to load: the title's initials on the LCD. */
export const ArtPlaceholder = styled.div`
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: var(--lcd-bg);
  color: var(--lcd-fg);
  font-family: var(--lcd-font);
  font-size: 26px;
  font-weight: 700;
  text-shadow: var(--lcd-glow);
`;

export const Lcd = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding: 5px 7px 6px;
  background: var(--lcd-bg);
  color: var(--lcd-fg);
  font-family: var(--lcd-font);
  font-size: var(--lcd-size);
  line-height: 1;
  ${sunkPanel}

  [data-skin="base"] & {
    text-transform: uppercase;
  }

  [data-skin="faizaan"] & {
    font-weight: 700;
  }
`;

export const LcdTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
`;

export const StateGlyph = styled.span`
  display: inline-flex;
  padding-top: 2px;
  color: var(--lcd-fg);

  &[data-state="play"] svg:not(:nth-child(1)),
  &[data-state="pause"] svg:not(:nth-child(2)),
  &[data-state="stop"] svg:not(:nth-child(3)) {
    display: none;
  }

  svg {
    width: 9px;
    height: 8px;
    fill: currentColor;
  }

  [data-skin="faizaan"] & {
    color: ${COPPER};
  }
`;

export const Clock = styled.button`
  all: unset;
  cursor: pointer;
  display: inline-flex;
  color: var(--lcd-fg);

  ${focusRing}
`;

export const ClockFace = styled.span`
  display: inline-flex;
  align-items: stretch;
  gap: 2px;
`;

/** Segment lit patterns: data-d on a digit lights its segments. */
const LIT: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
};

const litRules = Object.entries(LIT)
  .map(
    ([digit, segments]) =>
      `&[data-d="${digit}"] :is(${segments
        .split("")
        .map((s) => `[data-s="${s}"]`)
        .join(", ")}) { fill: var(--lcd-fg); }`
  )
  .join("\n");

export const Digit = styled.svg<{ $sign?: boolean }>`
  display: block;
  width: ${({ $sign }) => ($sign ? 9 : 15)}px;
  height: 24px;
  fill: var(--lcd-ghost);
  transform: skewX(-5deg);
  ${litRules}

  ${DRAWER} & {
    width: ${({ $sign }) => ($sign ? 10 : 15)}px;
    height: 26px;
  }
`;

export const Colon = styled.svg`
  display: block;
  width: 4px;
  height: 24px;
  fill: var(--lcd-fg);

  ${DRAWER} & {
    height: 26px;
  }
`;

/** Doto's own colon reads as a dagger at this weight: two dots instead. */
export const DotColon = styled.span`
  display: inline-block;
  width: 4px;
  height: 14px;
  margin: 0 3px;
  background: radial-gradient(circle, currentColor 1.8px, transparent 2.2px) 0 0 / 4px 7px repeat-y;
  filter: drop-shadow(0 0 3px rgba(138, 177, 238, 0.6));
`;

export const ClockText = styled.span`
  display: inline-flex;
  align-items: center;
  font-family: "Doto", monospace;
  font-size: 30px;
  font-weight: 900;
  line-height: 22px;
  letter-spacing: -0.02em;
  text-shadow: var(--lcd-glow);
  font-variation-settings: "ROND" 100;

  ${DRAWER} & {
    font-size: 34px;
    line-height: 26px;
  }
`;

/** bpm / kHz / mono stereo, Winamp's info line: lit when known and true, ghosted otherwise. */
export const Readouts = styled.div`
  display: flex;
  align-items: baseline;
  gap: 3px;
  font-size: var(--lcd-size);
  line-height: 1;
  white-space: nowrap;

  ${DRAWER} & {
    font-size: calc(var(--lcd-size) + 1px);
  }
`;

export const Readout = styled.span<{ $on?: boolean; $push?: boolean }>`
  color: ${({ $on }) => ($on ? "var(--lcd-fg)" : "var(--lcd-ghost)")};
  margin-left: ${({ $push }) => ($push ? "auto" : "0")};

  [data-skin="faizaan"] & {
    text-shadow: ${({ $on }) => ($on ? "var(--lcd-glow)" : "none")};
  }
`;

export const ReadoutUnit = styled.span`
  margin-right: 5px;
  color: var(--lcd-dim);
`;

export const Marquee = styled.div<{ $mini?: boolean }>`
  position: relative;
  overflow: hidden;
  height: ${({ $mini }) => ($mini ? 9 : 11)}px;
  font-family: var(--lcd-font);
  font-size: var(--lcd-size);
  line-height: ${({ $mini }) => ($mini ? 9 : 11)}px;
  color: var(--lcd-fg);
  white-space: pre;
  text-shadow: var(--lcd-glow);

  [data-skin="base"] & {
    text-transform: uppercase;
  }

  [data-skin="chrome"] & {
    height: ${({ $mini }) => ($mini ? 12 : 13)}px;
    line-height: ${({ $mini }) => ($mini ? 12 : 13)}px;
  }

  [data-skin="faizaan"] & {
    height: 14px;
    line-height: 14px;
    font-weight: 700;
  }

  ${DRAWER} & {
    height: 16px;
    line-height: 16px;
    font-size: calc(var(--lcd-size) + 2px);
  }

  ${({ $mini }) =>
    $mini &&
    css`
      flex: 1;
      min-width: 0;
      padding: 0 3px;
      background: var(--lcd-bg);
      ${bevel("var(--lcd-dark)", "var(--lcd-light)")}
    `}
`;

export const MarqueeStrip = styled.span`
  display: inline-block;
  will-change: transform;

  & > span {
    display: inline-block;
  }
`;

export const MarqueeNote = styled.span`
  position: absolute;
  inset: 0;
  opacity: 0;
`;

/* ---------- visualiser ---------- */

export const Vis = styled.button`
  all: unset;
  box-sizing: border-box;
  grid-column: 1 / -1;
  display: grid;
  place-items: center;
  padding: 3px 0;
  cursor: pointer;
  background: var(--lcd-bg);
  ${sunkPanel}
  ${holdBevel("var(--lcd-light)", "var(--lcd-dark)", true)}

  [data-skin="chrome"] &,
  [data-skin="chrome"] &:hover {
    background: linear-gradient(180deg, #0d3a5c, #041726);
    border-color: #2b4d66;
  }

  canvas {
    display: block;
  }

  ${focusRing}
`;

export const MiniVis = styled.span`
  display: inline-flex;
  flex: none;
  padding: 1px;
  background: var(--lcd-bg);
  ${bevel("var(--lcd-dark)", "var(--lcd-light)")}

  canvas {
    display: block;
  }
`;

/* ---------- sliders ---------- */

const range = css`
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  margin: 0;
  cursor: pointer;
  touch-action: none;

  &:disabled {
    cursor: default;
    opacity: 0.55;
  }

  &::-webkit-slider-runnable-track {
    height: 8px;
    background: var(--groove-bg);
    ${bevel("var(--groove-dark)", "var(--groove-light)")}
    border-radius: var(--thumb-radius);
  }

  &::-moz-range-track {
    height: 6px;
    background: var(--groove-bg);
    ${bevel("var(--groove-dark)", "var(--groove-light)")}
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: var(--thumb-w);
    height: var(--thumb-h);
    margin-top: calc((6px - var(--thumb-h)) / 2);
    background: var(--thumb-bg);
    ${bevel("var(--thumb-light)", "var(--thumb-dark)")}
    border-radius: var(--thumb-radius);
  }

  &::-moz-range-thumb {
    width: var(--thumb-w);
    height: var(--thumb-h);
    background: var(--thumb-bg);
    ${bevel("var(--thumb-light)", "var(--thumb-dark)")}
    border-radius: var(--thumb-radius);
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  ${DRAWER} & {
    height: 44px;
  }
`;

export const Seek = styled.input`
  ${range}
  grid-column: 1 / -1;
  width: 100%;
  height: 14px;
`;

export const Volume = styled.input<{ $level: number }>`
  ${range}
  --thumb-w: var(--vol-thumb-w);
  flex: 1;
  min-width: 0;
  height: 20px;

  /* base: Winamp's volume bar runs green to red with the level */
  [data-skin="base"] &::-webkit-slider-runnable-track {
    background: hsl(${({ $level }) => Math.round(120 - $level * 120)}, 72%, 36%);
  }

  [data-skin="base"] &::-moz-range-track {
    background: hsl(${({ $level }) => Math.round(120 - $level * 120)}, 72%, 36%);
  }
`;

/* ---------- buttons ---------- */

export const Controls = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 6px;

  ${DRAWER} & {
    flex-wrap: wrap;
    gap: 8px;
  }
`;

export const Group = styled.div`
  display: flex;
  gap: 1px;

  ${DRAWER} & {
    gap: 6px;
  }

  ${DRAWER} &:first-child {
    flex: 1 0 100%;

    & > * {
      flex: 1;
    }
  }
`;

export const Button = styled.button<{ $play?: boolean }>`
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 20px;
  min-width: 22px;
  padding: 0 3px;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  color: ${({ $play }) => ($play ? "var(--play-fg)" : "var(--btn-fg)")};
  background: ${({ $play }) => ($play ? "var(--play-bg)" : "var(--btn-bg)")};
  ${bevel("var(--btn-light)", "var(--btn-dark)")}
  ${holdBevel("var(--btn-light)", "var(--btn-dark)")}
  border-radius: var(--btn-radius);
  font-family: var(--btn-font);
  font-size: var(--btn-size);
  line-height: 1;

  svg {
    width: 10px;
    height: 8px;
    fill: currentColor;
  }

  &:active,
  &[aria-pressed="true"]:active {
    background: var(--btn-down);
    ${bevel("var(--btn-light)", "var(--btn-dark)", 1, true)}
  }

  [data-skin="base"] & {
    text-transform: uppercase;
  }

  [data-skin="chrome"] &,
  [data-skin="chrome"] &:hover {
    border: 1px solid var(--btn-dark);
    box-shadow:
      0 1px 1px rgba(0, 20, 40, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    font-weight: 700;
    min-width: 24px;
  }

  [data-skin="faizaan"] & {
    ${bevel("var(--btn-light)", "var(--btn-dark)", 2)}
    font-weight: 800;
  }

  ${DRAWER} & {
    height: 44px;
    min-width: 44px;
    padding: 0 10px;
    gap: 6px;
    font-size: calc(var(--btn-size) + 3px);

    svg {
      width: 15px;
      height: 12px;
    }
  }

  ${focusRing}
`;

/** Winamp's EQ/PL-style indicator light on a toggle button. */
export const Lamp = styled.span<{ $on: boolean }>`
  width: 4px;
  height: 4px;
  flex: none;
  background: ${({ $on }) => ($on ? "var(--lamp-on)" : "var(--lamp-off)")};
  box-shadow: ${({ $on }) => ($on ? "0 0 4px var(--lamp-on)" : "none")};

  [data-skin="chrome"] & {
    border-radius: 50%;
    width: 5px;
    height: 5px;
  }

  ${DRAWER} & {
    width: 6px;
    height: 6px;
  }
`;

/* ---------- playlist ---------- */

export const List = styled.ul`
  position: relative;
  margin: 3px;
  padding: 2px 0;
  list-style: none;
  height: 99px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--pl-bg);
  color: var(--pl-fg);
  font-family: var(--pl-font);
  font-size: var(--pl-size);
  line-height: 16px;
  ${sunkPanel}
  scrollbar-width: thin;
  scrollbar-color: var(--pl-dim) var(--pl-bg);

  [data-skin="chrome"] & {
    border-radius: 0 0 9px 9px;
    margin: 0 4px 5px;
  }

  ${DRAWER} & {
    height: auto;
    max-height: min(260px, 30dvh);
    line-height: 40px;
    font-size: 13px;
  }

  ${focusRing}
  &:focus-visible {
    outline-offset: -2px;
  }
`;

export const Row = styled.li<{ $cursor: boolean }>`
  display: flex;
  gap: 8px;
  padding: 0 5px;
  cursor: pointer;
  user-select: none;

  &:nth-child(even) {
    background: var(--pl-stripe);
  }

  &[aria-selected="true"] {
    color: var(--pl-current);
    font-weight: 700;
  }

  ${({ $cursor }) =>
    $cursor &&
    css`
      ${List}:focus-visible & {
        background: var(--pl-cursor-bg);
        outline: 1px dotted var(--pl-fg);
        outline-offset: -1px;
      }

      [data-skin="chrome"] ${List}:focus-visible & {
        color: #ffffff;
      }
    `}

  &:hover {
    background: var(--pl-cursor-bg);
  }

  [data-skin="chrome"] &:hover {
    color: #ffffff;
  }
`;

export const RowText = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const RowTime = styled.span`
  flex: none;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
`;

/* ---------- misc ---------- */

/** Announces the track to screen readers (the marquee is decorative). */
export const VisuallyHidden = styled.p`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
`;

/** The jam pad keeps the top-right spot it had in the old transport row. */
export const PadDock = styled.div`
  position: fixed;
  top: 0.75rem;
  right: 1rem;
  z-index: 20;
`;
