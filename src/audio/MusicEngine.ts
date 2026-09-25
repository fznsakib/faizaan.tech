import { BAND_COUNT, clearFrame, createCursors, createFrame, writeFrame } from "./frame";

import type { FrameCursors } from "./frame";
import type { BeatMap, EngineState, MusicFrame, TrackSource } from "./types";

export interface EngineDeps {
  createContext: () => AudioContext;
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>;
}

/** Sources start this far ahead of currentTime so the clock anchor is sample-exact. */
const SCHEDULE_AHEAD = 0.05;
const MUTE_RAMP = 0.01;
/** 6 log-spaced bands, 40 Hz – 16 kHz. */
const BAND_EDGES = Array.from(
  { length: BAND_COUNT + 1 },
  (_, i) => 40 * Math.pow(16000 / 40, i / BAND_COUNT)
);
const DB_FLOOR = -90;
const DB_CEIL = -20;
const PEAK_DECAY = 0.995;
const PEAK_FLOOR = 0.25;

interface LoadedTrack {
  source: TrackSource;
  buffer: AudioBuffer | null;
  map: BeatMap | null;
  loading: Promise<void> | null;
}

const defaultDeps: EngineDeps = {
  createContext: () => new AudioContext({ latencyHint: "interactive" }),
  fetchArrayBuffer: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.arrayBuffer();
  },
};

/**
 * Plays tracks through Web Audio and derives every per-frame value from the AudioContext
 * output clock plus the track's precomputed beat map. See docs/superpowers/specs/2026-09-25-music-engine-design.md.
 */
export class MusicEngine {
  /** Mutated in place by `update`. Read it each frame; never keep its values across frames. */
  readonly frame: MusicFrame = createFrame();
  /** Seconds between a rAF callback and the photons it produces; the ticker sets it to one display frame. */
  visualLead = 1 / 60;
  /** Per-device calibration in seconds (e.g. Bluetooth output). */
  userOffset = 0;

  private readonly deps: EngineDeps;
  private readonly tracks: LoadedTrack[];
  private readonly listeners = new Set<() => void>();
  private readonly peaks = new Float32Array(BAND_COUNT).fill(PEAK_FLOOR);
  private state: EngineState;
  private current = 0;
  private ctx: AudioContext | null = null;
  private contextFailed = false;
  private bus: GainNode | null = null;
  private muteGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private spectrum = new Float32Array(0);
  private source: AudioBufferSourceNode | null = null;
  private anchorCtx = 0;
  private anchorSong = 0;
  private pausedAt = 0;
  private wantsPlay = false;
  private cursors: FrameCursors = createCursors();
  private lastNow = Number.NaN;

  constructor(tracks: TrackSource[], deps: Partial<EngineDeps> = {}) {
    if (tracks.length === 0) throw new Error("MusicEngine needs at least one track");
    this.deps = { ...defaultDeps, ...deps };
    this.tracks = tracks.map((source) => ({ source, buffer: null, map: null, loading: null }));
    this.state = {
      status: "idle",
      unlocked: false,
      track: tracks[0].id,
      title: tracks[0].title,
      bpm: null,
      isPlaying: false,
      muted: false,
    };
  }

  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  get beatMap(): BeatMap | null {
    return this.tracks[this.current].map;
  }

  songTimeAtContext(contextTime: number): number {
    return this.anchorSong + (contextTime - this.anchorCtx);
  }

  contextTimeAtSong(songTime: number): number {
    return this.anchorCtx + (songTime - this.anchorSong);
  }

