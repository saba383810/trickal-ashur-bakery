// SD キャラをコードで描く。頭の半径 50 の座標系でデザインし、描画時に拡縮する。
// 原作の画風（横に広いもち顔・低い位置の大きな目・赤茶の線・低彩度のパステル塗り）に寄せた
// 描き起こし。公式イラストの模写・トレースではなく、設定資料の特徴から起こしたオリジナル。

export type HairStyle = 'long' | 'wavy' | 'bob' | 'twin' | 'pony' | 'short' | 'bun';
/** heavy = 目まで隠れる重い前髪（モブ） */
export type BangStyle = 'blunt' | 'swept' | 'split' | 'heavy';
/** bowband = リボン付きのカチューシャ */
export type HatKind = 'beret' | 'tiara' | 'veil' | 'ribbon' | 'leaf' | 'maid' | 'bowband' | null;
export type WingKind = 'plain' | 'pink' | 'frost' | 'swirl' | null;
/** cat = ω の口 */
export type MouthKind = 'line' | 'fang' | 'open' | 'smirk' | 'cat';
export type Expr =
  | 'normal'
  | 'happy'
  | 'smile'
  | 'angry'
  | 'worried'
  | 'munch'
  | 'surprised'
  | 'sulk'
  | 'dizzy'
  | 'stern'
  | 'sleep';

export interface ChibiSpec {
  skin: string;
  hair: string;
  hairShade: string;
  /** 毛先の色（後ろ髪のグラデーションの終点） */
  hairTip: string;
  /** 頭のつやの色 */
  shine: string;
  /** ふだんから半目（ジト目） */
  halfLid?: boolean;
  /** 眉の色（怒り・困り顔のときだけ出る） */
  brows?: string;
  /** 瞳の下側の色（省略時は焦げ茶一色） */
  eye?: string;
  mouth: MouthKind;
  style: HairStyle;
  bangs: BangStyle;
  outfit: string;
  outfitShade: string;
  collar: string;
  legs: string;
  shoes: string;
  ears: 'elf' | 'cat' | 'dog' | null;
  /** しっぽ（tip = 先の色） */
  tail?: { kind: 'cat' | 'dog'; color: string; tip: string };
  /** 頭のてっぺんのアホ毛 */
  ahoge?: boolean;
  hat: HatKind;
  hatColor: string;
  wings: WingKind;
  /** キャラ固有の服・小物 */
  extra?: 'eshur' | 'elfin' | 'nell' | 'komi' | 'butter' | 'speaki';
  /** 名前のないモブ（目は前髪で隠れ、口と頬で表情を出す） */
  mob?: boolean;
  /** モブのエプロンの色 */
  apron?: string;
}

export interface ChibiPose {
  expr: Expr;
  /** アニメーション用の経過秒 */
  t: number;
  blink?: boolean;
  /** 体の上下の伸び縮み（1 = そのまま） */
  squash?: number;
  tilt?: number;
  /** 左右のほっぺのぷるぷる（バネのずれ） */
  wobble?: number;
  /** 体を描くか（false なら顔だけ） */
  body?: boolean;
  /** 持ち物（王笏・斧・指示棒）を持たせる */
  prop?: boolean;
  /** 顔を向ける側（そちらのほっぺが輪郭の外へもちっと張り出す）。既定 1 */
  turn?: -1 | 1;
}

/** ほっぺの中心。頭半径 50 の単位 */
const CHEEK = { x: 36, y: 29 };
/** 足の裏の高さ（頭の半径に対する倍率） */
export const FEET_R = 2.34;

const LINE = '#5a2d32';
const BLUSH = 'rgba(255, 166, 164, 0.95)';
/** 原作の SD の目の色（焦げ茶） */
const EYE = '#55242a';
const MOUTH = '#b23a48';
const TONGUE = '#fda3a2';
const WHITE = '#fffdfb';
const GOLD = '#fdd397';
const GOLD_SHADE = '#e3a46f';
const PUMPKIN = '#f3a25f';
const PUMPKIN_SHADE = '#dc8546';

export function drawChibi(
  ctx: CanvasRenderingContext2D,
  spec: ChibiSpec,
  x: number,
  y: number,
  r: number,
  pose: ChibiPose,
): void {
  const k = r / 50;
  const squash = pose.squash ?? 1;
  const body = pose.body !== false;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pose.tilt ?? 0);
  ctx.scale(k * (2 - squash), k * squash);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (body && spec.wings) wings(ctx, spec.wings);
  if (body && spec.tail) tail(ctx, spec.tail);
  // 顔だけの時は、肩から下に垂れる髪やヴェールを切る
  ctx.save();
  if (!body) {
    ctx.beginPath();
    ctx.rect(-140, -140, 280, 196);
    ctx.clip();
  }
  if (spec.hat === 'veil') veilBack(ctx, spec);
  if (body && spec.extra === 'elfin') royalCape(ctx);
  backHair(ctx, spec);
  ctx.restore();
  if (body) drawBody(ctx, spec, pose);
  if (spec.ears === 'elf') elfEars(ctx, spec);
  const g = faceGeom(spec, pose);
  face(ctx, spec, g);
  // 顔を向けた側へ目と口を少しずらす（3/4 向き）
  ctx.save();
  ctx.translate(g.turn * 3, 0);
  eyes(ctx, spec, pose);
  mouth(ctx, spec, pose);
  // スピッキーは困るとすぐ涙ぐむ
  const teary = spec.extra === 'speaki' && pose.expr === 'worried';
  if (teary) tears(ctx);
  ctx.restore();
  frontHair(ctx, spec, body, g);
  ctx.save();
  ctx.translate(g.turn * 3, 0);
  brows(ctx, spec, pose.expr);
  ctx.restore();
  if (spec.ears === 'cat') catEars(ctx, spec);
  if (spec.ahoge) ahoge(ctx, spec);
  hat(ctx, spec);
  if (body && pose.prop) prop(ctx, spec);
  if (pose.expr === 'angry') angerMark(ctx, pose.t);
  if (pose.expr === 'worried' && !teary) sweat(ctx);
  if (spec.mob && pose.expr === 'happy') heart(ctx, -g.turn * 50, -56 - Math.abs(Math.sin(pose.t * 5)) * 4);
  ctx.restore();
}

// ------------------------------------------------------------------ helpers

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: string[]): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** 左右で塗り分ける 1 段影（アニメ塗り） */
function sideShade(ctx: CanvasRenderingContext2D, x0: number, x1: number, light: string, shade: string, at = 0.62): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, light);
  g.addColorStop(at, light);
  g.addColorStop(Math.min(1, at + 0.01), shade);
  g.addColorStop(1, shade);
  return g;
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 2.4, stroke = LINE): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** 線つきの太い筒（腕・柄など） */
function tube(ctx: CanvasRenderingContext2D, pts: number[], w: number, color: string): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
    else ctx.lineTo(pts[2], pts[3]);
  };
  path();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = w + 4.6;
  ctx.stroke();
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, lw = 2): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, fill, lw);
}

function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w, 0);
  ctx.lineTo(0, h);
  ctx.lineTo(-w, 0);
  ctx.closePath();
  fillStroke(ctx, color, 1.6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.7);
  ctx.lineTo(w * 0.45, -h * 0.1);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function spiral(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  for (let a = 0; a <= Math.PI * 3.2; a += 0.25) {
    const rr = (size * a) / (Math.PI * 3.2);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.stroke();
}

// ------------------------------------------------------------------ wings / cape / veil

function wings(ctx: CanvasRenderingContext2D, kind: Exclude<WingKind, null>): void {
  const tint = kind === 'pink' ? '#f6d2dc' : kind === 'frost' ? '#d4f1fb' : kind === 'swirl' ? '#fbdbe3' : '#ece4ec';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 28, 57);
    ctx.scale(side, 1);
    ctx.rotate(-0.3);
    const p = new Path2D();
    p.moveTo(0, 2);
    p.bezierCurveTo(6, -20, 30, -32, 46, -24);
    p.quadraticCurveTo(53, -16, 42, -11);
    p.quadraticCurveTo(49, -2, 37, 1);
    p.quadraticCurveTo(41, 10, 27, 10);
    p.quadraticCurveTo(14, 14, 0, 2);
    ctx.fillStyle = WHITE;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.ellipse(30, 9, 26, 10, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2.2;
    ctx.stroke(p);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(20, -7);
    ctx.quadraticCurveTo(30, -10, 39, -8);
    ctx.moveTo(14, 2);
    ctx.quadraticCurveTo(23, 3, 31, 2);
    ctx.stroke();
    if (kind === 'swirl') {
      ctx.lineWidth = 1.6;
      spiral(ctx, 40, -19, 5);
    }
    ctx.restore();
  }
}

