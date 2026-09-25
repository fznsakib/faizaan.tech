import emptyLightningUrl from "../assets/audio/empty-lightning.mp3";
import etakiUrl from "../assets/audio/etaki.mp3";

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
];
