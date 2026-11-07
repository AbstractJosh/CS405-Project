// scene/camera.js — orbit cameras. A camera is a plain object
//   { target, yaw, pitch, dist, fov (degrees), near, far, ortho }
// whose eye sits on a sphere of radius `dist` around `target`.
import { lookAt, perspective, orthographic, invertRigid, transformPoint } from '../math/mat4.js';
import { normalize } from '../math/vec3.js';

export function eyeOf(c) {
  const cp = Math.cos(c.pitch);
  return [c.target[0] + c.dist * cp * Math.sin(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * cp * Math.cos(c.yaw)];
}

export const viewOf = c => lookAt(eyeOf(c), c.target, [0, 1, 0]);

// Half-height of what the camera sees at depth d. Orthographic uses the height perspective has at the
// target, so switching projection keeps the target region the same size on screen.
const halfHeight = (c, d) => Math.tan(c.fov * Math.PI / 360) * (c.ortho ? c.dist : d);

export function projOf(c, aspect) {
  if (!c.ortho) return perspective(c.fov * Math.PI / 180, aspect, c.near, c.far);
  const h = halfHeight(c), w = h * aspect;
  return orthographic(-w, w, -h, h, c.near, c.far);
}

// World-space ray through normalised device coordinates (x, y) ∈ [−1, 1]², used for mouse picking.
// Built in camera space, then taken to world space by the inverse of the (rigid) view matrix.
export function rayOf(c, aspect, x, y) {
  const toWorld = invertRigid(viewOf(c)), h = halfHeight(c, 1), w = h * aspect;
  const [o, d] = c.ortho ? [[x * w, y * h, 0], [0, 0, -1]] : [[0, 0, 0], [x * w, y * h, -1]];
  return { origin: transformPoint(toWorld, o).slice(0, 3), dir: normalize(transformPoint(toWorld, d, 0).slice(0, 3)) };
}

// The 8 frustum corners in world space: near rectangle, then far rectangle.
export function frustumOf(c, aspect) {
  const toWorld = invertRigid(viewOf(c));
  return [c.near, c.far].flatMap(d => {
    const h = halfHeight(c, d), w = h * aspect;
    return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => transformPoint(toWorld, [x, y, -d]).slice(0, 3));
  });
}
