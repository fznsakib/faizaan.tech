import { describe, expect, it } from "vitest";

import {
  clearFrame,
  createCursors,
  createFrame,
  onsetEnvelope,
  sampleCurve,
  writeFrame,
} from "./frame";

import type { BeatMap } from "./types";

// 120 BPM → 0.5 s beats; beat 0 at 0.5 s; bar 0 starts on beat 1 (t = 1.0 s); bars last 2 s.
const map: BeatMap = {
  id: "test",
  version: 1,
  duration: 20,
  bpm: 120,
  beat0: 0.5,
  beatsPerBar: 4,
  downbeatMod: 1,
  confidence: 1,
  curveFps: 10,
  energy: [0, 255, 0],
  section: [0, 255],
  barLevels: [0, 1, 1, 0],
  onsets: { kick: [1.0, 0.8, 1.5, 0.5], snare: [], hat: [] },
};

function frameAt(times: number[], playing = true) {
  const frame = createFrame();
  const cursors = createCursors();
  for (const t of times) writeFrame(frame, map, t, playing, cursors);
  return frame;
}

describe("writeFrame beat and bar position", () => {
  it("places beat 0 at beat0 as the last beat of bar -1", () => {
    const f = frameAt([0.5]);
    expect(f.beat).toBeCloseTo(0);
    expect(f.beatIndex).toBe(0);
    expect(f.beatPhase).toBeCloseTo(0);
    expect(f.barIndex).toBe(-1);
    expect(f.barPhase).toBeCloseTo(0.75);
  });

  it("starts bar 0 on the downbeat", () => {
    const f = frameAt([1.0]);
    expect(f.beatIndex).toBe(1);
    expect(f.barIndex).toBe(0);
    expect(f.barPhase).toBeCloseTo(0);
  });

  it("reports phases and time to the next beat mid-beat", () => {
    const f = frameAt([1.25]);
    expect(f.time).toBe(1.25);
    expect(f.bpm).toBe(120);
    expect(f.beatPhase).toBeCloseTo(0.5);
    expect(f.barPhase).toBeCloseTo(0.125);
    expect(f.timeToNextBeat).toBeCloseTo(0.25);
  });

  it("is negative before beat0", () => {
    const f = frameAt([0.25]);
    expect(f.beat).toBeCloseTo(-0.5);
    expect(f.beatIndex).toBe(-1);
  });
});

describe("writeFrame edges", () => {
  it("does not report an edge on the first frame", () => {
    expect(frameAt([1.01]).beatCrossed).toBe(false);
  });

  it("reports beatCrossed and isDownbeat only on the crossing frame", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 0.9, true, cursors);
    writeFrame(frame, map, 1.01, true, cursors);
    expect(frame.beatCrossed).toBe(true);
    expect(frame.isDownbeat).toBe(true);
    writeFrame(frame, map, 1.02, true, cursors);
    expect(frame.beatCrossed).toBe(false);
    expect(frame.isDownbeat).toBe(false);
    writeFrame(frame, map, 1.51, true, cursors);
    expect(frame.beatCrossed).toBe(true);
    expect(frame.isDownbeat).toBe(false);
  });

  it("reports a single edge after a long forward jump", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 1.1, true, cursors);
    writeFrame(frame, map, 13.2, true, cursors);
    expect(frame.beatCrossed).toBe(true);
    expect(frame.kick).toBeCloseTo(0);
    writeFrame(frame, map, 13.21, true, cursors);
    expect(frame.beatCrossed).toBe(false);
  });

  it("reports no edges while paused", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 0.9, false, cursors);
    writeFrame(frame, map, 1.01, false, cursors);
    expect(frame.beatCrossed).toBe(false);
    expect(frame.isPlaying).toBe(false);
  });
});

describe("section levels", () => {
  it("reads sectionLevel from barLevels and flags the changing downbeat", () => {
    const frame = createFrame();
    const cursors = createCursors();
    writeFrame(frame, map, 2.99, true, cursors);
    expect(frame.sectionLevel).toBe(0);
    writeFrame(frame, map, 3.01, true, cursors);
    expect(frame.isDownbeat).toBe(true);
    expect(frame.sectionLevel).toBe(1);
    expect(frame.sectionChanged).toBe(true);
    writeFrame(frame, map, 4.99, true, cursors);
    writeFrame(frame, map, 5.01, true, cursors);
    expect(frame.isDownbeat).toBe(true);
    expect(frame.sectionChanged).toBe(false);
  });

  it("is 0 before bar 0 and clamps past the last bar", () => {
    expect(frameAt([0.6]).sectionLevel).toBe(0);
    expect(frameAt([19]).sectionLevel).toBe(0);
  });
});

describe("onset envelopes", () => {
  it("attacks instantly and decays exponentially", () => {
    expect(frameAt([0.99]).kick).toBe(0);
    expect(frameAt([1.0]).kick).toBeCloseTo(0.8);
    expect(frameAt([1.18]).kick).toBeCloseTo(0.8 * Math.exp(-1));
    expect(frameAt([1.5]).kick).toBeCloseTo(0.5);
  });

  it("rewinds when time goes backwards", () => {
    const cursors = createCursors();
    const events = map.onsets.kick;
    onsetEnvelope(events, 1.6, cursors, "kick");
    expect(onsetEnvelope(events, 0.9, cursors, "kick")).toBe(0);
    expect(onsetEnvelope(events, 1.0, cursors, "kick")).toBeCloseTo(0.8);
  });

  it("is silent while paused", () => {
    const f = frameAt([1.0], false);
    expect(f.kick).toBe(0);
    expect(f.beatConfidence).toBe(0);
  });
});

describe("curves and clearing", () => {
  it("interpolates 0..255 curves to 0..1", () => {
    expect(sampleCurve([0, 255, 0], 10, 0.05)).toBeCloseTo(0.5);
    expect(sampleCurve([0, 255, 0], 10, 0.1)).toBeCloseTo(1);
    expect(sampleCurve([0, 255, 0], 10, 99)).toBe(0);
    expect(sampleCurve([], 10, 1)).toBe(0);
  });

  it("writes energy, section and confidence from the map", () => {
    const f = frameAt([0.05]);
    expect(f.energy).toBeCloseTo(0.5);
    expect(f.section).toBeCloseTo(0.5);
    expect(frameAt([1.0]).beatConfidence).toBe(1);
  });

  it("clearFrame zeroes musical fields but keeps time and playing", () => {
    const f = frameAt([1.0]);
    clearFrame(f, 3, true);
    expect(f.time).toBe(3);
    expect(f.isPlaying).toBe(true);
    expect(f.bpm).toBe(0);
    expect(f.kick).toBe(0);
    expect(f.beatConfidence).toBe(0);
  });
});
