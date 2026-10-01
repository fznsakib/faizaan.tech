import { fileURLToPath } from "node:url";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { Box3, Euler, Matrix4, Object3D, PerspectiveCamera, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { COPPER_FIT, fitCamera, SKIN_FIT, TAN_HALF_FOV } from "./fit";
import { COPPER_SILHOUETTE, headOutline, restPose, SKIN_SILHOUETTE } from "./headShape";

import type { HeadPose, HeadSilhouette } from "./headShape";

const D = Math.PI / 180;

/** A head mesh's vertices as the rig's prepareModel places them: relative to the nod pivot, plus the rig's rest height. */
async function loadHead(file: string): Promise<{ points: Vector3[]; baseY: number }> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(fileURLToPath(new URL(`../assets/${file}`, import.meta.url)));
  const head = new Object3D();
  head.rotation.set(Math.PI / 2, Math.PI, 0);
  head.scale.setScalar(0.25);
  head.updateMatrix();
  const points: Vector3[] = [];
  const element: number[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const matrix = new Matrix4().fromArray(node.getWorldMatrix()).premultiply(head.matrix);
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position) continue;
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, element);
        points.push(new Vector3(element[0], element[1], element[2]).applyMatrix4(matrix));
      }
    }
  }
  const box = new Box3().setFromPoints(points);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const pivot = new Vector3(centre.x, box.min.y + size.y * 0.22, centre.z - size.z * 0.1);
  return { points: points.map((point) => point.sub(pivot)), baseY: pivot.y - centre.y - 0.1 };
}

/** The mesh's screen positions (CSS px) through r3f's camera: 75° vertical fov, never re-aimed after the start. */
function project(points: readonly Vector3[], pose: HeadPose, width: number, height: number) {
  const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(0, pose.cameraY, pose.cameraZ);
  camera.updateMatrixWorld(true);
  const rig = new Matrix4().makeRotationFromEuler(new Euler(pose.pitch, pose.yaw, pose.roll, "XYZ")).setPosition(0, pose.y, 0);
  const v = new Vector3();
  return points.map((point) => {
    v.copy(point).applyMatrix4(rig).project(camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  });
}

/** The silhouette's left and right edge per 2 px row, from the projected vertices (the mesh is dense). */
function rows(screen: readonly { x: number; y: number }[]) {
  const edges = new Map<number, { left: number; right: number }>();
  for (const { x, y } of screen) {
    const row = Math.floor(y / 2);
    const edge = edges.get(row);
    if (!edge) edges.set(row, { left: x, right: x });
    else {
      edge.left = Math.min(edge.left, x);
      edge.right = Math.max(edge.right, x);
    }
  }
  return edges;
}

/** Where the outline crosses a row, scanning in from `from` toward `to` (px). */
function edgeAlong(outline: ReturnType<typeof headOutline>, y: number, from: number, to: number): number | null {
  const step = Math.sign(to - from);
  for (let x = from; step > 0 ? x <= to : x >= to; x += step * 0.5) if (outline.contains(x, y)) return x;
  return null;
}

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 393, height: 852 };

/** On-screen extent of a mesh's silhouette at rest (shares of the viewport height), from its projected vertices. */
function extent(points: readonly Vector3[], silhouette: HeadSilhouette) {
  const { width, height } = DESKTOP;
  const screen = project(points, restPose(width, height, silhouette), width, height);
  const xs = screen.map((p) => p.x);
  const ys = screen.map((p) => p.y);
  const [top, bottom] = [Math.min(...ys), Math.max(...ys)];
  return { width: (Math.max(...xs) - Math.min(...xs)) / height, height: (bottom - top) / height, centre: (top + bottom) / 2 / height };
}

/**
 * Each head, with the worst stand-off its proxy is allowed (px, along the normal). The skin head's hair fringe curves
 * in over the forehead where its ellipsoids can't follow, so turned 22° its temple side stands off up to ~41 px.
 */
const HEADS: [string, string, HeadSilhouette, number][] = [
  ["copper", "head.glb", COPPER_SILHOUETTE, 30],
  ["skin", "skin-head.glb", SKIN_SILHOUETTE, 42],
];