/** エルフィンのマント（表はコーラル、裏はくすみピンク、裾に白いポンポン） */
function royalCape(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-22, 44);
  ctx.bezierCurveTo(-44, 60, -56, 92, -54, 112);
  ctx.lineTo(54, 112);
  ctx.bezierCurveTo(56, 92, 44, 60, 22, 44);
  ctx.closePath();
  fillStroke(ctx, '#ca7589');
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 22, 44);
    ctx.bezierCurveTo(side * 44, 60, side * 56, 92, side * 54, 112);
    ctx.lineTo(side * 42, 112);
    ctx.bezierCurveTo(side * 42, 88, side * 34, 62, side * 18, 46);
    ctx.closePath();
    fillStroke(ctx, '#ee8584');
  }
  for (let px = -48; px <= 48; px += 12) dot(ctx, px, 112, 5.5, WHITE, 1.8);
}

/** ネルのヴェールの後ろ側（頭の後ろから肩まで） */
function veilBack(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  const speaki = s.extra === 'speaki';
  ctx.beginPath();
  ctx.moveTo(-62, -52);
  ctx.bezierCurveTo(-84, -12, -82, 40, -76, 78);
  ctx.lineTo(76, 78);
  ctx.bezierCurveTo(82, 40, 84, -12, 62, -52);
  ctx.bezierCurveTo(40, -92, -40, -92, -62, -52);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, -90, 80, [speaki ? '#625869' : '#7d7893', s.hatColor]));
  // 縁の帯（スピッキーは金）
  ctx.strokeStyle = speaki ? GOLD : '#4e3436';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-77, 72);
  ctx.lineTo(-60, 72);
  ctx.moveTo(77, 72);
  ctx.lineTo(60, 72);
  ctx.stroke();
}

// ------------------------------------------------------------------ hair

function backHair(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  ctx.beginPath();
  let bottom = 60;
  switch (s.style) {
    case 'long':
      bottom = 110;
      ctx.moveTo(-58, -34);
      ctx.bezierCurveTo(-76, 6, -76, 64, -70, 106);
      for (const [x, y] of [[-58, 100], [-48, 110], [-34, 102], [-18, 109], [0, 103], [18, 109], [34, 102], [48, 110], [58, 100], [70, 106]]) ctx.lineTo(x, y);
      ctx.bezierCurveTo(76, 64, 76, 6, 58, -34);
      break;
    case 'wavy':
      bottom = 98;
      ctx.moveTo(-58, -34);
      ctx.bezierCurveTo(-72, -6, -62, 14, -72, 34);
      ctx.bezierCurveTo(-80, 54, -62, 66, -72, 86);
      ctx.quadraticCurveTo(-72, 98, -58, 96);
      for (const [x, y] of [[-48, 90], [-36, 98], [-20, 90], [0, 96], [20, 90], [36, 98], [48, 90], [58, 96]]) ctx.lineTo(x, y);
      ctx.quadraticCurveTo(72, 98, 72, 86);
      ctx.bezierCurveTo(62, 66, 80, 54, 72, 34);
      ctx.bezierCurveTo(62, 14, 72, -6, 58, -34);
      break;
    case 'bob':
      bottom = 50;
      ctx.moveTo(-60, -24);
      ctx.bezierCurveTo(-72, 16, -64, 48, -44, 50);
      ctx.lineTo(44, 50);
      ctx.bezierCurveTo(64, 48, 72, 16, 60, -24);
      break;
    case 'twin':
      bottom = 74;
      for (const side of [-1, 1]) {
        ctx.moveTo(side * 52, -34);
        ctx.bezierCurveTo(side * 96, -24, side * 92, 44, side * 72, 74);
        ctx.bezierCurveTo(side * 70, 40, side * 64, 8, side * 46, -10);
        ctx.closePath();
      }
      ctx.moveTo(-58, -20);
      ctx.bezierCurveTo(-66, 20, -52, 40, -34, 40);
      ctx.lineTo(34, 40);
      ctx.bezierCurveTo(52, 40, 66, 20, 58, -20);
      break;
    case 'pony':
      bottom = 64;
      ctx.moveTo(34, -56);
      ctx.bezierCurveTo(96, -62, 94, 28, 70, 64);
      ctx.bezierCurveTo(70, 24, 62, -14, 44, -22);
      ctx.closePath();
      ctx.moveTo(-58, -20);
      ctx.bezierCurveTo(-64, 16, -50, 36, -34, 36);
      ctx.lineTo(34, 36);
      ctx.bezierCurveTo(50, 36, 64, 16, 58, -20);
      break;
    case 'bun':
      bottom = 36;
      ctx.arc(0, -72, 19, 0, Math.PI * 2);
      ctx.moveTo(-58, -20);
      ctx.bezierCurveTo(-62, 16, -50, 32, -34, 32);
      ctx.lineTo(34, 32);
      ctx.bezierCurveTo(50, 32, 62, 16, 58, -20);
      break;
    case 'short':
      bottom = 28;
      ctx.moveTo(-58, -20);
      ctx.bezierCurveTo(-62, 12, -52, 26, -38, 26);
      ctx.lineTo(38, 26);
      ctx.bezierCurveTo(52, 26, 62, 12, 58, -20);
      break;
  }
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, -40, bottom, [mix(s.hair, s.hairShade, 0.45), mix(s.hair, s.hairShade, 0.2), s.hairTip]), 2.6);
}

// 前髪の下端（右 → 左）。ほぼ切りそろえた線に、とがった毛束をいくつか混ぜる
const BANG_EDGES: Record<BangStyle, number[][]> = {
  blunt: [[50, 8], [46, -3], [40, -6], [34, 1], [29, -7], [18, -8], [12, -1], [7, -9], [-4, -9], [-9, -1], [-14, -9], [-26, -8], [-31, 0], [-36, -7], [-44, -4], [-50, 8], [-58, 18]],
  swept: [[50, 8], [45, -8], [38, -14], [33, -6], [28, -15], [18, -17], [12, -9], [6, -19], [-4, -15], [-10, -5], [-16, -12], [-28, -6], [-33, 2], [-38, -3], [-46, -1], [-52, 10], [-58, 18]],
  split: [[50, 8], [45, -4], [38, -6], [32, 0], [27, -8], [16, -12], [10, -6], [4, -24], [-4, -24], [-10, -6], [-16, -12], [-27, -8], [-32, 0], [-38, -6], [-45, -4], [-50, 8], [-58, 18]],
  // 目の下まで届く、ぱっつんの重い前髪。毛束の切れ目だけ小さく上がる
  heavy: [[56, 12], [46, 7], [37, 8], [34, 1], [30, 7], [13, 7], [9, 0], [5, 7], [-13, 7], [-17, 0], [-21, 7], [-39, 7], [-48, 8], [-56, 12], [-60, 20]],
};

/** 前髪（頭のてっぺんから額まで） */
function bangsPath(s: ChibiSpec): Path2D {
  const p = new Path2D();
  const e = s.bangs === 'heavy' ? 20 : 18;
  p.moveTo(-58, e);
  p.bezierCurveTo(-68, -38, -38, -73, 0, -73);
  p.bezierCurveTo(38, -73, 68, -38, 58, e);
  let px = 58;
  let py = e;
  for (const [x, y] of BANG_EDGES[s.bangs]) {
    p.quadraticCurveTo((px + x) / 2, (py + y) / 2 + 1, x, y);
    px = x;
    py = y;
  }
  p.closePath();
  return p;
}

