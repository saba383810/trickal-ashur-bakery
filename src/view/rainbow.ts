import { SPEAKI } from './draw/characters';
import { drawChibi, feetR } from './draw/chibi';
import type { Layout } from './layout';

// フィーバータイムに画面の外から出てくる、虹色に光るスピキ（ミームのオマージュ）。
// しゃがんだままくるくる回り、横向きになるたびに色が変わる。さわれない飾りで、操作するものには重ならないところだけを通る:
// back = 客の後ろを横切る / counter = カウンターの前板を横切る（トレーより奥） / peek・drop = 客席の外の画面の端（HUD より奥）

type Kind = 'back' | 'counter' | 'peek' | 'drop';

interface Sprite {
  kind: Kind;
  /** 経過秒（負の間は出番待ち） */
  t: number;
  dur: number;
  /** 頭の半径 px */
  r: number;
  /** 出てくる側 */
  side: -1 | 1;
  /** 1 秒あたりの回転数 */
  spin: number;
  phase: number;
  /** 色の並びの開始位置 */
  hue: number;
  /** 足元の高さ（back・counter は跳ねる前、peek は顔を出す高さ、drop は着地する高さ） */
  y: number;
  /** drop: 落ちてくる x */
  x: number;
}

/** 横向きになるたびに次の色へ（null = 白く光る） */
const HUES: (number | null)[] = [null, 188, 52, 300, 140, 26, 266, 92, 0, 330];
const SPEED = 430;
const PEEK = { in: 0.3, stay: 1.3, out: 0.3 };
const DROP = { fall: 0.55, bounce: 0.3, out: 0.7 };

export class RainbowParade {
  reduced = false;
  private sprites: Sprite[] = [];
  private nextAt = 0;
  private time = 0;
  private base = new Map<number, HTMLCanvasElement>();
  private tinted = new Map<string, HTMLCanvasElement>();

  get busy(): boolean {
    return this.sprites.length > 0;
  }

  /** フィーバー開始: 四方からいっせいに出てくる */
  start(L: Layout): void {
    const kinds: Kind[] = this.reduced ? ['drop', 'counter'] : ['drop', 'drop', 'counter', 'peek', 'back', 'peek'];
    kinds.forEach((k, i) => this.spawn(L, k, -i * 0.16, i % 2 === 0 ? -1 : 1));
    this.nextAt = this.time + 1;
  }

  clear(): void {
    this.sprites = [];
  }

  update(dt: number, L: Layout, active: boolean): void {
    this.time += dt;
    for (const s of this.sprites) s.t += dt;
    this.sprites = this.sprites.filter((s) => s.t < s.dur);
    const cap = this.reduced ? 2 : 7;
    if (active && this.time >= this.nextAt && this.sprites.length < cap) {
      const roll = Math.random();
      const kind: Kind = roll < 0.3 ? 'counter' : roll < 0.5 ? 'back' : roll < 0.8 ? 'peek' : 'drop';
      this.spawn(L, kind, 0, Math.random() < 0.5 ? -1 : 1);
      this.nextAt = this.time + (this.reduced ? 1.6 : 0.5 + Math.random() * 0.4);
    }
  }

  /** 客の後ろ（店の奥の背景を描いた直後に呼ぶ） */
  drawBack(c: CanvasRenderingContext2D, L: Layout, pr: number): void {
    this.drawKinds(c, L, pr, ['back']);
  }

  /** カウンターの前板（カウンターを描いた直後・トレーの前に呼ぶ） */
  drawCounter(c: CanvasRenderingContext2D, L: Layout, pr: number): void {
    this.drawKinds(c, L, pr, ['counter']);
  }

  /** 画面の端（HUD の前に呼ぶ） */
  drawEdge(c: CanvasRenderingContext2D, L: Layout, pr: number): void {
    this.drawKinds(c, L, pr, ['peek', 'drop']);
  }

  private drawKinds(c: CanvasRenderingContext2D, L: Layout, pr: number, kinds: Kind[]): void {
    for (const s of this.sprites) if (s.t >= 0 && kinds.includes(s.kind)) this.drawSprite(c, L, pr, s);
  }

