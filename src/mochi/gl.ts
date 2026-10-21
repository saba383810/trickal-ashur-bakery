// キャラの絵（2D キャンバスに描いたスプライト）を、もちほっぺメーカーと同じ頂点シェーダの式で変形して描く。
// 変形は頂点シェーダで解析的に計算し、引っぱられた部分ほど手前（深度）に描いて、伸びたほっぺが下に潜らないようにする。
// WebGL2 が使えない環境では create() が null を返すので、呼び出し側は変形なしで描く。
import { MOCHI, type Pinch } from './pinch';

const VERTEX = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aRest;

uniform vec2 uSprite;   // スプライトの大きさ px
uniform vec2 uOrigin;   // スプライト内の頭の中心 px
uniform float uK;       // 頭の単位 1 あたりの px
uniform float uMargin;  // 出力キャンバスの伸びしろ px
uniform vec2 uOut;      // 出力キャンバスの大きさ px
uniform int uGrabCount;
uniform vec4 uGrabA[${MOCHI.maxGrabs}];    // anchor.xy, radiusEff, strength
uniform vec2 uGrabPull[${MOCHI.maxGrabs}];
uniform float uBulge;
uniform vec4 uEye;     // 動かさない目のまわり: 中心 x（左右対称）, y, rx, ry
uniform vec3 uMask;    // 目のまわりのぼかし幅, 首の y（ここから 1→0）

out vec2 vUV;

float falloff(float t) {
  float s = 1.0 - t;
  return s * s * s * (6.0 * t * t + 3.0 * t + 1.0);
}
float ring(float t) {
  return 6.75 * t * (1.0 - t) * (1.0 - t);
}

