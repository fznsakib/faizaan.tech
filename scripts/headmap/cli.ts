import { relative, resolve } from "node:path";

import type { Vec3 } from "./ray.ts";

export type FlagKind = "number" | "count" | "pair" | "vec3" | "path" | "switch";

/** Parses `<capture> --flag value …` (a switch takes no value) against a spec, throwing an error that names the offending flag. */
export function parseFlags<Name extends string>(argv: string[], spec: Record<Name, FlagKind>) {
  const [capture, ...rest] = argv;
  if (!capture || capture.startsWith("--")) throw new Error("missing the capture: yarn headmap <capture.glb> [flags]");
  const values = new Map<string, string | number | number[]>();
  const switches = new Set<string>();
  for (let i = 0; i < rest.length; ) {
    const flag = rest[i];
    const name = flag.startsWith("--") ? flag.slice(2) : "";
    const kind = (spec as Record<string, FlagKind | undefined>)[name];
    if (!kind) throw new Error(`unknown flag ${flag}`);
    if (kind === "switch") {
      switches.add(name);
      i += 1;
      continue;
    }
    const raw = rest[i + 1];
    if (raw === undefined || raw.startsWith("--")) throw new Error(`${flag} needs a value`);
    values.set(name, parseValue(flag, kind, raw));
    i += 2;
  }
  return {
    capture,
    string: (name: Name) => values.get(name) as string | undefined,
    number: (name: Name) => values.get(name) as number | undefined,
    pair: (name: Name) => values.get(name) as [number, number] | undefined,
    vec: (name: Name) => values.get(name) as Vec3 | undefined,
    on: (name: Name) => switches.has(name),
  };
}

function parseValue(flag: string, kind: FlagKind, raw: string) {
  if (kind === "path") return raw;
  const numbers = raw.split(",").map((part) => (part.trim() === "" ? NaN : Number(part)));
  const length = kind === "pair" ? 2 : kind === "vec3" ? 3 : 1;
  if (numbers.length !== length || !numbers.every(Number.isFinite)) {
    throw new Error(`${flag} needs ${length === 1 ? "a number" : `${length} comma-separated numbers`}, got "${raw}"`);
  }
  if (kind === "count" && (!Number.isInteger(numbers[0]) || numbers[0] < 0)) {
    throw new Error(`${flag} needs a whole number ≥ 0, got "${raw}"`);
  }
  return length === 1 ? numbers[0] : numbers;
}

/** Whether `path` is `dir` or somewhere under it. */
export function isInside(path: string, dir: string) {
  const rel = relative(resolve(dir), resolve(path));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
}
