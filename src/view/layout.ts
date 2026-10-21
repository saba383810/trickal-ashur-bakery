import type { StageDef } from '../config/stages';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Layout {
  w: number;
  h: number;
  portrait: boolean;
  hud: Rect;
  pauseBtn: Rect;
  /** 客のいる店内 */
  floor: Rect;
  /** カウンター（天板 + 前板） */
  counter: Rect;
  /** 客の頭の中心 */
  seats: Point[];
  /** 注文吹き出しの最大幅 */
  bubbleMaxW: number;
  /** 客の頭の半径 */
  headR: number;
  tray: Rect;
  traySlots: Rect[];
  /** 作業場（ショーケースとオーブンの床） */
  work: Rect;
  showcase: Rect;
  /** stage.breads と同じ並び */
  slots: Rect[];
  ovens: Rect[];
  /** エルフィンが入ってくる位置（頭の中心） */
  elfinDoor: Point;
  /** バナーを出す中心 */
  banner: Point;
}

export function inside(r: Rect, p: Point, pad = 0): boolean {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
}

export function center(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** 横に n 個並べる（中央寄せ・最大幅つき） */
function row(area: Rect, n: number, gap: number, maxW: number): Rect[] {
  const w = Math.min(maxW, (area.w - gap * (n - 1)) / n);
  const total = w * n + gap * (n - 1);
  const x0 = area.x + (area.w - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gap), y: area.y, w, h: area.h }));
}

/** 格子に並べる（1 行最大 cols 個） */
function grid(area: Rect, n: number, cols: number, gap: number, maxW: number, maxH: number): Rect[] {
  const c = Math.min(cols, n);
  const rows = Math.ceil(n / c);
  const w = Math.min(maxW, (area.w - gap * (c - 1)) / c);
  const h = Math.min(maxH, (area.h - gap * (rows - 1)) / rows);
  const totalH = h * rows + gap * (rows - 1);
  const y0 = area.y + (area.h - totalH) / 2;
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(c, n - r * c);
    const totalW = w * inRow + gap * (inRow - 1);
    const x0 = area.x + (area.w - totalW) / 2;
    for (let i = 0; i < inRow; i++) out.push({ x: x0 + i * (w + gap), y: y0 + r * (h + gap), w, h });
  }
  return out;
}

export function makeLayout(w: number, h: number, portrait: boolean, stage: StageDef): Layout {
  return portrait ? portraitLayout(w, h, stage) : landscapeLayout(w, h, stage);
}

function landscapeLayout(w: number, h: number, stage: StageDef): Layout {
  const hud = { x: 0, y: 0, w, h: 64 };
  const floor = { x: 0, y: 64, w, h: 276 };
  const counter = { x: 0, y: 330, w, h: 92 };
  const margin = 170;
  const seats = Array.from({ length: stage.seats }, (_, i) => ({
    x: margin + ((w - margin * 2) * (i + 0.5)) / stage.seats,
    y: 262,
  }));
  const spacing = (w - margin * 2) / stage.seats;
  const tray = { x: w / 2 - 190, y: 342, w: 380, h: 70 };
  const work = { x: 0, y: 422, w, h: h - 422 };
  const showcase = { x: 20, y: 440, w: 690, h: 262 };
  const slots = grid(inset(showcase, 18, 22), stage.breads.length, 4, 12, 170, 112);
  const ovenArea = { x: 730, y: 446, w: 530, h: 250 };
  const ovens = row(ovenArea, stage.ovens, 16, 168);
  return {
    w,
    h,
    portrait: false,
    hud,
    pauseBtn: { x: w - 60, y: 8, w: 48, h: 48 },
    floor,
    counter,
    seats,
    bubbleMaxW: Math.min(250, spacing - 14),
    headR: 50,
    tray,
    traySlots: row(inset(tray, 10, 6), 4, 8, 84),
    work,
    showcase,
    slots,
    ovens,
    elfinDoor: { x: -70, y: showcase.y + showcase.h - 70 },
    // 注文の吹き出しを隠さないよう、客の顔の高さに出す
    banner: { x: w / 2, y: 268 },
  };
}

function portraitLayout(w: number, h: number, stage: StageDef): Layout {
  // 基準は 720×1280。それより縦長なら、客席・ショーケース・オーブンに余りを配る
  const extra = Math.max(0, h - 1280);
  const top = Math.round(extra * 0.4);
  const mid = Math.round(extra * 0.25);
  const hud = { x: 0, y: 0, w, h: 72 };
  const floor = { x: 0, y: 72, w, h: 450 + top };
  const counter = { x: 0, y: 512 + top, w, h: 100 };
  const margin = 70;
  const seats = Array.from({ length: stage.seats }, (_, i) => ({
    x: margin + ((w - margin * 2) * (i + 0.5)) / stage.seats,
    y: 440 + top,
  }));
  const spacing = (w - margin * 2) / stage.seats;
  const tray = { x: w / 2 - 190, y: 526 + top, w: 380, h: 74 };
  const work = { x: 0, y: 612 + top, w, h: h - 612 - top };
  const showcase = { x: 16, y: 630 + top, w: w - 32, h: 330 + mid };
  const slots = grid(inset(showcase, 16, 22), stage.breads.length, 4, 10, 160, 150);
  const ovenArea = { x: 16, y: 984 + top + mid, w: w - 32, h: h - 1010 - top - mid };
  const ovens = row(ovenArea, stage.ovens, 14, 216);
  return {
    w,
    h,
    portrait: true,
    hud,
    pauseBtn: { x: w - 62, y: 10, w: 52, h: 52 },
    floor,
    counter,
    seats,
    bubbleMaxW: Math.min(250, spacing - 10),
    headR: 46,
    tray,
    traySlots: row(inset(tray, 10, 6), 4, 8, 84),
    work,
    showcase,
    slots,
    ovens,
    elfinDoor: { x: -70, y: showcase.y + showcase.h - 80 },
    banner: { x: w / 2, y: 450 + top },
  };
}

function inset(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w - dx * 2, h: r.h - dy * 2 };
}
