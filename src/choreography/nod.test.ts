import { describe, expect, it } from "vitest";

import { bob, DOWNBEAT_ACCENT, nodDrive, Spring } from "./nod";

/** Frame fields for a map with beat0 = 0 and the given downbeat offset. */
function beatFrame(bpm: number, beat: number, downbeatMod = 0) {
  const beatIndex = Math.floor(beat);
  const relative = beat - downbeatMod;
  const barIndex = Math.floor(Math.floor(relative) / 4);
  return { bpm, beat, beatIndex, barPhase: (relative - barIndex * 4) / 4 };
}

describe("bob", () => {
  it("peaks on the beat and is continuous across the wrap", () => {
    expect(bob(0, 0.5)).toBeCloseTo(1);
    expect(Math.abs(bob(0.9999, 0.5) - bob(0, 0.5))).toBeLessThan(0.01);
  });

  it("lifts (goes negative) before the beat", () => {
    let lowest = Infinity;
    for (let p = 0.6; p < 0.95; p += 0.01) lowest = Math.min(lowest, bob(p, 0.5));
    expect(lowest).toBeLessThan(-0.05);
  });
});

describe("nodDrive", () => {
  it("samples the curve NOD_LEAD early", () => {
    const drive = nodDrive(beatFrame(120, 0.9));
    expect(drive.phase).toBeCloseTo(0);
    expect(drive.period).toBeCloseTo(0.5);
    expect(drive.accent).toBe(1);
  });

  it("accents nods that land on a downbeat", () => {
    expect(nodDrive(beatFrame(120, 3.9)).accent).toBe(DOWNBEAT_ACCENT);
  });

  it("goes half-time above 135 BPM, landing on the downbeat and the third beat", () => {
    const early = nodDrive(beatFrame(150, 3.9, 3));
    expect(early.period).toBeCloseTo(0.8);
    expect(early.phase).toBeCloseTo(0.5125);
    expect(early.accent).toBe(1); // next landing is beat 5 (third beat of the bar)
    expect(nodDrive(beatFrame(150, 6.9, 3)).accent).toBe(DOWNBEAT_ACCENT); // landing on beat 7, a downbeat
  });
});

describe("Spring", () => {
  it("converges on its target", () => {
    const spring = new Spring(900, 45);
    for (let i = 0; i < 240; i++) spring.step(1, 1 / 120);
    expect(spring.value).toBeCloseTo(1, 3);
  });

  it("stays stable with a huge dt (tab hidden for minutes)", () => {
    const spring = new Spring(900, 45);
    const value = spring.step(1, 120);
    expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(value)).toBeLessThan(2);
  });
});

describe("nod landing (bob → spring at 120 fps)", () => {
  function peakOffsetsMs(bpm: number) {
    const fps = 120;
    const spring = new Spring(900, 45);
    const samples: { t: number; value: number }[] = [];
    for (let i = 0; i < 12 * fps; i++) {
      const t = i / fps;
      const drive = nodDrive(beatFrame(bpm, t / (60 / bpm)));
      samples.push({ t, value: spring.step(bob(drive.phase, drive.period), 1 / fps) });
    }
    const period = nodDrive(beatFrame(bpm, 0)).period;
    const offsets: number[] = [];
    for (let landing = period * 4; landing < 11; landing += period) {
      const window = samples.filter((s) => Math.abs(s.t - landing) < period / 2);
      const peak = window.reduce((best, s) => (s.value > best.value ? s : best));
      offsets.push((peak.t - landing) * 1000);
    }
    return offsets.sort((a, b) => a - b);
  }

  for (const bpm of [113.01, 120, 149.98]) {
    it(`peaks within ±12 ms of each landing at ${bpm} BPM`, () => {
      const offsets = peakOffsetsMs(bpm);
      expect(Math.abs(offsets[offsets.length >> 1])).toBeLessThanOrEqual(12);
    });
  }
});
