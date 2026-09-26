import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeWithAfconvert } from "./decode.ts";
import { analyzeTrack } from "../src/audio/analysis/analyzeTrack.ts";
import { buildBeatMap } from "../src/audio/analysis/buildBeatMap.ts";

import type { BeatMapOverrides } from "../src/audio/analysis/buildBeatMap.ts";

const beatmapDir = fileURLToPath(new URL("../src/audio/beatmaps/", import.meta.url));
const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("usage: yarn beatmap <file.mp3> [--id <id>]");
  process.exit(1);
}
const idFlag = flags.indexOf("--id");
const id = idFlag >= 0 ? flags[idFlag + 1] : basename(file, extname(file));

const overrides: Record<string, BeatMapOverrides> = JSON.parse(
  readFileSync(join(beatmapDir, "overrides.json"), "utf8")
);
const started = performance.now();
const { pcm, sampleRate } = decodeWithAfconvert(file);
const analysis = analyzeTrack(pcm, sampleRate);
const map = buildBeatMap(id, analysis, overrides[id]);
writeFileSync(join(beatmapDir, `${id}.json`), JSON.stringify(map) + "\n");

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `${id}: ${map.bpm} bpm, beat0 ${map.beat0}s, downbeatMod ${map.downbeatMod} (raw ${analysis.downbeatMod}), ` +
    `${map.onsets.kick.length / 2} kicks, ${map.barLevels.length} bars, ${seconds}s`
);
console.log(`bar levels: ${map.barLevels.join("")}`);
