// render/shaders.js — one WGSL module. Every draw gets its own 256-byte slot in a uniform buffer
// (selected with a dynamic offset), holding the matrices exactly as computed by math/mat4.js.
export const SHADER = /* wgsl */ `
struct Draw {
  mvp    : mat4x4f,   // P · V · M
  model  : mat4x4f,   // M (for normals)
  color  : vec4f,     // linear RGB
  params : vec4f,     // x = mode: 0 lit colour, 1 flat colour, 2 lit texture, 3 flat texture
};
@group(0) @binding(0) var<uniform> d : Draw;
@group(0) @binding(1) var samp : sampler;
@group(0) @binding(2) var tex : texture_2d<f32>;

struct MeshOut { @builtin(position) pos : vec4f, @location(0) normal : vec3f, @location(1) uv : vec2f };

@vertex fn vsMesh(@location(0) p : vec3f, @location(1) n : vec3f, @location(2) uv : vec2f) -> MeshOut {
  var o : MeshOut;
  o.pos = d.mvp * vec4f(p, 1.0);
  // Exact for rotation + uniform scale; non-uniform scale bends normals slightly —
  // the exact fix is the inverse-transpose of the model matrix.
  o.normal = (d.model * vec4f(n, 0.0)).xyz;
  o.uv = uv;
  return o;
}

@fragment fn fsMesh(i : MeshOut) -> @location(0) vec4f {
  let mode = u32(d.params.x);
  let texel = textureSample(tex, samp, i.uv).rgb;   // sampled unconditionally: must be in uniform control flow
  var c = d.color.rgb;
  if (mode >= 2u) { c *= texel; }
  if (mode % 2u == 0u) {
    let l = max(dot(normalize(i.normal), normalize(vec3f(0.35, 0.8, 0.5))), 0.0);
    c *= 0.3 + 0.7 * l;
  }
  return vec4f(c, 1.0);
}

struct LineOut { @builtin(position) pos : vec4f, @location(0) color : vec3f };

@vertex fn vsLine(@location(0) p : vec3f, @location(1) c : vec3f) -> LineOut {
  var o : LineOut;
  o.pos = d.mvp * vec4f(p, 1.0);   // lines are already in world space: mvp = P · V
  o.color = c;
  return o;
}

@fragment fn fsLine(i : LineOut) -> @location(0) vec4f { return vec4f(i.color, 1.0); }
`;
