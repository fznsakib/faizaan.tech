import { describe, expect, it } from "vitest";

import { directionalCoverage, fullCapture, headBounds } from "./full.ts";
import { sampleRgb } from "./texture.ts";

import type { Vec3 } from "./ray.ts";

interface Mesh {
  positions: number[];
  indices: number[];
  uvs: number[];
}

/**
 * A UV sphere (rows × cols quads), its UVs squeezed into [u0, u1] × [0, 1]; `bump` pushes the surface out along each
 * vertex's direction (for a nose).
 */
function sphere(centre: Vec3, radius: number, rows: number, cols: number, [u0, u1]: [number, number], bump: (direction: Vec3) => number = () => 0): Mesh {
  const mesh: Mesh = { positions: [], indices: [], uvs: [] };
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const theta = (Math.PI * r) / rows, phi = (2 * Math.PI * c) / cols;
      const d: Vec3 = [Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi)];
      const k = radius + bump(d);
      mesh.positions.push(centre[0] + k * d[0], centre[1] + k * d[1], centre[2] + k * d[2]);
      mesh.uvs.push(u0 + ((u1 - u0) * c) / cols, r / rows);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + cols + 1;
      mesh.indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return mesh;
}

/** An open tube along y (the neck), UVs in [u0, u1]. */
function tube(centre: Vec3, radius: number, y0: number, y1: number, cols: number, [u0, u1]: [number, number]): Mesh {
  const mesh: Mesh = { positions: [], indices: [], uvs: [] };
  for (const [row, y] of [y0, y1].entries()) {
    for (let c = 0; c <= cols; c++) {
      const phi = (2 * Math.PI * c) / cols;
      mesh.positions.push(centre[0] + radius * Math.sin(phi), y, centre[2] + radius * Math.cos(phi));
      mesh.uvs.push(u0 + ((u1 - u0) * c) / cols, row);
    }
  }
  for (let c = 0; c < cols; c++) mesh.indices.push(c, c + cols + 1, c + 1, c + 1, c + cols + 1, c + cols + 2);
  return mesh;
}

/** A quad in the z = `z` plane (the room behind the head), UVs in [u0, u1] × [0, 1]. */
function wall(z: number, size: number, [u0, u1]: [number, number]): Mesh {
  return {
    positions: [-size, -size, z, size, -size, z, -size, size, z, size, size, z],
    indices: [0, 1, 2, 2, 1, 3],
    uvs: [u0, 1, u1, 1, u0, 0, u1, 0],
  };
}

function merge(...meshes: Mesh[]) {
  const out: Mesh = { positions: [], indices: [], uvs: [] };
  for (const m of meshes) {
    const base = out.positions.length / 3;
    for (const v of m.positions) out.positions.push(v);
    for (const v of m.uvs) out.uvs.push(v);
    for (const i of m.indices) out.indices.push(i + base);
  }
  return { positions: new Float32Array(out.positions), indices: new Uint32Array(out.indices), uvs: new Float32Array(out.uvs) };
}

// A 64² texture: a red/green gradient over the head's UVs (u < 0.7), pure blue over the wall's (u ≥ 0.8).
const SIZE = 64;
const image = { data: new Uint8Array(SIZE * SIZE * 4), width: SIZE, height: SIZE };
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const u = (x + 0.5) / SIZE;
    image.data.set(u >= 0.75 ? [0, 0, 255, 255] : [Math.round(u * 300), Math.round((y / SIZE) * 200), 40, 255], (y * SIZE + x) * 4);
  }
}

// A head of radius 0.1 (capture units, metres) with a nose, on a neck, above shoulders, in front of a wall.
const nose = (d: Vec3) => 0.02 * Math.exp(-((d[0] ** 2 + (d[1] + 0.1) ** 2) / 0.02)) * (d[2] > 0 ? 1 : 0);
const head = sphere([0, 0.3, 0], 0.1, 160, 160, [0, 0.7], nose); // ~2 mm apart, like a phone scan
const neck = tube([0, 0, 0], 0.045, 0.1, 0.22, 32, [0, 0.7]);
const shoulders = sphere([0, -0.12, -0.05], 0.2, 16, 32, [0, 0.7]);
const capture = merge(head, neck, shoulders, wall(-0.8, 1.5, [0.8, 1]));

// The stock head's landmarks, in its face frame and units.
const target = { nose: [0, 9.13, 9.1] as Vec3, L: 5.2 };

describe("directionalCoverage", () => {
  it("is nearly all directions for a closed head, about half for a front-only capture", () => {
    const closed = merge(head);
    expect(directionalCoverage(closed.positions, closed.indices, [0, 0.3, 0], 0.3)).toBeGreaterThan(0.95);
    const frontOnly = new Uint32Array(filterTriangles(closed, (p) => p[2] > 0));
    expect(directionalCoverage(closed.positions, frontOnly, [0, 0.3, 0], 0.3)).toBeLessThan(0.7);
  });

  it("ignores what lies beyond the radius (the room behind a front-only capture)", () => {
    const half = merge(head);
    const frontOnly = new Uint32Array(filterTriangles(half, (p) => p[2] > 0));
    const withWall = merge({ positions: Array.from(half.positions), indices: Array.from(frontOnly), uvs: Array.from(half.uvs) }, wall(-0.8, 1.5, [0.8, 1]));
    expect(directionalCoverage(withWall.positions, withWall.indices, [0, 0.3, 0], 0.3)).toBeLessThan(0.7);
  });
});

