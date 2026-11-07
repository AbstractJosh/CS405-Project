import { SHADER } from './shaders.js';
import { identity, multiply } from '../math/mat4.js';

const SLOT = 256;
const MAX_DRAWS = 2048;

export async function createRenderer(canvas, imageUrl) {
  if (!navigator.gpu) throw new Error('this browser does not expose WebGPU (navigator.gpu is undefined).');
  const { VERTEX, INDEX, UNIFORM, COPY_DST } = GPUBufferUsage;
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('no WebGPU adapter is available.');
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', e => console.error('WebGPU:', e.error.message));

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat(), srgb = `${format}-srgb`;
  context.configure({ device, format, viewFormats: [srgb], alphaMode: 'opaque' });

  const bmp = await createImageBitmap(await (await fetch(imageUrl)).blob());
  const texture = device.createTexture({
    size: [bmp.width, bmp.height], format: 'rgba8unorm-srgb',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source: bmp }, { texture }, [bmp.width, bmp.height]);

  const uniforms = device.createBuffer({ size: SLOT * MAX_DRAWS, usage: UNIFORM | COPY_DST });
  const layout = device.createBindGroupLayout({ entries: [
    { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 160 } },
    { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
  ] });
  const bindGroup = device.createBindGroup({ layout, entries: [
    { binding: 0, resource: { buffer: uniforms, size: 160 } },
    { binding: 1, resource: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }) },
    { binding: 2, resource: texture.createView() },
  ] });

  const module = device.createShaderModule({ code: SHADER });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const attrs = list => list.map(([format, offset], shaderLocation) => ({ format, offset, shaderLocation }));
  const meshBuffers = [{ arrayStride: 32, attributes: attrs([['float32x3', 0], ['float32x3', 12], ['float32x2', 24]]) }];
  const lineBuffers = [{ arrayStride: 24, attributes: attrs([['float32x3', 0], ['float32x3', 12]]) }];
  const pipeline = (vs, fs, buffers, topology, cullMode) => device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: { module, entryPoint: vs, buffers },
    fragment: { module, entryPoint: fs, targets: [{ format: srgb }] },
    primitive: { topology, cullMode, frontFace: 'ccw' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });
  const meshPipe = pipeline('vsMesh', 'fsMesh', meshBuffers, 'triangle-list', 'back');
  const linePipe = pipeline('vsLine', 'fsLine', lineBuffers, 'line-list', 'none');
  const triPipe = pipeline('vsLine', 'fsLine', lineBuffers, 'triangle-list', 'none');

  function mesh({ positions, normals, uvs, indices }) {
    const n = positions.length / 3, data = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) data.set([...positions.slice(3 * i, 3 * i + 3), ...normals.slice(3 * i, 3 * i + 3), ...uvs.slice(2 * i, 2 * i + 2)], 8 * i);
    const vbuf = device.createBuffer({ size: data.byteLength, usage: VERTEX | COPY_DST });
    const ibuf = device.createBuffer({ size: indices.length * 4, usage: INDEX | COPY_DST });
    device.queue.writeBuffer(vbuf, 0, data);
    device.queue.writeBuffer(ibuf, 0, new Uint32Array(indices));
    return { vbuf, ibuf, count: indices.length };
  }

  const slots = new Float32Array((MAX_DRAWS * SLOT) / 4);
  let depth = null, imm = null;

  function render(views, clearValue) {
    const W = canvas.width, H = canvas.height;
    if (!depth || depth.width !== W || depth.height !== H) {
      depth?.destroy();
      depth = device.createTexture({ size: [W, H], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
    }
    const floats = views.reduce((s, v) => s + v.lines.length + v.tris.length, 0);
    if (!imm || imm.size < floats * 4) { imm?.destroy(); imm = device.createBuffer({ size: Math.max(floats * 8, 1 << 16), usage: VERTEX | COPY_DST }); }
    const immData = new Float32Array(floats);

    let n = 0, used = 0, vertices = 0;
    const slot = (mvp, model, color, mode) => {
      if (n >= MAX_DRAWS) throw new Error('too many draws for the uniform buffer');
      const o = n * (SLOT / 4);
      slots.set(mvp, o); slots.set(model, o + 16); slots.set(color, o + 32); slots[o + 35] = 1; slots[o + 36] = mode;
      return n++ * SLOT;
    };

    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView({ format: srgb }), clearValue, loadOp: 'clear', storeOp: 'store' }],
      depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    });
    for (const v of views) {
      const [x, y, w, h] = v.rect;
      pass.setViewport(x, y, w, h, 0, 1);
      pass.setScissorRect(x, y, w, h);
      const VP = multiply(v.proj, v.view);
      pass.setPipeline(meshPipe);
      for (const d of v.draws) {
        pass.setBindGroup(0, bindGroup, [slot(multiply(VP, d.world), d.world, d.color, d.mode)]);
        pass.setVertexBuffer(0, d.mesh.vbuf);
        pass.setIndexBuffer(d.mesh.ibuf, 'uint32');
        pass.drawIndexed(d.mesh.count);
        vertices += d.mesh.count;
      }
      const offset = slot(VP, identity(), [1, 1, 1], 1);
      for (const [list, pipe] of [[v.lines, linePipe], [v.tris, triPipe]]) {
        if (!list.length) continue;
        immData.set(list, used);
        pass.setPipeline(pipe);
        pass.setBindGroup(0, bindGroup, [offset]);
        pass.setVertexBuffer(0, imm, used * 4);
        pass.draw(list.length / 6);
        used += list.length;
        vertices += list.length / 6;
      }
    }
    pass.end();
    device.queue.writeBuffer(uniforms, 0, slots, 0, n * (SLOT / 4));
    if (used) device.queue.writeBuffer(imm, 0, immData, 0, used);
    device.queue.submit([enc.finish()]);
    return vertices;
  }

  const info = adapter.info ?? {};
  return { mesh, render, device, gpuName: [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') || 'unknown GPU' };
}
