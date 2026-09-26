import bendArt from "../assets/artwork/bend-tiesto.jpg";
import emptyLightningArt from "../assets/artwork/empty-lightning.jpg";
import expressionOnYourFaceArt from "../assets/artwork/expression-on-your-face.jpg";
import generateUtopiaArt from "../assets/artwork/generate-utopia.jpg";
import iStillSeeYouArt from "../assets/artwork/i-still-see-you.jpg";
import inMyMindArt from "../assets/artwork/in-my-mind.jpg";
import voidArt from "../assets/artwork/void.jpg";
import bendUrl from "../assets/audio/bend-tiesto.mp3";
import emptyLightningUrl from "../assets/audio/empty-lightning.mp3";
import expressionOnYourFaceUrl from "../assets/audio/expression-on-your-face.mp3";
import generateUtopiaUrl from "../assets/audio/generate-utopia.mp3";
import iStillSeeYouUrl from "../assets/audio/i-still-see-you.mp3";
import inMyMindUrl from "../assets/audio/in-my-mind.mp3";
import voidUrl from "../assets/audio/void.mp3";

import type { BeatMap, TrackSource } from "./types";

/**
 * Playback and playlist order; the list loops. Beat maps are generated with `yarn beatmap <file.mp3>`.
 * Artwork is downloaded once from the source noted on each entry and downscaled (`sips -Z 300 -s format jpeg`);
 * `duration` is the beat map's, rounded (tracks.test.ts keeps them in step).
 */
export const TRACKS: TrackSource[] = [
  {
    id: "empty-lightning",
    title: "Empty Lightning (feat. Oklou)",
    artist: "Woesum",
    album: "Blue Summer",
    year: 2021,
    // https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/01/72/3d/01723d0a-a4a1-a668-7ed8-1f05e1b97969/artwork.jpg/600x600bb.jpg
    artwork: emptyLightningArt,
    duration: 129.5,
    url: emptyLightningUrl,
    loadBeatMap: async () => (await import("./beatmaps/empty-lightning.json")).default as BeatMap,
  },
  {
    id: "bend-tiesto",
    title: "Bend It Like You Don't Care",
    artist: "Tiësto",
    album: "Kaleidoscope",
    year: 2009,
    // https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ac/ec/66/acec66a8-1fbd-1ead-7d23-7f1f93c48dc7/190295449490.jpg/600x600bb.jpg
    artwork: bendArt,
    duration: 203.2,
    url: bendUrl,
    loadBeatMap: async () => (await import("./beatmaps/bend-tiesto.json")).default as BeatMap,
  },
  {
    id: "expression-on-your-face",
    title: "Expression On Your Face",
    artist: "Mechatok, Ecco2k & Bladee",
    album: "Expression On Your Face (Single)",
    year: 2025,
    // https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/56/c8/32/56c83231-2e61-15cf-420f-a0e1bf71b897/889030043047.png/600x600bb.jpg
    artwork: expressionOnYourFaceArt,
    duration: 200.5,
    url: expressionOnYourFaceUrl,
    loadBeatMap: async () => (await import("./beatmaps/expression-on-your-face.json")).default as BeatMap,
  },
  {
    id: "generate-utopia",
    title: "Generate Utopia",
    artist: "death's dynamic shroud & Galen Tipton",
    album: "You Like Music",
    year: 2024,
    // https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e7/1e/70/e71e7059-9d82-5124-cc85-d182d22cb900/797885144935_cover.jpg/600x600bb.jpg
    artwork: generateUtopiaArt,
    duration: 269,
    url: generateUtopiaUrl,
    loadBeatMap: async () => (await import("./beatmaps/generate-utopia.json")).default as BeatMap,
  },
  {
    id: "void",
    title: "Void ///////(d) [u] [m]",
    artist: "DJ Worm, jamesjamesjames & Eurohead",
    album: "SWEEDISH Open 2025 ***sthlm city i lågor***",
    year: 2025,
    // https://i.scdn.co/image/ab67616d0000b273ed25a1eda491a275ada07dff
    artwork: voidArt,
    duration: 230.4,
    url: voidUrl,
    loadBeatMap: async () => (await import("./beatmaps/void.json")).default as BeatMap,
  },
  {
    id: "in-my-mind",
    title: "In My Mind",
    artist: "DJ Worm, Eurohead & SPÖKE",
    album: "In My Heart / In My Mind",
    year: 2024,
    // https://i.scdn.co/image/ab67616d0000b273b0dbe5cdee230af2f14fa97b
    artwork: inMyMindArt,
    duration: 244,
    url: inMyMindUrl,
    loadBeatMap: async () => (await import("./beatmaps/in-my-mind.json")).default as BeatMap,
  },
  {
    id: "i-still-see-you",
    title: "I Still See You",
    artist: "Himera & Nora Korra",
    album: "Now I Know What Dreams Are Made Of",
    year: 2025,
    // https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4b/bf/a9/4bbfa9ec-d976-6f93-4da6-d87b8a1ab6e6/5050580865167.png/600x600bb.jpg
    artwork: iStillSeeYouArt,
    duration: 278,
    url: iStillSeeYouUrl,
    loadBeatMap: async () => (await import("./beatmaps/i-still-see-you.json")).default as BeatMap,
  },
];
