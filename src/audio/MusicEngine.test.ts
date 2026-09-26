import { afterEach, describe, expect, it, vi } from "vitest";

import { MusicEngine } from "./MusicEngine";
import { FakeAudioContext } from "./testing/fakeAudio";

import type { BeatMap, TrackSource } from "./types";

const baseMap: BeatMap = {
  id: "a",
  version: 1,
  duration: 120,
  bpm: 120,
  beat0: 0,
  beatsPerBar: 4,
  downbeatMod: 0,
  confidence: 1,
  curveFps: 10,
  energy: [128],
  section: [0],
  barLevels: [0],
  onsets: { kick: [], snare: [], hat: [] },
};

interface SetupOptions {
  maps?: Record<string, BeatMap | null>;
  fetch?: (url: string) => Promise<ArrayBuffer>;
  createContext?: () => AudioContext;
}

function setup(options: SetupOptions = {}) {
  const contexts: FakeAudioContext[] = [];
  const maps = options.maps ?? { a: baseMap, b: { ...baseMap, id: "b", bpm: 150 } };
  const tracks: TrackSource[] = ["a", "b"].map((id) => ({
    id,
    title: id.toUpperCase(),
    url: `/${id}.mp3`,
    loadBeatMap: async () => maps[id] ?? null,
  }));
  const engine = new MusicEngine(tracks, {
    createContext:
      options.createContext ??
      (() => {
        const ctx = new FakeAudioContext();
        contexts.push(ctx);
        return ctx as unknown as AudioContext;
      }),
    fetchArrayBuffer: options.fetch ?? (async () => new ArrayBuffer(8)),
  });
  engine.visualLead = 0;
  return { engine, contexts, ctx: () => contexts[0] };
}

async function playing(options?: SetupOptions) {
  const s = setup(options);
  await s.engine.preload();
  s.engine.unlock();
  s.engine.play(0);
  return s;
}

/** Make the fake output clock say `contextTime` is audible at performance time `nowMs`. */
function audibleAt(ctx: FakeAudioContext, contextTime: number, nowMs: number) {
  ctx.outputTimestamp = { contextTime, performanceTime: nowMs };
  ctx.currentTime = contextTime + 0.03;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loading and unlocking", () => {
  it("creates one context and decodes once, however often preload is called", async () => {
    const { engine, contexts } = setup();
    const statuses: string[] = [];
    engine.subscribe(() => statuses.push(engine.getSnapshot().status));
    await Promise.all([engine.preload(), engine.preload()]);
    await engine.preload();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].decodeCalls).toBe(1);
    expect(statuses).toEqual(["loading", "ready"]);
    expect(engine.getSnapshot()).toMatchObject({ track: "a", title: "A", bpm: 120, isPlaying: false });
  });

  it("keeps the context suspended until unlock", async () => {
    const { engine, ctx } = setup();
    await engine.preload();
    expect(ctx().state).toBe("suspended");
    engine.unlock();
    expect(ctx().state).toBe("running");
    expect(engine.getSnapshot().unlocked).toBe(true);
  });

  it("reports error when Web Audio is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { engine } = setup({
      createContext: () => {
        throw new Error("no audio");
      },
    });
    await engine.preload();
    engine.unlock();
    engine.play(0);
    expect(engine.getSnapshot().status).toBe("error");
    expect(engine.update(16).isPlaying).toBe(false);
  });

  it("reports error when the track fails to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { engine } = setup({
      fetch: async () => {
        throw new Error("404");
      },
    });
    await engine.preload();
    expect(engine.getSnapshot().status).toBe("error");
  });
});

