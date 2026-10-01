/**
 * Daylight: the page lit by the visitor's clock. Maps local time to the head's lights and environment and the
 * page's colours: cold blue-white at dawn, neutral at midday (exactly today's scene), hot orange-copper at golden
 * hour, deep violet with a cool rim at night. Purely visual: nothing here reads the music.
 *
 * Colours are `#rrggbb` (sRGB), interpolated between keyframes in OKLab with a smoothstep per segment, so the day
 * has no visible steps and the look dwells a little at each keyframe. It wraps across midnight.
 */

export type Vec3 = [number, number, number];

export interface Lamp {
  color: string;
  intensity: number;
}

/** Page colour tokens, written to `:root` as `--day-*` custom properties (see `paletteVars`). */
export interface Palette {
  /** The page background: a small hue/lightness shift around the site's `rgb(20, 61, 50)`. */
  ground: string;
  /** The grid's big plusses. */
  gridBig: string;
  /** The grid's mini plusses (drawn at half opacity). */
  gridMini: string;
  /** The glass's body and bevel. */
  glassTint: string;
  /** The light's own colour, for highlights: the glass's lit edge and sheen. */
  accent: string;
}

export interface Daylight {
  /** Local time as a fractional hour, 0 ≤ hour < 24. */
  hour: number;
  /** Radians. Azimuth turns about +y from the viewer (+z) toward screen right (+x); elevation is above the horizon. */
  sun: { azimuth: number; elevation: number };
  /** The main light: follows the sun across the sky, never from below the horizon, and goes out at night. */
  key: Lamp & { position: Vec3 };
  /** Low bounce light from behind-left. */
  fill: Lamp & { position: Vec3 };
  /** The back light's colour and base strength (the head adds its snare flash on top). */
  rim: Lamp;
  ambient: Lamp;
  /**
   * The head's Lightformers: the top softbox takes the sky, the side panels warm or cool, the floor ring reflects
   * the page's ground. `rotation` turns the whole environment about +y with the sun, so reflections move with it.
   */
  env: { rotation: number; sky: Lamp; cool: Lamp; warm: Lamp; ground: Lamp };
  palette: Palette;
}

export const SUNRISE = 6.5;
export const NOON = 13;
export const SUNSET = 19.5;

/** The key light's noon position is today's [10, 10, 10]: the radius of the sun's arc and the height of its peak. */
const KEY_DISTANCE = 10 * Math.sqrt(3);
const PEAK_ELEVATION = Math.asin(1 / Math.sqrt(3));
const NOON_AZIMUTH = Math.PI / 4;
/** How far the sun swings either side of its noon azimuth by sunrise and sunset: front-left at dawn, back-right at dusk. */
const HALF_SWING = Math.PI / 2;
/** How far below the horizon the sun sinks at its lowest, halfway through the night. */
const NIGHT_DEPTH = PEAK_ELEVATION;
const FILL_POSITION: Vec3 = [-5, -5, -5];
/** The floor ring's strength: its colour is the page's ground, its intensity today's. */
const GROUND_GLOW = 1.5;

/** How much of the chrome head's light a head variant takes: the photo-skin head is lit more gently. */
export const VARIANT_GAIN = {
  chrome: { key: 1, fill: 1, ambient: 1, rim: 1, env: 1 },
  skin: { key: 0.7, fill: 0.5, ambient: 2.2, rim: 0.6, env: 0.9 },
} as const;

export type DaylightVariant = keyof typeof VARIANT_GAIN;

/** A full sweep of `?daycycle`, seconds. */
export const CYCLE_SECONDS = 60;

const LAMPS = ["key", "fill", "rim", "ambient", "sky", "cool", "warm"] as const;
const TOKENS = ["ground", "gridBig", "gridMini", "glassTint", "accent"] as const;
type LampName = (typeof LAMPS)[number];
type TokenName = (typeof TOKENS)[number];
type Keyframe = { hour: number } & Record<LampName, [color: string, intensity: number]> & Record<TokenName, string>;

