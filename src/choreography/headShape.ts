/**
 * The head's on-screen silhouette, for the glass to bump into and the caustics to sit under. The head is modelled
 * as a few ellipsoids in the rig's frame (relative to the nod pivot, y up, face toward +z), fitted to head.glb.
 * Each frame they're posed like the rig and projected exactly through r3f's perspective camera (an ellipsoid's
 * outline is an ellipse), then smooth-unioned into one signed distance field in CSS px.
 */
import { CAMERA_Z, fitCamera, TAN_HALF_FOV } from "./fit";

export interface Point {
  x: number;
  y: number;
}

export interface HeadView {
  /** CSS px. */
  width: number;
  height: number;
}

/** The rig and camera as `Head` last drew them. */
export interface HeadPose {
  /** The rig's Euler XYZ angles (radians): +pitch drops the chin, +yaw turns the face right, +roll tips it left. */
  pitch: number;
  yaw: number;
  roll: number;
  /** The rig's (the pivot's) world height. */
  y: number;
  cameraZ: number;
  cameraY: number;
}

/** One ellipsoid of the proxy, axis-aligned in the rig's frame; `mirror` adds its twin at −x (ears, jaw). */
export interface HeadPart {
  centre: readonly [number, number, number];
  radii: readonly [number, number, number];
  mirror?: boolean;
}

/**
 * head.glb as `prepareModel` places it, pivot at the origin. Fitted so the outline covers every vertex of the
 * silhouette within a few px and stands off it by ~8 px on average, across looks, nods, rolls and phones
 * (headShape.test.ts measures both against the mesh): refit these if the head mesh changes.
 */
export const COPPER_HEAD: readonly HeadPart[] = [
  { centre: [0, 2.002, 0.207], radii: [1.465, 1.754, 1.625] }, // cranium
  { centre: [0, 1.924, -0.816], radii: [1.115, 1.084, 0.806] }, // back of the skull
  { centre: [1.316, 1.514, -0.113], radii: [0.284, 0.563, 0.168], mirror: true }, // ears
  { centre: [0, 0.995, 0.787], radii: [1.132, 1.025, 1.242] }, // face
  { centre: [0, 1.449, 1.662], radii: [0.811, 0.083, 0.051] }, // brow
  { centre: [0, 0.406, 0.309], radii: [0.948, 0.615, 0.598] }, // jaw
  { centre: [0, 0.059, 1.306], radii: [0.704, 0.384, 0.356] }, // chin
  { centre: [0, -0.568, -0.25], radii: [0.933, 0.787, 1.022] }, // neck
  { centre: [0, -0.718, -0.379], radii: [0.985, 0.227, 0.931] }, // the neck's flared base
];

/** The rig's rest height (the pivot's world y) for head.glb: `prepareModel`'s baseY. */
export const HEAD_BASE_Y = -1.448;
/** Smooth-union radius (world units): fills the creases where parts meet, so the outline and its normals stay smooth. */
const BLEND = 0.1;

/** The head at rest for a viewport: no nod, turn or roll, and the fitted camera. */
export function restPose(width: number, height: number): HeadPose {
  const { z, y } = fitCamera(width, height);
  return { pitch: 0, yaw: 0, roll: 0, y: HEAD_BASE_Y, cameraZ: z, cameraY: y };
}

export interface HeadOutline {
  contains(x: number, y: number): boolean;
  /** Signed distance (px) from the outline: negative inside. */
  distance(x: number, y: number): number;
  /** The outward unit normal of the outline nearest (x, y), written into `out`. Returns the signed distance. */
  normal(x: number, y: number, out: Point): number;
  /** The outline point nearest (x, y), its outward normal, and how deep (x, y) is inside (negative outside). */
  nearest(x: number, y: number): { point: Point; normal: Point; depth: number };
  /** The outline's bounding box (px). */
  bounds: { left: number; right: number; top: number; bottom: number };
  /** Screen position of the first part's centre (the cranium) and of the nod pivot (px). */
  centre: Point;
  pivot: Point;
  /** Px per world unit at the pivot's depth. */
  scale: number;
}

/** A projected part: an ellipse with centre (mx, my), semi-axes a ≥ b, a along (cos, sin). */
interface Ellipse {
  mx: number;
  my: number;
  a: number;
  b: number;
  cos: number;
  sin: number;
}

const EMPTY: HeadOutline = {
  contains: () => false,
  distance: () => Infinity,
  normal: (_x, _y, out) => {
    out.x = 0;
    out.y = -1;
    return Infinity;
  },
  nearest: () => ({ point: { x: 0, y: 0 }, normal: { x: 0, y: -1 }, depth: -Infinity }),
  bounds: { left: 0, right: 0, top: 0, bottom: 0 },
  centre: { x: 0, y: 0 },
  pivot: { x: 0, y: 0 },
  scale: 0,
};

