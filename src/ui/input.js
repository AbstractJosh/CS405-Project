export function attachInput(canvas, app) {
  let drag = null, last = null;
  const at = e => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * canvas.width) / r.width, ((e.clientY - r.top) * canvas.height) / r.height];
  };
  canvas.addEventListener('pointerdown', e => {
    const p = at(e);
    if (e.shiftKey) return app.add(p);
    drag = app.pick(p) ?? { orbit: app.viewAt(p) };
    last = p;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = at(e);
    if (drag.orbit) app.orbit(drag.orbit, p[0] - last[0], p[1] - last[1]);
    else app.drag(drag, p);
    last = p;
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); app.zoom(e.deltaY); }, { passive: false });
}
