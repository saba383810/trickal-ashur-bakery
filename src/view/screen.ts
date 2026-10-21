// キャンバスを画面いっぱいに置き、論理座標（横 1280×720 / 縦 720×1280）へ変換する。
export const LANDSCAPE = { w: 1280, h: 720 };
export const PORTRAIT = { w: 720, h: 1280 };
/** 縦画面で伸ばす論理高さの上限 */
const PORTRAIT_MAX_H = 1600;

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
    const size = this.portrait ? PORTRAIT : LANDSCAPE;
    this.w = size.w;
    // 縦長のスマホでは上下の余白を作らず、論理サイズを縦に伸ばす
    this.h = this.portrait ? Math.round(Math.min(PORTRAIT_MAX_H, Math.max(size.h, (size.w * ch) / Math.max(1, cw)))) : size.h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
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