  private spawn(L: Layout, kind: Kind, t: number, side: -1 | 1): void {
    const hr = L.headR;
    const r = { back: hr * 0.42, counter: hr * 0.5, peek: hr * 0.8, drop: hr * 0.72 }[kind];
    const top = L.floor.y + r * (feetR(SPEAKI) + 1.3);
    const bottom = L.counter.y - 6;
    const y = {
      back: L.floor.y + L.floor.h * 0.62,
      counter: L.counter.y + L.counter.h - 6,
      peek: top + Math.random() * Math.max(0, bottom - top),
      drop: bottom,
    }[kind];
    const s: Sprite = {
      kind,
      t,
      dur: 0,
      r,
      side,
      spin: (this.reduced ? 0.4 : 1.1 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1),
      phase: Math.random() * Math.PI * 2,
      hue: Math.floor(Math.random() * HUES.length),
      y,
      x: 0,
    };
    // 端の客の頭と吹き出しにかからない幅に収める（縦画面は半分だけ顔を出す）
    const inX = Math.min(r * (1.4 + (kind === 'drop' ? Math.random() * 0.6 : 0)), edgeRoom(L) - r * 1.3);
    s.x = side < 0 ? inX : L.w - inX;
    if (kind === 'back' || kind === 'counter') s.dur = (L.w + r * 8) / (SPEED * (kind === 'back' ? 0.8 : 1));
    else if (kind === 'peek') s.dur = PEEK.in + PEEK.stay + PEEK.out;
    else s.dur = DROP.fall + DROP.bounce + DROP.out;
    this.sprites.push(s);
  }

  /** 足元の位置 */
  private feet(L: Layout, s: Sprite): { x: number; y: number } {
    const r = s.r;
    const out = s.side < 0 ? -r * 2.4 : L.w + r * 2.4;
    if (s.kind === 'back' || s.kind === 'counter') {
      const p = s.t / s.dur;
      const from = s.side < 0 ? -r * 4 : L.w + r * 4;
      const to = s.side < 0 ? L.w + r * 4 : -r * 4;
      // カウンターでは低く跳ねる（上の客の顔にかからないように）
      const hop = s.kind === 'counter' ? 0.45 : 1.3;
      return { x: from + (to - from) * p, y: s.y - Math.abs(Math.sin(s.t * Math.PI * 2.6)) * r * hop };
    }
    if (s.kind === 'peek') {
      const inX = s.x;
      if (s.t < PEEK.in) return { x: out + (inX - out) * easeOut(s.t / PEEK.in), y: s.y };
      const st = s.t - PEEK.in;
      if (st < PEEK.stay) return { x: inX, y: s.y - Math.abs(Math.sin(st * 7)) * r * 0.35 };
      const p = (st - PEEK.stay) / PEEK.out;
      return { x: inX + (out - inX) * p * p, y: s.y };
    }
    // drop: 上から落ちて弾み、横へ跳ねて帰る
    if (s.t < DROP.fall) {
      const p = s.t / DROP.fall;
      return { x: s.x, y: -r * 0.5 + (s.y + r * 0.5) * p * p };
    }
    if (s.t < DROP.fall + DROP.bounce) {
      const p = (s.t - DROP.fall) / DROP.bounce;
      return { x: s.x, y: s.y - Math.sin(p * Math.PI) * r * 0.9 };
    }
    const p = (s.t - DROP.fall - DROP.bounce) / DROP.out;
    return { x: s.x + (out - s.x) * p, y: s.y - Math.sin(p * Math.PI) * r * 2.2 };
  }

