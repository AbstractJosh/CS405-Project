// render/meshes.js — geometry generators. A mesh is { positions, normals, uvs, indices } as flat arrays;
// triangles wind counter-clockwise seen from outside (front faces, back faces are culled).
import * as v3 from '../math/vec3.js';

// Unit square in the xy plane facing +z. uv (0,0) is the TOP-left of the image (images are stored top row first).
export const quad = () => ({
  positions: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  uvs: [0, 1, 1, 1, 1, 0, 0, 0],
  indices: [0, 1, 2, 0, 2, 3],
});

// Unit cube centred at the origin. Each face: normal n and in-face axes a, b with a × b = n (→ CCW).
export function cube() {
  const m = { positions: [], normals: [], uvs: [], indices: [] };
  const faces = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  for (const [n, a, b] of faces) {
    const base = m.positions.length / 3;
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      m.positions.push(...n.map((x, i) => 0.5 * (x + s * a[i] + t * b[i])));
      m.normals.push(...n);
      m.uvs.push((s + 1) / 2, (1 - t) / 2);
    }
    m.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return m;
}

// UV sphere of radius 0.5 (diameter 1, like the cube).
export function sphere(rings = 18, sectors = 28) {
  const m = { positions: [], normals: [], uvs: [], indices: [] };
  for (let i = 0; i <= rings; i++) {
    const th = (i * Math.PI) / rings;
    for (let j = 0; j <= sectors; j++) {
      const ph = (j * 2 * Math.PI) / sectors, n = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
      m.positions.push(...v3.scale(n, 0.5));
      m.normals.push(...n);
      m.uvs.push(j / sectors, i / rings);
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sectors; j++) {
      const a = i * (sectors + 1) + j, b = a + sectors + 1;
      m.indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return m;
}

// Wavefront OBJ text → mesh. Reads v / vt / vn / f (polygons fan-triangulated, negative indices allowed); a face
// without vn gets its flat normal. Re-fitted so the largest side is 1, centred in x and z, base at y = 0 — so a
// model sits ON whatever surface it is translated to.
export function parseOBJ(text) {
  const src = { v: [], vt: [], vn: [] }, m = { positions: [], normals: [], uvs: [], indices: [] };
  const at = (list, i) => list[i < 0 ? list.length + i : i - 1];
  for (const line of text.split('\n')) {
    const [tag, ...rest] = line.trim().split(/\s+/);
    if (Object.hasOwn(src, tag)) src[tag].push(rest.slice(0, tag === 'vt' ? 2 : 3).map(Number));
    if (tag !== 'f') continue;
    const corners = rest.map(c => c.split('/').map(Number));   // "v", "v/vt", "v//vn", "v/vt/vn"; missing → 0
    for (let k = 1; k + 1 < corners.length; k++) {
      const tri = [corners[0], corners[k], corners[k + 1]], p = tri.map(([v]) => at(src.v, v));
      const flat = v3.normalize(v3.cross(v3.sub(p[1], p[0]), v3.sub(p[2], p[0])));
      tri.forEach(([, t, n], j) => {
        const uv = t ? at(src.vt, t) : [0, 1];
        m.indices.push(m.positions.length / 3);
        m.positions.push(...p[j]);
        m.normals.push(...(n ? at(src.vn, n) : flat));
        m.uvs.push(uv[0], 1 - uv[1]);   // OBJ v points up; ours points down the image
      });
    }
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  m.positions.forEach((x, k) => { lo[k % 3] = Math.min(lo[k % 3], x); hi[k % 3] = Math.max(hi[k % 3], x); });
  const s = 1 / Math.max(...hi.map((h, i) => h - lo[i])), origin = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  m.positions = m.positions.map((x, k) => (x - origin[k % 3]) * s);
  return m;
}

// Square pyramid: base at x = −0.5, apex at x = +0.5, so it "points" along +x. Flat-shaded.
export function pyramid() {
  const A = [0.5, 0, 0], B = [[-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [-0.5, -0.5, 0.5]];
  const tris = [...B.map((b, i) => [A, b, B[(i + 1) % 4]]), [B[0], B[3], B[2]], [B[0], B[2], B[1]]];
  const m = { positions: [], normals: [], uvs: [], indices: [] };
  for (const [p, q, r] of tris) {
    const n = v3.normalize(v3.cross(v3.sub(q, p), v3.sub(r, p)));
    for (const x of [p, q, r]) { m.indices.push(m.positions.length / 3); m.positions.push(...x); m.normals.push(...n); m.uvs.push(0, 0); }
  }
  return m;
}
