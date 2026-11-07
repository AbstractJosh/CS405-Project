import { lookAt, perspective, orthographic, invertRigid, transformPoint } from '../math/mat4.js';
import { normalize } from '../math/vec3.js';

export function eyeOf(c) {
  const cp = Math.cos(c.pitch);
  return [c.target[0] + c.dist * cp * Math.sin(c.yaw), c.target[1] + c.dist * Math.sin(c.pitch), c.target[2] + c.dist * cp * Math.cos(c.yaw)];
}

export const viewOf = c => lookAt(eyeOf(c), c.target, [0, 1, 0]);

const halfHeight = (c, d) => Math.tan(c.fov * Math.PI / 360) * (c.ortho ? c.dist : d);

export function projOf(c, aspect) {
  if (!c.ortho) return perspective(c.fov * Math.PI / 180, aspect, c.near, c.far);
  const h = halfHeight(c), w = h * aspect;
  return orthographic(-w, w, -h, h, c.near, c.far);
}

export function rayOf(c, aspect, x, y) {
  const toWorld = invertRigid(viewOf(c)), h = halfHeight(c, 1), w = h * aspect;
  const [o, d] = c.ortho ? [[x * w, y * h, 0], [0, 0, -1]] : [[0, 0, 0], [x * w, y * h, -1]];
  return { origin: transformPoint(toWorld, o).slice(0, 3), dir: normalize(transformPoint(toWorld, d, 0).slice(0, 3)) };
}

export function frustumOf(c, aspect) {
  const toWorld = invertRigid(viewOf(c));
  return [c.near, c.far].flatMap(d => {
    const h = halfHeight(c, d), w = h * aspect;
    return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => transformPoint(toWorld, [x, y, -d]).slice(0, 3));
  });
}
