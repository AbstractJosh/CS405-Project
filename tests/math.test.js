import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/math/mat4.js';
import * as C from '../src/math/curves.js';

const close = (a, b, eps = 1e-5) => {
  assert.equal(a.length, b.length);
  a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < eps, `index ${i}: ${x} vs ${b[i]}`));
};
const apply = (m, p) => M.transformPoint(m, p).slice(0, 3);

test('identity is neutral for multiply', () => {
  const A = M.compose(M.translate(1, 2, 3), M.rotateX(0.3), M.scale(2, 1, 0.5));
  close(M.multiply(A, M.identity()), A);
  close(M.multiply(M.identity(), A), A);
});

test('translate, rotate, scale act on points as expected', () => {
  close(apply(M.translate(1, 2, 3), [1, 1, 1]), [2, 3, 4]);
  close(apply(M.rotateX(Math.PI / 2), [0, 1, 0]), [0, 0, 1]);
  close(apply(M.rotateY(Math.PI / 2), [0, 0, 1]), [1, 0, 0]);
  close(apply(M.rotateZ(Math.PI / 2), [1, 0, 0]), [0, 1, 0]);
  close(apply(M.scale(2, 3, 4), [1, 1, 1]), [2, 3, 4]);
});

test('order matters: T·S vs S·T', () => {
  close(apply(M.compose(M.translate(1, 0, 0), M.scale(2, 2, 2)), [1, 0, 0]), [3, 0, 0]);
  close(apply(M.compose(M.scale(2, 2, 2), M.translate(1, 0, 0)), [1, 0, 0]), [4, 0, 0]);
});

test('transpose is an involution; invertRigid inverts rigid transforms', () => {
  const R = M.compose(M.translate(1, -2, 3), M.rotateY(0.7), M.rotateX(-0.4));
  close(M.transpose(M.transpose(R)), R);
  close(M.multiply(M.invertRigid(R), R), M.identity());
  close(M.multiply(R, M.invertRigid(R)), M.identity());
});

test('lookAt sends the eye to the origin and the target onto −z', () => {
  const eye = [3, 4, 5], V = M.lookAt(eye, [0, 1, 0], [0, 1, 0]);
  close(apply(V, eye), [0, 0, 0]);
  const t = apply(V, [0, 1, 0]);
  close([t[0], t[1]], [0, 0]);
  assert.ok(t[2] < 0);
});

test('lookAt survives up parallel to the view direction', () => {
  const V = M.lookAt([0, 5, 0], [0, 0, 0], [0, 1, 0]);
  assert.ok([...V].every(Number.isFinite));
  close(M.multiply(M.invertRigid(V), V), M.identity());
  close(apply(V, [0, 0, 0]), [0, 0, -5]);
});

test('perspective maps near → 0 and far → 1 (WebGPU depth)', () => {
  const P = M.perspective(1, 1.5, 0.5, 20);
  const ndcZ = z => { const c = M.transformPoint(P, [0, 0, z]); return c[2] / c[3]; };
  close([ndcZ(-0.5), ndcZ(-20)], [0, 1]);
});

test('orthographic maps the box to [−1,1]² × [0,1]', () => {
  const O = M.orthographic(-2, 4, -1, 3, 0.5, 10);
  close(apply(O, [-2, -1, -0.5]), [-1, -1, 0]);
  close(apply(O, [4, 3, -10]), [1, 1, 1]);
});

test('Bézier: endpoints, end tangents, basis sums to 1, de Casteljau agrees', () => {
  const P = [[0, 0], [1, 2], [3, 3], [4, 0]];
  close(C.bezier(P, 0), P[0]);
  close(C.bezier(P, 1), P[3]);
  close(C.bezierTangent(P, 0), [3, 6]);
  close(C.bezierTangent(P, 1), [3, -9]);
  for (const t of [0.2, 0.5, 0.9]) {
    close([C.bernstein(t).reduce((a, b) => a + b)], [1]);
    close(C.deCasteljau(P, t).at(-1)[0], C.bezier(P, t));
  }
});

test('enforceC1 mirrors the handle and makes the tangent continuous', () => {
  const P = [[0, 0], [1, 1], [2, 1], [3, 0], [9, 9], [5, 1], [6, 0]];
  C.enforceC1(P, 2);
  close(P[4], [4, -1]);
  close(C.bezierTangent(C.bezierSegment(P, 0), 1), C.bezierTangent(C.bezierSegment(P, 1), 0));
  close([C.c1Error(P)], [0]);
});

test('Catmull–Rom passes through its points', () => {
  const K = [[0, 0], [1, 2], [3, 3], [4, 0], [6, 1]];
  K.forEach((k, i) => close(C.catmullRomPath(K, i / (K.length - 1)).point, k));
});
