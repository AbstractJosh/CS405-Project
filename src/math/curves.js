// math/curves.js — curve evaluation. Points are plain arrays of any dimension (the app uses 2-D painting coords).

const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const combine = (P, w) => P[0].map((_, i) => P.reduce((s, p, k) => s + w[k] * p[i], 0));   // Σ w_k · P_k

// Cubic Bernstein basis: B(t) = (1−t)³P0 + 3(1−t)²t P1 + 3(1−t)t² P2 + t³P3, and its derivative in t.
export const bernstein = t => { const u = 1 - t; return [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]; };
export const bernsteinDerivative = t => {
  const u = 1 - t;
  return [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
};
export const bezier = (P, t) => combine(P, bernstein(t));
export const bezierTangent = (P, t) => combine(P, bernsteinDerivative(t));   // B'(0) = 3(P1−P0), B'(1) = 3(P3−P2)

// de Casteljau: lerp neighbouring points by t until one is left. Returns every level; the last is [B(t)].
export function deCasteljau(P, t) {
  const levels = [P];
  while (levels.at(-1).length > 1) {
    const L = levels.at(-1);
    levels.push(L.slice(1).map((p, i) => lerp(L[i], p, t)));
  }
  return levels;
}

// Global t ∈ [0,1] over `segments` equal pieces → [segment index, local u ∈ [0,1]].
function locate(segments, t) {
  const s = Math.min(Math.max(t, 0), 1) * segments, i = Math.min(Math.floor(s), segments - 1);
  return [i, s - i];
}

// Piecewise cubic Bézier: points P0 … P3n. Knots (on the curve) sit at multiples of 3; the rest are handles.
export const isKnot = i => i % 3 === 0;
export const bezierSegment = (P, i) => P.slice(3 * i, 3 * i + 4);
export function bezierPath(P, t) {
  const [segment, u] = locate((P.length - 1) / 3, t), S = bezierSegment(P, segment);
  return { point: bezier(S, u), tangent: bezierTangent(S, u), segment, u };
}

// C¹ at an interior knot K = P3i needs B_i'(1) = B_{i+1}'(0), i.e. 3(K − P_before) = 3(P_after − K),
// so P_after = 2K − P_before: the two handles are mirror images through the knot.
// `moved` is the index just dragged; the handle on the other side of that knot follows it.
const mirror = (K, P) => K.map((k, i) => 2 * k - P[i]);
export function enforceC1(P, moved = -1) {
  for (let k = 3; k < P.length - 1; k += 3)
    if (moved === k + 1) P[k - 1] = mirror(P[k], P[k + 1]);
    else P[k + 1] = mirror(P[k], P[k - 1]);
}
// Largest violation of the C¹ condition over all joints (≈ 0 when enforced).
export function c1Error(P) {
  let e = 0;
  for (let k = 3; k < P.length - 1; k += 3) e = Math.max(e, Math.hypot(...P[k + 1].map((x, i) => x - 2 * P[k][i] + P[k - 1][i])));
  return e;
}

// Uniform Catmull–Rom spline through every point K_i. Segment i runs K_i → K_i+1 using K_i−1 and K_i+2;
// the end points are repeated so the first and last segments have a neighbour.
//   C(t) = ½ [ 2K1 + (K2−K0)t + (2K0−5K1+4K2−K3)t² + (−K0+3K1−3K2+K3)t³ ]
const crBasis = t => { const t2 = t * t, t3 = t2 * t; return [(-t3 + 2 * t2 - t) / 2, (3 * t3 - 5 * t2 + 2) / 2, (-3 * t3 + 4 * t2 + t) / 2, (t3 - t2) / 2]; };
const crDerivative = t => [(-3 * t * t + 4 * t - 1) / 2, (9 * t * t - 10 * t) / 2, (-9 * t * t + 8 * t + 1) / 2, (3 * t * t - 2 * t) / 2];
export function catmullRomPath(K, t) {
  const n = K.length - 1, [segment, u] = locate(n, t);
  const Q = [K[Math.max(segment - 1, 0)], K[segment], K[segment + 1], K[Math.min(segment + 2, n)]];
  return { point: combine(Q, crBasis(u)), tangent: combine(Q, crDerivative(u)), segment, u };
}