  private drawSprite(c: CanvasRenderingContext2D, L: Layout, pr: number, s: Sprite): void {
    const { x, y } = this.feet(L, s);
    const angle = s.phase + s.t * s.spin * Math.PI * 2;
    const sx = Math.cos(angle);
    // 横向き（cos = 0）を通るたびに 1 つ進む
    const turn = Math.floor((angle + Math.PI / 2) / Math.PI);
    const hue = HUES[(((s.hue + turn) % HUES.length) + HUES.length) % HUES.length];
    const base = this.sprite(s.r, pr);
    const img = this.tint(base, hue, s.r, pr);
    const w = base.width / pr;
    const h = base.height / pr;
    const headY = -s.r * feetR(SPEAKI);
    const glow = hue === null ? 'rgba(255, 255, 240,' : `hsla(${hue}, 95%, 70%,`;

    c.save();
    c.translate(x, y);
    // 後光
    const g = c.createRadialGradient(0, headY * 0.6, 0, 0, headY * 0.6, s.r * 2.6);
    g.addColorStop(0, `${glow} 0.55)`);
    g.addColorStop(1, `${glow} 0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, headY * 0.6, s.r * 2.6, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.scale(Math.sign(sx || 1) * Math.max(0.05, Math.abs(sx)), 1);
    c.drawImage(img, 0, 0, base.width, base.height, -w / 2, -s.r * 1.85 + headY, w, h);
    c.restore();
    // まわりのきらきら
    for (let i = 0; i < 4; i++) {
      const a = this.time * 2.2 + i * (Math.PI / 2) + s.phase;
      const tw = 0.5 + 0.5 * Math.sin(this.time * 9 + i * 1.7);
      sparkle(c, Math.cos(a) * s.r * 1.9, headY * 0.6 + Math.sin(a) * s.r * 1.5, s.r * 0.22 * tw, i % 2 ? '#ffffff' : '#fff3a8');
    }
    c.restore();
  }

  /** しゃがんだスピキの絵（頭の半径 r・端末の画素比 pr ごとに 1 枚） */
  private sprite(r: number, pr: number): HTMLCanvasElement {
    const key = Math.round(r * pr * 4);
    let cv = this.base.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(r * 3.7 * pr);
    cv.height = Math.ceil(r * (1.85 + feetR(SPEAKI) + 0.15) * pr);
    const c = cv.getContext('2d')!;
    c.scale(pr, pr);
    drawChibi(c, SPEAKI, r * 1.85, r * 1.85, r, { expr: 'happy', t: 0.4, body: true });
    this.base.set(key, cv);
    return cv;
  }

  /**
   * 明るさはそのまま、色相だけを塗り替える（null は白く光らせる）。
   * 輪郭や目のような暗い線は塗り替えず、ほかの子と同じクレヨンの線のまま残す（色を付けると線が薄く見える）
   */
  private tint(base: HTMLCanvasElement, hue: number | null, r: number, pr: number): HTMLCanvasElement {
    const key = `${Math.round(r * pr * 4)}:${hue}`;
    let cv = this.tinted.get(key);
    if (cv) return cv;
    // 画面の大きさが何度も変わったときに古い大きさの絵をためこまない
    if (this.tinted.size >= HUES.length * 8) this.tinted.clear();
    cv = document.createElement('canvas');
    cv.width = base.width;
    cv.height = base.height;
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(base, 0, 0);
    if (hue === null) {
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255, 255, 255, 0.45)';
    } else {
      c.globalCompositeOperation = 'color';
      c.fillStyle = `hsl(${hue}, 90%, 55%)`;
    }
    c.fillRect(0, 0, base.width, base.height);
    if (hue !== null) {
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(base, 0, 0);
    }
    c.globalCompositeOperation = 'source-over';
    keepLines(c, base);
    this.tinted.set(key, cv);
    return cv;
  }
}

/**
 * 線の画素だけ元の色に戻す。線は赤みのある焦げ茶なので、暗くて赤みのある画素ほど元のまま残す
 * （明るさ 0.42 以上か、紺のヴェールや服のように青みのある暗い色は塗り替えた色のまま）
 */
function keepLines(c: CanvasRenderingContext2D, base: HTMLCanvasElement): void {
  const { width: w, height: h } = base;
  if (w === 0 || h === 0) return;
  const out = c.getImageData(0, 0, w, h);
  const src = base.getContext('2d')!.getImageData(0, 0, w, h).data;
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (src[i + 3] === 0) continue;
    const l = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
    const red = (src[i] - src[i + 2]) / 255;
    const k = Math.min(1, Math.max(0, (l - 0.26) / 0.16, (0.08 - red) / 0.06));
    if (k >= 1) continue;
    for (let j = 0; j < 3; j++) d[i + j] = src[i + j] + (d[i + j] - src[i + j]) * k;
  }
  c.putImageData(out, 0, 0);
}

/** 画面の端から、いちばん端の客の頭・吹き出しまでの幅 */
function edgeRoom(L: Layout): number {
  const s = L.seats[0];
  return s ? s.x - Math.max(L.bubbleMaxW / 2, L.headR * 1.3) : L.w / 2;
}

function easeOut(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

/** 4 つ角のきらめき */
function sparkle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  if (r <= 0.5) return;
  c.beginPath();
  c.moveTo(x, y - r * 2);
  c.quadraticCurveTo(x, y, x + r * 2, y);
  c.quadraticCurveTo(x, y, x, y + r * 2);
  c.quadraticCurveTo(x, y, x - r * 2, y);
  c.quadraticCurveTo(x, y, x, y - r * 2);
  c.fillStyle = color;
  c.fill();
}