describe.each(HEADS)("headOutline for the %s head", (_, file, silhouette, worstStandOff) => {
  let mesh: Awaited<ReturnType<typeof loadHead>>;
  beforeAll(async () => {
    mesh = await loadHead(file);
  });

  const poses: [string, { width: number; height: number }, Partial<HeadPose>][] = [
    ["at rest", DESKTOP, {}],
    ["looking right", DESKTOP, { yaw: 22 * D }],
    ["looking left", DESKTOP, { yaw: -22 * D }],
    ["mid-nod, chin down", DESKTOP, { pitch: 14 * D }],
    ["looking up", DESKTOP, { pitch: -10 * D }],
    ["rolled and flinching", DESKTOP, { roll: 10 * D, yaw: 8 * D }],
    ["lifted in a drop, camera punched in", DESKTOP, { y: silhouette.baseY - 0.08, cameraZ: 4.65 }],
    ["on an iPhone 15", PHONE, {}],
    ["on an iPhone 15, turned and nodding", PHONE, { yaw: 20 * D, pitch: 10 * D }],
  ];

  it("rests where the rig's prepareModel puts it, under the camera its fit places", () => {
    expect(silhouette.baseY).toBeCloseTo(mesh.baseY, 2);
    expect(restPose(1440, 900, silhouette)).toEqual({ pitch: 0, yaw: 0, roll: 0, y: silhouette.baseY, cameraZ: 5, cameraY: 0 });
    const phone = fitCamera(393, 852, silhouette.fit);
    expect(restPose(393, 852, silhouette)).toMatchObject({ cameraZ: phone.z, cameraY: phone.y });
  });

  it.each(poses)("covers every vertex of the head's silhouette %s (within 6 px)", (_, view, change) => {
    const pose = { ...restPose(view.width, view.height, silhouette), ...change };
    const outline = headOutline(view, pose, silhouette.parts);
    let worst = -Infinity;
    for (const { x, y } of project(mesh.points, pose, view.width, view.height)) worst = Math.max(worst, outline.distance(x, y));
    expect(worst).toBeLessThanOrEqual(6);
  });

  it.each(poses)("hugs the head %s: the outline stands off the silhouette by ≤ 12 px on average", (_, view, change) => {
    const pose = { ...restPose(view.width, view.height, silhouette), ...change };
    const outline = headOutline(view, pose, silhouette.parts);
    const edges = rows(project(mesh.points, pose, view.width, view.height));
    const gaps: number[] = [];
    let standOff = 0;
    for (const [row, edge] of edges) {
      const y = row * 2 + 1;
      const left = edgeAlong(outline, y, edge.left - 80, edge.right);
      const right = edgeAlong(outline, y, edge.right + 80, edge.left);
      if (left !== null) gaps.push(edge.left - left);
      if (right !== null) gaps.push(right - edge.right);
      // the worst case along the normal: a row scan overstates it where the outline runs nearly flat
      standOff = Math.max(standOff, -outline.distance(edge.left, y), -outline.distance(edge.right, y));
    }
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    expect(mean).toBeLessThanOrEqual(12);
    expect(standOff).toBeLessThanOrEqual(worstStandOff);
    // and no taller than the head: crown and neck within a few rows
    const ys = [...edges.keys()].map((row) => row * 2);
    expect(outline.bounds.top).toBeGreaterThan(Math.min(...ys) - 16);
    expect(outline.bounds.bottom).toBeLessThan(Math.max(...ys) + 18);
  });

  it("gives unit outward normals, and nearest points that sit on the outline", () => {
    const outline = headOutline(DESKTOP, restPose(1440, 900, silhouette), silhouette.parts);
    const { centre } = outline;
    for (let i = 0; i < 24; i++) {
      const angle = (2 * Math.PI * i) / 24;
      for (const reach of [150, 260, 420]) {
        const x = centre.x + reach * Math.cos(angle);
        const y = centre.y + reach * Math.sin(angle);
        const near = outline.nearest(x, y);
        expect(Math.hypot(near.normal.x, near.normal.y)).toBeCloseTo(1, 6);
        expect(Math.abs(outline.distance(near.point.x, near.point.y))).toBeLessThan(1.5);
        expect(near.depth).toBeCloseTo(-outline.distance(x, y), 6);
        expect(outline.contains(x, y)).toBe(near.depth > 0);
      }
    }
    // the sides face out sideways, the crown faces up
    const { bounds } = outline;
    expect(outline.nearest(bounds.left - 20, centre.y).normal.x).toBeLessThan(-0.9);
    expect(outline.nearest(bounds.right + 20, centre.y).normal.x).toBeGreaterThan(0.9);
    expect(outline.nearest(centre.x, bounds.top - 20).normal.y).toBeLessThan(-0.9);
  });
});

