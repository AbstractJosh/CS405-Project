# CS405 Project 1 — Transformations, Projection & Curves from Paintings

**Painting:** Şeker Ahmed Paşa — *Kavunlu Natürmort* (Still Life with Melon), Sakıp Sabancı Museum.
The painting hangs on a wall as a textured quad. In front of it is a table with a weight bench and a barbell (OBJ models in `assets/`), a box you control
from the UI and an animated desk lamp built from five OBJ parts. A curve traced along the top of the painted melon carries an arrow along its tangent.

WebGPU + WGSL only. All matrix, camera, scene-graph and curve maths is written in this repository; no maths or 3D library is used.

## Run

```bash
npm install && npm run dev      # then open the printed URL (http://localhost:5173)
npm test                        # unit tests for the maths (Node's built-in test runner)
```

You need a browser with WebGPU: current Chrome or Edge, Safari 26+, or Firefox 141+ (Windows).

## Controls

**Mouse (on the 3D view)**

| Action | Effect |
|---|---|
| drag empty space in the main view | orbit the main camera around its target |
| mouse wheel | zoom the main camera in or out |
| drag a point on the painting | move a control point (round = knot, square = Bézier handle) |
| shift + click on the painting | append a Bézier segment, or a Catmull–Rom point |

**Panel**

| Section | Controls |
|---|---|
| View · reset · debug (E) | view: main camera / inspection camera / split; **Reset scene**; toggles for node axes, the main camera's frustum, the control polygon and the de Casteljau construction |
| A · Transformations | order `M = T·R·S` or `M = S·R·T`; translate x/y/z, rotation axis and angle, scale of the textured box. Both matrices are always shown, and the one marked ◀ is in use |
| B · Scene graph | animate the lamp joints and set their speed; pick a node to see its local and world matrices and its world position |
| C · Camera & projection | azimuth, elevation, distance, fov, near, far, orthographic toggle; **Top view** puts *up* parallel to the view direction to show the degenerate case. Shows eye, target, up, V and P |
| D · Curves | Bézier (C¹) or Catmull–Rom; parameter *t* (also drives the de Casteljau drawing); animate the arrow along the curve; **Export JSON** (downloads `curve.json`), **Remove last** segment/point, **Reset curve** |

The overlay at the top left shows the frame time, fps, CPU time per frame, the number of vertices submitted per frame and the GPU name.

## Bonus

**Surface of revolution.** The golden melon on the table is the traced curve (Part D) revolved 360° about its chord,
the line from its first to its last point (`revolve` in `src/render/meshes.js`). Normals come from the curve tangent.
It is re-swept whenever the curve changes, so dragging a control point reshapes the melon live, and switching the
curve type sweeps the Catmull–Rom curve instead.

## Structure

```
src/
  math/    vec3.js · mat4.js (column-major, WebGPU depth 0…1) · curves.js (Bézier, de Casteljau, C¹, Catmull–Rom)
  scene/   node.js (scene graph) · camera.js (orbit camera, picking ray, frustum) · world.js (the set, painting plane) · curve.js (traced curves, JSON)
  render/  renderer.js (WebGPU device, pipelines, per-draw uniforms) · shaders.js (WGSL) · meshes.js · overlay.js (debug lines)
  ui/      panel.js (HTML controls bound to state) · input.js (mouse)
  main.js  frame loop that connects them
tests/math.test.js
curve.json   exported default trace (normalised painting coordinates)
```

## Conventions

- Column vectors, `p' = M·p`; matrices are column-major `Float32Array(16)` and are uploaded to the uniform buffer unchanged.
- Objects are placed with `M = T·R·S` (scale, then rotate, then translate). `S·R·T` exists only for the Part A comparison.
- The camera looks down its −z axis. Projection maps view depth −near → 0 and −far → 1 (WebGPU clip space).
- Painting coordinates are normalised: (0,0) is the bottom-left corner and (1,1) the top-right.
- Colours are linear. The canvas is rendered through an `*-srgb` view and the painting is stored as `rgba8unorm-srgb`.
