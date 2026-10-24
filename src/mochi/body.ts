// 引っぱれるキャラ 1 人分。ほっぺが動いていない間はふつうに描き、動いている間だけ
// 顔（輪郭・ほっぺ・目・口）をスプライトに描いてから WebGL で変形して貼り、髪や体は変形せずに上下へ重ねる
// （WebGL2 が無ければ変形なしで描く）。髪はほっぺが急に動いた反動で遅れて揺れる。
import { Spring } from '../view/spring';
import { drawChibi, LAYER, type ChibiPose, type ChibiSpec } from '../view/draw/chibi';
import { MochiRenderer } from './gl';
import { Pinch, type Grab, type Vec } from './pinch';

let shared: MochiRenderer | null | undefined;

function renderer(): MochiRenderer | null {
  if (shared === undefined) shared = MochiRenderer.create();
  return shared?.ok ? shared : null;
}

/** つまむほっぺ（頭の単位）。顔のふちのほっぺの中心と、触った点に合わせてつまむ点をずらせる範囲 */
const CHEEK_GRAB = { x: 40, y: 30, rx: 7, ry: 6 };

/** 変形する顔の層を描くスプライトの範囲（頭の単位）。張り出したほっぺ・ふくれ顔・ぷるぷるも入る */
const FACE_BOX = { x: 80, top: 66, bottom: 62 };

/** 動きを減らす設定なら、髪は揺らさない */
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 髪の揺れ。周波数 2.4 Hz・減衰比 0.18 くらいのバネ。
 * fling = 離したほっぺの伸び 1 あたりに髪へ与える速さ（伸びきって離すと毛先が 6 ほど揺れる）、
 * cheek = つまんでいる指でほっぺが動いた時に頭へ伝わる割合、head = 体ごと動いた時の割合、
 * max = 揺れの頭打ち（頭の単位）
 */
export const HAIR = { stiffness: 227, damping: 5.5, fling: 3.6, cheek: 0.15, head: 0.1, max: 10, settle: 0.05 };

export class MochiBody {
  readonly pinch = new Pinch();
  /** 髪の横揺れ（x だけ使う） */
  readonly hair = new Spring(HAIR.stiffness, HAIR.damping);
  private sprite: HTMLCanvasElement | null = null;
  /** 前のフレームの、つまんでいる指のほっぺの速さ */
  private cheekVel = 0;
  /** 離した反動をもう髪に伝えたつまみ */
  private flung = new WeakSet<Grab>();

  /** 画面の点を、頭の中心 (x, y)・半径 r のキャラの頭の単位へ。flip = -1 なら左右反転して描いている */
  static toLocal(p: Vec, x: number, y: number, r: number, flip = 1): Vec {
    const k = r / 50;
    return { x: ((p.x - x) / k) * flip, y: (p.y - y) / k };
  }

  /** 頭の単位の点 → 画面 */
  static toScreen(p: Vec, x: number, y: number, r: number, flip = 1): Vec {
    const k = r / 50;
    return { x: x + p.x * k * flip, y: y + p.y * k };
  }

  /**
   * つまむ。触った点（変形後）を変形前に戻し、近いほうのほっぺの範囲の中へ寄せた点をつまむ。
   * 頭や体を触っても、目ではなくほっぺが伸びる
   */
  grab(pointerId: number, local: Vec): Grab | null {
    const rest = this.pinch.invert(local.x, local.y);
    const c = CHEEK_GRAB;
    const cx = (rest.x < 0 ? -1 : 1) * c.x;
    const dx = (rest.x - cx) / c.rx;
    const dy = (rest.y - c.y) / c.ry;
    const d = Math.hypot(dx, dy);
    const s = d > 1 ? 1 / d : 1;
    return this.pinch.grab(pointerId, local, { x: cx + dx * s * c.rx, y: c.y + dy * s * c.ry });
  }

  update(dt: number): void {
    // 離したほっぺが勢いよく戻る反動で、髪を伸ばしていた側へ振る（戻りながらのぷるぷるは髪に伝えない）
    for (const g of this.pinch.grabs) {
      if (!g.released || this.flung.has(g)) continue;
      this.flung.add(g);
      this.jolt(-g.pull.x, HAIR.fling);
    }
    this.pinch.update(dt);
    // つまんだまま急に引くと頭が引かれ、髪は遅れてついてくる
    const v = this.pinch.velocity.x;
    this.jolt(v - this.cheekVel, HAIR.cheek);
    this.cheekVel = v;
    this.hair.step(dt);
    if (Math.abs(this.hair.x) < HAIR.settle && Math.abs(this.hair.vx) < HAIR.settle * 10) this.hair.set(0, 0);
  }

  /** 頭が横へ dv（頭の単位 / 秒）だけ速さを変えた（体ごと動いた時は ratio = HAIR.head）。髪は反対へ遅れて揺れる */
  jolt(dv: number, ratio: number = HAIR.head): void {
    if (!still) this.hair.kick(-dv * ratio);
  }

  /** 髪の揺れ（頭の単位）。大きく揺らしても頭打ちにする */
  get sway(): number {
    return HAIR.max * Math.tanh(this.hair.x / HAIR.max);
  }

  /** ほっぺか髪が動いている（描き直しが要る） */
  get active(): boolean {
    return this.pinch.active || this.hair.x !== 0 || this.hair.vx !== 0;
  }

  /** 揺れも含めて全部止める */
  reset(): void {
    this.pinch.reset();
    this.hair.set(0, 0);
    this.cheekVel = 0;
  }

  draw(ctx: CanvasRenderingContext2D, spec: ChibiSpec, x: number, y: number, r: number, pose: ChibiPose): void {
    const p: ChibiPose = this.hair.x ? { ...pose, sway: (pose.sway ?? 0) + this.sway } : pose;
    const gl = this.pinch.active ? renderer() : null;
    if (!gl) {
      drawChibi(ctx, spec, x, y, r, p);
      return;
    }
    const m = ctx.getTransform();
    const scale = Math.hypot(m.a, m.b) || 1;
    const rp = r * scale;
    const k = rp / 50;
    const w = Math.ceil(FACE_BOX.x * 2 * k);
    const top = Math.ceil(FACE_BOX.top * k);
    const h = Math.ceil(top + FACE_BOX.bottom * k);
    const sprite = (this.sprite ??= document.createElement('canvas'));
    if (sprite.width !== w || sprite.height !== h) {
      sprite.width = w;
      sprite.height = h;
    }
    const sc = sprite.getContext('2d')!;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, w, h);
    drawChibi(sc, spec, w / 2, top, rp, p, LAYER.face);
    const margin = Math.ceil(this.pinch.lmax * 1.2 * k);
    const out = gl.render(sprite, { x: w / 2, y: top }, k, margin, this.pinch);
    if (!out) {
      drawChibi(ctx, spec, x, y, r, p);
      return;
    }
    // 体と後ろ・横の髪 → 伸びた顔 → 前髪や帽子の順に重ねる（ほっぺだけが伸び、横の髪の手前へ出る）
    drawChibi(ctx, spec, x, y, r, p, LAYER.back);
    ctx.drawImage(out.canvas, x - out.ox / scale, y - out.oy / scale, out.canvas.width / scale, out.canvas.height / scale);
    drawChibi(ctx, spec, x, y, r, p, LAYER.front);
  }
}