/* prettier-ignore */
const KEYFRAMES: Keyframe[] = [
  { // 02:00 deep night: the sun long gone, a dark indigo sky, the cold rim the brightest thing on the head
    hour: 2,
    key: ["#718ecd", 0], fill: ["#4c67a3", 2], rim: ["#359bd9", 8], ambient: ["#425b96", 0.35],
    sky: ["#2c4188", 0.7], cool: ["#244d9e", 1.6], warm: ["#333a7c", 1],
    ground: "#00262a", gridBig: "#3b4253", gridMini: "#5171bb", glassTint: "#99b2de", accent: "#8cbaf7",
  },
  { // 05:00 pre-dawn: the sky greying to a cold blue before the sun
    hour: 5,
    key: ["#b1d2f4", 0], fill: ["#7da1d0", 2.5], rim: ["#9cbff8", 6], ambient: ["#81a1ca", 0.3],
    sky: ["#5c80bc", 2], cool: ["#5a84d4", 3.4], warm: ["#5682bb", 1.5],
    ground: "#032e32", gridBig: "#414f5d", gridMini: "#73a1dc", glassTint: "#c2daf9", accent: "#acd2fb",
  },
  { // 06:30 dawn: the sun on the horizon at front-left, cold blue-white
    hour: SUNRISE,
    key: ["#c3e2fe", 30], fill: ["#b7d2e6", 4], rim: ["#c7eaff", 5], ambient: ["#cde1f0", 0.3],
    sky: ["#bddcf7", 5], cool: ["#abd7fd", 7], warm: ["#c1e3fc", 4.5],
    ground: "#093838", gridBig: "#4c5a65", gridMini: "#9ecaef", glassTint: "#ddf2ff", accent: "#d3ebff",
  },
  { // 09:00 morning: a warm-white sun climbing from the left under a pale blue sky
    hour: 9,
    key: ["#fef5db", 17], fill: ["#e1f2f8", 5], rim: ["#b4e7fc", 1.5], ambient: ["#e4f5fb", 0.3],
    sky: ["#c9efff", 2.5], cool: ["#81cffc", 4], warm: ["#fbefc2", 3],
    ground: "#103f38", gridBig: "#4f5a5e", gridMini: "#6ccdea", glassTint: "#e3faff", accent: "#fff9e2",
  },
  { // 13:00 midday: exactly today's scene (App's lights, Head's Lightformers and rim, the page's colours)
    hour: NOON,
    key: ["#ffffff", 20], fill: ["#ffffff", 5], rim: ["#bfe6ff", 1.5], ambient: ["#ffffff", 0.3],
    sky: ["#ffffff", 2.5], cool: ["#9fd3ff", 4], warm: ["#ffe2b8", 3],
    ground: "#143d32", gridBig: "#555555", gridMini: "#8ab1ee", glassTint: "#ffffff", accent: "#ffffff",
  },
  { // 18:30 golden hour: a low, hot orange sun at back-right, copper everywhere
    hour: 18.5,
    key: ["#ff9845", 28], fill: ["#f2ab83", 5], rim: ["#ffcc8e", 3], ambient: ["#f5c299", 0.32],
    sky: ["#ffbb7b", 2.6], cool: ["#fa8c58", 3.5], warm: ["#f67f2f", 5],
    ground: "#214026", gridBig: "#6d594a", gridMini: "#f6ab6b", glassTint: "#ffdeb0", accent: "#ffb769",
  },
  { // 20:00 dusk: the sun just under, a pink-violet afterglow
    hour: 20,
    key: ["#e8777a", 0], fill: ["#b873b2", 3.5], rim: ["#d398e0", 6], ambient: ["#c287bc", 0.32],
    sky: ["#ba71cb", 1.6], cool: ["#c35aa4", 2.6], warm: ["#d14a5f", 3],
    ground: "#05332e", gridBig: "#5b4959", gridMini: "#d080b6", glassTint: "#f6bde2", accent: "#f594c3",
  },
  { // 22:30 night: deep violet, a cool blue-violet rim
    hour: 22.5,
    key: ["#ae96da", 0], fill: ["#8d6cc2", 2.5], rim: ["#56acf0", 10], ambient: ["#835fb3", 0.35],
    sky: ["#794db6", 0.9], cool: ["#6e4fc1", 2], warm: ["#7f42a6", 1.4],
    ground: "#012c28", gridBig: "#52485f", gridMini: "#a377d3", glassTint: "#d1b6f3", accent: "#c3aeff",
  },
];

/** The keyframes' hours, in order through the day. */
export const KEYFRAME_HOURS: readonly number[] = KEYFRAMES.map((k) => k.hour);

type Lab = [number, number, number];

/** Every keyframe colour in OKLab, converted once. */
const LABS = KEYFRAMES.map((k) => {
  const labs = {} as Record<LampName | TokenName, Lab>;
  for (const name of [...LAMPS, ...TOKENS]) labs[name] = hexToOklab(hexOf(k, name));
  return labs;
});

function hexOf(k: Keyframe, name: LampName | TokenName): string {
  const value = k[name];
  return typeof value === "string" ? value : value[0];
}

/** The visitor's local clock as a fractional hour. */
export function localHour(date: Date): number {
  return (
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600 + date.getMilliseconds() / 3_600_000
  );
}

