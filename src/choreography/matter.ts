/** What the name's letters are made of. Also their stacking order, bottom to top. */
export type Matter = "plain" | "chrome" | "molten" | "shatter" | "frost";
export const MATTERS: readonly Matter[] = ["plain", "chrome", "molten", "shatter", "frost"];

export interface Stage {
  matter: Matter;
  /** Seconds, including the blend into the next stage at its end. */
  duration: number;
}

/** Seconds each stage cross-fades into the next, at the end of the stage. */
export const BLEND = 0.35;

/** One run, per letter: a lead-in from plain, the four materials, and back to plain as the last one fades. */
export const STAGES: readonly Stage[] = [
  { matter: "plain", duration: BLEND },
  { matter: "chrome", duration: 1.4 },
  { matter: "molten", duration: 1.6 },
  { matter: "shatter", duration: 1.2 },
  { matter: "frost", duration: 1.5 },
];

/** Seconds from a letter's first change to its return to plain. */
export const RUN_LENGTH = STAGES.reduce((sum, stage) => sum + stage.duration, 0);

export interface MatterRun {
  /** When the run left its origin, s. */
  start: number;
  /** Where it left from: the pointer's or the head's x, px. */
  origin: number;
}

export interface MatterSample {
  state: Matter;
  /** What the state is blending into; `plain` after the last material. */
  next: Matter;
  /** 0..1 through the state. */
  t: number;
  /** 0..1 blended into `next`. */
  blend: number;
}

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** What a letter is made of at `now` (already delayed by the letter's sweep), written into `out` if given. */
export function matterAt(
  run: MatterRun | null,
  now: number,
  out: MatterSample = { state: "plain", next: "plain", t: 0, blend: 0 }
): MatterSample {
  let elapsed = run ? now - run.start : -1;
  if (elapsed >= 0) {
    for (let i = 0; i < STAGES.length; i++) {
      const { matter, duration } = STAGES[i];
      if (elapsed < duration) {
        const length = Math.min(BLEND, duration);
        out.state = matter;
        out.next = STAGES[i + 1]?.matter ?? "plain";
        out.t = elapsed / duration;
        out.blend = smoothstep((elapsed - (duration - length)) / length);
        return out;
      }
      elapsed -= duration;
    }
  }
  out.state = "plain";
  out.next = "plain";
  out.t = 0;
  out.blend = 0;
  return out;
}

/**
 * A layer's opacity for this sample. In a blend the upper of the two layers fades over the lower one, which stays
 * opaque, so the glyph is always fully covered (a plain cross-fade dims mid-way).
 */
export function layerOpacity(sample: MatterSample, matter: Matter): number {
  const { state, next, blend } = sample;
  if (blend === 0 || state === next) return matter === state ? 1 : 0;
  if (matter !== state && matter !== next) return 0;
  const weight = matter === state ? 1 - blend : blend;
  const other = matter === state ? next : state;
  const upper = MATTERS.indexOf(matter) > MATTERS.indexOf(other);
  return upper ? weight : weight > 0 ? 1 : 0;
}
