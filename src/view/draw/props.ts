import { BALANCE } from '../../config/balance';
import { BREADS, type BreadId } from '../../config/breads';
import type { Oven } from '../../sim/world';
import type { Rect } from '../layout';
import { C, font } from '../palette';
import { drawBread } from './breads';
import { check, outlined, roundRect } from './ui';

export interface SlotLook {
  hover: boolean;
  /** 在庫切れでタップしたときの赤い点滅 0..1 */
  flash: number;
  /** 取ったときのぽよん 0..1 */
  pop: number;
}

/** ショーケースのパン（在庫を山盛りで見せる） */
export function drawSlot(c: CanvasRenderingContext2D, r: Rect, bread: BreadId, stock: number, pr: number, look: SlotLook): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h * 0.46;
  const size = Math.min(r.w * 0.5, r.h * 0.62);

  if (look.hover && stock > 0) {
    c.fillStyle = 'rgba(255, 255, 255, 0.55)';
    roundRect(c, r.x, r.y, r.w, r.h, 14);
    c.fill();
  }

  if (stock <= 0) {
    c.save();
    c.globalAlpha = 0.25;
    drawBread(c, bread, cx, cy, size, pr);
    c.restore();
    outlined(c, '売り切れ', cx, cy, Math.min(20, r.w * 0.15), '#ffffff', C.bad);
  } else {
    const s = 1 + look.pop * 0.18;
    const pile = Math.min(stock, 3);
    const offsets = [
      [0, 0],
      [-size * 0.32, -size * 0.12],
      [size * 0.32, -size * 0.12],
    ];
    for (let i = pile - 1; i >= 0; i--) {
      const [dx, dy] = offsets[i];
      drawBread(c, bread, cx + dx, cy + dy, size * (i === 0 ? s : 0.85), pr);
    }
    // 個数バッジ
    const bx = r.x + r.w - 20;
    const by = r.y + 18;
    c.fillStyle = stock <= 1 ? C.warn : C.woodDark;
    c.beginPath();
    c.arc(bx, by, 15, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = C.white;
    c.lineWidth = 2.5;
    c.stroke();
    c.fillStyle = C.white;
    c.font = font(stock >= 10 ? 13 : 16);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(stock), bx, by + 1);
  }

  if (look.flash > 0) {
    c.strokeStyle = `rgba(226, 87, 76, ${look.flash})`;
    c.lineWidth = 5;
    roundRect(c, r.x, r.y, r.w, r.h, 14);
    c.stroke();
  }
}

/** カウンターの上のトレー */
export function drawTray(c: CanvasRenderingContext2D, tray: Rect, slots: Rect[], items: BreadId[], pr: number, pulse: number): void {
  c.fillStyle = 'rgba(90, 58, 34, 0.25)';
  roundRect(c, tray.x + 4, tray.y + 8, tray.w, tray.h, 18);
  c.fill();
  const g = c.createLinearGradient(0, tray.y, 0, tray.y + tray.h);
  g.addColorStop(0, '#f2f4f7');
  g.addColorStop(1, '#c9ced6');
  c.fillStyle = g;
  roundRect(c, tray.x, tray.y, tray.w, tray.h, 18);
  c.fill();
  c.strokeStyle = '#8b929e';
  c.lineWidth = 3;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.8)';
  c.lineWidth = 2;
  roundRect(c, tray.x + 6, tray.y + 5, tray.w - 12, tray.h - 10, 13);
  c.stroke();

  slots.forEach((s, i) => {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const bread = items[i];
    if (!bread) {
      c.fillStyle = 'rgba(139, 146, 158, 0.18)';
      c.beginPath();
      c.ellipse(cx, cy + 4, s.w * 0.32, s.h * 0.26, 0, 0, Math.PI * 2);
      c.fill();
      return;
    }
    const bounce = i === items.length - 1 ? pulse : 0;
    drawBread(c, bread, cx, cy - bounce * 8, Math.min(s.w, s.h) * 0.92, pr);
  });
}

export interface OvenLook {
  hover: boolean;
  t: number;
}