function frontHair(ctx: CanvasRenderingContext2D, s: ChibiSpec, body: boolean, g: FaceGeom): void {
  // 顔の横に垂れる髪
  const len = s.style === 'short' ? 22 : s.style === 'bob' ? 42 : s.style === 'long' || s.style === 'wavy' ? 60 : 46;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 52, -22);
    ctx.bezierCurveTo(side * 64, 4, side * 63, len * 0.6, side * 55, len);
    ctx.quadraticCurveTo(side * 51, len - 7, side * 46, len - 2);
    ctx.bezierCurveTo(side * 47, len * 0.6, side * 45, 10, side * 40, -10);
    ctx.closePath();
    fillStroke(ctx, vgrad(ctx, -20, len, [s.hair, s.hair, s.hairTip]), 2.4);
  }
  if (s.extra === 'elfin' && body) braid(ctx, s);
  // 垂れ耳は横の髪より手前・前髪より奥（付け根は前髪に隠れる）
  if (s.ears === 'dog') dogEars(ctx, s);
  cheekBulge(ctx, s, g);

  const bangs = bangsPath(s);
  ctx.fillStyle = vgrad(ctx, -73, 12, [s.hair, s.hair, mix(s.hair, s.hairShade, 0.55)]);
  ctx.fill(bangs);
  // 毛束の線
  ctx.save();
  ctx.clip(bangs);
  ctx.strokeStyle = s.hairShade;
  ctx.lineWidth = 1.8;
  const tip = s.bangs === 'heavy' ? 16 : 0;
  ctx.beginPath();
  ctx.moveTo(-14, -60);
  ctx.quadraticCurveTo(-20, -36, -16, -14 + tip);
  ctx.moveTo(16, -60);
  ctx.quadraticCurveTo(22, -38, 20, -14 + tip);
  ctx.moveTo(-40, -42);
  ctx.quadraticCurveTo(-44, -22, -38, -6 + tip);
  if (s.bangs === 'heavy') {
    ctx.moveTo(38, -40);
    ctx.quadraticCurveTo(42, -18, 40, 4);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2.6;
  ctx.stroke(bangs);

  // つや
  ctx.fillStyle = s.shine;
  if (!s.mob) {
    // 丸いクリーム色の水玉のつや
    for (const [x, y, r] of [[-40, -38, 6.5], [36, -46, 5.5], [-6, -62, 3.5]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(-26, -52, 9, 5, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-8, -62, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (s.extra === 'eshur') {
    // 黄土色のヘアピン
    ctx.save();
    ctx.translate(-30, -22);
    ctx.rotate(0.7);
    ctx.beginPath();
    ctx.roundRect(-2.5, -9, 5, 18, 2.5);
    fillStroke(ctx, '#d9a94e', 1.6);
    ctx.restore();
  }
}

/** エルフィンの片側の三つ編み */
function braid(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(-53, 8);
  ctx.quadraticCurveTo(-60, 50, -55, 90);
  ctx.stroke();
  ctx.strokeStyle = s.hair;
  ctx.lineWidth = 10.5;
  ctx.stroke();
  // 編み目（左右交互の斜線）
  ctx.strokeStyle = s.hairShade;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9.5;
    const y = 8 + 82 * t;
    const x = -53 * (1 - t) * (1 - t) + -60 * 2 * t * (1 - t) + -55 * t * t;
    const d = i % 2 ? 1 : -1;
    ctx.moveTo(x - 5 * d, y - 3);
    ctx.quadraticCurveTo(x, y - 1, x + 4 * d, y + 4);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-55, 92);
  ctx.quadraticCurveTo(-62, 100, -58, 108);
  ctx.quadraticCurveTo(-55, 102, -51, 106);
  ctx.quadraticCurveTo(-50, 98, -55, 92);
  fillStroke(ctx, s.hairTip, 2);
  dot(ctx, -55, 90, 3.6, '#ee8584', 1.6);
}

function elfEars(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 48, -4);
    ctx.quadraticCurveTo(side * 72, -12, side * 84, -26);
    ctx.quadraticCurveTo(side * 74, 6, side * 50, 18);
    ctx.closePath();
    fillStroke(ctx, s.skin, 2.4);
  }
}

function catEars(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 18, -66);
    ctx.lineTo(side * 42, -90);
    ctx.lineTo(side * 52, -48);
    ctx.closePath();
    fillStroke(ctx, s.hair, 2.4);
    ctx.fillStyle = '#f7c0c6';
    ctx.beginPath();
    ctx.moveTo(side * 27, -64);
    ctx.lineTo(side * 41, -80);
    ctx.lineTo(side * 46, -56);
    ctx.closePath();
    ctx.fill();
  }
}

/** 頭の横から垂れる大きな犬の耳（髪と同じ色）。カチューシャのリボンがあれば片耳にも付ける */
function dogEars(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 34, -54);
    ctx.bezierCurveTo(side * 72, -66, side * 92, -24, side * 88, 14);
    ctx.quadraticCurveTo(side * 85, 38, side * 70, 33);
    ctx.bezierCurveTo(side * 60, 22, side * 60, -8, side * 46, -38);
    ctx.closePath();
    fillStroke(ctx, sideShade(ctx, side * 44, side * 82, s.hair, s.hairShade, 0.7), 2.4);
    ctx.strokeStyle = mix(s.hairShade, LINE, 0.3);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(side * 64, -36);
    ctx.quadraticCurveTo(side * 78, -6, side * 75, 22);
    ctx.stroke();
    if (s.hat === 'bowband' && side === 1) bow(ctx, side * 72, -34, 0.4, 0.75, s.hatColor);
  }
}

/** 体の後ろから出るしっぽ。cat = 細長く立ち上がる / dog = ふさふさで大きい */
function tail(ctx: CanvasRenderingContext2D, t: NonNullable<ChibiSpec['tail']>): void {
  if (t.kind === 'cat') {
    tube(ctx, [16, 88, 92, 98, 80, 38], 10, t.color);
    tube(ctx, [83, 54, 80, 38], 10, t.tip);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(14, 92);
  ctx.bezierCurveTo(38, 116, 88, 112, 88, 80);
  ctx.bezierCurveTo(88, 62, 74, 56, 66, 64);
  ctx.bezierCurveTo(62, 84, 40, 88, 14, 84);
  ctx.closePath();
  fillStroke(ctx, vgrad(ctx, 60, 110, [t.tip, t.color]), 2.4);
  ctx.strokeStyle = mix(t.color, LINE, 0.35);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(48, 96);
  ctx.quadraticCurveTo(70, 94, 78, 76);
  ctx.stroke();
}

/** 頭のてっぺんのアホ毛 1 本 */
function ahoge(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  ctx.beginPath();
  ctx.moveTo(-4, -60);
  ctx.bezierCurveTo(-2, -78, 16, -88, 18, -76);
  ctx.bezierCurveTo(12, -82, 4, -76, 4, -60);
  ctx.closePath();
  fillStroke(ctx, s.hair, 2.2);
}

/** 左右の輪とまん中の結び目のリボン */
function bow(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, sc: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 18, -16, side * 22, 0);
    ctx.quadraticCurveTo(side * 18, 14, 0, 0);
    fillStroke(ctx, color, 2.2 / sc);
  }
  dot(ctx, 0, 0, 5, color, 2.2 / sc);
  ctx.restore();
}

// ------------------------------------------------------------------ hats

function hat(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  switch (s.hat) {
    case 'tiara':
      tiara(ctx);
      // 片側の髪の、ラベンダー色の結晶の髪飾り
      crystal(ctx, -57, -24, 4, 8, '#9594bb', -0.3);
      crystal(ctx, -61, -8, 3.5, 7, '#9594bb', -0.2);
      break;
    case 'beret':
      beret(ctx, s);
      break;
    case 'veil':
      veilFront(ctx, s);
      break;
    case 'ribbon':
      bow(ctx, -38, -52, -0.4, 1, s.hatColor);
      break;
    case 'bowband': {
      // 頭の上を回るカチューシャと、片側の大きなリボン
      const band = () => {
        ctx.beginPath();
        ctx.ellipse(0, -12, 57, 52, 0, Math.PI * 1.12, Math.PI * 1.88);
      };
      band();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 10;
      ctx.stroke();
      band();
      ctx.strokeStyle = s.hatColor;
      ctx.lineWidth = 6;
      ctx.stroke();
      bow(ctx, -26, -60, -0.35, 0.85, s.hatColor);
      break;
    }
    case 'leaf':
      for (const [lx, ly, a] of [[-32, -58, -0.9], [-12, -70, -0.3], [9, -71, 0.3], [29, -60, 0.9]]) {
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -6, 6, 11, 0, 0, Math.PI * 2);
        fillStroke(ctx, s.hatColor, 2.2);
        ctx.restore();
      }
      break;
    case 'maid': {
      // フリルのカチューシャ
      const frill = (a: number) => {
        ctx.save();
        ctx.translate(Math.cos(a) * 57, -30 + Math.sin(a) * 42);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.roundRect(-5, -12, 10, 10, 2.5);
        fillStroke(ctx, '#ffffff', 1.8);
        ctx.restore();
      };
      for (let i = 0; i <= 6; i++) frill(Math.PI * (1.13 + (0.74 * i) / 6));
      ctx.beginPath();
      ctx.ellipse(0, -30, 57, 42, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = s.hatColor;
      ctx.lineWidth = 5.6;
      ctx.stroke();
      break;
    }
    case null:
      break;
  }
}

/** エルフィンの角ばったティアラ（斜めにかぶる） */
function tiara(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.translate(-8, -66);
  ctx.rotate(-0.24);
  ctx.beginPath();
  ctx.moveTo(-30, 10);
  ctx.lineTo(-35, -7);
  ctx.lineTo(-16, 0);
  ctx.lineTo(0, -22);
  ctx.lineTo(16, 0);
  ctx.lineTo(35, -7);
  ctx.lineTo(30, 10);
  ctx.quadraticCurveTo(0, 4, -30, 10);
  ctx.closePath();
  fillStroke(ctx, GOLD, 2.2);
  ctx.fillStyle = GOLD_SHADE;
  ctx.beginPath();
  ctx.moveTo(-30, 10);
  ctx.quadraticCurveTo(0, 4, 30, 10);
  ctx.lineTo(29, 5);
  ctx.quadraticCurveTo(0, -1, -29, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-28, -2);
  ctx.lineTo(-20, 1);
  ctx.moveTo(-4, -14);
  ctx.lineTo(-8, -6);
  ctx.stroke();
  crystal(ctx, 0, -4, 6, 10, '#c6dae4');
  crystal(ctx, -22, 3, 3.5, 5, '#c6dae4');
  crystal(ctx, 22, 3, 3.5, 5, '#c6dae4');
  ctx.restore();
}

