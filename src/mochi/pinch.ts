// ほっぺを引っぱる物理。もちほっぺメーカー（saba383810/moti_hoppe_maker）の pinchSystem と同じつくり:
// 指へはバネで少し遅れて追従し、伸びは tanh で頭打ち、離すとよく揺れるバネで戻る。
// 変形の式（falloff / ring / 重なりの割り戻し）はシェーダ（mochi/gl.ts）と同じものを CPU にも持つ。
// 長さはすべてキャラの「頭の単位」（頭の半径 = 50。chibi.ts と同じ座標）で測る。

export interface Vec {
  x: number;
  y: number;
}

export interface MochiParams {
  /** つまんだ点から変形が届く半径 */
  radius: number;
  /** 伸びの上限 = stretch × radius */
  stretch: number;
  /** 離したあとの揺れの周波数 Hz */
  releaseFreq: number;
  /** 減衰比（小さいほどよく揺れる） */
  releaseZeta: number;
  /** ぷっくり量 */
  bulge: number;
}

export const MOCHI = {
  maxGrabs: 4,
  dragOmega: 80,
  dragZeta: 0.85,
  grabEaseMs: 60,
  radiusGrow: 0.35,
  substep: 1 / 240,
  maxDt: 1 / 30,
  settlePos: 0.15,
  settleVel: 1.5,
  /**
   * 変形させない範囲（頭の単位）。もちほっぺメーカーで「ほっぺを塗る」マスクの代わり:
   * 左右の目のまわり（楕円の 1〜1+fade 倍で重みが 0→1）と、首から下（neck の y で 1→0）は動かさない
   */
  eye: { x: 25, y: 11, rx: 15, ry: 15, fade: 0.5 },
  neck: [42, 54],
} as const;

/**
 * もちほっぺメーカーの既定値（やわらかさ 0.5）を、ゲームの小さなキャラでも伸びが見えるよう頭の単位に置き直したもの。
 * 半径と伸びの比・揺れの周波数・減衰・ぷっくり量の関係は元のまま。
 */
export const DEFAULT_PARAMS: MochiParams = {
  radius: 28,
  stretch: 2.4,
  releaseFreq: 9,
  releaseZeta: 0.19,
  bulge: 0.1,
};

export interface Grab {
  pointerId: number;
  /** つかんだ点（変形前。以後固定） */
  anchor: Vec;
  pointer: Vec;
  pull: Vec;
  vel: Vec;
  ease: number;
  released: boolean;
}

export function falloff(t: number): number {
  const s = 1 - t;
  return s * s * s * (6 * t * t + 3 * t + 1);
}

