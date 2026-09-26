import { describe, expect, it } from "vitest";

import { createNoiseBuffer, playVoice } from "./voices";
import { FakeAudioContext, FakeNode } from "../testing/fakeAudio";

import type { Voice } from "../types";

function setup() {
  const ctx = new FakeAudioContext();
  const destination = new FakeNode();
  const audio = ctx as unknown as BaseAudioContext;
  const noise = createNoiseBuffer(audio);
  const play = (voice: Voice, when: number) =>
    playVoice(audio, destination as unknown as AudioNode, voice, when, noise);
  return { ctx, destination, noise, play };
}

describe("voices", () => {
  it("kick is a sine sweeping 150 → 45 Hz over its 0.35 s tail", () => {
    const { ctx, play } = setup();
    play("kick", 2);
    const [osc] = ctx.oscillators;
    expect(osc.type).toBe("sine");
    expect(osc.startAt).toBe(2);
    expect(osc.stopAt).toBeCloseTo(2.35);
    expect(osc.frequency.events[0]).toEqual({ type: "set", value: 150, time: 2 });
    expect(osc.frequency.events[1].type).toBe("exp");
    expect(osc.frequency.events[1].value).toBe(45);
    expect(osc.frequency.events[1].time).toBeCloseTo(2.12);
  });

  it("every voice starts at `when` and ends by its tail", () => {
    for (const [voice, tail] of [["kick", 0.35], ["snare", 0.18], ["hat", 0.05], ["stab", 0.45]] as const) {
      const { ctx, play } = setup();
      play(voice, 5);
      const started = [...ctx.oscillators.map((o) => o.startAt), ...ctx.sources.map((s) => s.started?.when)];
      const stopped = [...ctx.oscillators.map((o) => o.stopAt), ...ctx.sources.map((s) => s.stopAt)];
      expect(started.length).toBeGreaterThan(0);
      started.forEach((t) => expect(t).toBe(5));
      stopped.forEach((t) => expect(t!).toBeLessThanOrEqual(5 + tail + 1e-9));
    }
  });

  it("filters noise for snare and hat, and runs the stab chord through a lowpass", () => {
    const snare = setup();
    snare.play("snare", 1);
    expect(snare.ctx.filters[0].type).toBe("highpass");
    expect(snare.ctx.filters[0].frequency.value).toBe(1200);
    const stab = setup();
    stab.play("stab", 1);
    expect(stab.ctx.oscillators.map((o) => o.frequency.value)).toEqual([220, 261.63, 329.63]);
    expect(stab.ctx.filters[0].type).toBe("lowpass");
  });

  it("routes into the destination", () => {
    const { ctx, destination, play } = setup();
    play("hat", 1);
    expect(ctx.gains.some((g) => g.connections.includes(destination))).toBe(true);
  });

  it("makes one second of deterministic noise in [-1, 1]", () => {
    const { noise } = setup();
    const data = noise.getChannelData(0);
    expect(data.length).toBe(44100);
    expect(Math.max(...data.slice(0, 1000))).toBeLessThanOrEqual(1);
    expect(Math.min(...data.slice(0, 1000))).toBeGreaterThanOrEqual(-1);
    expect(createNoiseBuffer(new FakeAudioContext() as unknown as BaseAudioContext).getChannelData(0)[10]).toBe(data[10]);
  });
  it("does not fall into a short cycle (32-bit LCG, no precision loss)", () => {
    const data = setup().noise.getChannelData(0);
    expect(Array.from(data.slice(17090, 17154))).not.toEqual(Array.from(data.slice(6624, 6688)));
  });
});
