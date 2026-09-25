/** Minimal Web Audio fakes for MusicEngine tests: only what the engine touches. */

export class FakeParam {
  value: number;
  readonly events: { type: "set" | "ramp" | "cancel"; value: number; time: number }[] = [];

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

  get frequencyBinCount() {
    return this.fftSize / 2;
  }

  getFloatFrequencyData(array: Float32Array) {
    array.fill(this.level);
  }
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started: { when: number; offset: number } | null = null;
  stopped = false;

  start(when = 0, offset = 0) {
    this.started = { when, offset };
  }

  stop() {
    this.stopped = true;
  }

  /** Simulate the track reaching its end. */
  finish() {
    this.onended?.();
  }
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
    return new FakeAnalyser();
  }

  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  decodeAudioData() {
    this.decodeCalls++;
    return Promise.resolve({ duration: this.bufferDuration });
  }

  getOutputTimestamp() {
    return this.outputTimestamp;
  }
}
