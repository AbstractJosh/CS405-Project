// math/mat4.js — 4×4 matrices as Float32Array(16), COLUMN-MAJOR: element (row r, column c) is m[c * 4 + r].
// This is exactly the layout WebGPU reads from a uniform buffer for mat4x4f, so matrices are uploaded as-is.
// Convention used everywhere: column vectors, p' = M · p, so in A · B the transform B is applied first.
import * as v3 from './vec3.js';

export const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function multiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];   // row r of a · column c of b
      o[c * 4 + r] = s;
    }
  return o;
}

// compose(A, B, C) = A · B · C  (C acts on the point first)
export const compose = (...ms) => ms.reduce(multiply);

export const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
export const scale = (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);

// Right-handed rotations by angle a (radians). Each column is the image of a basis vector.
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

// Inverse of a rigid transform M = [R t; 0 1] (rotation + translation only): M⁻¹ = [Rᵀ  −Rᵀt; 0 1].
// Cheaper and more stable than a general inverse, but WRONG if M contains scale or shear.
export function invertRigid(m) {
  const o = identity();
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c];   // Rᵀ
  for (let i = 0; i < 3; i++)                                                         // −Rᵀ t; row i of Rᵀ = column i of R
    o[12 + i] = -(m[i * 4] * m[12] + m[i * 4 + 1] * m[13] + m[i * 4 + 2] * m[14]);
  return o;
}

// M · [x, y, z, w]; w = 1 for points, 0 for directions. Returns all four components.
export const transformPoint = (m, p, w = 1) =>
  [0, 1, 2, 3].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * w);

// View matrix. The camera looks down its own −z axis, so w points from the target back to the eye.
//   w = normalize(eye − target)      u = normalize(up × w)  (right)      v = w × u  (true up)
// Rows of the rotation are u, v, w; the translation moves the eye to the origin.
export function lookAt(eye, target, up) {
  const w = v3.normalize(v3.sub(eye, target));
  let u = v3.cross(up, w);
  if (v3.length(u) < 1e-6 * v3.length(up)) {
    // Degenerate: up ∥ view direction, so up × w = 0 and the camera would have no defined "right".
    // Substitute the world axis least aligned with w; it is guaranteed not to be parallel to w.
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

// Perspective for WebGPU: clip z / w maps view depth −near → 0 and −far → 1 (OpenGL would map to −1 … 1).
//   z_clip = far/(near−far) · z + near·far/(near−far),   w_clip = −z
export function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, far * nf, -1, 0, 0, near * far * nf, 0]);
}

// Orthographic for WebGPU: the box [l,r]×[b,t]×[−near,−far] goes to x,y ∈ [−1,1], z ∈ [0,1].
export function orthographic(left, right, bottom, top, near, far) {
  const nf = 1 / (near - far);
  return new Float32Array([
    2 / (right - left), 0, 0, 0,
    0, 2 / (top - bottom), 0, 0,
    0, 0, nf, 0,
    -(right + left) / (right - left), -(top + bottom) / (top - bottom), near * nf, 1,
  ]);
}

// Four printable rows (row-major, the way matrices are written on paper).
export const format = (m, d = 2) =>
  [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => {
    const x = m[c * 4 + r];
    return (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d).padStart(d + 5);
  }).join(''));
