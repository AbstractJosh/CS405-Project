import * as M from './math/mat4.js';
import { deCasteljau, bezierSegment, isKnot, c1Error } from './math/curves.js';
import { createRenderer } from './render/renderer.js';
import { cube, sphere, quad, pyramid, parseOBJ, revolve } from './render/meshes.js';
const OBJS = import.meta.glob('../assets/*.obj', { query: '?raw', import: 'default', eager: true });
import { seg, polyline, axes, frustum, cross, ribbon } from './render/overlay.js';
import { buildWorld, animate, paintingPlane, PAINTING, lin } from './scene/world.js';
import { eyeOf, viewOf, projOf, rayOf, frustumOf } from './scene/camera.js';
import { createCurve } from './scene/curve.js';
import { buildPanel } from './ui/panel.js';
import { attachInput } from './ui/input.js';

const DEFAULTS = {
  view: 'main', axes: false, showFrustum: true, polygon: true, casteljau: true,
  order: 'TRS', tx: 0.55, ty: 1.15, tz: 2.05, axis: 'y', angle: 0.6, s: 0.45,
  animate: true, speed: 1, node: 'bulb', nx: 0, ny: 0, nz: 0,
  target: [0, 1.5, 0.9], yaw: 0.3, pitch: 0.2, dist: 7.5, fov: 50, near: 0.5, far: 30, ortho: false,
  curveType: 'bezier', t: 0.3, ride: true, rideSpeed: 1,
};
const INSPECT = { target: [0.5, 1.5, 4], yaw: 1.2, pitch: 0.45, dist: 20, fov: 50, near: 0.1, far: 100, ortho: false };
const LIFT = { ribbon: 0.012, poly: 0.02, casteljau: 0.025, marker: 0.03, follower: 0.08 };
const COL = {
  clear: { r: 0.02, g: 0.018, b: 0.016, a: 1 }, bezier: lin('#ffd54a'), catmull: lin('#4fc3f7'), poly: lin('#d8d8d8'),
  knot: lin('#e0582a'), handle: lin('#ffffff'), levels: [lin('#6fb3e0'), lin('#7cc478'), lin('#f07a4a')], camera: lin('#ff8a3d'),
};
const fmt3 = p => p.map(x => x.toFixed(2)).join(', ');

