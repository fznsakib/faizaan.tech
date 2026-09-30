import { useEffect, useMemo, useRef } from "react";

import { LITE } from "./NameHeader.styled";
import { LITE_COUNT } from "./pieces";
import { engine } from "../../audio/engine";
import { useMusicFrame } from "../../audio/react";
import { setStyle } from "../../choreography/dom";
import {
  chromeSweep,
  createSchedule,
  dripPose,
  isRunning,
  layerOpacity,
  matterAt,
  meltAmount,
  requestRun,
  shardPose,
  shatterGlyph,
  sparklePose,
  sweepDelay,
  tickSchedule,
} from "../../choreography/matter";
import { prefersReducedMotion } from "../../hooks/reducedMotion";

import type { MeltFilter } from "./MatterFilters";
import type { LetterPieces, LetterPlan } from "./pieces";
import type { Matter, MatterSample } from "../../choreography/matter";

/** The name's measured layout, filled in by the header's measure. */
export interface NameGeometry {
  /** Each letter's centre x, px. */
  centres: number[];
  /** The name's box, for hover and tap. */
  bounds: { left: number; right: number; top: number; bottom: number } | null;
  /** The header's font size, px. */
  fontSize: number;
  /** The head's x (the viewport's centre), px: kept from resize, since reading `innerWidth` mid-frame forces layout. */
  headX: number;
}

/** How far the molten letters sag from their top at full melt. */
const SAG = 0.06;
/** The melt's displacement at full melt, in font sizes. */
const WARP = 0.06;
const COST_SAMPLES = 600;

const debug = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");
const liteQuery = typeof window !== "undefined" ? window.matchMedia(LITE) : null;

/** `?debug`: the matter painter's per-frame cost (ms), its schedule, and a way to hold a run at one moment. */
export interface MatterProbe {
  costs: number[];
  schedule: ReturnType<typeof createSchedule>;
  /** Seconds into the current run to hold it at (for screenshots), or null to let it play. */
  hold: number | null;
  /** Start a run from the head now, as an ambient run would. */
  run: () => boolean;
}

/** `LetterPieces.shown` slots. */
const GLYPH = 0;
const CHROME = 1;
const MOLTEN = 2;
const SHATTER = 3;
const FROST = 4;

/** Show a layer at `opacity`; nothing is written while it stays the same to a thousandth. */
function show(letter: LetterPieces, slot: number, el: HTMLElement | null, opacity: number) {
  const level = Math.round(opacity * 1000);
  if (!el || letter.shown[slot] === level) return;
  letter.shown[slot] = level;
  setStyle(el, "visibility", level > 0 ? "visible" : "hidden");
  setStyle(el, "opacity", String(level / 1000));
}
const hide = (els: HTMLElement[]) => {
  for (const el of els) setStyle(el, "opacity", "0");
};
/** A state's own t for this sample: its t while it's current, 0 before it, 1 after. */
const tOf = (sample: MatterSample, matter: Matter) =>
  sample.state === matter ? sample.t : sample.next === matter ? 0 : 1;

/**
 * Runs the name through its materials: on hover or tap (after entering) and ambiently every 40–70 s, never while
 * the tab is hidden; reduced motion gets hover/tap only, as a plain cross-fade. Between runs the overlays aren't
 * rendered and the frame callback does nothing but check the schedule.
 */
