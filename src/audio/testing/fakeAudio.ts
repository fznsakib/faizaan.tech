/** Minimal Web Audio fakes for MusicEngine tests: only what the engine touches. */

export class FakeParam {
  value: number;
  readonly events: { type: "set" | "ramp" | "exp" | "cancel"; value: number; time: number }[] = [];

  constructor(value: number) {
    this.value = value;
  }

  setValueAtTime(value: number, time: number) {
    this.events.push({ type: "set", value, time });
    this.value = value;
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: "ramp", value, time });
    this.value = value;
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: "exp", value, time });
    this.value = value;
    return this;
  }

  cancelScheduledValues(time: number) {
    this.events.push({ type: "cancel", value: this.value, time });
    return this;
  }
}

export class FakeNode {
  readonly connections: unknown[] = [];

  connect<T>(node: T): T {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.connections.length = 0;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

export class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  level = -40;
  /** Per-bin dB; overrides `level` when set. */
  levelAt: ((bin: number) => number) | null = null;

  get frequencyBinCount() {
    return this.fftSize / 2;
  }

  getFloatFrequencyData(array: Float32Array) {
    if (this.levelAt) for (let k = 0; k < array.length; k++) array[k] = this.levelAt(k);
    else array.fill(this.level);
  }

  /** A ramp from -1 up to just under 1 across the window. */
  getFloatTimeDomainData(array: Float32Array) {
    for (let i = 0; i < array.length; i++) array[i] = (2 * i) / array.length - 1;
  }
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started: { when: number; offset: number } | null = null;
  stopped = false;
  stopAt: number | null = null;

  start(when = 0, offset = 0) {
    this.started = { when, offset };
  }

  stop(when?: number) {
    this.stopped = true;
    this.stopAt = when ?? null;
  }

  /** Simulate the track reaching its end. */
  finish() {
    this.onended?.();
  }
}

export class FakeOscillator extends FakeNode {
  type = "sine";
  readonly frequency = new FakeParam(440);
  startAt: number | null = null;
  stopAt: number | null = null;

  start(when = 0) {
    this.startAt = when;
  }

  stop(when = 0) {
    this.stopAt = when;
  }
}

export class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
}

export class FakeWaveShaper extends FakeNode {
  curve: Float32Array | null = null;
  oversample = "none";
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  baseLatency = 0.005;
  outputLatency = 0.02;
  state: "suspended" | "running" | "closed" = "suspended";
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly sources: FakeSource[] = [];
  readonly oscillators: FakeOscillator[] = [];
  readonly filters: FakeFilter[] = [];
  readonly shapers: FakeWaveShaper[] = [];
  readonly analysers: FakeAnalyser[] = [];
  outputTimestamp = { contextTime: 0, performanceTime: 0 };
  bufferDuration = 120;
  decodeCalls = 0;

  get lastSource(): FakeSource {
    return this.sources[this.sources.length - 1];
  }

  resume() {
    this.state = "running";
    return Promise.resolve();
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createAnalyser() {
    const analyser = new FakeAnalyser();
    this.analysers.push(analyser);
    return analyser;
  }

  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createWaveShaper() {
    const shaper = new FakeWaveShaper();
    this.shapers.push(shaper);
    return shaper;
  }

  createBiquadFilter() {
    const filter = new FakeFilter();
    this.filters.push(filter);
    return filter;
  }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }

  decodeAudioData() {
    this.decodeCalls++;
    return Promise.resolve({ duration: this.bufferDuration, numberOfChannels: 2 });
  }

  getOutputTimestamp() {
    return this.outputTimestamp;
  }
}