async function main() {
  const canvas = document.getElementById('gpu'), hud = document.getElementById('hud');
  let gpu;
  try { gpu = await createRenderer(canvas, PAINTING.url); }
  catch (e) { document.getElementById('err').textContent = `WebGPU could not start: ${e.message} Use a current Chrome, Edge, Safari or Firefox.`; return; }

  const meshes = { cube: gpu.mesh(cube()), sphere: gpu.mesh(sphere()), quad: gpu.mesh(quad()), pyramid: gpu.mesh(pyramid()) };
  for (const [path, text] of Object.entries(OBJS)) meshes[path.match(/(\w+)\.obj$/)[1]] = gpu.mesh(parseOBJ(text));
  const world = buildWorld(meshes), nodes = world.nodes, plane = paintingPlane(nodes.painting);
  const curve = createCurve({ artist: PAINTING.artist, title: PAINTING.title, pixels: PAINTING.px });
  const state = structuredClone(DEFAULTS);
  const profile = t => {
    const { point: [u, v], tangent: [du, dv] } = curve.evaluate(state.curveType, t), w = PAINTING.width, h = PAINTING.height;
    return { point: [u * w, v * h], tangent: [du * w, dv * h] };
  };
  let melonKey = '';
  const frames = [...world.root.walk()].filter(([n]) => !n.shape);
  const tree = frames.map(([n, d]) => (d ? '   '.repeat(d - 1) + '└─ ' : '') + n.name).join('\n');
  let shownNode = null, time = 0, views = [], vertices = 0, frameMs = 16.7, cpuMs = 0, last = performance.now();

  const ui = buildPanel(document.getElementById('panel'), state);
  ui.section('View · reset · debug (Part E)');
  ui.select('view', 'view', { main: 'main camera', inspect: 'inspection camera', split: 'split: main | inspection' });
  ui.check('axes', 'node axes (scene-graph frames)');
  ui.check('showFrustum', 'main camera + frustum in inspection view');
  ui.check('polygon', 'control polygon');
  ui.check('casteljau', 'de Casteljau construction');
  ui.buttons({ 'Reset scene': reset });

  ui.section('A · Transformations', 'Controls the textured box. Both products are shown; the one marked ◀ is used.');
  ui.select('order', 'order', { TRS: 'M = T · R · S', SRT: 'M = S · R · T' });
  ui.slider('tx', 'translate x', -3, 3, 0.05);
  ui.slider('ty', 'translate y', -1, 3, 0.05);
  ui.slider('tz', 'translate z', -1, 4, 0.05);
  ui.select('axis', 'rotation axis', { x: 'x', y: 'y', z: 'z' });
  ui.slider('angle', 'angle (rad)', -3.14, 3.14, 0.01);
  ui.slider('s', 'scale', 0.1, 2.5, 0.01);
  const outA = ui.pre();

  ui.section('B · Scene graph', 'Desk lamp: table → lamp base → arm 1 → arm 2 → lamp head → bulb.');
  ui.check('animate', 'animate joints');
  ui.slider('speed', 'speed', 0, 3, 0.05);
  ui.select('node', 'inspect node', Object.fromEntries(frames.map(([n]) => [n.name, n.name])));
  ui.slider('nx', 'x', -2, 2, 0.01);
  ui.slider('ny', 'y', -2, 2, 0.01);
  ui.slider('nz', 'z', -2, 2, 0.01);
  const outB = ui.pre();

  ui.section('C · Camera & projection', 'Drag on the main view to orbit, mouse wheel to zoom.');
  ui.slider('yaw', 'azimuth (rad)', -3.14, 3.14, 0.01);
  ui.slider('pitch', 'elevation (rad)', -1.2, 1.57, 0.01);
  ui.slider('dist', 'distance', 2, 25, 0.1);
  ui.slider('fov', 'fov y (°)', 10, 120, 1);
  ui.slider('near', 'near', 0.05, 5, 0.05);
  ui.slider('far', 'far', 6, 100, 1);
  ui.check('ortho', 'orthographic projection');
  ui.buttons({ 'Top view (up ∥ view direction)': () => { state.pitch = Math.PI / 2; } });
  const outC = ui.pre();

  ui.section('D · Curves over the painting',
    'Drag the points on the painting: round = knots, square = Bézier handles. <b>Shift+click</b> on the painting appends a segment (Bézier) or a point (Catmull–Rom).' +
    '<br><b>Bonus:</b> the melon on the table is this curve revolved about its chord; it follows your edits.');
  ui.select('curveType', 'curve', { bezier: 'piecewise cubic Bézier (C¹)', catmull: 'Catmull–Rom (through points)' });
  ui.slider('t', 'parameter t', 0, 1, 0.001);
  ui.check('ride', 'animate the arrow along the curve');
  ui.slider('rideSpeed', 'speed', 0, 3, 0.05);
  ui.buttons({ 'Export JSON': exportJSON, 'Remove last': () => curve.removeLast(state.curveType), 'Reset curve': () => curve.reset() });
  const outD = ui.pre(), outJSON = ui.pre();
  outJSON.hidden = true;

  function reset() {
    Object.assign(state, structuredClone(DEFAULTS));
    curve.reset();
    for (const n of Object.values(nodes)) n.offset = [0, 0, 0];
    time = 0;
    outJSON.hidden = true;
  }

  function exportJSON() {
    const json = curve.toJSON();
    outJSON.textContent = json;
    outJSON.hidden = false;
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'curve.json' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const viewAt = ([x, y]) => views.find(({ rect: [rx, ry, w, h] }) => x >= rx && x < rx + w && y >= ry && y < ry + h);
  const ndc = (v, [x, y]) => [((x - v.rect[0]) / v.rect[2]) * 2 - 1, 1 - ((y - v.rect[1]) / v.rect[3]) * 2];
  const uvAt = (v, p) => v && plane.hit(rayOf(v.cam, v.aspect, ...ndc(v, p)));
  const clamp01 = x => Math.min(1, Math.max(0, x));
  attachInput(canvas, {
    viewAt,
    pick(p) {
      const v = viewAt(p);
      if (!v) return null;
      const VP = M.multiply(v.proj, v.view), r = (14 * canvas.width) / canvas.clientWidth;
      let best = null, bestD = r * r;
      curve[state.curveType].forEach((uv, i) => {
        const c = M.transformPoint(VP, plane.toWorld(uv, LIFT.marker));
        if (c[3] <= 0) return;
        const sx = v.rect[0] + (c[0] / c[3] * 0.5 + 0.5) * v.rect[2], sy = v.rect[1] + (0.5 - c[1] / c[3] * 0.5) * v.rect[3];
        const d = (sx - p[0]) ** 2 + (sy - p[1]) ** 2;
        if (d < bestD) { bestD = d; best = { index: i, view: v }; }
      });
      return best;
    },
    drag({ index, view }, p) { const uv = uvAt(view, p); if (uv) curve.move(state.curveType, index, uv.map(clamp01)); },
    add(p) { const uv = uvAt(viewAt(p), p); if (uv && uv.every(x => x >= 0 && x <= 1)) curve.add(state.curveType, uv); },
    orbit(v, dx, dy) {
      if (v?.cam !== state) return;
      state.yaw -= dx * 0.006;
      state.pitch = Math.min(Math.PI / 2, Math.max(-1.2, state.pitch + dy * 0.006));
    },
    zoom(dy) { state.dist = Math.min(25, Math.max(2, state.dist * Math.exp(dy * 0.001))); },
  });

  const partA = () => {
    const T = M.translate(state.tx, state.ty, state.tz), R = M[`rotate${state.axis.toUpperCase()}`](state.angle), S = M.scale(state.s, state.s, state.s);
    return { TRS: M.compose(T, R, S), SRT: M.compose(S, R, T) };
  };

  function curveOverlay() {
    const lines = [], tris = [], marks = [];
    if (state.axes) for (const [n] of frames) axes(lines, n.world);
    const type = state.curveType, bez = type === 'bezier', P = curve[type], [ex, ey, normal] = plane.axes();
    const samples = Array.from({ length: 301 }, (_, k) => plane.toWorld(curve.evaluate(type, k / 300).point, LIFT.ribbon));
    ribbon(tris, samples, 0.03, bez ? COL.bezier : COL.catmull, normal);
    if (state.polygon) polyline(lines, P.map(uv => plane.toWorld(uv, LIFT.poly)), COL.poly);
    if (state.casteljau && bez) {
      const { segment, u } = curve.evaluate(type, state.t);
      deCasteljau(bezierSegment(P, segment), u).slice(1).forEach((level, d) => {
        const pts = level.map(uv => plane.toWorld(uv, LIFT.casteljau));
        polyline(lines, pts, COL.levels[d]);
        pts.forEach(p => cross(lines, p, 0.05, COL.levels[d], ex, ey));
      });
    }
    P.forEach((uv, i) => {
      const handle = bez && !isKnot(i), size = handle ? 0.06 : 0.08;
      marks.push({ mesh: handle ? meshes.cube : meshes.sphere, color: handle ? COL.handle : COL.knot, mode: 1,
        world: M.compose(M.translate(...plane.toWorld(uv, LIFT.marker)), M.scale(size, size, size)) });
    });
    return { lines, tris, marks };
  }

  function cameraGizmo(aspect) {
    const lines = [], eye = eyeOf(state);
    frustum(lines, frustumOf(state, aspect), COL.camera, state.ortho ? null : eye);
    seg(lines, eye, state.target, COL.poly);
    return { lines, marks: [{ mesh: meshes.sphere, world: M.compose(M.translate(...eye), M.scale(0.2, 0.2, 0.2)), color: COL.camera, mode: 1 }] };
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    frameMs += (now - last - frameMs) * 0.05;
    last = now;
    const t0 = performance.now();

    const dpr = Math.min(devicePixelRatio, 2), W = Math.max(1, Math.round(canvas.clientWidth * dpr)), H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

    if (state.animate) time += dt * state.speed;
    if (state.ride) state.t = (state.t + dt * 0.08 * state.rideSpeed) % 1;
    animate(nodes, time);
    const A = partA();
    nodes['part A'].local = A[state.order];
    const { point, tangent } = curve.evaluate(state.curveType, state.t), [fx, fy] = plane.toLocal(point);
    const heading = Math.atan2(tangent[1] * PAINTING.height, tangent[0] * PAINTING.width);
    nodes.follower.local = M.compose(M.translate(fx, fy, LIFT.follower), M.rotateZ(heading), M.scale(0.26, 0.13, 0.13));
    const key = state.curveType + JSON.stringify(curve[state.curveType]);
    if (key !== melonKey) {
      const old = nodes.melon.mesh;
      nodes.melon.mesh = gpu.mesh(revolve(profile));
      old?.vbuf.destroy(); old?.ibuf.destroy();
      melonKey = key;
    }
    const picked = nodes[state.node];
    if (picked !== shownNode) { [state.nx, state.ny, state.nz] = picked.offset; shownNode = picked; }
    picked.offset = [state.nx, state.ny, state.nz];
    world.root.update();

    const ov = curveOverlay(), split = state.view === 'split', wide = W >= H, half = Math.floor((wide ? W : H) / 2);
    const layout = !split ? [[state.view === 'main' ? state : INSPECT, [0, 0, W, H]]]
      : wide ? [[state, [0, 0, half - 1, H]], [INSPECT, [half + 1, 0, W - half - 1, H]]]
      : [[state, [0, 0, W, half - 1]], [INSPECT, [0, half + 1, W, H - half - 1]]];
    const mainAspect = split ? layout[0][1][2] / layout[0][1][3] : W / H;
    const sceneDraws = [...world.root.walk()].map(([n]) => n).filter(n => n.mesh);
    views = layout.map(([cam, rect]) => {
      const aspect = rect[2] / rect[3];
      const v = { cam, rect, aspect, view: viewOf(cam), proj: projOf(cam, aspect), draws: [...sceneDraws, ...ov.marks], lines: ov.lines, tris: ov.tris };
      if (cam === INSPECT && state.showFrustum) { const g = cameraGizmo(mainAspect); v.lines = [...ov.lines, ...g.lines]; v.draws.push(...g.marks); }
      return v;
    });
    vertices = gpu.render(views, COL.clear);
    cpuMs += (performance.now() - t0 - cpuMs) * 0.05;
    showInfo(A, mainAspect, split && (wide ? 'left: main camera · right: inspection camera' : 'top: main camera · bottom: inspection camera'));
    requestAnimationFrame(frame);
  }

  function showInfo(A, mainAspect, split) {
    ui.refresh();
    const mark = k => (state.order === k ? ' ◀ in use' : '');
    const left = [`T·R·S${mark('TRS')}`.padEnd(28), ...M.format(A.TRS)], right = [` S·R·T${mark('SRT')}`, ...M.format(A.SRT)];
    outA.textContent = left.map((r, i) => `${r} │${right[i]}`).join('\n');

    const n = nodes[state.node], o = M.transformPoint(n.world, [0, 0, 0]);
    outB.textContent = `${tree}\n\n${n.name} · local\n${M.format(n.matrix()).join('\n')}\n\n` +
      `${n.name} · world = world(${n.parent?.name ?? '—'}) · local\n${M.format(n.world).join('\n')}\n\norigin in world: (${fmt3(o.slice(0, 3))})`;

    const degenerate = Math.abs(state.pitch) >= Math.PI / 2 - 1e-9;
    outC.textContent = `eye     (${fmt3(eyeOf(state))})\ntarget  (${fmt3(state.target)})\nup      (0.00, 1.00, 0.00)${degenerate ? '  ∥ view dir → fallback axis' : ''}\n` +
      `fov y   ${state.fov}°   aspect ${mainAspect.toFixed(2)}\nnear    ${state.near}   far ${state.far}\nproj    ${state.ortho ? 'orthographic' : 'perspective'}\n\n` +
      `V = lookAt(eye, target, up)\n${M.format(viewOf(state)).join('\n')}\n\nP  (depth → z ∈ [0, 1])\n${M.format(projOf(state, mainAspect), 3).join('\n')}`;

    const bez = state.curveType === 'bezier', P = curve[state.curveType], ev = curve.evaluate(state.curveType, state.t);
    outD.textContent = `${bez ? 'piecewise cubic Bézier' : 'Catmull–Rom'} · ${P.length} points · ${bez ? (P.length - 1) / 3 : P.length - 1} segments\n` +
      `t = ${state.t.toFixed(3)} → segment ${ev.segment}, u = ${ev.u.toFixed(3)}\nC(t)  = (${ev.point.map(x => x.toFixed(4)).join(', ')})\n` +
      `C'(t) = (${ev.tangent.map(x => x.toFixed(3)).join(', ')})` + (bez ? `\nC¹ error at joints: ${c1Error(P).toExponential(1)}` : '');

    hud.textContent = `${frameMs.toFixed(1)} ms/frame · ${(1000 / frameMs).toFixed(0)} fps · CPU ${cpuMs.toFixed(2)} ms · ${vertices.toLocaleString()} vertices/frame\n` +
      `${gpu.gpuName}\n${split || `${state.view === 'main' ? 'main' : 'inspection'} camera`}`;
  }

  requestAnimationFrame(frame);
}

main();
