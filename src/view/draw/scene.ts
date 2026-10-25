import { BREADS } from '../../config/breads';
import type { StageDef } from '../../config/stages';
import { breadName, T } from '../../i18n';
import type { Layout, Rect } from '../layout';
import { C, font } from '../palette';
import { roundRect } from './ui';

// 動かない背景は 2 枚のオフスクリーンにまとめて焼く。
// back = 客の後ろ（壁・窓）、front = 客の手前（カウンター・作業場・ショーケース枠・オーブン本体）
export class SceneCache {
  back: HTMLCanvasElement | null = null;
  front: HTMLCanvasElement | null = null;
  private key = '';

  ensure(L: Layout, stage: StageDef, pr: number): void {
    const key = `${L.w}x${L.h}:${stage.id}:${pr}`;
    if (key === this.key) return;
    this.key = key;
    this.back = bake(L, pr, (c) => drawBack(c, L));
    this.front = bake(L, pr, (c) => drawFront(c, L, stage));
  }

  invalidate(): void {
    this.key = '';
  }
}

function bake(L: Layout, pr: number, paint: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(L.w * pr);
  cv.height = Math.ceil(L.h * pr);
  const c = cv.getContext('2d')!;
  c.scale(pr, pr);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  paint(c);
  return cv;
}

// ------------------------------------------------------------------ back

