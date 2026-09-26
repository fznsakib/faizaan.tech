import { describe, expect, it } from "vitest";

import { estimateVisualLead } from "./ticker";

describe("estimateVisualLead", () => {
  it("uses the median frame interval", () => {
    expect(estimateVisualLead([8.3, 8.4, 8.3, 50, 8.3])).toBeCloseTo(0.0083);
  });

  it("clamps to 30–240 Hz displays", () => {
    expect(estimateVisualLead([1])).toBeCloseTo(1 / 240);
    expect(estimateVisualLead([500])).toBeCloseTo(1 / 30);
  });

  it("defaults to 60 Hz without samples", () => {
    expect(estimateVisualLead([])).toBeCloseTo(1 / 60);
  });
});
