// キャンバスを画面いっぱいに置き、論理座標（横 1280×720 / 縦 720×1280 が基準）へ変換する。
export const LANDSCAPE = { w: 1280, h: 720 };
export const PORTRAIT = { w: 720, h: 1280 };
/**
 * 画面の縦横比に合わせて、基準より余る方向へ論理サイズを伸ばす上限。
 * 横: iPad（4:3 まで）は縦に、横持ちのスマホは横に。縦: 縦長のスマホは縦に、iPad の縦持ちは横に。
 * 上限を超えた分だけ上下か左右に余白が出る
 */
const MAX = {
  landscape: { w: 1600, h: 960 },
  portrait: { w: 1000, h: 1600 },
};
/** ページの拡大中に増やす画素の上限（iOS は canvas のメモリに上限がある） */
const ZOOM_MAX_PIXELS = 8_000_000;

/** ページの拡大率（拡大していなければ 1）。sabanogames ではフレームの中にいるので、外側のページの拡大を見る */
export function pageZoom(): number {
  let z = window.visualViewport?.scale ?? 1;
  try {
    if (window.top && window.top !== window) z *= window.top.visualViewport?.scale ?? 1;
  } catch {
    // 別オリジンのフレームの中では外側を読めない
  }
  return Math.max(1, z);
}

/**
 * 実画素 / CSS px。スマホは 3 倍が多いので 3 まで（2 で止めると絵と文字がぼやける）。
 * iOS はピンチでページを拡大できる（user-scalable=no は無視される）。拡大しても DOM は描き直されるが
 * canvas は画素数のまま引き伸ばされてぼやけるので、拡大中はその分だけ細かく描く（4 倍まで）
 */
export function renderRatio(pixels = 0): number {
  const base = Math.min(window.devicePixelRatio || 1, 3);
  let k = Math.min(base * pageZoom(), 4);
  if (pixels > 0) k = Math.min(k, Math.sqrt(ZOOM_MAX_PIXELS / pixels));
  return Math.max(base, k);
}

export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  portrait = false;
  /** 論理サイズ */
  w = LANDSCAPE.w;
  h = LANDSCAPE.h;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  dpr = 1;
  /** レイアウトが変わった回数（キャッシュの破棄に使う） */
  version = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.portrait = ch > cw * 1.05;
    const base = this.portrait ? PORTRAIT : LANDSCAPE;
    const max = this.portrait ? MAX.portrait : MAX.landscape;
    const r = ch / Math.max(1, cw);
    if (r > base.h / base.w) {
      this.w = base.w;
      this.h = Math.round(Math.min(max.h, base.w * r));
    } else {
      this.w = Math.round(Math.min(max.w, base.h / r));
      this.h = base.h;
    }
    this.dpr = renderRatio(cw * ch);
    this.scale = Math.min(cw / this.w, ch / this.h);
    this.offsetX = (cw - this.w * this.scale) / 2;
    this.offsetY = (ch - this.h * this.scale) / 2;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.version++;
  }

  /** 論理座標で描くための変換をかける */
  begin(): void {
    const k = this.dpr * this.scale;
    this.ctx.setTransform(k, 0, 0, k, this.offsetX * this.dpr, this.offsetY * this.dpr);
  }

  /** 画面全体（余白含む）を塗る */
  clear(color: string): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - this.offsetX) / this.scale,
      y: (clientY - r.top - this.offsetY) / this.scale,
    };
  }

  /** 論理 1px が実ピクセルで何 px か */
  get pixelRatio(): number {
    return this.dpr * this.scale;
  }
}
