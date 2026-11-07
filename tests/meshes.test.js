import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseOBJ } from '../src/render/meshes.js';

test('parseOBJ: quad fan-triangulated, flat normal, negative indices, refit to unit box on y = 0', () => {
  const m = parseOBJ('# 2 x 4 quad\nv 0 2 0\nv 2 2 0\nv 2 6 0\nv 0 6 0\nf -4 -3 -2 -1\n');
  assert.equal(m.indices.length, 6);                       // 4-gon → 2 triangles
  assert.deepEqual(m.normals.slice(0, 3), [0, 0, 1]);      // CCW in xy → +z
  const ys = m.positions.filter((_, k) => k % 3 === 1), xs = m.positions.filter((_, k) => k % 3 === 0);
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [0, 1]);       // base at 0, largest side (4) → 1
  assert.deepEqual([Math.min(...xs), Math.max(...xs)], [-0.25, 0.25]);  // centred in x
});

test('parseOBJ: the shipped models load with one normal per vertex and no NaNs', () => {
  for (const f of ['barbell', 'bench']) {
    const m = parseOBJ(readFileSync(new URL(`../assets/${f}.obj`, import.meta.url), 'utf8'));
    assert.ok(m.indices.length > 0 && m.positions.length === m.normals.length);
    assert.ok([...m.positions, ...m.normals, ...m.uvs].every(Number.isFinite), f);
  }
});
