// 引っぱれるキャラ 1 人分。ほっぺが動いていない間はふつうに描き、動いている間だけ
// スプライトに描いてから WebGL で変形して貼る（WebGL2 が無ければ変形なしで描く）。
import { drawChibi, FEET_R, type ChibiPose, type ChibiSpec } from '../view/draw/chibi';
import { MochiRenderer } from './gl';
import { Pinch, type Grab, type Vec } from './pinch';

let shared: MochiRenderer | null | undefined;

function renderer(): MochiRenderer | null {
  if (shared === undefined) shared = MochiRenderer.create();
  return shared?.ok ? shared : null;
}

/** つまむほっぺ（頭の単位）。顔のふちのほっぺの中心と、触った点に合わせてつまむ点をずらせる範囲 */
const CHEEK_GRAB = { x: 40, y: 30, rx: 7, ry: 6 };

export class MochiBody {
  readonly pinch = new Pinch();
  private sprite: HTMLCanvasElement | null = null;

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
    this.pinch.update(dt);
  }

  draw(ctx: CanvasRenderingContext2D, spec: ChibiSpec, x: number, y: number, r: number, pose: ChibiPose): void {
    const gl = this.pinch.active ? renderer() : null;
    if (!gl) {
      drawChibi(ctx, spec, x, y, r, pose);
      return;
    }
    const m = ctx.getTransform();
    const scale = Math.hypot(m.a, m.b) || 1;
    const rp = r * scale;
    const k = rp / 50;
    const w = Math.ceil(rp * 3.8);
    const top = Math.ceil(rp * 2.05);
    const h = Math.ceil(top + rp * (FEET_R + 0.15));
    const sprite = (this.sprite ??= document.createElement('canvas'));
    if (sprite.width !== w || sprite.height !== h) {
      sprite.width = w;
      sprite.height = h;
    }
    const sc = sprite.getContext('2d')!;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, w, h);
    drawChibi(sc, spec, w / 2, top, rp, pose);
    const margin = Math.ceil(this.pinch.lmax * 1.2 * k);
    const out = gl.render(sprite, { x: w / 2, y: top }, k, margin, this.pinch);
    if (!out) {
      drawChibi(ctx, spec, x, y, r, pose);
      return;
    }
    ctx.drawImage(out.canvas, x - out.ox / scale, y - out.oy / scale, out.canvas.width / scale, out.canvas.height / scale);
  }
}