/** オーブンの扉まわり（状態で変わる部分） */
export function drawOven(c: CanvasRenderingContext2D, r: Rect, oven: Oven, pr: number, look: OvenLook): void {
  const door = ovenDoor(r);
  const cx = door.x + door.w / 2;

  // 扉の中
  c.save();
  archPath(c, door);
  let inner = '#3b2418';
  if (oven.state === 'baking') inner = `rgb(${200 + Math.sin(look.t * 9) * 20}, 96, 40)`;
  if (oven.state === 'ready') inner = '#ffb347';
  if (oven.state === 'burnt') inner = '#2a2220';
  c.fillStyle = inner;
  c.fill();
  c.clip();
  if (oven.state === 'baking' || oven.state === 'ready') {
    const glow = c.createRadialGradient(cx, door.y + door.h, 4, cx, door.y + door.h, door.w);
    glow.addColorStop(0, 'rgba(255, 240, 160, 0.9)');
    glow.addColorStop(1, 'rgba(255, 200, 100, 0)');
    c.fillStyle = glow;
    c.fillRect(door.x, door.y, door.w, door.h);
  }
  if (oven.bread && oven.state !== 'burnt') {
    const progress = oven.state === 'ready' ? 1 : oven.t / BREADS[oven.bread].bakeTime;
    c.globalAlpha = 0.35 + progress * 0.65;
    drawBread(c, oven.bread, cx, door.y + door.h * 0.62, door.w * 0.62, pr);
    c.globalAlpha = 1;
  }
  if (oven.state === 'burnt') {
    c.fillStyle = '#1a1412';
    c.beginPath();
    c.ellipse(cx, door.y + door.h * 0.66, door.w * 0.3, door.h * 0.18, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  c.strokeStyle = '#4a2a1a';
  c.lineWidth = 5;
  archPath(c, door);
  c.stroke();

  // 状態表示
  const top = r.y + 24;
  if (oven.state === 'idle') {
    if (look.hover) {
      c.fillStyle = 'rgba(255,255,255,0.18)';
      archPath(c, door);
      c.fill();
    }
    outlined(c, 'やく', cx, door.y + door.h * 0.5, 22, '#ffffff', '#7d3a26');
  } else if (oven.state === 'baking' && oven.bread) {
    const p = oven.t / BREADS[oven.bread].bakeTime;
    gauge(c, cx, top + 14, r.w * 0.36, p, '#ffd36e');
    const left = Math.ceil(BREADS[oven.bread].bakeTime - oven.t);
    outlined(c, `${left}`, cx, top + 14, 18, '#ffffff', '#7d3a26');
  } else if (oven.state === 'ready') {
    const rest = 1 - oven.t / BALANCE.oven.readyWindow;
    gauge(c, cx, top + 14, r.w * 0.36, rest, rest < 0.35 ? C.bad : C.good);
    const bob = Math.sin(look.t * 10) * 4;
    outlined(c, 'やけた！', cx, door.y - 2 + bob, 22, '#fff4a8', '#a0461e');
  } else if (oven.state === 'burnt') {
    outlined(c, 'こげた…', cx, door.y - 2, 20, '#ffffff', '#3b2418');
  }
}

export function ovenDoor(r: Rect): Rect {
  const w = r.w * 0.62;
  const h = r.h * 0.48;
  return { x: r.x + (r.w - w) / 2, y: r.y + r.h - h - 26, w, h };
}

function archPath(c: CanvasRenderingContext2D, d: Rect): void {
  const rr = d.w / 2;
  c.beginPath();
  c.moveTo(d.x, d.y + d.h);
  c.lineTo(d.x, d.y + rr);
  c.arc(d.x + rr, d.y + rr, rr, Math.PI, 0);
  c.lineTo(d.x + d.w, d.y + d.h);
  c.closePath();
}

/** 円形ゲージ（残り割合） */
function gauge(c: CanvasRenderingContext2D, x: number, y: number, r: number, ratio: number, color: string): void {
  const rr = Math.min(22, r * 0.4);
  c.fillStyle = 'rgba(59, 36, 24, 0.75)';
  c.beginPath();
  c.arc(x, y, rr + 4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.beginPath();
  c.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, ratio)));
  c.stroke();
}