/** エシュールの灰青のベレー帽と、オレンジの謎の生き物のバッジ */
function beret(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  // 右に垂れるリボン
  ctx.beginPath();
  ctx.moveTo(36, -54);
  ctx.quadraticCurveTo(46, -40, 43, -22);
  ctx.lineTo(51, -22);
  ctx.quadraticCurveTo(54, -40, 44, -56);
  ctx.closePath();
  fillStroke(ctx, '#8f9bc0', 2);
  ctx.beginPath();
  ctx.moveTo(42, -24);
  ctx.lineTo(47, -14);
  ctx.lineTo(52, -24);
  ctx.lineTo(52, -18);
  ctx.lineTo(47, -9);
  ctx.lineTo(42, -18);
  ctx.closePath();
  fillStroke(ctx, '#fedd79', 1.6);

  ctx.save();
  ctx.translate(-4, -66);
  ctx.rotate(-0.12);
  ctx.beginPath();
  ctx.ellipse(0, 0, 56, 21, 0, 0, Math.PI * 2);
  fillStroke(ctx, vgrad(ctx, -21, 21, [mix(s.hatColor, '#ffffff', 0.22), s.hatColor, mix(s.hatColor, LINE, 0.1)]), 2.4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.ellipse(-16, -8, 22, 6, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-3, -27, 6, 9, 3);
  fillStroke(ctx, s.hatColor, 2);
  ctx.restore();

  critter(ctx, 38, -60, 1);
}

/** オレンジの謎の生き物（うさぎっぽい顔） */
function critter(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, sc);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 5.5, -10, 3.6, 7, side * 0.3, 0, Math.PI * 2);
    fillStroke(ctx, '#fdb155', 1.8);
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 10.5, 9, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#fdb155', 1.8);
  ctx.fillStyle = LINE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 4, -1, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-3, 3);
  ctx.quadraticCurveTo(-1.5, 5, 0, 3);
  ctx.quadraticCurveTo(1.5, 5, 3, 3);
  ctx.stroke();
  ctx.restore();
}

/** ネルのヴェールの前側（頭を覆う暗い布と、額の白い帯） */
function veilFront(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  ctx.beginPath();
  ctx.moveTo(-64, -10);
  ctx.bezierCurveTo(-70, -62, -38, -86, 0, -86);
  ctx.bezierCurveTo(38, -86, 70, -62, 64, -10);
  ctx.bezierCurveTo(58, -38, 34, -54, 0, -54);
  ctx.bezierCurveTo(-34, -54, -58, -38, -64, -10);
  ctx.closePath();
  const speaki = s.extra === 'speaki';
  fillStroke(ctx, vgrad(ctx, -86, -10, [speaki ? '#625869' : '#7d7893', s.hatColor]), 2.6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.ellipse(-24, -72, 16, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  if (speaki) {
    // 帯の内側の白いレース
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const u = i / 8;
        const x = side * cubic(61, 55, 32, 0, u);
        const y = cubic(-18, -42, -57, -57, u);
        const l = Math.hypot(x, y - 10);
        dot(ctx, x - (x / l) * 4.5, y - ((y - 10) / l) * 4.5, 2.8, WHITE, 1.4);
      }
    }
    dot(ctx, 0, -52.5, 2.8, WHITE, 1.4);
  }
  const band = () => {
    ctx.beginPath();
    ctx.moveTo(-61, -18);
    ctx.bezierCurveTo(-55, -42, -32, -57, 0, -57);
    ctx.bezierCurveTo(32, -57, 55, -42, 61, -18);
  };
  band();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 10;
  ctx.stroke();
  band();
  ctx.strokeStyle = speaki ? GOLD : '#ffffff';
  ctx.lineWidth = 6;
  ctx.stroke();
  if (speaki) {
    // てっぺんの金の十字
    ctx.beginPath();
    ctx.roundRect(-2.4, -80, 4.8, 15, 1.5);
    ctx.roundRect(-6.5, -76, 13, 4.4, 1.5);
    fillStroke(ctx, GOLD, 1.6);
  }
}

/** 3 次ベジェの 1 成分 */
function cubic(a: number, b: number, c: number, d: number, t: number): number {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
}

// ------------------------------------------------------------------ body

function drawBody(ctx: CanvasRenderingContext2D, s: ChibiSpec, pose: ChibiPose): void {
  if (s.mob) {
    mobLegs(ctx, s);
    mobBody(ctx, s);
    return;
  }
  legs(ctx, s);
  switch (s.extra) {
    case 'elfin':
      elfinBody(ctx, s, pose);
      break;
    case 'nell':
      nellBody(ctx, s, pose);
      break;
    case 'eshur':
      eshurBody(ctx, s, pose);
      break;
    case 'komi':
      komiBody(ctx, s);
      break;
    case 'butter':
      butterBody(ctx, s);
      break;
    case 'speaki':
      speakiBody(ctx, s, pose);
      break;
    default:
      villagerBody(ctx, s);
  }
}

function legs(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * 10 - 6.5, 92, 13, 20, 4);
    fillStroke(ctx, s.legs, 2.2);
    ctx.beginPath();
    ctx.roundRect(side * 10 - 8, 108, 16, 9, 4.5);
    fillStroke(ctx, s.shoes, 2.2);
  }
}

/** モブのむちっとした脚。ひざにほんのり赤み */
function mobLegs(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * 11 - 8.5, 90, 17, 22, 6);
    fillStroke(ctx, s.legs, 2.2);
    const g = ctx.createRadialGradient(side * 11, 103, 0.5, side * 11, 103, 6);
    g.addColorStop(0, 'rgba(242, 130, 136, 0.8)');
    g.addColorStop(1, 'rgba(246, 160, 162, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(side * 11, 103, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(side * 11 - 9.5, 108, 19, 9.5, 4.8);
    fillStroke(ctx, s.shoes, 2.2);
  }
}

function mobBody(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  torsoPath(ctx, 40);
  fillStroke(ctx, sideShade(ctx, -40, 40, s.outfit, s.outfitShade));
  if (s.apron) {
    // 縫い目の点線が入ったエプロン
    ctx.beginPath();
    ctx.roundRect(-21, 64, 42, 31, [3, 3, 9, 9]);
    fillStroke(ctx, s.apron, 2);
    ctx.save();
    ctx.setLineDash([3, 2.6]);
    ctx.strokeStyle = mix(s.apron, LINE, 0.45);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-17, 67, 34, 24, [2, 2, 6, 6]);
    ctx.stroke();
    ctx.restore();
  }
  // 丸い襟
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.quadraticCurveTo(side * 20, 40, side * 20, 51);
    ctx.quadraticCurveTo(side * 11, 57, 0, 50);
    ctx.closePath();
    fillStroke(ctx, s.collar, 2);
  }
  // ふくらんだ袖から、胸の前で組んだ手へ
  for (const side of [-1, 1]) {
    tube(ctx, [side * 22, 52, side * 19, 62, side * 6, 64], 10, s.outfit);
    ctx.beginPath();
    ctx.ellipse(side * 21, 50, 9, 8.5, side * 0.3, 0, Math.PI * 2);
    fillStroke(ctx, s.outfit, 2.2);
  }
  const hand = mix(s.skin, '#f3a0a4', 0.28);
  dot(ctx, 3.5, 64, 6, hand, 2.2);
  dot(ctx, -3.5, 63, 6, hand, 2.2);
}

/** 胴とスカートの形（肩 y=42、裾 y=98） */
function torsoPath(ctx: CanvasRenderingContext2D, flare = 36): void {
  ctx.beginPath();
  ctx.moveTo(-19, 42);
  ctx.quadraticCurveTo(-26, 58, -25, 74);
  ctx.quadraticCurveTo(-flare + 2, 88, -flare, 98);
  ctx.lineTo(flare, 98);
  ctx.quadraticCurveTo(flare - 2, 88, 25, 74);
  ctx.quadraticCurveTo(26, 58, 19, 42);
  ctx.closePath();
}

function arm(ctx: CanvasRenderingContext2D, s: ChibiSpec, side: number, hx: number, hy: number, sleeve: string, cuff?: string): void {
  tube(ctx, [side * 20, 50, side * 30, 60, hx, hy], 12, sleeve);
  if (cuff) {
    const dx = hx - side * 30;
    const dy = hy - 60;
    const l = Math.hypot(dx, dy) || 1;
    tube(ctx, [hx - (dx / l) * 5, hy - (dy / l) * 5, hx - (dx / l) * 1.5, hy - (dy / l) * 1.5], 13, cuff);
  }
  dot(ctx, hx, hy + 3, 6.5, s.skin, 2.2);
}

