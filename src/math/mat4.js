import * as v3 from './vec3.js';

export const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

export const compose = (...ms) => ms.reduce(multiply);

export const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
export const scale = (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);

export function rotateX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}
export function rotateY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}
export function rotateZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function transpose(m) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[r * 4 + c] = m[c * 4 + r];
  return o;
}

export function invertRigid(m) {
  const o = identity();
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c];
  for (let i = 0; i < 3; i++)
    o[12 + i] = -(m[i * 4] * m[12] + m[i * 4 + 1] * m[13] + m[i * 4 + 2] * m[14]);
  return o;
}

export const transformPoint = (m, p, w = 1) =>
  [0, 1, 2, 3].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * w);

export function lookAt(eye, target, up) {
  const w = v3.normalize(v3.sub(eye, target));
  let u = v3.cross(up, w);
  if (v3.length(u) < 1e-6 * v3.length(up)) {
    const a = w.map(Math.abs), axis = [0, 0, 0];
    axis[a.indexOf(Math.min(...a))] = 1;
    u = v3.cross(axis, w);
  }
  u = v3.normalize(u);
  const v = v3.cross(w, u);
  return new Float32Array([
    u[0], v[0], w[0], 0,
    u[1], v[1], w[1], 0,
    u[2], v[2], w[2], 0,
    -v3.dot(u, eye), -v3.dot(v, eye), -v3.dot(w, eye), 1,
  ]);
}

export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far * nf, -1, 0, 0, near * far * nf, 0]);
}

export function orthographic(left, right, bottom, top, near, far) {
  const nf = 1 / (near - far);
  return new Float32Array([
    2 / (right - left), 0, 0, 0,
    0, 2 / (top - bottom), 0, 0,
    0, 0, nf, 0,
    -(right + left) / (right - left), -(top + bottom) / (top - bottom), near * nf, 1,
  ]);
}

export const format = (m, d = 2) =>
  [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => {
    const x = m[c * 4 + r];
    return (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d).padStart(d + 5);
  }).join(''));
