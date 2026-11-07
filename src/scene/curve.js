// scene/curve.js — the curves traced over the painting, in normalised painting coordinates
// ((0,0) bottom-left, (1,1) top-right), and the editing rules for them.
import { bezierPath, catmullRomPath, enforceC1, isKnot } from '../math/curves.js';

// Top contour of the large melon, traced in image pixels (x right, y down). Knots at indices 0, 3, 6, 9.
const TRACE_PX = [[205, 113], [220, 92], [270, 66], [330, 58], [390, 50], [525, 58], [590, 95], [655, 132], [645, 195], [628, 255]];

export function createCurve([imgW, imgH], meta) {
  const curve = {
    bezier: [], catmull: [],

    reset() {
      curve.bezier = TRACE_PX.map(([x, y]) => [x / imgW, 1 - y / imgH]);
      enforceC1(curve.bezier);
      // Catmull–Rom starts from seven points sampled on the same contour (it must pass through its points).
      curve.catmull = [0, 1, 2, 3, 4, 5, 6].map(i => bezierPath(curve.bezier, i / 6).point);
    },

    evaluate: (type, t) => (type === 'bezier' ? bezierPath(curve.bezier, t) : catmullRomPath(curve.catmull, t)),

    move(type, i, uv) {
      const P = curve[type];
      if (type === 'bezier' && isKnot(i))   // a knot carries its handles with it, which keeps C¹
        for (const j of [i - 1, i + 1]) if (P[j]) P[j] = P[j].map((x, k) => x + uv[k] - P[i][k]);
      P[i] = uv;
      if (type === 'bezier') enforceC1(P, i);
    },

    // Append a segment (Bézier: mirrored handle, midpoint handle, new knot) or a point (Catmull–Rom).
    add(type, uv) {
      if (type === 'catmull') return void curve.catmull.push(uv);
      const P = curve.bezier, K = P.at(-1), h1 = K.map((x, k) => 2 * x - P.at(-2)[k]);
      P.push(h1, h1.map((x, k) => (x + uv[k]) / 2), uv);
    },

    removeLast(type) {   // never below three segments
      if (type === 'bezier' && curve.bezier.length > 10) curve.bezier.splice(-3);
      if (type === 'catmull' && curve.catmull.length > 4) curve.catmull.pop();
    },

    toJSON() {
      const pt = (p, i, knot) => ({ x: +p[0].toFixed(4), y: +p[1].toFixed(4), ...(knot ? { knot: isKnot(i) } : {}) });
      return JSON.stringify({
        painting: meta,
        coordinates: 'normalised: (0,0) = bottom-left, (1,1) = top-right of the painting',
        bezier: { type: 'piecewise cubic Bézier', continuity: 'C1', segments: (curve.bezier.length - 1) / 3, points: curve.bezier.map((p, i) => pt(p, i, true)) },
        catmullRom: { type: 'uniform Catmull–Rom (end points repeated)', segments: curve.catmull.length - 1, points: curve.catmull.map(p => pt(p)) },
      }, null, 2);
    },
  };
  curve.reset();
  return curve;
}
