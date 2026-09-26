const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
const SAMPLES = 600;

/** `?debug` only: the player's summed per-frame JS cost (ms) over its frame callbacks, as `window.__player`. */
const probe = { costs: [] as number[], frame: -1, sum: 0 };
if (debug) (window as unknown as { __player: typeof probe }).__player = probe;

/** Start timing a frame callback; pass the result to `endCost`. Free when not debugging. */
export const startCost = (): number => (debug ? performance.now() : 0);

export function endCost(nowMs: number, started: number): void {
  if (!debug) return;
  const spent = performance.now() - started;
  if (nowMs !== probe.frame) {
    if (probe.frame >= 0) probe.costs.push(probe.sum);
    if (probe.costs.length > SAMPLES) probe.costs.shift();
    probe.frame = nowMs;
    probe.sum = 0;
  }
  probe.sum += spent;
}
