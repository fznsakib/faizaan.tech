import bendUrl from "../assets/audio/bend-tiesto.mp3";
import emptyLightningUrl from "../assets/audio/empty-lightning.mp3";
import etakiUrl from "../assets/audio/etaki.mp3";
import expressionOnYourFaceUrl from "../assets/audio/expression-on-your-face.mp3";
import generateUtopiaUrl from "../assets/audio/generate-utopia.mp3";
import iStillSeeYouUrl from "../assets/audio/i-still-see-you.mp3";
import inMyMindUrl from "../assets/audio/in-my-mind.mp3";
import voidUrl from "../assets/audio/void.mp3";

import type { BeatMap, TrackSource } from "./types";

/** Playback order; the list loops. Beat maps are generated with `yarn beatmap <file.mp3>`. */
export const TRACKS: TrackSource[] = [
  {
    id: "empty-lightning",
    title: "empty lightning",
    url: emptyLightningUrl,
    loadBeatMap: async () => (await import("./beatmaps/empty-lightning.json")).default as BeatMap,
  },
  {
    id: "etaki",
    title: "etaki",
    url: etakiUrl,
    loadBeatMap: async () => (await import("./beatmaps/etaki.json")).default as BeatMap,
  },
  {
    id: "bend-tiesto",
    title: "bend",
    url: bendUrl,
    loadBeatMap: async () => (await import("./beatmaps/bend-tiesto.json")).default as BeatMap,
  },
  {
    id: "expression-on-your-face",
    title: "expression on your face",
    url: expressionOnYourFaceUrl,
    loadBeatMap: async () => (await import("./beatmaps/expression-on-your-face.json")).default as BeatMap,
  },
  {
    id: "generate-utopia",
    title: "generate utopia",
    url: generateUtopiaUrl,
    loadBeatMap: async () => (await import("./beatmaps/generate-utopia.json")).default as BeatMap,
  },
  {
    id: "void",
    title: "void",
    url: voidUrl,
    loadBeatMap: async () => (await import("./beatmaps/void.json")).default as BeatMap,
  },
  {
    id: "in-my-mind",
    title: "in my mind",
    url: inMyMindUrl,
    loadBeatMap: async () => (await import("./beatmaps/in-my-mind.json")).default as BeatMap,
  },
  {
    id: "i-still-see-you",
    title: "i still see you",
    url: iStillSeeYouUrl,
    loadBeatMap: async () => (await import("./beatmaps/i-still-see-you.json")).default as BeatMap,
  },
];