export function ring(t: number): number {
  return 6.75 * t * (1 - t) * (1 - t);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 変形の重み。シェーダと同じ式 */
export function maskAt(x: number, y: number): number {
  const e = MOCHI.eye;
  const d = Math.hypot((Math.abs(x) - e.x) / e.rx, (y - e.y) / e.ry);
  return smoothstep(1, 1 + e.fade, d) * (1 - smoothstep(MOCHI.neck[0], MOCHI.neck[1], y));
}

export class Pinch {
  grabs: Grab[] = [];
  private uA = new Float32Array(MOCHI.maxGrabs * 4);
  private uPull = new Float32Array(MOCHI.maxGrabs * 2);

  constructor(public params: MochiParams = DEFAULT_PARAMS) {}

  get lmax(): number {
    return this.params.stretch * this.params.radius;
  }

  get active(): boolean {
    return this.grabs.length > 0;
  }

  /** 指でつかんでいる最中か */
  get held(): boolean {
    return this.grabs.some((g) => !g.released);
  }

  private radiusEff(g: Grab): number {
    const mag = Math.hypot(g.pull.x, g.pull.y);
    return this.params.radius * (1 + MOCHI.radiusGrow * Math.min(1, mag / this.lmax));
  }

  private strengthOf(g: Grab): number {
    return Math.min(1, (g.ease * 1000) / MOCHI.grabEaseMs);
  }

  displacementAt(x: number, y: number): Vec {
    let dx = 0;
    let dy = 0;
    let wsum = 0;
    const bulge = this.params.bulge;
    for (const g of this.grabs) {
      const strength = this.strengthOf(g);
      if (strength <= 0) continue;
      const rx = x - g.anchor.x;
      const ry = y - g.anchor.y;
      const d = Math.hypot(rx, ry);
      const t = Math.min(1, d / this.radiusEff(g));
      const w = falloff(t) * strength;
      const mag = Math.hypot(g.pull.x, g.pull.y);
      const ux = d > 1e-5 ? rx / d : 0;
      const uy = d > 1e-5 ? ry / d : 0;
      dx += w * g.pull.x + bulge * mag * ring(t) * ux * strength;
      dy += w * g.pull.y + bulge * mag * ring(t) * uy * strength;
      wsum += w;
    }
    const norm = maskAt(x, y) / Math.max(1, wsum);
    return { x: dx * norm, y: dy * norm };
  }

  /** 変形後の点 → 変形前の点（揺れている最中につかみ直してもずれない） */
  invert(x: number, y: number): Vec {
    let u = x;
    let v = y;
    for (let i = 0; i < 3; i++) {
      const d = this.displacementAt(u, v);
      u = x - d.x;
      v = y - d.y;
    }
    return { x: u, y: v };
  }

  /** 変形後の座標 p でつかむ。anchor を渡すとその点（変形前）をつかんだことにする */
  grab(pointerId: number, p: Vec, anchor?: Vec): Grab | null {
    if (this.grabs.some((g) => g.pointerId === pointerId && !g.released)) return null;
    if (this.grabs.length >= MOCHI.maxGrabs) {
      const idx = this.grabs.findIndex((g) => g.released);
      if (idx < 0) return null;
      this.grabs.splice(idx, 1);
    }
    const a = anchor ?? this.invert(p.x, p.y);
    const g: Grab = {
      pointerId,
      anchor: { x: a.x, y: a.y },
      pointer: { x: p.x, y: p.y },
      pull: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      ease: 0,
      released: false,
    };
    this.grabs.push(g);
    return g;
  }

  find(pointerId: number): Grab | null {
    return this.grabs.find((g) => g.pointerId === pointerId && !g.released) ?? null;
  }

  move(pointerId: number, p: Vec): void {
    const g = this.find(pointerId);
    if (g) {
      g.pointer.x = p.x;
      g.pointer.y = p.y;
    }
  }

  release(pointerId: number): Grab | null {
    const g = this.find(pointerId);
    if (g) g.released = true;
    return g;
  }

  /** 揺れも含めて全部消す */
  reset(): void {
    this.grabs.length = 0;
  }

  /** 伸びの強さ 0..1（効果音の音量や、追い払えるかの判定に使う） */
  intensity(g: Grab): number {
    return Math.min(1, Math.hypot(g.pull.x, g.pull.y) / this.lmax);
  }

  /** いちばん伸びているところの強さ */
  get maxIntensity(): number {
    let m = 0;
    for (const g of this.grabs) m = Math.max(m, this.intensity(g));
    return m;
  }

  update(dtRaw: number): void {
    if (this.grabs.length === 0) return;
    const dt = Math.min(dtRaw, MOCHI.maxDt);
    const p = this.params;
    const relOmega = 2 * Math.PI * p.releaseFreq;
    const L = this.lmax;
    for (let i = this.grabs.length - 1; i >= 0; i--) {
      const g = this.grabs[i];
      g.ease += dt;
      // 目標: つかんでいる間は頭打ちさせた指のずれ（抵抗感）、離したら 0（揺れ戻り）
      let tx = 0;
      let ty = 0;
      if (!g.released) {
        const dx = g.pointer.x - g.anchor.x;
        const dy = g.pointer.y - g.anchor.y;
        const mag = Math.hypot(dx, dy);
        if (mag > 1e-9) {
          const eff = L * Math.tanh(mag / L);
          tx = (dx / mag) * eff;
          ty = (dy / mag) * eff;
        }
      }
      const omega = g.released ? relOmega : MOCHI.dragOmega;
      const zeta = g.released ? p.releaseZeta : MOCHI.dragZeta;
      const n = Math.max(1, Math.ceil(dt / MOCHI.substep));
      const h = dt / n;
      for (let s = 0; s < n; s++) {
        const ax = omega * omega * (tx - g.pull.x) - 2 * zeta * omega * g.vel.x;
        const ay = omega * omega * (ty - g.pull.y) - 2 * zeta * omega * g.vel.y;
        g.vel.x += ax * h;
        g.vel.y += ay * h;
        g.pull.x += g.vel.x * h;
        g.pull.y += g.vel.y * h;
      }
      if (g.released && Math.hypot(g.pull.x, g.pull.y) < MOCHI.settlePos && Math.hypot(g.vel.x, g.vel.y) < MOCHI.settleVel) {
        this.grabs.splice(i, 1);
      }
    }
  }

  uniforms(): { count: number; a: Float32Array; pull: Float32Array } {
    const n = Math.min(this.grabs.length, MOCHI.maxGrabs);
    for (let i = 0; i < n; i++) {
      const g = this.grabs[i];
      this.uA[i * 4] = g.anchor.x;
      this.uA[i * 4 + 1] = g.anchor.y;
      this.uA[i * 4 + 2] = this.radiusEff(g);
      this.uA[i * 4 + 3] = this.strengthOf(g);
      this.uPull[i * 2] = g.pull.x;
      this.uPull[i * 2 + 1] = g.pull.y;
    }
    return { count: n, a: this.uA, pull: this.uPull };
  }
}
