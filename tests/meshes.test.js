import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseOBJ, revolve } from '../src/render/meshes.js';

test('revolve: a semicircle, and a closed circle (axis = its longest chord), become a sphere — radius, outward normals, CCW faces', () => {
  const semicircle = t => { const th = Math.PI * (1 - t); return { point: [Math.cos(th), Math.sin(th)], tangent: [Math.sin(th), -Math.cos(th)] }; };
  const circle = t => { const th = 2 * Math.PI * t; return { point: [Math.cos(th), Math.sin(th)], tangent: [-Math.sin(th), Math.cos(th)] }; };
  const c = [0, 0.5, 0], sub = (a, b) => a.map((x, k) => x - b[k]), dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
  for (const [name, shape] of [['semicircle', semicircle], ['circle', circle]]) {
    const m = revolve(shape, 24, 16), P = i => m.positions.slice(3 * i, 3 * i + 3), N = i => m.normals.slice(3 * i, 3 * i + 3);
    for (let i = 0; i < m.positions.length / 3; i++) {
      const out = sub(P(i), c);
      assert.ok(Math.abs(Math.hypot(...out) - 0.5) < 1e-9, `${name}: on the sphere`);
      assert.ok(dot(N(i), out) / 0.5 > 0.999, `${name}: normal points outward`);
    }
    for (let k = 0; k < m.indices.length; k += 3) {
      const [a, b, d] = m.indices.slice(k, k + 3).map(P), e = sub(b, a), f = sub(d, a);
      const n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
      if (Math.hypot(...n) > 1e-12) assert.ok(dot(n, sub(a, c)) > 0, `${name}: triangle ${k / 3} winds CCW from outside`);
    }
  }
});

test('parseOBJ: quad fan-triangulated, flat normal, negative indices, refit to unit box on y = 0', () => {
  const m = parseOBJ('# 2 x 4 quad\nv 0 2 0\nv 2 2 0\nv 2 6 0\nv 0 6 0\nf -4 -3 -2 -1\n');
  assert.equal(m.indices.length, 6);
  assert.deepEqual(m.normals.slice(0, 3), [0, 0, 1]);
  const ys = m.positions.filter((_, k) => k % 3 === 1), xs = m.positions.filter((_, k) => k % 3 === 0);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [0, 1]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [-0.25, 0.25]);
});

test('parseOBJ: the shipped models load with one normal per vertex and no NaNs', () => {
  const dir = new URL('../assets/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.obj'))) {
    const m = parseOBJ(readFileSync(new URL(f, dir), 'utf8'));
    assert.ok(m.indices.length > 0 && m.positions.length === m.normals.length);
    assert.ok([...m.positions, ...m.normals, ...m.uvs].every(Number.isFinite), f);
  }
});
