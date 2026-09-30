import { useSyncExternalStore } from "react";

import { prefersReducedMotion } from "./reducedMotion";
import { cycleHour, daylight, daylightParams, localHour, paletteVars } from "../choreography/daylight";

import type { Daylight } from "../choreography/daylight";

const MINUTE_MS = 60_000;
/** `?daycycle` re-evaluates this often: 2.4 simulated minutes a tick, smooth enough to read as continuous. */
const CYCLE_TICK_MS = 100;
const COST_SAMPLES = 600;
/** `?debug` exposes `window.__daylight`: the current state and each update's main-thread cost (ms), React's render of it included. */
const DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

const listeners = new Set<() => void>();
const written = new Map<string, string>();
const costs: number[] = [];
let current: Daylight | null = null;
let started = false;

/** Make `day` the current state: write the palette's `--day-*` properties on `:root` (changed ones only), then tell subscribers. */
function publish(day: Daylight): void {
  const t0 = DEBUG ? performance.now() : 0;
  current = day;
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(paletteVars(day.palette))) {
    if (written.get(name) === value) continue;
    written.set(name, value);
    root.setProperty(name, value);
  }
  listeners.forEach((listener) => listener());
  if (DEBUG) {
    // React flushes the store's re-renders in a microtask queued by the listeners above, so this one runs after it.
    queueMicrotask(() => {
      costs.push(performance.now() - t0);
      if (costs.length > COST_SAMPLES) costs.shift();
    });
    (window as unknown as { __daylight: { day: Daylight; costs: number[] } }).__daylight = { day, costs };
  }
}

/**
 * Start the page's daylight clock (idempotent): call before React renders, so the palette is on `:root` before the
 * first paint. The visitor's local time, re-evaluated at each minute and on returning to the tab; `?hour=18.5`
 * pins a time; `?daycycle` sweeps the day in a minute (from `?hour`, or now), except under reduced motion.
 */
export function startDaylight(): void {
  if (started) return;
  started = true;
  const { hour, cycle } = daylightParams(window.location.search, prefersReducedMotion());

  if (cycle) {
    const from = hour ?? localHour(new Date());
    const t0 = performance.now();
    const tick = () =>
      publish(daylight(new Date(), prefersReducedMotion() ? null : cycleHour(from, performance.now() - t0)));
    tick();
    window.setInterval(tick, CYCLE_TICK_MS);
    return;
  }

  if (hour !== null) {
    publish(daylight(new Date(), hour));
    return;
  }

  let timer = 0;
  const tick = () => {
    publish(daylight(new Date()));
    window.clearTimeout(timer);
    timer = window.setTimeout(tick, MINUTE_MS - (Date.now() % MINUTE_MS));
  };
  tick();
  // Background tabs throttle timers: catch up at once on coming back
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tick();
  });
}

function subscribe(listener: () => void): () => void {
  startDaylight();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Daylight {
  if (!current) startDaylight();
  return current!;
}

/** The page's current daylight. Re-renders when it changes: about once a minute (each tick under `?daycycle`). */
export function useDaylight(): Daylight {
  return useSyncExternalStore(subscribe, getSnapshot);
}
