// scene/node.js — scene-graph node. Each node stores only its LOCAL transform (relative to its parent);
// its WORLD transform is the product of every local matrix on the path from the root:
//   world(n) = world(parent) · local(n) = local(root) · … · local(parent) · local(n)
import { identity, multiply } from '../math/mat4.js';

export class Node {
  // shape: true marks pure geometry nodes (a box scaled into a table top, …) as opposed to frames/joints;
  // debug axes are drawn only for frames, and scale on a shape node never leaks into its siblings.
  constructor(name, { local = identity(), mesh = null, color = [1, 1, 1], mode = 0, shape = false } = {}) {
    Object.assign(this, { name, local, mesh, color, mode, shape, parent: null, children: [], world: identity() });
  }

  add(...nodes) {
    for (const n of nodes) { n.parent = this; this.children.push(n); }
    return this;
  }

  // Depth-first traversal: parent world matrices are computed before their children need them.
  update(parentWorld = identity()) {
    this.world = multiply(parentWorld, this.local);
    for (const c of this.children) c.update(this.world);
  }

  *walk(depth = 0) {
    yield [this, depth];
    for (const c of this.children) yield* c.walk(depth + 1);
  }
}
