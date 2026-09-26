import { describe, expect, it } from "vitest";

import { forgetStyles, setStyle } from "./dom";

function recordingElement() {
  const writes: string[] = [];
  const style = new Proxy({} as Record<string, string>, {
    set(target, prop, value) {
      writes.push(`${String(prop)}=${value}`);
      target[String(prop)] = value;
      return true;
    },
  });
  return { el: { style } as unknown as HTMLElement, writes };
}

describe("setStyle", () => {
  it("writes a style only when its value changes", () => {
    const { el, writes } = recordingElement();
    setStyle(el, "transform", "a");
    setStyle(el, "transform", "a");
    setStyle(el, "transform", "b");
    setStyle(el, "opacity", "1");
    expect(writes).toEqual(["transform=a", "transform=b", "opacity=1"]);
  });

  it("writes again after forgetStyles", () => {
    const { el, writes } = recordingElement();
    setStyle(el, "fontSize", "1em");
    forgetStyles(el);
    setStyle(el, "fontSize", "1em");
    expect(writes).toEqual(["fontSize=1em", "fontSize=1em"]);
  });
});