/** The lighting and colour for `date`'s local time, or for `override` (an hour, folded into 0–24) when given. */
export function daylight(date: Date, override?: number | null): Daylight {
  const hour = wrapHour(override ?? localHour(date));
  const { from, to, t } = segment(hour);
  const colour = (name: LampName | TokenName) => mixColour(from, to, name, t);
  const lamp = (name: LampName): Lamp => ({
    color: colour(name),
    intensity: lerp(KEYFRAMES[from][name][1], KEYFRAMES[to][name][1], t),
  });

  const sun = sunAt(hour);
  const above = Math.max(sun.elevation, 0);
  const ground = colour("ground");
  return {
    hour,
    sun,
    key: {
      ...lamp("key"),
      position: [
        KEY_DISTANCE * Math.cos(above) * Math.sin(sun.azimuth),
        KEY_DISTANCE * Math.sin(above),
        KEY_DISTANCE * Math.cos(above) * Math.cos(sun.azimuth),
      ],
    },
    fill: { ...lamp("fill"), position: [...FILL_POSITION] },
    rim: lamp("rim"),
    ambient: lamp("ambient"),
    env: {
      rotation: wrapAngle(sun.azimuth - NOON_AZIMUTH),
      sky: lamp("sky"),
      cool: lamp("cool"),
      warm: lamp("warm"),
      ground: { color: ground, intensity: GROUND_GLOW },
    },
    palette: {
      ground,
      gridBig: colour("gridBig"),
      gridMini: colour("gridMini"),
      glassTint: colour("glassTint"),
      accent: colour("accent"),
    },
  };
}

/**
 * The sun's place in the sky: rises at SUNRISE front-left, peaks at NOON at today's key-light angle, sets at
 * SUNSET back-right, and carries on round under the horizon through the night.
 */
export function sunAt(hour: number): { azimuth: number; elevation: number } {
  const h = wrapHour(hour);
  if (h >= SUNRISE && h <= SUNSET) {
    const p = (h - SUNRISE) / (SUNSET - SUNRISE);
    return {
      azimuth: wrapAngle(NOON_AZIMUTH + HALF_SWING * (2 * p - 1)),
      elevation: PEAK_ELEVATION * Math.sin(Math.PI * p),
    };
  }
  const q = wrapHour(h - SUNSET) / (24 - (SUNSET - SUNRISE));
  return {
    azimuth: wrapAngle(NOON_AZIMUTH + HALF_SWING + (2 * Math.PI - 2 * HALF_SWING) * q),
    elevation: -NIGHT_DEPTH * Math.sin(Math.PI * q),
  };
}

/** `?hour=18.5` previews a time; `?daycycle` sweeps the day in CYCLE_SECONDS, never under reduced motion. */
export function daylightParams(search: string, reduced: boolean): { hour: number | null; cycle: boolean } {
  const params = new URLSearchParams(search);
  const raw = params.get("hour");
  const value = raw === null || raw.trim() === "" ? NaN : Number(raw);
  return { hour: Number.isFinite(value) ? wrapHour(value) : null, cycle: params.has("daycycle") && !reduced };
}

/** The hour `elapsedMs` into a `?daycycle` sweep that started at `startHour`. */
export function cycleHour(startHour: number, elapsedMs: number): number {
  return wrapHour(startHour + (24 * elapsedMs) / (CYCLE_SECONDS * 1000));
}

/** The palette as the `--day-*` CSS custom properties DOM layers read. */
export function paletteVars(palette: Palette): Record<string, string> {
  return {
    "--day-ground": palette.ground,
    "--day-grid-big": palette.gridBig,
    "--day-grid-mini": palette.gridMini,
    "--day-glass-tint": palette.glassTint,
    "--day-accent": palette.accent,
  };
}

/** A `#rrggbb` palette colour as a canvas `rgba()` at `alpha`. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** The keyframes either side of `hour` and the eased position between them. At a keyframe, t is exactly 0. */
function segment(hour: number): { from: number; to: number; t: number } {
  const n = KEYFRAMES.length;
  let from = n - 1;
  for (let i = 0; i < n; i++) if (KEYFRAMES[i].hour <= hour) from = i;
  const to = (from + 1) % n;
  const start = KEYFRAMES[from].hour;
  const end = KEYFRAMES[to].hour + (to === 0 ? 24 : 0);
  const at = hour < start ? hour + 24 : hour;
  const u = (at - start) / (end - start);
  return { from, to, t: u * u * (3 - 2 * u) };
}

/** A keyframe's own colour at t = 0 (exact, no OKLab round trip); otherwise mixed in OKLab. */
function mixColour(from: number, to: number, name: LampName | TokenName, t: number): string {
  if (t === 0) return hexOf(KEYFRAMES[from], name);
  const a = LABS[from][name];
  const b = LABS[to][name];
  return oklabToHex([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function wrapHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

/** An angle folded into (−π, π]. */
function wrapAngle(angle: number): number {
  const turn = 2 * Math.PI;
  const a = (((angle + Math.PI) % turn) + turn) % turn - Math.PI;
  return a === -Math.PI ? Math.PI : a;
}

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toGamma(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** `#rrggbb` (sRGB) → OKLab [L, a, b]. */
export function hexToOklab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  const r = toLinear(((n >> 16) & 255) / 255);
  const g = toLinear(((n >> 8) & 255) / 255);
  const b = toLinear((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → `#rrggbb`, clipped to sRGB. */
function oklabToHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) => Math.round(Math.min(1, Math.max(0, toGamma(Math.max(0, c)))) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}