function villagerBody(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  torsoPath(ctx);
  fillStroke(ctx, sideShade(ctx, -36, 36, s.outfit, s.outfitShade));
  for (const side of [-1, 1]) arm(ctx, s, side, side * 31, 76, s.outfit);
  // 丸い襟
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.quadraticCurveTo(side * 22, 40, side * 22, 52);
    ctx.quadraticCurveTo(side * 12, 59, 0, 51);
    ctx.closePath();
    fillStroke(ctx, s.collar, 2);
  }
  dot(ctx, 0, 58, 2.6, s.outfitShade, 1.6);
}

/** 短パン（腰 y=80、裾 y=97） */
function shorts(ctx: CanvasRenderingContext2D, color: string, shade: string): void {
  ctx.beginPath();
  ctx.roundRect(-24, 80, 48, 17, [2, 2, 6, 6]);
  fillStroke(ctx, sideShade(ctx, -24, 24, color, shade));
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 87);
  ctx.lineTo(0, 97);
  ctx.stroke();
}

/** ゆったりした上着の形（肩 y=42、裾 y=86） */
function loosePath(ctx: CanvasRenderingContext2D, hem: number): void {
  ctx.beginPath();
  ctx.moveTo(-21, 42);
  ctx.quadraticCurveTo(-hem, 60, -hem, 85);
  ctx.quadraticCurveTo(0, 91, hem, 85);
  ctx.quadraticCurveTo(hem, 60, 21, 42);
  ctx.closePath();
}

/** コミー: 片方の肩がずり落ちたぶかぶかの白いシャツ（襟と袖口にピンクの線）と、ピンクの短パン */
function komiBody(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  shorts(ctx, '#febcbd', '#e59aa2');
  loosePath(ctx, 31);
  fillStroke(ctx, sideShade(ctx, -31, 31, s.outfit, s.outfitShade));
  ctx.fillStyle = s.skin;
  ctx.beginPath();
  ctx.ellipse(-15, 47, 11, 5.5, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = s.collar;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-27, 53);
  ctx.quadraticCurveTo(-6, 57, 18, 45);
  ctx.stroke();
  for (const side of [-1, 1]) arm(ctx, s, side, side * 30, 78, s.outfit, s.collar);
}

/** バター: 白いブラウスに胸ポケットの黄色いベスト、金の鈴の首輪、斜め掛けの犬の顔のポーチ、薄ピンクの短パン */
function butterBody(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  shorts(ctx, '#fed4d3', '#eab3b6');
  loosePath(ctx, 27);
  fillStroke(ctx, sideShade(ctx, -27, 27, s.outfit, s.outfitShade));
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 7, 52);
    ctx.lineTo(side * 19, 44);
    ctx.quadraticCurveTo(side * 26, 62, side * 27, 84);
    ctx.quadraticCurveTo(side * 16, 88, side * 5, 87);
    ctx.quadraticCurveTo(side * 3, 68, side * 7, 52);
    ctx.closePath();
    fillStroke(ctx, sideShade(ctx, -27, 27, '#fed588', '#dda46e', 0.7), 2.2);
  }
  ctx.beginPath();
  ctx.roundRect(10, 64, 11, 9, 2);
  fillStroke(ctx, '#fbc96e', 1.6);
  for (const side of [-1, 1]) arm(ctx, s, side, side * 31, 76, s.outfit, s.outfitShade);
  // 首輪と鈴
  ctx.beginPath();
  ctx.roundRect(-14, 42, 28, 5.5, 2.5);
  fillStroke(ctx, '#3b3135', 1.6);
  dot(ctx, 0, 51, 4.2, '#fdd36b', 1.6);
  ctx.beginPath();
  ctx.moveTo(-2, 52.5);
  ctx.lineTo(2, 52.5);
  ctx.stroke();
  // 斜め掛けのひもと、犬の顔のポーチ
  tube(ctx, [17, 45, -19, 79], 3, '#9e807e');
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-24 + side * 8, 80, 4, 6.5, side * 0.5, 0, Math.PI * 2);
    fillStroke(ctx, '#7f6461', 1.6);
  }
  dot(ctx, -24, 85, 8.5, '#b39390', 2);
  ctx.fillStyle = LINE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(-24 + side * 3.5, 84, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(-24, 87.5, 1.8, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function elfinBody(ctx: CanvasRenderingContext2D, s: ChibiSpec, pose: ChibiPose): void {
  // 白いガーターとニーハイのレース
  ctx.strokeStyle = '#3d2a2c';
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 10, 94);
    ctx.lineTo(side * 10, 99);
    ctx.stroke();
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.roundRect(side * 10 - 7, 98, 14, 4, 2);
    ctx.fill();
    ctx.stroke();
  }
  torsoPath(ctx);
  fillStroke(ctx, sideShade(ctx, -36, 36, s.outfit, s.outfitShade));
  // スカートの裾（金とコーラルの縁）
  ctx.strokeStyle = '#dd857b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-34, 95);
  ctx.lineTo(34, 95);
  ctx.stroke();
  // 前の金のライン
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-7, 62);
  ctx.lineTo(-9, 96);
  ctx.moveTo(7, 62);
  ctx.lineTo(9, 96);
  ctx.stroke();
  // 腰のベルト
  ctx.beginPath();
  ctx.moveTo(-25, 72);
  ctx.quadraticCurveTo(0, 76, 25, 72);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 5.5;
  ctx.stroke();
  ctx.strokeStyle = '#6b3436';
  ctx.lineWidth = 3.2;
  ctx.stroke();
  crystal(ctx, 0, 86, 4.5, 6, '#c6dae4');

  const hold = pose.prop;
  arm(ctx, s, -1, -31, 76, WHITE, GOLD);
  arm(ctx, s, 1, hold ? 44 : 31, hold ? 66 : 76, WHITE, GOLD);

  // 赤いケープカラー
  ctx.beginPath();
  ctx.moveTo(-22, 43);
  ctx.quadraticCurveTo(-34, 50, -32, 61);
  ctx.quadraticCurveTo(0, 69, 32, 61);
  ctx.quadraticCurveTo(34, 50, 22, 43);
  ctx.closePath();
  fillStroke(ctx, sideShade(ctx, -34, 34, '#ee8584', '#d86f73', 0.66));
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-30, 60);
  ctx.quadraticCurveTo(0, 67.5, 30, 60);
  ctx.stroke();
  crystal(ctx, 0, 54, 6.5, 7.5, GOLD);
  crystal(ctx, 0, 54, 3.4, 4.5, '#c6dae4');
}

function nellBody(ctx: CanvasRenderingContext2D, s: ChibiSpec, pose: ChibiPose): void {
  torsoPath(ctx, 34);
  fillStroke(ctx, sideShade(ctx, -34, 34, s.outfit, s.outfitShade));
  // 裾の白いフリル
  for (let x = -30; x <= 30; x += 7.5) dot(ctx, x, 98, 3.8, WHITE, 1.6);
  // 白い前掛けと金のひし形
  ctx.beginPath();
  ctx.moveTo(-11, 66);
  ctx.lineTo(11, 66);
  ctx.lineTo(13, 92);
  ctx.lineTo(0, 96);
  ctx.lineTo(-13, 92);
  ctx.closePath();
  fillStroke(ctx, WHITE, 2);
  ctx.strokeStyle = '#d69d57';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-12, 90);
  ctx.lineTo(0, 94);
  ctx.lineTo(12, 90);
  ctx.stroke();
  crystal(ctx, 0, 85, 3.6, 4.6, '#d69d57');
  // 腰のポーチ
  ctx.beginPath();
  ctx.roundRect(15, 66, 12, 12, 3);
  fillStroke(ctx, '#8a5e4c', 2);

  // 手は体の前で組む（斧を持つ時は左手で柄を握る）
  if (pose.prop) {
    arm(ctx, s, -1, -30, 80, s.outfit, WHITE);
    arm(ctx, s, 1, 6, 70, s.outfit, WHITE);
  } else {
    arm(ctx, s, -1, -4, 70, s.outfit, WHITE);
    arm(ctx, s, 1, 4, 71, s.outfit, WHITE);
  }

  // 白い小ケープと金の十字
  ctx.beginPath();
  ctx.moveTo(-22, 43);
  ctx.quadraticCurveTo(-36, 52, -33, 63);
  ctx.quadraticCurveTo(0, 71, 33, 63);
  ctx.quadraticCurveTo(36, 52, 22, 43);
  ctx.closePath();
  fillStroke(ctx, sideShade(ctx, -34, 34, WHITE, '#e2d4dd', 0.66));
  ctx.beginPath();
  ctx.roundRect(-2.6, 46, 5.2, 18, 1.5);
  ctx.roundRect(-8, 51, 16, 4.6, 1.5);
  fillStroke(ctx, '#cc9359', 1.6);
}