describe("the head silhouettes and the camera fits", () => {
  it("agree on how the skin head compares with the copper head (fit.ts measures them in one shared unit)", async () => {
    const copper = extent((await loadHead("head.glb")).points, COPPER_SILHOUETTE);
    const skin = extent((await loadHead("skin-head.glb")).points, SKIN_SILHOUETTE);
    // the fits are the meshes' silhouettes in one shared calibration (crown-to-neck reads ~7% short of the mesh)
    expect(skin.height / copper.height).toBeCloseTo(SKIN_FIT.height / COPPER_FIT.height, 1);
    expect(Math.abs(skin.height / copper.height / (SKIN_FIT.height / COPPER_FIT.height) - 1)).toBeLessThan(0.02);
    expect(Math.abs(skin.width / copper.width / (SKIN_FIT.width / COPPER_FIT.width) - 1)).toBeLessThan(0.02);
    expect(Math.abs(skin.centre - copper.centre - (SKIN_FIT.centre - COPPER_FIT.centre))).toBeLessThan(0.006);
  });
});

describe("headOutline", () => {
  it("projects a sphere to its exact silhouette circle", () => {
    const { width, height } = DESKTOP;
    const pose: HeadPose = { pitch: 0, yaw: 0, roll: 0, y: 0, cameraZ: 5, cameraY: 0 };
    const outline = headOutline(DESKTOP, pose, [{ centre: [0, 0, 0], radii: [1, 1, 1] }]);
    const f = height / 2 / TAN_HALF_FOV;
    const radius = f / Math.sqrt(25 - 1); // tangent cone, not f·r/d
    expect(outline.distance(width / 2, height / 2)).toBeCloseTo(-radius, 0);
    for (const angle of [0, 1, 2, 3, 4, 5]) {
      const x = width / 2 + radius * Math.cos(angle);
      const y = height / 2 + radius * Math.sin(angle);
      expect(Math.abs(outline.distance(x, y))).toBeLessThan(0.5);
      const { normal } = outline.nearest(x + 30 * Math.cos(angle), y + 30 * Math.sin(angle));
      expect(normal.x).toBeCloseTo(Math.cos(angle), 3);
      expect(normal.y).toBeCloseTo(Math.sin(angle), 3);
    }
    // off-axis, the silhouette's top and bottom are where the tangent cone meets the screen
    const lifted = headOutline(DESKTOP, { ...pose, y: 1 }, [{ centre: [0, 0, 0], radii: [1, 1, 1] }]);
    const [toward, half] = [Math.atan(1 / 5), Math.asin(1 / Math.sqrt(26))];
    expect(Math.abs(lifted.distance(width / 2, height / 2 - f * Math.tan(toward + half)))).toBeLessThan(0.5);
    expect(Math.abs(lifted.distance(width / 2, height / 2 - f * Math.tan(toward - half)))).toBeLessThan(0.5);
  });

  it("follows the pose: a turn swings the face, a roll tips the crown, a lift and the camera move and scale it", () => {
    const rest = restPose(1440, 900);
    const still = headOutline(DESKTOP, rest);
    const jaw = still.bounds.top + 0.7 * (still.bounds.bottom - still.bounds.top);
    const rightEdge = (outline: ReturnType<typeof headOutline>) => edgeAlong(outline, jaw, 1440, 0)!;
    expect(rightEdge(headOutline(DESKTOP, { ...rest, yaw: 22 * D }))).toBeGreaterThan(rightEdge(still) + 15);

    const crown = (outline: ReturnType<typeof headOutline>) => {
      const y = outline.bounds.top + 30;
      return (edgeAlong(outline, y, 0, 1440)! + edgeAlong(outline, y, 1440, 0)!) / 2;
    };
    expect(crown(headOutline(DESKTOP, { ...rest, roll: 8 * D }))).toBeLessThan(crown(still) - 30); // +roll: counter-clockwise

    expect(headOutline(DESKTOP, { ...rest, y: rest.y + 0.2 }).bounds.top).toBeLessThan(still.bounds.top - 15);
    const far = headOutline(DESKTOP, { ...rest, cameraZ: 7 });
    expect(far.bounds.right - far.bounds.left).toBeLessThan(0.8 * (still.bounds.right - still.bounds.left));
  });

  it("reports its screen centre, the nod pivot and a px-per-unit scale", () => {
    const outline = headOutline(DESKTOP, restPose(1440, 900));
    expect(outline.centre.x).toBeCloseTo(720, 0);
    expect(outline.pivot.x).toBeCloseTo(720, 0);
    expect(outline.pivot.y).toBeGreaterThan(outline.centre.y); // the pivot is low, at the top of the neck
    expect(outline.scale).toBeCloseTo(450 / TAN_HALF_FOV / 5, 0);
    expect(outline.contains(outline.centre.x, outline.centre.y)).toBe(true);
  });

  it("is empty for a zero-sized view", () => {
    const outline = headOutline({ width: 0, height: 0 }, restPose(0, 0));
    expect(outline.contains(0, 0)).toBe(false);
    expect(outline.distance(0, 0)).toBe(Infinity);
  });
});
