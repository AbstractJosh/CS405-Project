import { identity, multiply, translate } from '../math/mat4.js';

export class Node {
  constructor(name, { local = identity(), mesh = null, color = [1, 1, 1], mode = 0, shape = false } = {}) {
    Object.assign(this, { name, local, mesh, color, mode, shape, offset: [0, 0, 0], parent: null, children: [], world: identity() });
  }

  matrix() {
    return multiply(translate(...this.offset), this.local);
  }

  add(...nodes) {
    for (const n of nodes) { n.parent = this; this.children.push(n); }
    return this;
  }

  update(parentWorld = identity()) {
    this.world = multiply(parentWorld, this.matrix());
    for (const c of this.children) c.update(this.world);
  }

  *walk(depth = 0) {
    yield [this, depth];
    for (const c of this.children) yield* c.walk(depth + 1);
  }
}