/** スピッキー: ネルをまねたシスター服。黒いブラウスに白い襟とオレンジの蝶ネクタイ、前が短い黒とオレンジのスカート、腰にドクロの仮面 */
function speakiBody(ctx: CanvasRenderingContext2D, s: ChibiSpec, pose: ChibiPose): void {
  // 後ろが長いオレンジのスカート
  torsoPath(ctx, 38);
  fillStroke(ctx, sideShade(ctx, -38, 38, PUMPKIN, PUMPKIN_SHADE));
  // 前が短い黒い上着
  ctx.beginPath();
  ctx.moveTo(-19, 42);
  ctx.quadraticCurveTo(-26, 58, -25, 74);
  ctx.quadraticCurveTo(-33, 84, -35, 94);
  ctx.quadraticCurveTo(0, 78, 35, 94);
  ctx.quadraticCurveTo(33, 84, 25, 74);
  ctx.quadraticCurveTo(26, 58, 19, 42);
  ctx.closePath();
  fillStroke(ctx, sideShade(ctx, -35, 35, s.outfit, s.outfitShade));
  // 裾の金の線と白いレース
  const hem = (t: number, dy: number): [number, number] => {
    const m = 1 - t;
    return [m * m * -35 + t * t * 35, m * m * 94 + 2 * m * t * 78 + t * t * 94 + dy];
  };
  for (let i = 0; i <= 10; i++) {
    const [x, y] = hem(i / 10, 2.5);
    dot(ctx, x, y, 3, WHITE, 1.4);
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const [x, y] = hem(0.05 + i * 0.09, -4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  bow(ctx, -31, 94, 0.4, 0.42, PUMPKIN);
  bow(ctx, 31, 94, -0.4, 0.42, PUMPKIN);
  skull(ctx, 22, 76);

  // 手は胸の前でもじもじ（バケツを持つ時は右手で提げる）
  if (pose.prop) {
    arm(ctx, s, -1, -5, 70, s.outfit, WHITE);
    arm(ctx, s, 1, 34, 80, s.outfit, WHITE);
  } else {
    arm(ctx, s, -1, -4, 68, s.outfit, WHITE);
    arm(ctx, s, 1, 4, 69, s.outfit, WHITE);
  }

  // 白い襟とオレンジの蝶ネクタイ
  ctx.beginPath();
  ctx.moveTo(-20, 43);
  ctx.quadraticCurveTo(-31, 50, -25, 59);
  ctx.quadraticCurveTo(-10, 61, 0, 51);
  ctx.quadraticCurveTo(10, 61, 25, 59);
  ctx.quadraticCurveTo(31, 50, 20, 43);
  ctx.closePath();
  fillStroke(ctx, sideShade(ctx, -31, 31, WHITE, '#e2d4dd', 0.66));
  bow(ctx, 0, 51, 0, 0.5, PUMPKIN);
}

/** 幽霊のしるしのドクロの仮面 */
function skull(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.roundRect(x - 4.5, y + 2, 9, 6.5, 2.5);
  fillStroke(ctx, WHITE, 1.8);
  ctx.beginPath();
  ctx.ellipse(x, y, 7.5, 6.5, 0, 0, Math.PI * 2);
  fillStroke(ctx, WHITE, 1.8);
  ctx.fillStyle = LINE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 2.8, y + 0.5, 2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function eshurBody(ctx: CanvasRenderingContext2D, s: ChibiSpec, pose: ChibiPose): void {
  // くすんだローズのプリーツスカート
  ctx.beginPath();
  ctx.moveTo(-26, 76);
  ctx.lineTo(-36, 98);
  ctx.lineTo(36, 98);
  ctx.lineTo(26, 76);
  ctx.closePath();
  fillStroke(ctx, sideShade(ctx, -36, 36, '#b97378', '#a5646a'));
  ctx.strokeStyle = '#8f5258';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const x of [-18, -6, 6, 18]) {
    ctx.moveTo(x * 0.75, 78);
    ctx.lineTo(x, 97);
  }
  ctx.stroke();
  // クリーム色のセーター
  ctx.beginPath();
  ctx.moveTo(-19, 42);
  ctx.quadraticCurveTo(-27, 58, -27, 80);
  ctx.lineTo(27, 80);
  ctx.quadraticCurveTo(27, 58, 19, 42);
  ctx.closePath();
  fillStroke(ctx, sideShade(ctx, -27, 27, s.outfit, s.outfitShade));
  ctx.strokeStyle = s.outfitShade;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-25, 76);
  ctx.lineTo(25, 76);
  ctx.stroke();
  // V ネックから見える白シャツとネクタイ
  ctx.beginPath();
  ctx.moveTo(-12, 43);
  ctx.lineTo(0, 62);
  ctx.lineTo(12, 43);
  ctx.closePath();
  fillStroke(ctx, WHITE, 2);
  ctx.beginPath();
  ctx.moveTo(-2.5, 48);
  ctx.lineTo(2.5, 48);
  ctx.lineTo(3.5, 60);
  ctx.lineTo(0, 64);
  ctx.lineTo(-3.5, 60);
  ctx.closePath();
  fillStroke(ctx, '#908fa2', 1.6);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 46);
    ctx.lineTo(side * 12, 42);
    ctx.lineTo(side * 9, 50);
    ctx.closePath();
    fillStroke(ctx, WHITE, 1.8);
  }
  // 斜めがけのポーチの紐
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(17, 46);
  ctx.lineTo(-20, 82);
  ctx.stroke();
  ctx.strokeStyle = '#977473';
  ctx.lineWidth = 3.4;
  ctx.stroke();

  const hold = pose.prop;
  arm(ctx, s, -1, -31, 76, s.outfit, s.outfitShade);
  arm(ctx, s, 1, hold ? 40 : 31, hold ? 64 : 76, s.outfit, s.outfitShade);

  // ポーチ
  ctx.beginPath();
  ctx.roundRect(-30, 78, 17, 13, 3);
  fillStroke(ctx, '#977473', 2);
  dot(ctx, -21.5, 84.5, 2.6, '#d9534f', 1.2);
  // 胸の謎の生き物のブローチと青いリボン
  ctx.fillStyle = '#8fa6d6';
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-14, 64);
  ctx.lineTo(-18, 76);
  ctx.lineTo(-14, 73);
  ctx.lineTo(-11, 76);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  critter(ctx, -14, 62, 0.55);
}

// ------------------------------------------------------------------ props