export function useMatter(
  header: React.RefObject<HTMLElement | null>,
  plans: readonly (LetterPlan | null)[],
  pieces: readonly (LetterPieces | null)[],
  geometry: NameGeometry,
  melt: MeltFilter
): void {
  const schedule = useMemo(() => createSchedule(), []);
  const shown = useRef(false);
  const lastWarp = useRef("");
  const costs = useRef<number[]>([]);
  const hold = useRef<number | null>(null);
  const scratch = useMemo(
    () => ({
      sample: { state: "plain", next: "plain", t: 0, blend: 0 } as MatterSample,
      shard: { x: 0, y: 0, rotate: 0, scale: 0, opacity: 0 },
      drip: { y: 0, stretch: 0, opacity: 0 },
      sparkle: { scale: 0, rotate: 0, opacity: 0 },
    }),
    []
  );

  useEffect(() => {
    if (!debug) return;
    const probe: MatterProbe = {
      costs: costs.current,
      schedule,
      get hold() {
        return hold.current;
      },
      set hold(value) {
        hold.current = value;
      },
      run: () => requestRun(schedule, performance.now() / 1000, geometry.headX),
    };
    (window as Window & { __name?: MatterProbe }).__name = probe;
  }, [geometry, schedule]);

  useEffect(() => {
    let inside = false;
    const hit = (x: number, y: number) => {
      const box = geometry.bounds;
      return box !== null && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    };
    const trigger = (event: PointerEvent) => {
      if (engine.getSnapshot().unlocked) requestRun(schedule, event.timeStamp / 1000, event.clientX);
    };
    // Hover: entering the name starts a run (a touch's move is a drag, not a hover).
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const over = hit(event.clientX, event.clientY);
      if (over && !inside) trigger(event);
      inside = over;
    };
    const down = (event: PointerEvent) => {
      if (hit(event.clientX, event.clientY)) trigger(event);
    };
    const out = (event: PointerEvent) => {
      if (!event.relatedTarget) inside = false;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerout", out);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerout", out);
    };
  }, [geometry, schedule]);

  const paint = (seconds: number | null, reduced: boolean) => {
    const run = seconds === null ? null : schedule.run;
    const lite = liteQuery?.matches ?? false;
    const { sample, shard: shardOut, drip: dripOut, sparkle: sparkleOut } = scratch;
    let meltPeak = 0;
    for (let i = 0; i < pieces.length; i++) {
      const letter = pieces[i];
      const plan = plans[i];
      if (!letter || !plan) continue;
      const centre = geometry.centres[i] ?? geometry.headX;
      const delay = run && !reduced ? sweepDelay(centre, run.origin) : 0;
      matterAt(run, (seconds ?? 0) - delay, sample);
      const { state, t } = sample;

      show(letter, GLYPH, letter.glyph, layerOpacity(sample, "plain"));

      const chrome = layerOpacity(sample, "chrome");
      show(letter, CHROME, letter.chrome, chrome);
      if (chrome > 0 && letter.chrome) {
        const sweep = reduced ? 50 : chromeSweep(tOf(sample, "chrome"));
        setStyle(letter.chrome, "backgroundPosition", `${sweep.toFixed(1)}% 0%, 0% 0%`);
      }

      const molten = layerOpacity(sample, "molten");
      show(letter, MOLTEN, letter.molten, molten);
      const melted = molten > 0 && !reduced ? meltAmount(tOf(sample, "molten")) : 0;
      meltPeak = Math.max(meltPeak, melted);
      if (letter.molten) setStyle(letter.molten, "transform", melted > 0 ? `scaleY(${(1 + SAG * melted).toFixed(3)})` : "none");

      const shattering = state === "shatter" && !reduced;
      show(letter, SHATTER, letter.shatter, layerOpacity(sample, "shatter") * (shattering ? shatterGlyph(t) : 1));

      show(letter, FROST, letter.frost, layerOpacity(sample, "frost"));

      if (state === "molten" && !reduced) {
        const count = lite ? LITE_COUNT.drips : plan.drips.length;
        for (let j = 0; j < count; j++) {
          const el = letter.drips[j];
          if (!el) continue;
          dripPose(plan.drips[j], t, dripOut);
          setStyle(el, "transform", `translateY(${dripOut.y.toFixed(3)}em) scaleY(${dripOut.stretch.toFixed(3)})`);
          setStyle(el, "opacity", dripOut.opacity.toFixed(3));
        }
        letter.moving.drips = true;
      } else if (letter.moving.drips) {
        hide(letter.drips);
        letter.moving.drips = false;
      }

      if (shattering) {
        const side = centre >= (run?.origin ?? centre) ? 1 : -1;
        const count = lite ? LITE_COUNT.shards : plan.shards.length;
        for (let j = 0; j < count; j++) {
          const el = letter.shards[j];
          if (!el) continue;
          shardPose(plan.shards[j], t, side, shardOut);
          setStyle(
            el,
            "transform",
            `translate(${shardOut.x.toFixed(3)}em, ${shardOut.y.toFixed(3)}em) rotate(${shardOut.rotate.toFixed(1)}deg) scale(${shardOut.scale.toFixed(3)})`
          );
          setStyle(el, "opacity", shardOut.opacity.toFixed(3));
        }
        letter.moving.shards = true;
      } else if (letter.moving.shards) {
        hide(letter.shards);
        letter.moving.shards = false;
      }

      if (state === "frost" && !reduced) {
        const count = lite ? LITE_COUNT.sparkles : plan.sparkles.length;
        for (let j = 0; j < count; j++) {
          const el = letter.sparkles[j];
          if (!el) continue;
          sparklePose(plan.sparkles[j], t, sparkleOut);
          setStyle(el, "transform", `rotate(${(45 + sparkleOut.rotate).toFixed(1)}deg) scale(${sparkleOut.scale.toFixed(3)})`);
          setStyle(el, "opacity", sparkleOut.opacity.toFixed(3));
        }
        letter.moving.sparkles = true;
      } else if (letter.moving.sparkles) {
        hide(letter.sparkles);
        letter.moving.sparkles = false;
      }
    }

    // One melt filter for the whole name: its warp follows the most melted letter.
    const warp = (meltPeak * WARP * geometry.fontSize).toFixed(1);
    if (melt.warp && warp !== lastWarp.current) {
      lastWarp.current = warp;
      melt.warp.setAttribute("scale", warp);
    }
  };

  useMusicFrame((_, now) => {
    const started = debug ? performance.now() : 0;
    const reduced = prefersReducedMotion();
    let seconds = now / 1000;
    const ambient = engine.getSnapshot().unlocked && document.visibilityState === "visible" && !reduced;
    tickSchedule(schedule, seconds, ambient, geometry.headX);
    if (debug && hold.current !== null && schedule.run) seconds = schedule.run.start + hold.current;
    const running = isRunning(schedule, seconds) || (debug && hold.current !== null && schedule.run !== null);
    if (running || shown.current) {
      if (running !== shown.current) {
        shown.current = running;
        header.current?.toggleAttribute("data-running", running);
      }
      paint(running ? seconds : null, reduced);
    }
    if (debug) {
      costs.current.push(performance.now() - started);
      if (costs.current.length > COST_SAMPLES) costs.current.shift();
    }
  });
}
