// ui/panel.js — side panel of native HTML controls bound to keys of one shared `state` object.
// refresh() pushes state back into every control (after a reset, or when the mouse/animation changed it).
const h = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

export function buildPanel(root, state) {
  const refreshers = [];
  let sec = root;
  const row = (label, ...kids) => sec.appendChild(h('label', { className: 'row' }, h('span', { textContent: label }), ...kids));

  return {
    section(title, hint) {
      sec = root.appendChild(h('section', {}, h('h2', { textContent: title })));
      if (hint) sec.append(h('p', { className: 'hint', innerHTML: hint }));
    },
    slider(key, label, min, max, step) {
      const input = h('input', { type: 'range', min, max, step }), out = h('output');
      const sync = () => { input.value = state[key]; out.textContent = (+state[key]).toFixed(step >= 1 ? 0 : 2); };
      input.oninput = () => { state[key] = +input.value; sync(); };
      refreshers.push(sync);
      row(label, input, out);
    },
    check(key, label) {
      const input = h('input', { type: 'checkbox', onchange: () => { state[key] = input.checked; } });
      refreshers.push(() => { input.checked = state[key]; });
      sec.append(h('label', { className: 'chk' }, input, ' ' + label));
    },
    select(key, label, options) {
      const s = h('select', { onchange: () => { state[key] = s.value; } }, ...Object.entries(options).map(([value, textContent]) => h('option', { value, textContent })));
      refreshers.push(() => { if (s.value !== state[key]) s.value = state[key]; });
      row(label, s);
    },
    buttons(map) { sec.append(h('div', { className: 'btns' }, ...Object.entries(map).map(([textContent, onclick]) => h('button', { textContent, onclick })))); },
    pre: () => sec.appendChild(h('pre')),
    refresh() { refreshers.forEach(f => f()); },
  };
}
