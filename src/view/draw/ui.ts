import { C, font } from '../palette';

export function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

/** 縁取り文字 */
export function outlined(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string = C.white,
  stroke: string = C.woodDeep,
  align: CanvasTextAlign = 'center',
): void {
  c.font = font(size);
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size * 0.22);
  c.strokeStyle = stroke;
  c.strokeText(text, x, y);
  c.fillStyle = fill;
  c.fillText(text, x, y);
}

export function coin(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.fillStyle = C.goldDeep;
  c.beginPath();
  c.arc(x, y + r * 0.12, r, 0, Math.PI * 2);
  c.fill();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff2b0');
  g.addColorStop(1, C.gold);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = C.goldDeep;
  c.lineWidth = Math.max(1.5, r * 0.14);
  c.beginPath();
  c.arc(x, y, r * 0.66, 0, Math.PI * 2);
  c.stroke();
}

export function clock(c: CanvasRenderingContext2D, x: number, y: number, r: number, ratio: number, color: string): void {
  c.fillStyle = C.cream;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y);
  c.arc(x, y, r - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
  c.closePath();
  c.fill();
  c.strokeStyle = C.woodDeep;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.stroke();
}

export function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.46;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fillStyle = filled ? C.gold : 'rgba(255,255,255,0.35)';
  c.fill();
  c.strokeStyle = filled ? C.goldDeep : 'rgba(90,58,34,0.4)';
  c.lineWidth = 2.5;
  c.stroke();
}

export function check(c: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  c.fillStyle = C.good;
  c.beginPath();
  c.arc(x, y, s, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = C.white;
  c.lineWidth = s * 0.32;
  c.beginPath();
  c.moveTo(x - s * 0.45, y);
  c.lineTo(x - s * 0.1, y + s * 0.38);
  c.lineTo(x + s * 0.5, y - s * 0.35);
  c.stroke();
}

/** キーボードのキー表示 */
export function keycap(c: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  c.font = font(13, 800);
  const w = Math.max(22, c.measureText(label).width + 10);
  roundRect(c, x - w / 2, y - 11, w, 22, 6);
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.fill();
  c.strokeStyle = C.inkSoft;
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = C.ink;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, x, y + 1);
}