function drawBack(c: CanvasRenderingContext2D, L: Layout): void {
  const f = L.floor;
  // 壁紙
  c.fillStyle = C.wall;
  c.fillRect(0, 0, L.w, L.counter.y + 20);
  c.fillStyle = C.wallStripe;
  for (let x = 0; x < L.w; x += 56) c.fillRect(x, f.y, 22, f.h);
  // 小花模様
  c.fillStyle = 'rgba(229, 132, 139, 0.25)';
  for (let x = 39; x < L.w; x += 56) {
    for (let y = f.y + 30; y < f.y + f.h - 60; y += 70) {
      const yy = y + ((x / 56) % 2) * 35;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(x + Math.cos((i * Math.PI) / 2) * 4, yy + Math.sin((i * Math.PI) / 2) * 4, 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  // 窓（左右）
  for (const r of L.windows) drawWindow(c, r.x, r.y, r.w, r.h);

  // 吊り看板
  const signW = L.portrait ? 300 : 340;
  const sx = L.w / 2 - signW / 2;
  const sy = f.y + (L.portrait ? 20 : 12);
  c.strokeStyle = C.woodDark;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(sx + 40, f.y);
  c.lineTo(sx + 40, sy + 6);
  c.moveTo(sx + signW - 40, f.y);
  c.lineTo(sx + signW - 40, sy + 6);
  c.stroke();
  roundRect(c, sx, sy, signW, 44, 14);
  c.fillStyle = C.woodLight;
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = C.woodDark;
  c.stroke();
  c.fillStyle = C.woodDeep;
  c.font = font(L.portrait ? 21 : 22);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(T.game.sign, L.w / 2, sy + 23);

  // 腰板
  const wy = L.counter.y - 46;
  c.fillStyle = C.woodLight;
  c.fillRect(0, wy, L.w, 66);
  c.fillStyle = C.wood;
  c.fillRect(0, wy, L.w, 6);
  c.strokeStyle = 'rgba(138, 82, 40, 0.35)';
  c.lineWidth = 2;
  for (let x = 30; x < L.w; x += 60) {
    c.beginPath();
    c.moveTo(x, wy + 10);
    c.lineTo(x, wy + 66);
    c.stroke();
  }

  // HUD の帯
  const h = L.hud;
  const g = c.createLinearGradient(0, 0, 0, h.h);
  g.addColorStop(0, '#9b5e2e');
  g.addColorStop(1, '#7c4721');
  c.fillStyle = g;
  c.fillRect(0, 0, L.w, h.h);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(0, 0, L.w, 4);
  c.fillStyle = C.woodDeep;
  c.fillRect(0, h.h - 5, L.w, 5);
}

function drawWindow(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = w / 2;
  c.save();
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + r);
  c.arc(x + r, y + r, r, Math.PI, 0);
  c.lineTo(x + w, y + h);
  c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#a8def5');
  g.addColorStop(1, '#e3f6fc');
  c.fillStyle = g;
  c.fill();
  c.clip();
  // 雲と木
  c.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [cx, cy, cr] of [[0.3, 0.35, 0.12], [0.42, 0.33, 0.15], [0.55, 0.36, 0.11]]) {
    c.beginPath();
    c.arc(x + w * cx, y + h * cy, w * cr, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#8fcf7e';
  c.beginPath();
  c.arc(x + w * 0.8, y + h * 0.95, w * 0.4, 0, Math.PI * 2);
  c.arc(x + w * 0.15, y + h * 1.0, w * 0.32, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // 枠
  c.strokeStyle = C.woodDark;
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y + r);
  c.arc(x + r, y + r, r, Math.PI, 0);
  c.lineTo(x + w, y + h);
  c.closePath();
  c.stroke();
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + r, y + h);
  c.moveTo(x, y + h * 0.55);
  c.lineTo(x + w, y + h * 0.55);
  c.stroke();
  // 窓台と植木鉢
  c.fillStyle = C.wood;
  roundRect(c, x - 10, y + h - 4, w + 20, 12, 4);
  c.fill();
  c.fillStyle = '#e07b54';
  roundRect(c, x + w * 0.62, y + h - 26, 30, 24, 5);
  c.fill();
  c.fillStyle = '#6fbf73';
  for (const dx of [-8, 0, 8]) {
    c.beginPath();
    c.ellipse(x + w * 0.62 + 15 + dx, y + h - 32, 6, 11, dx * 0.06, 0, Math.PI * 2);
    c.fill();
  }
}

// ----------------------------------------------------------------- front

function drawFront(c: CanvasRenderingContext2D, L: Layout, stage: StageDef): void {
  const k = L.counter;
  // カウンター天板
  const top = c.createLinearGradient(0, k.y, 0, k.y + 26);
  top.addColorStop(0, '#fbe4bf');
  top.addColorStop(1, C.counterTop);
  c.fillStyle = top;
  c.fillRect(0, k.y, L.w, 26);
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillRect(0, k.y + 2, L.w, 3);
  // 前板
  const front = c.createLinearGradient(0, k.y + 26, 0, k.y + k.h);
  front.addColorStop(0, C.wood);
  front.addColorStop(1, C.woodDark);
  c.fillStyle = front;
  c.fillRect(0, k.y + 26, L.w, k.h - 26);
  c.strokeStyle = 'rgba(80, 40, 15, 0.35)';
  c.lineWidth = 3;
  for (let x = 40; x < L.w; x += 120) {
    roundRect(c, x, k.y + 36, 96, k.h - 46, 8);
    c.stroke();
  }

  // 作業場の床（市松）
  const w = L.work;
  c.fillStyle = C.tile;
  c.fillRect(w.x, w.y, w.w, w.h);
  c.fillStyle = C.tileLine;
  const t = 48;
  for (let y = w.y; y < w.y + w.h; y += t) {
    for (let x = ((y - w.y) / t) % 2 === 0 ? 0 : t; x < w.w; x += t * 2) c.fillRect(x, y, t, t);
  }
  c.fillStyle = 'rgba(90, 58, 34, 0.25)';
  c.fillRect(0, w.y, L.w, 8);

  drawShowcaseFrame(c, L, stage);
  for (const r of L.ovens) drawOvenBody(c, r);
}

function drawShowcaseFrame(c: CanvasRenderingContext2D, L: Layout, stage: StageDef): void {
  const s = L.showcase;
  // 影
  c.fillStyle = 'rgba(90, 58, 34, 0.2)';
  roundRect(c, s.x + 6, s.y + 10, s.w, s.h, 22);
  c.fill();
  // 木枠
  c.fillStyle = C.woodLight;
  roundRect(c, s.x, s.y, s.w, s.h, 22);
  c.fill();
  c.strokeStyle = C.woodDark;
  c.lineWidth = 4;
  c.stroke();
  // 内側
  const inner: Rect = { x: s.x + 10, y: s.y + 10, w: s.w - 20, h: s.h - 20 };
  const g = c.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
  g.addColorStop(0, '#fff9ef');
  g.addColorStop(1, '#f6e3c6');
  c.fillStyle = g;
  roundRect(c, inner.x, inner.y, inner.w, inner.h, 14);
  c.fill();

  // 各スロットの皿と名札
  stage.breads.forEach((id, i) => {
    const r = L.slots[i];
    if (!r) return;
    c.fillStyle = 'rgba(201, 132, 70, 0.12)';
    roundRect(c, r.x, r.y, r.w, r.h, 14);
    c.fill();
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#e8cfa8';
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(r.x + r.w / 2, r.y + r.h * 0.56, r.w * 0.38, r.h * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // 名札
    const tagH = 22;
    c.fillStyle = C.cream;
    roundRect(c, r.x + 8, r.y + r.h - tagH - 4, r.w - 16, tagH, 8);
    c.fill();
    c.strokeStyle = '#e2c49c';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = C.ink;
    c.font = font(r.w < 150 ? 12 : 13, 700);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${breadName(id)}  ${BREADS[id].price}G`, r.x + r.w / 2, r.y + r.h - tagH / 2 - 4, r.w - 20);
  });
}

function drawOvenBody(c: CanvasRenderingContext2D, r: Rect): void {
  // れんがのかまど
  c.fillStyle = 'rgba(90, 58, 34, 0.2)';
  roundRect(c, r.x + 6, r.y + 10, r.w, r.h, 26);
  c.fill();
  const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#d9785a');
  g.addColorStop(1, '#b25a40');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(r.x, r.y + r.h);
  c.lineTo(r.x, r.y + r.w * 0.5);
  c.arc(r.x + r.w / 2, r.y + r.w * 0.5, r.w / 2, Math.PI, 0);
  c.lineTo(r.x + r.w, r.y + r.h);
  c.closePath();
  c.fill();
  c.strokeStyle = '#7d3a26';
  c.lineWidth = 4;
  c.stroke();
  // れんが目地
  c.save();
  c.clip();
  c.strokeStyle = 'rgba(255, 220, 190, 0.35)';
  c.lineWidth = 2;
  for (let y = r.y + 14; y < r.y + r.h; y += 22) {
    c.beginPath();
    c.moveTo(r.x, y);
    c.lineTo(r.x + r.w, y);
    c.stroke();
    const off = ((y - r.y) / 22) % 2 === 0 ? 0 : 20;
    for (let x = r.x + off; x < r.x + r.w; x += 40) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + 22);
      c.stroke();
    }
  }
  c.restore();
  // 台
  c.fillStyle = '#8a8f99';
  roundRect(c, r.x - 6, r.y + r.h - 18, r.w + 12, 18, 6);
  c.fill();
}