void main() {
  vec2 px = aRest * uSprite;
  vec2 p = (px - uOrigin) / uK;
  vec2 disp = vec2(0.0);
  float wsum = 0.0;
  for (int i = 0; i < ${MOCHI.maxGrabs}; i++) {
    if (i >= uGrabCount) break;
    float strength = uGrabA[i].w;
    if (strength <= 0.0) continue;
    vec2 rel = p - uGrabA[i].xy;
    float d = length(rel);
    float t = clamp(d / uGrabA[i].z, 0.0, 1.0);
    float w = falloff(t) * strength;
    vec2 pull = uGrabPull[i];
    vec2 dir = d > 1e-5 ? rel / d : vec2(0.0);
    disp += w * pull + uBulge * length(pull) * ring(t) * dir * strength;
    wsum += w;
  }
  float de = length(vec2(abs(p.x) - uEye.x, p.y - uEye.y) / uEye.zw);
  float m = smoothstep(1.0, 1.0 + uMask.x, de) * (1.0 - smoothstep(uMask.y, uMask.z, p.y));
  disp *= m / max(1.0, wsum);
  float lift = clamp(wsum, 0.0, 1.0) * m;
  vec2 outPx = (p + disp) * uK + uOrigin + uMargin;
  vec2 clip = outPx / uOut * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, -0.5 * lift, 1.0);
  vUV = aRest;
}
`;

const FRAGMENT = /* glsl */ `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uPass;
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUV);
  // 不透明パス（深度あり）と、半透明のフチのパス（深度書き込みなし）に分ける
  if (uPass < 0.5) {
    if (c.a < 0.95) discard;
  } else {
    if (c.a >= 0.95) discard;
  }
  outColor = c;
}
`;

const UNIFORMS = ['uSprite', 'uOrigin', 'uK', 'uMargin', 'uOut', 'uGrabCount', 'uGrabA', 'uGrabPull', 'uBulge', 'uEye', 'uMask', 'uTex', 'uPass'] as const;

export interface MochiOutput {
  canvas: HTMLCanvasElement;
  /** 出力キャンバス内の頭の中心 px */
  ox: number;
  oy: number;
}

export class MochiRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  private tex: WebGLTexture;
  private vao: WebGLVertexArrayObject | null = null;
  private buffers: WebGLBuffer[] = [];
  private meshKey = '';
  private indexCount = 0;
  private lost = false;

  static create(): MochiRenderer | null {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true });
      if (!gl) return null;
      return new MochiRenderer(canvas, gl);
    } catch {
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.program = link(gl);
    this.u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(this.program, n)])) as typeof this.u;
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  get ok(): boolean {
    return !this.lost;
  }

  /**
   * sprite を pinch の状態で変形して描く。
   * origin = スプライト内の頭の中心 px、k = 頭の単位 1 あたりの px、margin = 伸びしろ px
   */
  render(sprite: HTMLCanvasElement, origin: { x: number; y: number }, k: number, margin: number, pinch: Pinch): MochiOutput | null {
    if (this.lost) return null;
    const gl = this.gl;
    const ow = sprite.width + margin * 2;
    const oh = sprite.height + margin * 2;
    if (this.canvas.width !== ow || this.canvas.height !== oh) {
      this.canvas.width = ow;
      this.canvas.height = oh;
    }
    gl.viewport(0, 0, ow, oh);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.ensureMesh(sprite.width, sprite.height);

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, sprite);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    const u = this.u;
    const f = pinch.uniforms();
    gl.uniform2f(u.uSprite, sprite.width, sprite.height);
    gl.uniform2f(u.uOrigin, origin.x, origin.y);
    gl.uniform1f(u.uK, k);
    gl.uniform1f(u.uMargin, margin);
    gl.uniform2f(u.uOut, ow, oh);
    gl.uniform1i(u.uGrabCount, f.count);
    gl.uniform4fv(u.uGrabA, f.a);
    gl.uniform2fv(u.uGrabPull, f.pull);
    gl.uniform1f(u.uBulge, pinch.params.bulge);
    const e = MOCHI.eye;
    gl.uniform4f(u.uEye, e.x, e.y, e.rx, e.ry);
    gl.uniform3f(u.uMask, e.fade, MOCHI.neck[0], MOCHI.neck[1]);
    gl.uniform1i(u.uTex, 0);

    gl.bindVertexArray(this.vao);
    gl.uniform1f(u.uPass, 0);
    gl.depthMask(true);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.uniform1f(u.uPass, 1);
    gl.depthMask(false);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);
    gl.bindVertexArray(null);
    return { canvas: this.canvas, ox: origin.x + margin, oy: origin.y + margin };
  }

  /** スプライトの縦横比に合わせた格子（セルはほぼ正方形） */
  private ensureMesh(w: number, h: number): void {
    const short = 72;
    const sx = w >= h ? Math.min(160, Math.round((short * w) / h)) : short;
    const sy = w >= h ? short : Math.min(160, Math.round((short * h) / w));
    const key = `${sx}x${sy}`;
    if (key === this.meshKey) return;
    const gl = this.gl;
    if (this.vao) gl.deleteVertexArray(this.vao);
    for (const b of this.buffers) gl.deleteBuffer(b);
    const cols = sx + 1;
    const pos = new Float32Array(cols * (sy + 1) * 2);
    let p = 0;
    for (let y = 0; y <= sy; y++) {
      for (let x = 0; x <= sx; x++) {
        pos[p++] = x / sx;
        pos[p++] = y / sy;
      }
    }
    const idx = new Uint16Array(sx * sy * 6);
    let q = 0;
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const i0 = y * cols + x;
        idx[q++] = i0;
        idx[q++] = i0 + cols;
        idx[q++] = i0 + 1;
        idx[q++] = i0 + 1;
        idx[q++] = i0 + cols;
        idx[q++] = i0 + cols + 1;
      }
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.buffers = [vbo, ibo];
    this.indexCount = idx.length;
    this.meshKey = key;
  }
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  const compile = (type: number, src: string): WebGLShader => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`program: ${gl.getProgramInfoLog(prog)}`);
  return prog;
}
