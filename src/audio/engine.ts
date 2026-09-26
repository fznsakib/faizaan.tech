import { MusicEngine } from "./MusicEngine";
import { TRACKS } from "./tracks";

/** The app-wide music engine. Only `src/audio/ticker.ts` calls `engine.update`. */
export const engine = new MusicEngine(TRACKS);
