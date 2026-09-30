import { describe, expect, it } from "vitest";

import { BLEND, layerOpacity, MATTERS, matterAt, RUN_LENGTH, STAGES } from "./matter";

import type { Matter, MatterRun, MatterSample } from "./matter";

const run: MatterRun = { start: 10, origin: 0 };
/** When stage `index` of the run begins, s. */
const stageStart = (index: number) => run.start + STAGES.slice(0, index).reduce((sum, stage) => sum + stage.duration, 0);
const stageEnd = (index: number) => stageStart(index) + STAGES[index].duration;

/** How much of the glyph each layer shows once the stack is composited (upper layers cover lower ones). */
function contributions(sample: MatterSample): Record<Matter, number> {
  const out = {} as Record<Matter, number>;
  let covered = 0;
  for (let i = MATTERS.length - 1; i >= 0; i--) {
    const opacity = layerOpacity(sample, MATTERS[i]);
    out[MATTERS[i]] = opacity * (1 - covered);
    covered += out[MATTERS[i]];
  }
  return out;
}

describe("matter timeline", () => {
  it("runs plain → chrome → molten → shatter → frost, then back to plain", () => {
    expect(STAGES.map((stage) => stage.matter)).toEqual(["plain", "chrome", "molten", "shatter", "frost"]);
    const states = STAGES.map((_, i) => matterAt(run, (stageStart(i) + stageEnd(i)) / 2).state);
    expect(states).toEqual(["plain", "chrome", "molten", "shatter", "frost"]);
    expect(matterAt(run, stageEnd(STAGES.length - 1) - 1e-6).next).toBe("plain");
  });

  it("holds each material for 0.9–1.6 s, after a lead-in no longer than one blend", () => {
    const [leadIn, ...materials] = STAGES;
    expect(leadIn.duration).toBeLessThanOrEqual(BLEND);
    for (const stage of materials) {
      expect(stage.duration).toBeGreaterThanOrEqual(0.9);
      expect(stage.duration).toBeLessThanOrEqual(1.6);
    }
    expect(RUN_LENGTH).toBeCloseTo(STAGES.reduce((sum, stage) => sum + stage.duration, 0), 9);
  });

  it("is plain and still before the run reaches a letter, after it ends, and with no run", () => {
    for (const sample of [matterAt(run, run.start - 0.5), matterAt(run, run.start + RUN_LENGTH), matterAt(null, 3)]) {
      expect(sample).toMatchObject({ state: "plain", next: "plain", blend: 0 });
    }
  });

  it("runs t from 0 to 1 within each state", () => {
    STAGES.forEach((_, i) => {
      const opening = matterAt(run, stageStart(i) + 1e-9); // just past the boundary: float sums land either side of it
      expect(opening.state).toBe(STAGES[i].matter);
      expect(opening.t).toBeCloseTo(0, 6);
      expect(matterAt(run, stageStart(i) + STAGES[i].duration / 4).t).toBeCloseTo(0.25, 6);
      expect(matterAt(run, stageEnd(i) - 1e-6).t).toBeCloseTo(1, 4);
    });
  });

  it("blends toward the next state over each state's last BLEND seconds", () => {
    STAGES.forEach((stage, i) => {
      const length = Math.min(BLEND, stage.duration);
      const blendFrom = stageEnd(i) - length;
      if (length < stage.duration) expect(matterAt(run, blendFrom - 1e-3).blend).toBe(0);
      expect(matterAt(run, blendFrom).blend).toBeCloseTo(0, 6);
      const middle = matterAt(run, blendFrom + length / 2).blend;
      expect(middle).toBeGreaterThan(0.2);
      expect(middle).toBeLessThan(0.8);
      expect(matterAt(run, stageEnd(i) - 1e-6).blend).toBeCloseTo(1, 4);
    });
    expect(matterAt(run, stageStart(1) + 0.3).blend).toBe(0); // mid-chrome: no blend yet
  });

  it("writes into the object it is given, so the per-letter loop allocates nothing", () => {
    const out: MatterSample = { state: "plain", next: "plain", t: 0, blend: 0 };
    expect(matterAt(run, stageStart(2) + 0.1, out)).toBe(out);
    expect(out.state).toBe("molten");
  });
});

describe("matter layers", () => {
  it("shows only the current state's layer outside a blend", () => {
    const sample = matterAt(run, stageStart(2) + 0.2); // molten, before its blend
    for (const matter of MATTERS) expect(layerOpacity(sample, matter)).toBe(matter === "molten" ? 1 : 0);
  });

  it("fades the upper layer of a blend over the lower one, which stays opaque", () => {
    const intoMolten = matterAt(run, stageEnd(1) - BLEND / 2); // chrome (below) → molten (above)
    expect(layerOpacity(intoMolten, "chrome")).toBe(1);
    expect(layerOpacity(intoMolten, "molten")).toBeCloseTo(intoMolten.blend, 9);
    const backToPlain = matterAt(run, stageEnd(4) - BLEND / 2); // frost (above) → plain (below)
    expect(layerOpacity(backToPlain, "frost")).toBeCloseTo(1 - backToPlain.blend, 9);
    expect(layerOpacity(backToPlain, "plain")).toBe(1);
  });

  it("always covers the whole glyph, and changes continuously through the run", () => {
    const step = 1 / 1000;
    let previous = contributions(matterAt(run, run.start - step));
    for (let now = run.start - step; now <= run.start + RUN_LENGTH + step; now += step) {
      const current = contributions(matterAt(run, now));
      expect(MATTERS.reduce((sum, matter) => sum + current[matter], 0)).toBeCloseTo(1, 9);
      for (const matter of MATTERS) expect(Math.abs(current[matter] - previous[matter])).toBeLessThan(0.02);
      previous = current;
    }
  });
});
