import type { BreadId } from '../../config/breads';
import { crayon, LINE, setGrain } from './chibi';

// パンはすべてコードで描く。描画は重めなのでサイズごとにオフスクリーンへキャッシュする。
// 輪郭はキャラと同じクレヨンの線で引き、小さく描くほど太らせる（吹き出しの小さなパンでも線が細く薄くならない）
const cache = new Map<string, HTMLCanvasElement>();
/** 飛んでいくパンなどで大きさが毎フレーム変わるので、溜まりすぎたら作り直す */
const CACHE_MAX = 240;

/** 線の太さがそのままでよい大きさ（画面での CSS px）と、いま描いているパンの線の倍率・線の色 */
const LINE_SIZE = 70;
let lk = 1;
const ink = () => crayon(LINE);

/** (x, y) を中心に、幅 size 程度で描く。pr は論理 1px あたりの実ピクセル */
export function drawBread(ctx: CanvasRenderingContext2D, id: BreadId, x: number, y: number, size: number, pr: number): void {
  const px = Math.max(8, Math.round(size * pr));
  // キャラ（lineScale）と同じく、画面に出る大きさで線の倍率を決める（スマホで縮んだ店でも線が細くならない）
  const css = (size * pr) / ((typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const k = Math.min(2, Math.max(1, Math.pow(LINE_SIZE / css, 0.6)));
  const key = `${id}:${px}:${k.toFixed(2)}`;
  let sprite = cache.get(key);
  if (!sprite) {
    if (cache.size >= CACHE_MAX) cache.clear();
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = Math.ceil(px * 1.3);
    const c = sprite.getContext('2d')!;
    c.translate(sprite.width / 2, sprite.height / 2);
    c.scale(px / 100, px / 100);
    lk = k;
    setGrain(c);
    BREAD_PAINTERS[id](c);
    cache.set(key, sprite);
  }
  const s = (sprite.width / pr);
  ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
}

/** 100×100 の座標系で原点中心に描く */
const BREAD_PAINTERS: Record<BreadId, (c: CanvasRenderingContext2D) => void> = {
  roll(c) {
    shadow(c, 0, 30, 40);
    const g = c.createRadialGradient(-12, -14, 4, 0, 0, 46);
    g.addColorStop(0, '#f6cf8c');
    g.addColorStop(0.55, '#dc964c');
    g.addColorStop(1, '#a9612a');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 4, 42, 30, 0, 0, Math.PI * 2);
    c.fill();
    outline(c);
    c.strokeStyle = 'rgba(255, 236, 200, 0.85)';
    c.lineWidth = 4;
    c.lineCap = 'round';
    for (const dx of [-16, 0, 16]) {
      c.beginPath();
      c.moveTo(dx - 6, -12);
      c.quadraticCurveTo(dx + 2, -2, dx - 4, 16);
      c.stroke();
    }
    gloss(c, -14, -12, 12, 6);
  },

  croissant(c) {
    shadow(c, 0, 30, 44);
    const segs = [
      { x: -34, y: 10, r: 13, a: -0.6 },
      { x: -20, y: -2, r: 17, a: -0.3 },
      { x: 0, y: -8, r: 21, a: 0 },
      { x: 20, y: -2, r: 17, a: 0.3 },
      { x: 34, y: 10, r: 13, a: 0.6 },
    ];
    for (const s of segs) {
      const g = c.createLinearGradient(s.x, s.y - s.r, s.x, s.y + s.r);
      g.addColorStop(0, '#f7c46e');
      g.addColorStop(1, '#b8682a');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(s.x, s.y + 6, s.r * 0.95, s.r * 1.25, s.a, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = ink();
      c.lineWidth = 2.6 * lk;
      c.stroke();
    }
    gloss(c, -4, -18, 10, 5);
  },

  melon(c) {
    shadow(c, 0, 32, 42);
    const g = c.createRadialGradient(-10, -16, 6, 0, 0, 48);
    g.addColorStop(0, '#fff1b8');
    g.addColorStop(0.6, '#f3cf72');
    g.addColorStop(1, '#d59b3c');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 40, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(190, 128, 40, 0.55)';
    c.lineWidth = 3;
    for (let i = -60; i <= 60; i += 16) {
      c.beginPath();
      c.moveTo(i - 40, -40);
      c.lineTo(i + 40, 40);
      c.stroke();
      c.beginPath();
      c.moveTo(i + 40, -40);
      c.lineTo(i - 40, 40);
      c.stroke();
    }
    c.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (const [sx, sy] of [[-18, -6], [6, -22], [16, 8], [-4, 18], [24, -8], [-24, 14]]) {
      c.fillRect(sx, sy, 3, 3);
    }
    c.restore();
    c.beginPath();
    c.arc(0, 0, 40, 0, Math.PI * 2);
    outline(c);
    gloss(c, -14, -16, 11, 6);
  },

  anpan(c) {
    shadow(c, 0, 30, 40);
    const g = c.createRadialGradient(-10, -14, 4, 0, 0, 46);
    g.addColorStop(0, '#e99a58');
    g.addColorStop(0.6, '#b9652a');
    g.addColorStop(1, '#7f3e17');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 2, 40, 35, 0, 0, Math.PI * 2);
    c.fill();
    outline(c);
    c.fillStyle = '#6b3315';
    c.beginPath();
    c.arc(0, -2, 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff4dc';
    for (const [sx, sy, a] of [[-6, -12, 0.4], [4, -13, -0.3], [9, -6, 0.9], [-10, -4, -0.8]]) {
      c.save();
      c.translate(sx, sy);
      c.rotate(a);
      c.beginPath();
      c.ellipse(0, 0, 2.6, 1.4, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    gloss(c, -16, -14, 10, 6);
  },

  curry(c) {
    shadow(c, 0, 30, 44);
    const g = c.createLinearGradient(0, -30, 0, 34);
    g.addColorStop(0, '#f0b45c');
    g.addColorStop(1, '#a95a1f');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const bump = 1 + 0.05 * Math.sin(i * 2.7);
      const px = Math.cos(a) * 44 * bump;
      const py = Math.sin(a) * 30 * bump + 3;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    outline(c);
    c.fillStyle = 'rgba(255, 220, 150, 0.9)';
    for (let i = 0; i < 26; i++) {
      const a = i * 2.4;
      const r = 8 + ((i * 13) % 28);
      c.beginPath();
      c.arc(Math.cos(a) * r, Math.sin(a) * r * 0.6, 2, 0, Math.PI * 2);
      c.fill();
    }
  },

  cornet(c) {
    shadow(c, 0, 30, 44);
    c.save();
    c.rotate(-0.35);
    const g = c.createLinearGradient(-44, 0, 40, 0);
    g.addColorStop(0, '#b06a2c');
    g.addColorStop(1, '#efb46a');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-46, 0);
    c.lineTo(28, -26);
    c.quadraticCurveTo(44, 0, 28, 26);
    c.closePath();
    c.fill();
    c.strokeStyle = ink();
    c.lineWidth = 3 * lk;
    c.stroke();
    // 巻きの筋は輪郭より細く、パンの色で
    c.strokeStyle = '#8f4d1f';
    c.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      const x = -30 + i * 16;
      const hh = 6 + i * 6;
      c.beginPath();
      c.moveTo(x, -hh);
      c.quadraticCurveTo(x + 9, 0, x, hh);
      c.stroke();
    }
    c.fillStyle = '#5a3221';
    c.beginPath();
    c.ellipse(32, 0, 9, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255, 255, 255, 0.35)';
    c.beginPath();
    c.ellipse(30, -8, 3, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  },

  shokupan(c) {
    shadow(c, 0, 34, 44);
    c.fillStyle = '#b7692b';
    c.beginPath();
    c.moveTo(-40, 34);
    c.lineTo(-40, -8);
    c.bezierCurveTo(-46, -40, -6, -44, 0, -22);
    c.bezierCurveTo(6, -44, 46, -40, 40, -8);
    c.lineTo(40, 34);
    c.closePath();
    c.fill();
    outline(c);
    c.fillStyle = '#fbe7c4';
    c.beginPath();
    c.moveTo(-32, 28);
    c.lineTo(-32, -6);
    c.bezierCurveTo(-36, -30, -8, -32, 0, -14);
    c.bezierCurveTo(8, -32, 36, -30, 32, -6);
    c.lineTo(32, 28);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(214, 170, 110, 0.35)';
    for (const [sx, sy] of [[-14, 0], [10, 6], [-4, 16], [18, -8], [-20, 14]]) {
      c.beginPath();
      c.arc(sx, sy, 2.2, 0, Math.PI * 2);
      c.fill();
    }
  },
};

function shadow(c: CanvasRenderingContext2D, x: number, y: number, rx: number): void {
  c.fillStyle = 'rgba(90, 58, 34, 0.18)';
  c.beginPath();
  c.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2);
  c.fill();
}

function outline(c: CanvasRenderingContext2D): void {
  c.strokeStyle = ink();
  c.lineWidth = 3 * lk;
  c.stroke();
}

function gloss(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  c.fillStyle = 'rgba(255, 255, 255, 0.55)';
  c.beginPath();
  c.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2);
  c.fill();
}
