import { compose, translate, rotateY, rotateZ, scale, transformPoint, invertRigid } from '../math/mat4.js';
import { Node } from './node.js';

export const PAINTING = {
  url: 'kavunlu.jpg', px: [720, 502],
  artist: 'Şeker Ahmed Paşa', title: 'Kavunlu Natürmort (Still Life with Melon)',
  width: 3.6, center: [0, 2, 0],
};
PAINTING.height = PAINTING.width * PAINTING.px[1] / PAINTING.px[0];

export const lin = hex => [1, 3, 5].map(i => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);

export function buildWorld(meshes) {
  const shape = (name, mesh, hex, local, mode = 0) => new Node(name, { mesh, color: lin(hex), local, mode, shape: true });

  const painting = new Node('painting', { local: translate(...PAINTING.center) }).add(
    shape('canvas', meshes.quad, '#ffffff', scale(PAINTING.width, PAINTING.height, 1), 3),
    shape('frame', meshes.cube, '#5a3d1e', compose(translate(0, 0, -0.04), scale(PAINTING.width + 0.18, PAINTING.height + 0.18, 0.06))),
    new Node('follower', { mesh: meshes.pyramid, color: lin('#f4f1ea') }),
  );

  const table = new Node('table', { local: translate(0, 0, 1.6) }).add(
    shape('table top', meshes.cube, '#9b917f', compose(translate(0, 0.88, 0), scale(3, 0.08, 1.4))),
    ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z], i) =>
      shape(`leg ${i + 1}`, meshes.cube, '#4d3a28', compose(translate(1.35 * x, 0.42, 0.6 * z), scale(0.08, 0.84, 0.08)))),
    new Node('bench', { mesh: meshes.bench, color: lin('#34343a'), local: compose(translate(-0.8, 0.92, -0.2), rotateY(Math.PI / 2), scale(0.8, 0.8, 0.8)) }),
    shape('melon', undefined, '#c7a03a', compose(translate(0.15, 0.92, -0.35), rotateY(0.3), scale(0.8, 0.8, 0.8))),
    new Node('barbell', { mesh: meshes.barbell, color: lin('#6b6e75'), local: compose(translate(-0.65, 0.92, 0.45), rotateY(0.15), scale(0.9, 0.9, 0.9)) }),
  );
  const lamp = new Node('lamp base', { local: translate(1.05, 0.92, -0.3) });
  const arm1 = new Node('arm 1'), arm2 = new Node('arm 2'), head = new Node('lamp head');
  const bulb = new Node('bulb', { mesh: meshes.sphere, color: lin('#ffe8a0'), mode: 1, local: compose(translate(0, -0.17, 0), scale(0.12, 0.12, 0.12)) });
  lamp.add(shape('lamp foot', meshes.lamp_base, '#26262b', scale(0.4, 0.4, 0.4)), arm1);
  arm1.add(shape('rod 1', meshes.lamp_lower_arm, '#8a8d94', scale(0.8, 0.8, 0.8)),
    shape('elbow', meshes.lamp_arm_joint, '#26262b', compose(translate(0, 0.74, 0), scale(0.14, 0.14, 0.14))), arm2);
  arm2.add(shape('rod 2', meshes.lamp_upper_arm, '#8a8d94', scale(0.6, 0.6, 0.6)), head);
  head.add(shape('shade', meshes.lamp_head, '#2f5d46', compose(translate(-0.17, -0.085, 0), rotateZ(-Math.PI / 2), scale(0.34, 0.34, 0.34))), bulb);
  table.add(lamp);

  const root = new Node('root').add(
    shape('wall', meshes.cube, '#2a2420', compose(translate(0, 3, -0.15), scale(16, 6, 0.1))),
    shape('floor', meshes.cube, '#3b322b', compose(translate(0, -0.05, 4), scale(16, 0.1, 8))),
    painting, table,
    new Node('part A', { mesh: meshes.cube, color: [1, 1, 1], mode: 2 }),
  );
  const nodes = Object.fromEntries([...root.walk()].map(([n]) => [n.name, n]));
  animate(nodes, 0);
  root.update();
  return { root, nodes };
}

export function animate(nodes, t) {
  nodes['arm 1'].local = compose(translate(0, 0.127, 0), rotateY(0.6 * t), rotateZ(0.5 + 0.2 * Math.sin(1.3 * t)));
  nodes['arm 2'].local = compose(translate(0, 0.8, 0), rotateZ(-1.2 + 0.35 * Math.sin(0.9 * t + 1)));
  nodes['lamp head'].local = compose(translate(0, 0.6, 0), rotateZ(0.7 + 0.25 * Math.sin(1.7 * t)));
}

export function paintingPlane(node) {
  const { width: w, height: h } = PAINTING;
  const toLocal = ([u, v]) => [(u - 0.5) * w, (v - 0.5) * h];
  const axis = i => transformPoint(node.world, [i === 0, i === 1, i === 2].map(Number), 0).slice(0, 3);
  return {
    toLocal,
    toWorld: (uv, lift = 0) => transformPoint(node.world, [...toLocal(uv), lift]).slice(0, 3),
    axes: () => [axis(0), axis(1), axis(2)],
    hit({ origin, dir }) {
      const toLocalM = invertRigid(node.world), o = transformPoint(toLocalM, origin), d = transformPoint(toLocalM, dir, 0);
      if (Math.abs(d[2]) < 1e-9) return null;
      const s = -o[2] / d[2];
      return s < 0 ? null : [(o[0] + s * d[0]) / w + 0.5, (o[1] + s * d[1]) / h + 0.5];
    },
  };
}