function prop(ctx: CanvasRenderingContext2D, s: ChibiSpec): void {
  switch (s.extra) {
    case 'elfin': {
      // 金の輪に結晶をはめた王笏
      tube(ctx, [48, 116, 56, -34], 4.5, WHITE);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const t0 = i / 6 + 0.04;
        const t1 = t0 + 0.06;
        ctx.moveTo(48 + 8 * t0, 116 - 150 * t0);
        ctx.lineTo(48 + 8 * t1, 116 - 150 * t1);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(57, -50, 15, 0, Math.PI * 2);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 5;
      ctx.stroke();
      crystal(ctx, 57, -50, 6, 10, '#ae95bc');
      crystal(ctx, 51, -46, 3.4, 6, '#c6dae4', -0.4);
      crystal(ctx, 63, -46, 3.4, 6, '#c6dae4', 0.4);
      break;
    }
    case 'nell': {
      // 斧（車輪模様の金の刃と三日月の刃）
      tube(ctx, [-30, 74, -62, 110], 4.5, '#c8c4c5');
      ctx.beginPath();
      ctx.moveTo(-66, 92);
      ctx.quadraticCurveTo(-88, 100, -82, 118);
      ctx.quadraticCurveTo(-74, 106, -60, 106);
      ctx.closePath();
      fillStroke(ctx, '#d9dadf', 2.2);
      dot(ctx, -58, 104, 9, '#e6b15b', 2.2);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 4;
        ctx.moveTo(-58 + Math.cos(a) * 7, 104 + Math.sin(a) * 7);
        ctx.lineTo(-58 - Math.cos(a) * 7, 104 - Math.sin(a) * 7);
      }
      ctx.stroke();
      break;
    }
    case 'eshur':
      // 指示棒
      tube(ctx, [42, 68, 80, 30], 3.2, '#6d5f66');
      dot(ctx, 80, 30, 3, WHITE, 1.6);
      break;
    case 'speaki': {
      // お菓子でいっぱいのかぼちゃのバケツ
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(40, 96, 13, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      for (const [x, y, c] of [[31, 90, '#f2a7b6'], [40, 87, '#a9d8ef'], [48, 90, '#f8dc7a'], [36, 92, '#bfe3a8'], [45, 93, '#f2a7b6']] as const) dot(ctx, x, y, 4, c, 1.6);
      ctx.beginPath();
      ctx.ellipse(40, 103, 16, 12.5, 0, 0, Math.PI * 2);
      fillStroke(ctx, vgrad(ctx, 90, 116, [PUMPKIN, PUMPKIN_SHADE]), 2.2);
      ctx.strokeStyle = '#c96a32';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(40, 103, 7, 12, 0, -Math.PI / 2, Math.PI / 2, true);
      ctx.moveTo(40, 91);
      ctx.ellipse(40, 103, 7, 12, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // ジャック・オー・ランタンの顔
      ctx.fillStyle = LINE;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(40 + side * 3, 101);
        ctx.lineTo(40 + side * 9, 101);
        ctx.lineTo(40 + side * 6, 96);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(32, 106);
      ctx.lineTo(48, 106);
      ctx.lineTo(45, 111);
      ctx.lineTo(42.5, 108.5);
      ctx.lineTo(40, 111);
      ctx.lineTo(37.5, 108.5);
      ctx.lineTo(35, 111);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ------------------------------------------------------------------ face

/** 横に広いもち顔の輪郭 */
function facePath(w: number, b: number): Path2D {
  const p = new Path2D();
  p.moveTo(-44, -38);
  p.bezierCurveTo(-52, -24, -w, 2, -(w - 1), 22);
  p.bezierCurveTo(-(w - 2), 40, -34, b, 0, b);
  p.bezierCurveTo(34, b, w - 2, 40, w - 1, 22);
  p.bezierCurveTo(w, 2, 52, -24, 44, -38);
  p.quadraticCurveTo(0, -58, -44, -38);
  p.closePath();
  return p;
}

interface FaceGeom {
  path: Path2D;
  turn: -1 | 1;
  /** 向いた側の、輪郭の外へ張り出したほっぺ */
  bulge: { x: number; y: number; rx: number; ry: number };
  /** 頬紅 [向いた側, 反対側] */
  blush: { x: number; y: number; sc: number }[];
}

function faceGeom(s: ChibiSpec, pose: ChibiPose): FaceGeom {
  const puffed = pose.expr === 'angry' || pose.expr === 'sulk';
  const wob = pose.wobble ?? 0;
  const w = (puffed ? 57 : 54) + wob * 4;
  const b = (puffed ? 48 : 46) + Math.abs(wob) * 2;
  const turn = pose.turn ?? 1;
  const sc = puffed ? 1.12 : 1;
  // モブは目が無いぶん、頬を前髪のすぐ下まで上げる
  const by = s.mob ? -8 : 0;
  const bulge = { x: turn * (45 + wob * 3 + (puffed ? 2 : 0)), y: 28 + Math.abs(wob), rx: 22 + (puffed ? 2 : 0), ry: 17 + Math.abs(wob) * 2 };
  return {
    path: facePath(w, b),
    turn,
    bulge,
    blush: [
      { x: bulge.x - turn * 3, y: bulge.y - 1 + by, sc: sc * 1.06 },
      { x: -turn * (CHEEK.x - 2 + wob * 3), y: CHEEK.y + by, sc },
    ],
  };
}

function face(ctx: CanvasRenderingContext2D, s: ChibiSpec, g: FaceGeom): void {
  // 外側だけ線が見えるよう、太く引いてから塗る
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 5.2;
  ctx.stroke(g.path);
  ctx.fillStyle = s.skin;
  ctx.fill(g.path);

  // 前髪の落とす影
  ctx.save();
  ctx.clip(g.path);
  ctx.translate(0, 5);
  ctx.fillStyle = 'rgba(226, 150, 150, 0.32)';
  ctx.fill(bangsPath(s));
  ctx.restore();

  for (const b of g.blush) cheekBlush(ctx, s, b.x, b.y, b.sc);
}

/**
 * 向いた側のほっぺを輪郭の外へ丸く張り出させる（原作の「もちほっぺ」）。
 * 横の髪より手前・前髪より奥に、顔の輪郭の外にはみ出した分だけを描く。
 */
function cheekBulge(ctx: CanvasRenderingContext2D, s: ChibiSpec, g: FaceGeom): void {
  const c = g.bulge;
  ctx.save();
  const outside = new Path2D();
  outside.rect(-300, -300, 600, 600);
  outside.addPath(g.path);
  ctx.clip(outside, 'evenodd');
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = s.skin;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  const b = g.blush[0];
  cheekBlush(ctx, s, b.x, b.y, b.sc);
  ctx.restore();
}

function cheekBlush(ctx: CanvasRenderingContext2D, s: ChibiSpec, x: number, y: number, sc: number): void {
  if (s.mob) mobBlush(ctx, x, y, sc);
  else blush(ctx, x, y, sc);
}

/** モブの頬: にじんだ大きな丸と白いつや */
function mobBlush(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number): void {
  const g = ctx.createRadialGradient(x, y, 1, x, y, 15 * sc);
  g.addColorStop(0, 'rgba(242, 120, 128, 0.9)');
  g.addColorStop(0.62, 'rgba(246, 146, 150, 0.72)');
  g.addColorStop(1, 'rgba(250, 172, 172, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, 15 * sc, 13 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.ellipse(x - 3.5 * sc, y - 4.5 * sc, 2.8 * sc, 2.2 * sc, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

/** 原作の SD の頬: 大きな平たいピンクの丸 */
function blush(ctx: CanvasRenderingContext2D, x: number, y: number, sc: number): void {
  ctx.fillStyle = BLUSH;
  ctx.beginPath();
  ctx.ellipse(x, y, 14 * sc, 12.5 * sc, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 原作の SD の目: 縦長の焦げ茶の楕円と、目尻の上のまつ毛 1 本。半目や怒り目はまぶたの線で上を切る */
function eyes(ctx: CanvasRenderingContext2D, s: ChibiSpec, pose: ChibiPose): void {
  if (s.mob) return;
  const e = pose.expr;
  for (const side of [-1, 1]) {
    const x = side * 22;
    const y = 12;
    const iris = s.eye ? vgrad(ctx, y - 9, y + 9, [EYE, EYE, s.eye]) : EYE;
    ctx.strokeStyle = EYE;
    ctx.fillStyle = iris;
    ctx.lineWidth = 3;

    if (e === 'munch') {
      ctx.beginPath();
      ctx.moveTo(x + side * 5, y - 7);
      ctx.lineTo(x - side * 4, y);
      ctx.lineTo(x + side * 5, y + 7);
      ctx.stroke();
      continue;
    }
    if (e === 'dizzy') {
      ctx.lineWidth = 2.4;
      spiral(ctx, x, y, 8);
      continue;
    }
    if (e === 'sleep' || (pose.blink && e !== 'surprised')) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 2);
      ctx.quadraticCurveTo(x, y + 6.5, x + 6, y + 2);
      ctx.stroke();
      continue;
    }
    if (e === 'surprised') {
      ctx.beginPath();
      ctx.ellipse(x, y, 7.5, 9, 0, 0, Math.PI * 2);
      fillStroke(ctx, WHITE, 2.4, EYE);
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 3, 3.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = iris;
      ctx.fill();
      continue;
    }

    // まぶたの線 [目頭の y, 目尻の y]
    let lid: [number, number] | null = null;
    if (s.halfLid || e === 'sulk' || e === 'stern') lid = [y - 1.5, y - 1.5];
    if (e === 'angry') lid = [y - 0.5, y - 7];
    ctx.save();
    if (lid) {
      ctx.beginPath();
      ctx.moveTo(x - side * 9, lid[0]);
      ctx.lineTo(x + side * 9, lid[1]);
      ctx.lineTo(x + side * 9, y + 14);
      ctx.lineTo(x - side * 9, y + 14);
      ctx.closePath();
      ctx.clip();
    }
    ctx.beginPath();
    ctx.ellipse(x, y, 5.4, e === 'happy' ? 9.6 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 2.6;
    ctx.beginPath();
    if (lid) {
      ctx.moveTo(x - side * 7.5, lid[0]);
      ctx.lineTo(x + side * 7.5, lid[1]);
      ctx.lineTo(x + side * 10.5, lid[1] - 3);
    } else {
      ctx.moveTo(x + side * 4.2, y - 8);
      ctx.lineTo(x + side * 8.5, y - 10.5);
    }
    ctx.stroke();
  }
}

function brows(ctx: CanvasRenderingContext2D, s: ChibiSpec, e: Expr): void {
  if (s.mob) return;
  const mood = e === 'angry' || e === 'worried' || e === 'sulk';
  if (!mood) return;
  ctx.strokeStyle = s.brows ?? mix(s.hairShade, LINE, 0.5);
  ctx.lineWidth = 3.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (e === 'angry') {
      ctx.moveTo(side * 9, -4);
      ctx.lineTo(side * 27, -12);
    } else if (e === 'worried') {
      ctx.moveTo(side * 9, -12);
      ctx.lineTo(side * 27, -6);
    } else if (e === 'sulk') {
      ctx.moveTo(side * 10, -7);
      ctx.lineTo(side * 26, -10);
    } else {
      ctx.moveTo(side * 12, -9);
      ctx.quadraticCurveTo(side * 20, -14, side * 30, -11);
    }
    ctx.stroke();
  }
}

function mouth(ctx: CanvasRenderingContext2D, s: ChibiSpec, pose: ChibiPose): void {
  if (s.mob) {
    mobMouth(ctx, s, pose.expr);
    return;
  }
  const e = pose.expr;
  const kind = e === 'normal' || e === 'smile' ? s.mouth : e === 'happy' ? (s.mouth === 'fang' ? 'fangBig' : 'big') : e;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2.2;
  const open = (w: number, top: number, bottom: number, fang: boolean) => {
    // 輪郭は Path2D で持つ（舌を描いたあとの現在パスは舌の楕円なので、そのまま stroke すると口の下に丸が出る）
    const lip = new Path2D();
    lip.moveTo(-w, top - 1);
    lip.quadraticCurveTo(0, top + 1.5, w, top - 1);
    lip.quadraticCurveTo(w * 0.85, bottom, 0, bottom);
    lip.quadraticCurveTo(-w * 0.85, bottom, -w, top - 1);
    lip.closePath();
    ctx.fillStyle = MOUTH;
    ctx.fill(lip);
    ctx.save();
    ctx.clip(lip);
    ctx.fillStyle = TONGUE;
    ctx.beginPath();
    ctx.ellipse(0.5, bottom, w * 0.6, (bottom - top) * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.stroke(lip);
    if (fang) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, top - 0.3);
      ctx.lineTo(-w * 0.2, top + 0.6);
      ctx.lineTo(-w * 0.55, top + 4.8);
      ctx.closePath();
      fillStroke(ctx, '#ffffff', 1.2);
    }
  };
  switch (kind) {
    case 'fang':
      open(7.5, 28, 35.5, true);
      return;
    case 'fangBig':
      open(8.5, 27, 38.5, true);
      return;
    case 'open':
      open(8, 28, 35, false);
      return;
    case 'big':
      open(8.5, 27, 38.5, false);
      return;
    case 'cat':
      ctx.beginPath();
      ctx.moveTo(-6, 28.5);
      ctx.quadraticCurveTo(-3, 33, 0, 29.5);
      ctx.quadraticCurveTo(3, 33, 6, 28.5);
      ctx.stroke();
      return;
    case 'smirk':
      ctx.beginPath();
      ctx.moveTo(-5, 29.5);
      ctx.quadraticCurveTo(-1, 33, 5, 28.5);
      ctx.stroke();
      return;
    case 'surprised':
    case 'dizzy':
      ctx.beginPath();
      ctx.ellipse(0, 31, 4.5, 5.5, 0, 0, Math.PI * 2);
      fillStroke(ctx, MOUTH, 2.2);
      return;
    case 'munch': {
      const o = Math.abs(Math.sin(pose.t * 14));
      ctx.beginPath();
      ctx.ellipse(0, 31, 6, 2 + o * 4.5, 0, 0, Math.PI * 2);
      fillStroke(ctx, MOUTH, 2.2);
      if (s.mouth === 'fang') {
        ctx.beginPath();
        ctx.moveTo(-4.4, 29.5 - o * 4);
        ctx.lineTo(-1.6, 29.5 - o * 4);
        ctx.lineTo(-3, 33 - o * 4);
        ctx.closePath();
        fillStroke(ctx, '#ffffff', 1.2);
      }
      return;
    }
    case 'sulk':
      // とがらせた口（「3」）
      ctx.beginPath();
      ctx.moveTo(-1.5, 27);
      ctx.quadraticCurveTo(4.5, 27.5, 1.5, 30.5);
      ctx.quadraticCurveTo(5, 34, -1, 34.5);
      ctx.stroke();
      return;
    case 'angry':
      ctx.beginPath();
      ctx.moveTo(-6, 32);
      ctx.quadraticCurveTo(-3, 28, 0, 31);
      ctx.quadraticCurveTo(3, 28, 6, 32);
      ctx.stroke();
      return;
    case 'worried':
      ctx.beginPath();
      ctx.moveTo(-6, 32);
      ctx.quadraticCurveTo(0, 27, 6, 32);
      ctx.stroke();
      return;
    default:
      ctx.beginPath();
      ctx.moveTo(-5, 29);
      ctx.quadraticCurveTo(0, 33.5, 5, 29);
      ctx.stroke();
  }
}

/** モブの小さな口（目が見えないぶん、口の形で表情を出す） */
function mobMouth(ctx: CanvasRenderingContext2D, s: ChibiSpec, e: Expr): void {
  const y = 32;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  switch (e) {
    case 'happy':
      // 小さな三角の開いた口
      ctx.moveTo(-4.5, y - 2.5);
      ctx.quadraticCurveTo(0, y - 1.5, 4.5, y - 2.5);
      ctx.quadraticCurveTo(1.5, y + 4.5, 0, y + 4.5);
      ctx.quadraticCurveTo(-1.5, y + 4.5, -4.5, y - 2.5);
      fillStroke(ctx, MOUTH, 2);
      return;
    case 'worried':
      // 上がぎざぎざの、わなわなした口
      ctx.moveTo(-7, y);
      for (let i = 1; i <= 6; i++) ctx.lineTo(-7 + i * (14 / 6), y + (i % 2 ? -1.6 : 0));
      ctx.quadraticCurveTo(6, y + 7, 0, y + 7);
      ctx.quadraticCurveTo(-6, y + 7, -7, y);
      fillStroke(ctx, MOUTH, 2);
      return;
    case 'surprised':
    case 'dizzy':
      ctx.ellipse(0, y + 1, 2.6, 3.2, 0, 0, Math.PI * 2);
      fillStroke(ctx, MOUTH, 1.8);
      return;
    case 'angry':
    case 'sulk':
    case 'stern':
      ctx.moveTo(-5, y + 2);
      ctx.quadraticCurveTo(0, y - 3, 5, y + 2);
      ctx.stroke();
      return;
    default:
      if (s.mouth === 'open') {
        // ω の口
        ctx.moveTo(-5, y - 1.5);
        ctx.quadraticCurveTo(-2.5, y + 2.5, 0, y);
        ctx.quadraticCurveTo(2.5, y + 2.5, 5, y - 1.5);
      } else {
        ctx.moveTo(-4.5, y - 1);
        ctx.quadraticCurveTo(0, y + 3.5, 4.5, y - 1);
      }
      ctx.stroke();
  }
}

/** 小さなハート（モブがうれしい時） */
function heart(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-11, -1, -6, -10, 0, -4);
  ctx.bezierCurveTo(6, -10, 11, -1, 0, 7);
  ctx.closePath();
  ctx.fillStyle = '#f2606e';
  ctx.fill();
  ctx.restore();
}

function angerMark(ctx: CanvasRenderingContext2D, t: number): void {
  const s = 1 + Math.sin(t * 10) * 0.12;
  ctx.save();
  ctx.translate(44, -46);
  ctx.scale(s, s);
  ctx.strokeStyle = '#e2574c';
  ctx.lineWidth = 3.5;
  for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(ax * 3, ay * 10);
    ctx.quadraticCurveTo(ax * 3, ay * 3, ax * 10, ay * 3);
    ctx.stroke();
  }
  ctx.restore();
}

/** うるうるの目（光と、下まぶたにたまった涙）と、頬を伝うひとしずく */
function tears(ctx: CanvasRenderingContext2D): void {
  for (const side of [-1, 1]) {
    const x = side * 22;
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(x - 1.5, 7.5, 2.4, 0, Math.PI * 2);
    ctx.arc(x + 1.8, 15.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, 20, 8, 3.2, 0, 0, Math.PI);
    fillStroke(ctx, 'rgba(173, 222, 245, 0.9)', 1.4, '#5aa6c8');
  }
  ctx.beginPath();
  ctx.moveTo(31, 22);
  ctx.quadraticCurveTo(36, 30, 34, 33);
  ctx.quadraticCurveTo(29, 35, 29, 30);
  ctx.closePath();
  fillStroke(ctx, 'rgba(173, 222, 245, 0.95)', 1.4, '#5aa6c8');
}

function sweat(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-46, -24);
  ctx.quadraticCurveTo(-38, -10, -42, -6);
  ctx.quadraticCurveTo(-50, -2, -50, -10);
  ctx.closePath();
  fillStroke(ctx, '#9fd8f2', 2, '#5aa6c8');
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) =>
    Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
