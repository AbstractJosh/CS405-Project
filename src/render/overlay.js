// render/overlay.js — debug drawings as flat vertex lists [x,y,z, r,g,b, …] for the line / triangle pipelines.
import { transformPoint } from '../math/mat4.js';
import * as v3 from '../math/vec3.js';

const AXIS_COLORS = [[0.9, 0.1, 0.08], [0.15, 0.75, 0.15], [0.1, 0.3, 1]];   // x red, y green, z blue

export const seg = (out, a, b, c) => out.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2], c[0], c[1], c[2]);
export const polyline = (out, pts, c) => { for (let i = 1; i < pts.length; i++) seg(out, pts[i - 1], pts[i], c); };

// A node's local axes: the images of the unit axes under its world matrix.
export function axes(out, m, len = 0.35) {
  const o = transformPoint(m, [0, 0, 0]);
  AXIS_COLORS.forEach((c, i) => { const e = [0, 0, 0]; e[i] = len; seg(out, o, transformPoint(m, e), c); });
}

// Corners from camera.frustumOf (near quad, then far quad). With an eye, the near corners join it.
export function frustum(out, k, c, eye) {
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    seg(out, k[i], k[j], c); seg(out, k[4 + i], k[4 + j], c); seg(out, k[i], k[4 + i], c);
    if (eye) seg(out, eye, k[i], c);
  }
}

// Small "+" in the plane spanned by ex, ey.
export function cross(out, p, r, c, ex, ey) {
  for (const e of [ex, ey]) seg(out, v3.sub(p, v3.scale(e, r)), v3.add(p, v3.scale(e, r)), c);
}

// A flat band along a polyline, lying in the plane with normal n (WebGPU lines are always 1 px wide).
export function ribbon(out, pts, width, c, n) {
  const side = pts.map((_, i) =>
    v3.scale(v3.normalize(v3.cross(n, v3.sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]))), width / 2));
  for (let i = 1; i < pts.length; i++) {
    const a0 = v3.add(pts[i - 1], side[i - 1]), a1 = v3.sub(pts[i - 1], side[i - 1]);
    const b0 = v3.add(pts[i], side[i]), b1 = v3.sub(pts[i], side[i]);
    for (const p of [a0, a1, b0, b0, a1, b1]) out.push(p[0], p[1], p[2], c[0], c[1], c[2]);
  }
}
