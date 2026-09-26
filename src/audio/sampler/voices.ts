import type { Voice } from "../types";

/** One second of deterministic white noise (snare and hat source). */
export function createNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    data[i] = seed / 1073741824 - 1;
  }
  return buffer;
}

function decay(ctx: BaseAudioContext, destination: AudioNode, peak: number, when: number, tail: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + tail);
  gain.connect(destination);
  return gain;
}

function noiseBurst(ctx: BaseAudioContext, noise: AudioBuffer, when: number, tail: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  source.start(when);
  source.stop(when + tail);
  return source;
}

/** Schedule one synthesized voice at context time `when` into `destination`. */
export function playVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  voice: Voice,
  when: number,
  noise: AudioBuffer
): void {
  switch (voice) {
    case "kick": {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(45, when + 0.12);
      osc.connect(decay(ctx, destination, 0.9, when, 0.35));
      osc.start(when);
      osc.stop(when + 0.35);
      return;
    }
    case "snare": {
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1200, when);
      noiseBurst(ctx, noise, when, 0.18).connect(filter);
      filter.connect(decay(ctx, destination, 0.6, when, 0.18));
      const body = ctx.createOscillator();
      body.type = "triangle";
      body.frequency.setValueAtTime(190, when);
      body.connect(decay(ctx, destination, 0.3, when, 0.1));
      body.start(when);
      body.stop(when + 0.1);
      return;
    }
    case "hat": {
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(7000, when);
      noiseBurst(ctx, noise, when, 0.05).connect(filter);
      filter.connect(decay(ctx, destination, 0.35, when, 0.05));
      return;
    }
    case "stab": {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1800, when);
      filter.Q.setValueAtTime(4, when);
      filter.connect(decay(ctx, destination, 0.25, when, 0.45));
      for (const frequency of [220, 261.63, 329.63]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(frequency, when);
        osc.connect(filter);
        osc.start(when);
        osc.stop(when + 0.45);
      }
      return;
    }
  }
}
