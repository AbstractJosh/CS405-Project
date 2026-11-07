import { bezierPath, catmullRomPath, enforceC1, isKnot } from '../math/curves.js';
import TRACE from '../../curve.json' with { type: 'json' };

export function createCurve(meta) {
  const curve = {
    bezier: [], catmull: [],

    reset() {
      const pts = key => TRACE[key].points.map(p => [p.x, p.y]);
      curve.bezier = pts('bezier');
      enforceC1(curve.bezier);
      curve.catmull = pts('catmullRom');
    },

    evaluate: (type, t) => (type === 'bezier' ? bezierPath(curve.bezier, t) : catmullRomPath(curve.catmull, t)),

    move(type, i, uv) {
      const P = curve[type];
      if (type === 'bezier' && isKnot(i))
        for (const j of [i - 1, i + 1]) if (P[j]) P[j] = P[j].map((x, k) => x + uv[k] - P[i][k]);
      P[i] = uv;
      if (type === 'bezier') enforceC1(P, i);
    },

    add(type, uv) {
      if (type === 'catmull') return void curve.catmull.push(uv);
      const P = curve.bezier, K = P.at(-1), h1 = K.map((x, k) => 2 * x - P.at(-2)[k]);
      P.push(h1, h1.map((x, k) => (x + uv[k]) / 2), uv);
    },

    removeLast(type) {
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