describe("headBounds", () => {
  it("holds a real head with its hair, by the usual proportions in units of L (nose tip to chin)", () => {
    const L = 0.0475;
    const nose: Vec3 = [0, 0.26, 0.1];
    const { centre, radius } = headBounds(nose, L);
    const at = (x: number, y: number, z: number): Vec3 => [nose[0] + x * L, nose[1] + y * L, nose[2] + z * L];
    const inside = (p: Vec3) => Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]) <= radius;
    // nose tip; chin; crown with hair (~2.6 L up, 2 L back, + hair); back of the head with hair (~4.6 L behind the tip + hair);
    // ears and the sides of the hair (~1.7 L out, 2.2 L back); the top of the neck under the chin
    for (const p of [at(0, 0, 0), at(0, -1, -0.4), at(0, 3, -2), at(0, 1, -5.1), at(1.9, 0.4, -2.2), at(-1.9, 0.4, -2.2), at(0, -1.6, -2)]) {
      expect(inside(p)).toBe(true);
    }
  });

  it("leaves out a wall a hand's width behind the hair", () => {
    const L = 0.0475;
    const { centre, radius } = headBounds([0, 0.26, 0.1], L);
    expect(radius).toBeLessThan(Math.hypot(0, 0.26 + L - centre[1], 0.1 - 7.5 * L - centre[2]));
  });
});

describe("fullCapture", async () => {
  const out = await fullCapture({ ...capture, image }, target, { chinDepth: 0.03, neck: 0.9, radius: 2.8, maxTriangles: 20000, maxTexture: 2048 }, () => {});

  it("keeps the head and neck: drops the shoulders and the room", () => {
    let widest = 0;
    for (let i = 0; i < out.positions.length; i += 3) widest = Math.max(widest, Math.abs(out.positions[i]));
    // the head is 0.1 wide each side, the shoulders 0.2: scaled to the stock head, the head alone stays well under twice its radius
    const scale = target.L / out.captureL;
    expect(widest).toBeLessThan(0.1 * scale * 1.3);
    for (let i = 0; i < out.uvs.length; i += 2) expect(out.uvs[i]).toBeLessThan(0.75); // no wall corners
  });

  it("puts the capture's nose tip on the stock head's, at the stock head's scale", () => {
    let front = -Infinity, at: Vec3 = [0, 0, 0];
    for (let i = 0; i < out.positions.length; i += 3) {
      if (out.positions[i + 2] > front) [front, at] = [out.positions[i + 2], [out.positions[i], out.positions[i + 1], out.positions[i + 2]]];
    }
    for (let k = 0; k < 3; k++) expect(at[k]).toBeCloseTo(target.nose[k], 0);
  });

  it("keeps the capture's own UVs and photo under the head, and none of the room's texture", () => {
    const { atlas, atlasSize } = out;
    for (let i = 0; i < out.uvs.length / 2; i += 37) {
      const [u, v] = [out.uvs[i * 2], out.uvs[i * 2 + 1]];
      const kept = sampleRgb(atlas, atlasSize, atlasSize, u, v), source = sampleRgb(image.data, SIZE, SIZE, u, v);
      for (let k = 0; k < 3; k++) expect(Math.abs(kept[k] - source[k])).toBeLessThan(40);
    }
    for (let i = 0; i < atlasSize * atlasSize; i++) {
      const [r, g, b] = atlas.subarray(i * 4, i * 4 + 3);
      expect(b > 200 && r < 30 && g < 30).toBe(false);
    }
  });

  it("simplifies a scan denser than asked, and it's still the head", () => {
    expect(out.indices.length / 3).toBeLessThanOrEqual(20000);
    expect(out.indices.length / 3).toBeGreaterThan(1000);
  });

  it("gives every vertex a unit normal and a hair weight in 0..1", () => {
    for (let i = 0; i < out.normals.length; i += 3) expect(Math.hypot(out.normals[i], out.normals[i + 1], out.normals[i + 2])).toBeCloseTo(1, 3);
    expect(out.hair.every((h) => h >= 0 && h <= 1)).toBe(true);
    expect(out.indices.length % 3).toBe(0);
  });
});

function filterTriangles(mesh: { positions: Float32Array | number[]; indices: Uint32Array | number[] }, keep: (p: Vec3) => boolean) {
  const out: number[] = [];
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const ids = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
    if (ids.every((i) => keep([mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]]))) out.push(ids[0], ids[1], ids[2]);
  }
  return out;
}