/**
 * The silhouette for a view and pose. An ellipsoid's dual quadric Q* = T·diag(a², b², c², −1)·Tᵀ projects to its
 * outline's dual conic C* = P·Q*·Pᵀ, so the outline is exact under perspective, not a scaled orthographic guess.
 */
export function headOutline(view: HeadView, pose: HeadPose, parts: readonly HeadPart[] = COPPER_HEAD): HeadOutline {
  const { width, height } = view;
  if (width <= 0 || height <= 0) return EMPTY;
  const f = height / 2 / TAN_HALF_FOV;
  const [cz, cy] = [pose.cameraZ, pose.cameraY];
  // P = [[f, 0, −W/2, W/2·cz], [0, −f, −H/2, f·cy + H/2·cz], [0, 0, −1, cz]]: world → homogeneous px (y down)
  const P = [
    [f, 0, -width / 2, (width / 2) * cz],
    [0, -f, -height / 2, f * cy + (height / 2) * cz],
    [0, 0, -1, cz],
  ];
  // the rig's rotation, three's Euler XYZ order: R = Rx(pitch)·Ry(yaw)·Rz(roll)
  const [a, b, c] = [Math.cos(pose.pitch), Math.sin(pose.pitch), Math.cos(pose.yaw)];
  const [d, e, g] = [Math.sin(pose.yaw), Math.cos(pose.roll), Math.sin(pose.roll)];
  const R = [
    [c * e, -c * g, d],
    [a * g + b * d * e, a * e - b * d * g, -b * c],
    [b * g - a * d * e, b * e + a * d * g, a * c],
  ];
  const project = (x: number, y: number, z: number): Point => {
    const w = P[2][0] * x + P[2][1] * y + P[2][2] * z + P[2][3];
    return {
      x: (P[0][0] * x + P[0][1] * y + P[0][2] * z + P[0][3]) / w,
      y: (P[1][0] * x + P[1][1] * y + P[1][2] * z + P[1][3]) / w,
    };
  };

  const ellipses: Ellipse[] = [];
  const Q = [new Float64Array(4), new Float64Array(4), new Float64Array(4), new Float64Array(4)];
  const solids = parts.flatMap((part) =>
    part.mirror ? [part, { ...part, centre: [-part.centre[0], part.centre[1], part.centre[2]] as const }] : [part],
  );
  for (const part of solids) {
    const [px, py, pz] = part.centre;
    const t = [0, 1, 2].map((i) => R[i][0] * px + R[i][1] * py + R[i][2] * pz + (i === 1 ? pose.y : 0));
    // Q* = [[L·Lᵀ − t·tᵀ, −t], [−tᵀ, −1]], L = R·diag(radii)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += R[i][k] * R[j][k] * part.radii[k] * part.radii[k];
        Q[i][j] = sum - t[i] * t[j];
      }
      Q[i][3] = -t[i];
      Q[3][i] = -t[i];
    }
    Q[3][3] = -1;
    // C* = P·Q*·Pᵀ
    const PQ = P.map((row) => [0, 1, 2, 3].map((j) => row[0] * Q[0][j] + row[1] * Q[1][j] + row[2] * Q[2][j] + row[3] * Q[3][j]));
    const C = [0, 1, 2].map((i) => [0, 1, 2].map((j) => PQ[i].reduce((sum, value, k) => sum + value * P[j][k], 0)));
    const s = -C[2][2];
    if (!(s > 0)) continue; // behind the camera, or the camera is inside it
    const mx = C[0][2] / C[2][2];
    const my = C[1][2] / C[2][2];
    const p = C[0][0] / s + mx * mx;
    const q = C[0][1] / s + mx * my;
    const r = C[1][1] / s + my * my;
    const mean = (p + r) / 2;
    const spread = Math.hypot((p - r) / 2, q);
    const angle = 0.5 * Math.atan2(2 * q, p - r);
    ellipses.push({
      mx,
      my,
      a: Math.sqrt(Math.max(mean + spread, 1e-9)),
      b: Math.sqrt(Math.max(mean - spread, 1e-9)),
      cos: Math.cos(angle),
      sin: Math.sin(angle),
    });
  }
  if (ellipses.length === 0) return EMPTY;

  const pivot = project(0, pose.y, 0);
  const scale = f / Math.max(1e-6, cz);
  const k = BLEND * scale;

  /** Signed distance, with the unnormalised gradient left in `out`. */
  const field = (x: number, y: number, out: Point): number => {
    let dist = Infinity;
    let gx = 0;
    let gy = -1;
    for (let i = 0; i < ellipses.length; i++) {
      const el = ellipses[i];
      const dx = x - el.mx;
      const dy = y - el.my;
      // no nearer than its circumscribed circle: too far to touch the union, skip it
      if (dist !== Infinity && Math.hypot(dx, dy) - el.a >= dist + k) continue;
      const qx = dx * el.cos + dy * el.sin;
      const qy = dy * el.cos - dx * el.sin;
      const [a, b] = [el.a, el.b];
      const px = Math.abs(qx);
      const py = Math.abs(qy);
      // the nearest outline point, by Chatfield's trig-free iteration on the quadrant's arc (3 steps suffice)
      const c2 = a * a - b * b;
      let tx = Math.SQRT1_2;
      let ty = Math.SQRT1_2;
      for (let n = 0; n < 3; n++) {
        const ex = (c2 * tx * tx * tx) / a;
        const ey = (-c2 * ty * ty * ty) / b;
        const r = Math.hypot(a * tx - ex, b * ty - ey);
        const q = Math.hypot(px - ex, py - ey) || 1e-12;
        tx = Math.min(1, Math.max(0, (((px - ex) * r) / q + ex) / a));
        ty = Math.min(1, Math.max(0, (((py - ey) * r) / q + ey) / b));
        const t = Math.hypot(tx, ty) || 1;
        tx /= t;
        ty /= t;
      }
      const ox = px - a * tx;
      const oy = py - b * ty;
      const length = Math.hypot(ox, oy);
      const inside = (px * px) / (a * a) + (py * py) / (b * b) < 1;
      let lx: number;
      let ly: number;
      if (length > 1e-6) {
        [lx, ly] = inside ? [-ox / length, -oy / length] : [ox / length, oy / length];
      } else {
        const [ux, uy] = [tx / a, ty / b]; // on the outline: the ellipse's own normal
        const u = Math.hypot(ux, uy) || 1;
        [lx, ly] = [ux / u, uy / u];
      }
      if (qx < 0) lx = -lx;
      if (qy < 0) ly = -ly;
      const d = inside ? -length : length;
      const nx = lx * el.cos - ly * el.sin;
      const ny = lx * el.sin + ly * el.cos;
      if (dist === Infinity) {
        [dist, gx, gy] = [d, nx, ny];
        continue;
      }
      // polynomial smooth-min; its gradient blends the two by h
      const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (d - dist)) / k));
      dist = d + (dist - d) * h - k * h * (1 - h);
      gx = nx + (gx - nx) * h;
      gy = ny + (gy - ny) * h;
    }
    out.x = gx;
    out.y = gy;
    return dist;
  };

  const scratch = { x: 0, y: 0 };
  const distance = (x: number, y: number) => field(x, y, scratch);
  const normal = (x: number, y: number, out: Point) => {
    const dist = field(x, y, out);
    const length = Math.hypot(out.x, out.y) || 1;
    out.x /= length;
    out.y /= length;
    return dist;
  };

  // bounds: each ellipse's axis-aligned extent
  const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const el of ellipses) {
    const hx = Math.hypot(el.a * el.cos, el.b * el.sin);
    const hy = Math.hypot(el.a * el.sin, el.b * el.cos);
    bounds.left = Math.min(bounds.left, el.mx - hx);
    bounds.right = Math.max(bounds.right, el.mx + hx);
    bounds.top = Math.min(bounds.top, el.my - hy);
    bounds.bottom = Math.max(bounds.bottom, el.my + hy);
  }

  return {
    contains: (x, y) => distance(x, y) < 0,
    distance,
    normal,
    nearest(x, y) {
      const n = { x: 0, y: 0 };
      const dist = normal(x, y, n);
      // march along the normal onto the outline: one step lands near it, deep inside it takes a few
      let s = -dist;
      let d = distance(x + n.x * s, y + n.y * s);
      for (let i = 0; i < 32 && Math.abs(d) > 0.25; i++) {
        s -= d;
        d = distance(x + n.x * s, y + n.y * s);
      }
      return { point: { x: x + n.x * s, y: y + n.y * s }, normal: n, depth: -dist };
    },
    bounds,
    centre: { x: ellipses[0].mx, y: ellipses[0].my },
    pivot,
    scale,
  };
}

/** Where `Head` publishes its rig and camera every frame, for the glass and caustics (DOM layers, outside r3f). */
export const headPose: HeadPose & { ready: boolean } = {
  ...restPose(0, 0),
  cameraZ: CAMERA_Z,
  ready: false,
};

/** `Head`'s one-line hook: copy the rig's rotation and height, and the camera's, into `headPose`. */
export function trackHead(
  rig: { rotation: { x: number; y: number; z: number }; position: { y: number } },
  camera: { position: { y: number; z: number } },
): void {
  headPose.pitch = rig.rotation.x;
  headPose.yaw = rig.rotation.y;
  headPose.roll = rig.rotation.z;
  headPose.y = rig.position.y;
  headPose.cameraZ = camera.position.z;
  headPose.cameraY = camera.position.y;
  headPose.ready = true;
}