export interface BubbleSpec {
  order: BreadId[];
  received: boolean[];
  /** 待ち時間の残り割合 */
  ratio: number;
  /** ネル: 中身を伏せるか */
  hidden: boolean;
  /** コミー: 居眠り中（中身の代わりに Zzz） */
  sleep: boolean;
  nell: boolean;
  shake: number;
  /** ネルで中身が見えている残り割合（見えている間のゲージ） */
  reveal: number;
}

export function bubbleSize(n: number, maxW: number, cell: number): { w: number; h: number; cols: number } {
  const cols = Math.max(1, Math.min(n, Math.floor((maxW - 16) / cell)));
  const rows = Math.ceil(n / cols);
  return { w: cols * cell + 16, h: rows * cell + 26, cols };
}

/** 注文の吹き出し。(cx, bottom) は吹き出しのしっぽの先 */
export function drawBubble(c: CanvasRenderingContext2D, cx: number, bottom: number, maxW: number, cell: number, b: BubbleSpec, pr: number): Rect {
  const { w, h, cols } = bubbleSize(b.order.length, maxW, cell);
  const x = cx - w / 2 + Math.sin(b.shake * 40) * b.shake * 6;
  const y = bottom - h - 12;
  const frame = b.nell ? C.nell : '#d9b48a';

  c.fillStyle = 'rgba(90, 58, 34, 0.18)';
  roundRect(c, x + 3, y + 5, w, h, 16);
  c.fill();
  c.fillStyle = b.nell ? '#f4f8fc' : '#ffffff';
  roundRect(c, x, y, w, h, 16);
  c.fill();
  c.beginPath();
  c.moveTo(cx - 10, y + h - 1);
  c.lineTo(cx, bottom);
  c.lineTo(cx + 10, y + h - 1);
  c.closePath();
  c.fill();
  c.strokeStyle = frame;
  c.lineWidth = 3;
  roundRect(c, x, y, w, h, 16);
  c.stroke();
  c.fillStyle = b.nell ? '#f4f8fc' : '#ffffff';
  c.fillRect(cx - 9, y + h - 4, 18, 6);
  c.beginPath();
  c.moveTo(cx - 10, y + h);
  c.lineTo(cx, bottom);
  c.lineTo(cx + 10, y + h);
  c.stroke();

  if (b.sleep) {
    c.fillStyle = C.komi;
    c.font = font(cell * 0.5);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('Zzz…', x + w / 2, y + 8 + cell / 2);
  }
  b.order.forEach((bread, i) => {
    if (b.sleep) return;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ix = x + 8 + col * cell + cell / 2;
    const iy = y + 8 + row * cell + cell / 2;
    if (b.hidden) {
      c.fillStyle = '#dfe6ee';
      c.beginPath();
      c.arc(ix, iy, cell * 0.36, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = C.nell;
      c.font = font(cell * 0.46);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('？', ix, iy + 1);
      return;
    }
    c.globalAlpha = b.received[i] ? 0.35 : 1;
    drawBread(c, bread, ix, iy, cell * 0.86, pr);
    c.globalAlpha = 1;
    if (b.received[i]) check(c, ix + cell * 0.22, iy + cell * 0.18, cell * 0.2);
  });

  // 待ち時間のバー
  const barY = y + h - 14;
  const barW = w - 20;
  c.fillStyle = '#efe4d6';
  roundRect(c, x + 10, barY, barW, 7, 4);
  c.fill();
  const col = b.ratio > 0.5 ? C.good : b.ratio > 0.25 ? C.warn : C.bad;
  c.fillStyle = col;
  roundRect(c, x + 10, barY, Math.max(4, barW * b.ratio), 7, 4);
  c.fill();
  if (b.nell && b.reveal > 0) {
    c.fillStyle = C.nell;
    roundRect(c, x + 10, y - 9, barW * b.reveal, 5, 3);
    c.fill();
  }
  return { x, y, w, h };
}