  /** Create the (suspended) context if needed, then fetch and decode a track (default: current). Idempotent. */
  preload(id?: string): Promise<void> {
    const index = id === undefined ? this.current : this.tracks.findIndex((t) => t.source.id === id);
    const track = this.tracks[index];
    if (!track) return Promise.reject(new Error(`Unknown track: ${id}`));
    if (track.loading) return track.loading;
    if (!this.ensureContext()) {
      this.set({ status: "error" });
      return Promise.resolve();
    }
    const ctx = this.ctx as AudioContext;
    if (index === this.current) this.set({ status: "loading" });

    // Declared first so the async body can compare identities after its first await.
    let loading: Promise<void> | null = null;
    loading = (async () => {
      try {
        const [data, map] = await Promise.all([
          this.deps.fetchArrayBuffer(track.source.url),
          track.source.loadBeatMap().catch((err: unknown) => {
            console.warn(`[music] no beat map for ${track.source.id}`, err);
            return null;
          }),
        ]);
        const buffer = await ctx.decodeAudioData(data);
        if (track.loading !== loading) return;
        if (this.tracks[this.current] !== track) {
          track.loading = null; // switched away while loading: drop the decoded PCM
          return;
        }
        track.buffer = buffer;
        track.map = map;
        if (this.tracks[this.current] === track) this.onCurrentReady();
      } catch (err) {
        console.error(`[music] failed to load ${track.source.id}`, err);
        if (track.loading !== loading) return;
        track.loading = null; // allow a retry
        if (this.tracks[this.current] === track) {
          this.wantsPlay = false;
          this.set({ status: "error", isPlaying: false });
        }
      }
    })();
    track.loading = loading;
    return loading;
  }

  /** Resume audio output. Call synchronously inside a user-gesture handler (autoplay policy, iOS). */
  unlock(): void {
    if (!this.ensureContext()) {
      this.set({ status: "error" });
      return;
    }
    const ctx = this.ctx as AudioContext;
    if (ctx.state !== "running") {
      ctx.resume().catch((err: unknown) => console.error("[music] resume failed", err));
    }
    this.set({ unlocked: true });
  }

  /** Play the current track from song time `from` (default: where it paused); waits for decoding if needed. */
  play(from: number = this.pausedAt): void {
    if (!this.ensureContext()) {
      this.set({ status: "error" });
      return;
    }
    this.pausedAt = Math.max(0, from);
    const track = this.tracks[this.current];
    if (!track.buffer) {
      this.wantsPlay = true;
      this.set({ isPlaying: true }); // "playing or starting": the transport label and toggle agree
      void this.preload(track.source.id);
      return;
    }
    this.startSource(this.pausedAt);
  }

  pause(): void {
    this.wantsPlay = false;
    if (this.source && this.ctx) {
      this.pausedAt = Math.max(this.anchorSong, this.songTimeAtContext(this.ctx.currentTime));
      this.stopSource();
    }
    this.set({ isPlaying: false });
  }

  toggle(): void {
    if (this.state.isPlaying) this.pause();
    else this.play();
  }

  seek(time: number): void {
    const track = this.tracks[this.current];
    const duration = track.buffer?.duration ?? track.map?.duration ?? 0;
    const target = Math.min(Math.max(0, time), Math.max(0, duration - 0.1));
    if (this.source) {
      this.startSource(target);
    } else {
      this.pausedAt = target;
      this.cursors = createCursors();
    }
  }

  /** Switch to the next track (looping); keeps playing if it was playing. */
  next(): void {
    this.advance(this.state.isPlaying);
  }

  setMuted(muted: boolean): void {
    if (this.muteGain && this.ctx) {
      const gain = this.muteGain.gain;
      const now = this.ctx.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(muted ? 0 : 1, now + MUTE_RAMP);
    }
    this.set({ muted });
  }

  /** Compute the frame for a rAF timestamp. Only the ticker calls this; idempotent per `nowMs`. */
  update(nowMs: number): MusicFrame {
    if (nowMs === this.lastNow) return this.frame;
    this.lastNow = nowMs;
    const playing = this.source !== null && this.ctx !== null;
    const time = playing
      ? this.songTimeAtContext(this.audibleContextTime(nowMs) + this.visualLead + this.userOffset)
      : this.pausedAt;
    const map = this.tracks[this.current].map;
    if (map) writeFrame(this.frame, map, time, playing, this.cursors);
    else clearFrame(this.frame, time, playing);
    this.writeBands(playing);
    return this.frame;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): EngineState => this.state;