describe("transport", () => {
  it("anchors playback slightly ahead of currentTime", async () => {
    const { engine, ctx } = await playing();
    expect(ctx().lastSource.started).toEqual({ when: 0.05, offset: 0 });
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it("starts as soon as decoding finishes when play is pressed early", async () => {
    let release: (buffer: ArrayBuffer) => void = () => {};
    const { engine, ctx } = setup({ fetch: () => new Promise((resolve) => (release = resolve)) });
    const loaded = engine.preload();
    engine.unlock();
    engine.play(0);
    expect(ctx().sources).toHaveLength(0);
    release(new ArrayBuffer(8));
    await loaded;
    expect(ctx().sources).toHaveLength(1);
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it("reports playing while the first track is still decoding", async () => {
    const { engine } = setup({ fetch: () => new Promise<ArrayBuffer>(() => {}) });
    void engine.preload();
    engine.unlock();
    engine.play(0);
    expect(engine.getSnapshot().isPlaying).toBe(true);
    expect(engine.update(16).isPlaying).toBe(false);
  });

  it("toggle matches the label while a switched-to track is loading", async () => {
    const pending: ((buffer: ArrayBuffer) => void)[] = [];
    let fetches = 0;
    const { engine, ctx } = setup({
      fetch: () => {
        fetches++;
        return fetches === 1
          ? Promise.resolve(new ArrayBuffer(8))
          : new Promise<ArrayBuffer>((resolve) => pending.push(resolve));
      },
    });
    await engine.preload();
    engine.unlock();
    engine.play(0);
    engine.next();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", isPlaying: true });
    engine.toggle();
    expect(engine.getSnapshot().isPlaying).toBe(false);
    pending[0](new ArrayBuffer(8));
    await engine.preload();
    expect(engine.getSnapshot().isPlaying).toBe(false);
    expect(ctx().sources).toHaveLength(1);
  });

  it("keeps exactly one live source when play is called twice", async () => {
    const { engine, ctx } = await playing();
    engine.play(0);
    expect(ctx().sources).toHaveLength(2);
    expect(ctx().sources[0].stopped).toBe(true);
    expect(ctx().sources[1].stopped).toBe(false);
  });

  it("pause freezes time and resume continues from it", async () => {
    const { engine, ctx } = await playing();
    ctx().currentTime = 3.05;
    engine.pause();
    expect(ctx().sources[0].stopped).toBe(true);
    expect(engine.update(5000).time).toBeCloseTo(3.0);
    expect(engine.frame.isPlaying).toBe(false);
    expect(engine.getSnapshot().isPlaying).toBe(false);
    engine.play();
    expect(ctx().lastSource.started?.when).toBeCloseTo(3.1);
    expect(ctx().lastSource.started?.offset).toBeCloseTo(3.0);
  });

  it("pausing before the scheduled start keeps the start position", async () => {
    const { engine } = await playing();
    engine.pause();
    expect(engine.update(1).time).toBe(0);
  });

  it("toggle pauses and resumes", async () => {
    const { engine } = await playing();
    engine.toggle();
    expect(engine.getSnapshot().isPlaying).toBe(false);
    engine.toggle();
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it("seek restarts the source at the target and clamps to the track", async () => {
    const { engine, ctx } = await playing();
    engine.seek(10);
    expect(ctx().lastSource.started?.offset).toBe(10);
    engine.seek(500);
    expect(ctx().lastSource.started?.offset).toBeCloseTo(119.9);
    engine.pause();
    engine.seek(-5);
    expect(engine.update(99).time).toBe(0);
  });

  it("mute ramps the mute gain and survives track changes", async () => {
    const { engine, ctx } = await playing();
    engine.setMuted(true);
    const mute = ctx().gains[1].gain;
    expect(mute.events[mute.events.length - 1]).toEqual({ type: "ramp", value: 0, time: 0.01 });
    const eventCount = mute.events.length;
    ctx().lastSource.finish();
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", muted: true, isPlaying: true });
    expect(mute.events).toHaveLength(eventCount);
  });
});

describe("track switching", () => {
  it("advances to the next track when one ends and loops back", async () => {
    const { engine, ctx } = await playing();
    ctx().lastSource.finish();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", status: "loading", isPlaying: true });
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", title: "B", bpm: 150, status: "ready", isPlaying: true });
    expect(ctx().lastSource.started?.offset).toBe(0);
    engine.next();
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "a", isPlaying: true });
    expect(ctx().decodeCalls).toBe(3);
  });

  it("switches without playing when paused", async () => {
    const { engine, ctx } = await playing();
    engine.pause();
    const sources = ctx().sources.length;
    engine.next();
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", isPlaying: false, status: "ready" });
    expect(ctx().sources).toHaveLength(sources);
  });

  it("caps rapid next() clicks at one in-flight load per track", async () => {
    let fetches = 0;
    const { engine } = setup({
      fetch: () => {
        fetches++;
        return fetches === 1 ? Promise.resolve(new ArrayBuffer(8)) : new Promise<ArrayBuffer>(() => {});
      },
    });
    await engine.preload();
    engine.unlock();
    engine.play(0);
    for (let i = 0; i < 6; i++) engine.next();
    expect(fetches).toBeLessThanOrEqual(3);
  });

  it("reuses an in-flight load when returning to a track", async () => {
    const pending: { url: string; resolve: (buffer: ArrayBuffer) => void }[] = [];
    const { engine, ctx } = setup({
      fetch: (url) => new Promise((resolve) => pending.push({ url, resolve })),
    });
    const first = engine.preload();
    pending[0].resolve(new ArrayBuffer(8));
    await first;
    engine.unlock();
    engine.play(0);
    engine.next();
    engine.next();
    engine.next();
    expect(pending.map((p) => p.url)).toEqual(["/a.mp3", "/b.mp3", "/a.mp3"]);
    pending[1].resolve(new ArrayBuffer(8));
    await engine.preload();
    expect(engine.getSnapshot()).toMatchObject({ track: "b", status: "ready", isPlaying: true });
    expect(ctx().lastSource.started?.offset).toBe(0);
  });

  it("ignores a skipped track that finishes loading late", async () => {
    const pending: { url: string; resolve: (buffer: ArrayBuffer) => void }[] = [];
    const { engine, ctx } = setup({
      fetch: (url) => new Promise((resolve) => pending.push({ url, resolve })),
    });
    const first = engine.preload();
    await flush();
    pending[0].resolve(new ArrayBuffer(8));
    await first;
    engine.unlock();
    engine.play(0);
    engine.next();
    engine.next();
    await flush();
    expect(pending.map((p) => p.url)).toEqual(["/a.mp3", "/b.mp3", "/a.mp3"]);
    pending[2].resolve(new ArrayBuffer(8));
    await engine.preload();
    const sources = ctx().sources.length;
    pending[1].resolve(new ArrayBuffer(8));
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ track: "a", status: "ready", isPlaying: true });
    expect(ctx().sources).toHaveLength(sources);
  });
});

describe("frames", () => {
  it("derives song time from the output timestamp", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    const frame = engine.update(1100);
    expect(frame.time).toBeCloseTo(1.05);
    expect(frame.beatIndex).toBe(2);
    expect(frame.isPlaying).toBe(true);
    expect(frame.beatConfidence).toBe(1);
  });

  it("adds visualLead and userOffset", async () => {
    const { engine, ctx } = await playing();
    engine.visualLead = 0.01;
    engine.userOffset = 0.1;
    audibleAt(ctx(), 1.0, 1000);
    expect(engine.update(1000).time).toBeCloseTo(1.06);
  });

  it("falls back to currentTime minus latency without an output timestamp", async () => {
    const { engine, ctx } = await playing();
    ctx().currentTime = 2.05;
    expect(engine.update(10).time).toBeCloseTo(2.05 - 0.005 - 0.02 - 0.05);
  });

  it("never steps song time backwards within a playback run", async () => {
    const { engine, ctx } = await playing();
    let edges = 0;
    [0.54, 0.551, 0.5485, 0.557].forEach((contextTime, i) => {
      audibleAt(ctx(), contextTime, 1000 + i);
      if (engine.update(1000 + i).beatCrossed) edges++;
    });
    expect(edges).toBe(1);
    expect(engine.frame.time).toBeCloseTo(0.507);
  });

  it("lets time move back again after a seek", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 5.05, 1000);
    expect(engine.update(1000).time).toBeCloseTo(5.0);
    ctx().currentTime = 5.0;
    engine.seek(1);
    audibleAt(ctx(), 5.1, 2000);
    expect(engine.update(2000).time).toBeCloseTo(1.05);
  });

  it("freezes time and reports not playing while the context is suspended", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    engine.update(1000);
    ctx().state = "suspended";
    ctx().currentTime = 1.03;
    const frozen = engine.update(2000).time;
    expect(frozen).toBeCloseTo(1.03 - 0.005 - 0.02 - 0.05);
    expect(engine.frame.isPlaying).toBe(false);
    expect(engine.update(3000).time).toBeCloseTo(frozen);
  });

  it("is idempotent for the same timestamp", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    const time = engine.update(1100).time;
    audibleAt(ctx(), 5.0, 1000);
    expect(engine.update(1100).time).toBe(time);
  });

  it("plays tracks without a beat map with zero confidence", async () => {
    const { engine, ctx } = await playing({ maps: { a: null, b: null } });
    audibleAt(ctx(), 1.0, 1000);
    expect(engine.update(1000)).toMatchObject({ isPlaying: true, bpm: 0, beatConfidence: 0 });
    expect(engine.getSnapshot().bpm).toBeNull();
  });

  it("normalises live bands while playing and zeroes them when paused", async () => {
    const { engine, ctx } = await playing();
    audibleAt(ctx(), 1.0, 1000);
    const bands = Array.from(engine.update(1000).bands);
    expect(bands).toHaveLength(6);
    bands.forEach((value) => expect(value).toBeCloseTo(1, 5));
    engine.pause();
    expect(Array.from(engine.update(2000).bands)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe("state subscription", () => {
  it("notifies only when a field changes and keeps snapshot identity otherwise", () => {
    const { engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener);
    const before = engine.getSnapshot();
    engine.setMuted(false);
    expect(listener).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toBe(before);
    engine.setMuted(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
