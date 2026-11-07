const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const combine = (P, w) => P[0].map((_, i) => P.reduce((s, p, k) => s + w[k] * p[i], 0));

export const bernstein = t => { const u = 1 - t; return [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; };
export const bernsteinDerivative = t => {
  const u = 1 - t;
  return [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
};
export const bezier = (P, t) => combine(P, bernstein(t));
export const bezierTangent = (P, t) => combine(P, bernsteinDerivative(t));

export function deCasteljau(P, t) {
  const levels = [P];
  while (levels.at(-1).length > 1) {
    const L = levels.at(-1);
    levels.push(L.slice(1).map((p, i) => lerp(L[i], p, t)));
  }
  return levels;
}

function locate(segments, t) {
  const s = Math.min(Math.max(t, 0), 1) * segments, i = Math.min(Math.floor(s), segments - 1);
  return [i, s - i];
}

export const isKnot = i => i % 3 === 0;
export const bezierSegment = (P, i) => P.slice(3 * i, 3 * i + 4);
export function bezierPath(P, t) {
  const [segment, u] = locate((P.length - 1) / 3, t), S = bezierSegment(P, segment);
  return { point: bezier(S, u), tangent: bezierTangent(S, u), segment, u };
}

const mirror = (K, P) => K.map((k, i) => 2 * k - P[i]);
export function enforceC1(P, moved = -1) {
  for (let k = 3; k < P.length - 1; k += 3)
    if (moved === k + 1) P[k - 1] = mirror(P[k], P[k + 1]);
    else P[k + 1] = mirror(P[k], P[k - 1]);
}
export function c1Error(P) {
  let e = 0;
  for (let k = 3; k < P.length - 1; k += 3) e = Math.max(e, Math.hypot(...P[k + 1].map((x, i) => x - 2 * P[k][i] + P[k - 1][i])));
  return e;
}

const crBasis = t => { const t2 = t * t, t3 = t2 * t; return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2]; };
const crDerivative = t => [(-3 * t * t + 4 * t - 1) / 2, (9 * t * t - 10 * t) / 2, (-9 * t * t + 8 * t + 1) / 2, (3 * t * t - 2 * t) / 2];
export function catmullRomPath(K, t) {
  const n = K.length - 1, [segment, u] = locate(n, t);
  const Q = [K[Math.max(segment - 1, 0)], K[segment], K[segment + 1], K[Math.min(segment + 2, n)]];
  return { point: combine(Q, crBasis(u)), tangent: combine(Q, crDerivative(u)), segment, u };
}