  private set(patch: Partial<EngineState>): void {
    const keys = Object.keys(patch) as (keyof EngineState)[];
    if (keys.every((key) => patch[key] === this.state[key])) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private ensureContext(): boolean {
    if (this.ctx) return true;
    if (this.contextFailed) return false;
    let ctx: AudioContext;
    try {
      ctx = this.deps.createContext();
    } catch (err) {
      console.error("[music] Web Audio unavailable", err);
      this.contextFailed = true;
      return false;
    }
    const bus = ctx.createGain();
    const muteGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0;
    bus.connect(analyser);
    bus.connect(muteGain);
    muteGain.connect(ctx.destination);
    muteGain.gain.value = this.state.muted ? 0 : 1;
    this.ctx = ctx;
    this.bus = bus;
    this.muteGain = muteGain;
    this.analyser = analyser;
    this.spectrum = new Float32Array(analyser.frequencyBinCount);
    return true;
  }

  private onCurrentReady(): void {
    const track = this.tracks[this.current];
    this.set({ status: "ready", bpm: track.map?.bpm ?? null });
    if (this.wantsPlay) this.startSource(this.pausedAt);
  }

  private startSource(from: number): void {
    const ctx = this.ctx;
    const track = this.tracks[this.current];
    if (!ctx || !this.bus || !track.buffer) return;
    this.stopSource();
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.connect(this.bus);
    const when = ctx.currentTime + SCHEDULE_AHEAD;
    source.start(when, from);
    source.onended = () => {
      if (this.source !== source) return;
      this.source = null;
      this.pausedAt = 0;
      this.advance(true);
    };
    this.source = source;
    this.anchorCtx = when;
    this.anchorSong = from;
    this.pausedAt = from;
    this.wantsPlay = false;
    this.cursors = createCursors();
    this.set({ isPlaying: true });
  }

  private stopSource(): void {
    const source = this.source;
    if (!source) return;
    this.source = null;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // already stopped
    }
    source.disconnect();
  }

  private advance(resume: boolean): void {
    this.stopSource();
    const previous = this.tracks[this.current];
    this.current = (this.current + 1) % this.tracks.length;
    const track = this.tracks[this.current];
    if (previous !== track && previous.buffer) {
      // Decoded PCM is 45–72 MB per track: keep only the active one. An in-flight load keeps its
      // promise so returning to the track reuses it instead of starting another decode.
      previous.buffer = null;
      previous.loading = null;
    }
    this.pausedAt = 0;
    this.wantsPlay = false;
    this.cursors = createCursors();
    this.set({
      track: track.source.id,
      title: track.source.title,
      bpm: track.map?.bpm ?? null,
      isPlaying: resume,
      status: track.buffer ? "ready" : "loading",
    });
    if (resume) this.play(0);
    else void this.preload();
  }

  private audibleContextTime(nowMs: number): number {
    const ctx = this.ctx as AudioContext;
    const stamp = typeof ctx.getOutputTimestamp === "function" ? ctx.getOutputTimestamp() : undefined;
    if (
      stamp?.contextTime !== undefined &&
      stamp.performanceTime !== undefined &&
      stamp.performanceTime > 0
    ) {
      return stamp.contextTime + (nowMs - stamp.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.baseLatency || 0) - (ctx.outputLatency || 0);
  }

  private writeBands(playing: boolean): void {
    const bands = this.frame.bands;
    const analyser = this.analyser;
    if (!playing || !analyser || !this.ctx) {
      bands.fill(0);
      return;
    }
    analyser.getFloatFrequencyData(this.spectrum);
    const binHz = this.ctx.sampleRate / analyser.fftSize;
    for (let b = 0; b < BAND_COUNT; b++) {
      const lo = Math.max(1, Math.floor(BAND_EDGES[b] / binHz));
      const hi = Math.max(lo, Math.min(this.spectrum.length - 1, Math.ceil(BAND_EDGES[b + 1] / binHz) - 1));
      let sum = 0;
      for (let k = lo; k <= hi; k++) sum += this.spectrum[k];
      const level = Math.min(1, Math.max(0, (sum / (hi - lo + 1) - DB_FLOOR) / (DB_CEIL - DB_FLOOR)));
      this.peaks[b] = Math.max(level, this.peaks[b] * PEAK_DECAY, PEAK_FLOOR);
      bands[b] = level / this.peaks[b];
    }
  }
}
