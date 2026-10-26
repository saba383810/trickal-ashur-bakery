// ブルミ: ときどき窓の外からガラスに張り付く子。原作の SD の特徴を参考にした描き起こし（絵はなぞらない）。
// 金色のボブと毛先の丸いぱっつん前髪、毛先が筆のようにはねる低いツインテール、頭の上の葉っぱのリボン、白い小花の髪飾り、
// 眠たそうな半目の金色の目と「ω」の口、大きなピンクのほっぺ。白い丸えりの緑のワンピースに黄色い星のブローチ、白いタイツ。
// 両手を上げてガラスに張り付く
import { BALANCE } from '../../config/balance';
import type { Burumi } from '../../sim/world';
import type { Point, Rect } from '../layout';
import { crayon, EYE, LINE, lineScale, setGrain } from './chibi';

const SKIN = '#fff4ec';
const HAIR = '#ffd24f';
const HAIR_LIGHT = '#ffe58a';
const HAIR_TIP = '#f5a532';
const HAIR_SHADE = '#e3962f';
const LEAF = '#7fae5a';
const LEAF_SHADE = '#4f7d3b';
const LEAF_VEIN = '#b5d98a';
const DRESS = '#9dbd72';
const DRESS_SHADE = '#7b9d55';
const STAR = '#ffd23f';
const IRIS_TOP = '#8a4a1c';
const IRIS = '#e9a52c';
const IRIS_LIGHT = '#ffe07a';
/** ほっぺ・口はほかのキャラと同じ色 */
const BLUSH = 'rgba(255, 166, 164, 0.95)';
const MOUTH = '#b23a48';
const TONGUE = '#fda3a2';
const TIGHTS = '#fdf6f2';
const SHOE = '#8a5a44';

export type BurumiFace = 'look' | 'pressed' | 'strain' | 'happy';

/** 頭の中心から、窓の横桟で切れるところ（短パンの裾）まで。これより下は桟に隠れる */
const CUT = 70;
/** ツインテールの端から端まで（幅）と、リボンの先から CUT まで（高さ） */
const FIG_W = 124;
const FIG_H = 62 + CUT;

/** 窓の左上のガラス 1 枚のおおよその枠（アーチの丸みは drawBurumi で切り抜く） */
export function burumiPane(win: Rect): Rect {
  return { x: win.x + 3, y: win.y + 3, w: win.w / 2 - 5, h: win.h * 0.55 - 5 };
}

/** ガラスの大きさに合わせた、頭の単位（半径 50）からの縮尺 */
function figScale(pane: Rect): number {
  return Math.min(pane.w / FIG_W, (pane.h - 6) / FIG_H);
}

/** ガラスに張り付いたブルミの顔の中心 */
export function burumiCenter(win: Rect): Point {
  const p = burumiPane(win);
  return { x: p.x + p.w * 0.55, y: p.y + p.h - CUT * figScale(p) };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** 窓 win のガラスに、b の状態のブルミを描く（time = 揺れに使う経過秒） */
export function drawBurumi(ctx: CanvasRenderingContext2D, win: Rect, b: Burumi, time: number): void {
  if (b.state === 'absent') return;
  const cfg = BALANCE.burumi;
  const pane = burumiPane(win);
  const c = burumiCenter(win);
  const k0 = figScale(pane);
  const R = 50 * k0;
  let scale = 1;
  let sx = 1.06;
  let sy = 0.97;
  let dy = 0;
  let alpha = 1;
  let face: BurumiFace = 'pressed';
  let fog = 0;
  switch (b.state) {
    case 'entering': {
      // 遠くから飛んできて、ぺたっとぶつかる
      const p = Math.min(1, b.t / cfg.enterTime);
      const e = easeOut(Math.min(1, p / 0.85));
      scale = 0.35 + 0.65 * e;
      dy = (1 - e) * R * 0.5;
      sx = 1 + 0.06 * e;
      sy = 1 - 0.03 * e;
      face = 'look';
      break;
    }
    case 'stuck': {
      // ぶつかった勢いでつぶれてから、ガラスに張り付いたまま少しずつずり落ちる
      const k = Math.exp(-b.t * 9) * Math.cos(b.t * 28);
      sx = 1.06 + 0.12 * k + 0.012 * Math.sin(time * 5);
      sy = 0.97 - 0.1 * k - 0.012 * Math.sin(time * 5);
      dy = R * 0.3 * Math.pow(b.t / cfg.stay, 2);
      face = b.t > cfg.stay - 1.2 ? 'strain' : 'pressed';
      fog = Math.min(1, b.t / 0.6) * (0.75 + 0.25 * Math.sin(time * 3));
      break;
    }
    case 'leaving': {
      // ガラスからはがれて、遠ざかりながら上へ帰る
      const p = Math.min(1, b.t / cfg.leaveTime);
      scale = 1 - 0.6 * p * p;
      dy = R * 0.3 - R * 0.8 * p;
      sx = 1.06 - 0.06 * p;
      sy = 0.97 + 0.03 * p;
      alpha = 1 - p;
      face = 'look';
      fog = 1 - p;
      break;
    }
    case 'caught': {
      // タップされて、うれしそうにぽよんと跳ねて消える
      const p = Math.min(1, b.t / cfg.leaveTime);
      scale = 1 + 0.2 * Math.sin(p * Math.PI);
      dy = -R * 0.3 * Math.sin(p * Math.PI);
      sx = 1;
      sy = 1;
      alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
      face = 'happy';
      break;
    }
  }

  ctx.save();
  // 左上のガラス（外枠のアーチの内側・縦桟の左・横桟の上）だけに描く
  const r = win.w / 2;
  ctx.beginPath();
  ctx.moveTo(win.x + 3, pane.y + pane.h);
  ctx.lineTo(win.x + 3, win.y + r);
  ctx.arc(win.x + r, win.y + r, r - 3, Math.PI, Math.PI * 1.5);
  ctx.lineTo(pane.x + pane.w, win.y);
  ctx.lineTo(pane.x + pane.w, pane.y + pane.h);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.save();
  ctx.translate(c.x, c.y + dy);
  const k = k0 * scale;
  ctx.scale(k * sx, k * sy);
  body(ctx, face, time);
  ctx.restore();
  // 息でくもったガラス
  if (fog > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.32 * fog})`;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + dy + R * 0.5, R * 0.34, R * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // ガラスの照り（ブルミがガラスの向こうにいるように見せる）
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.moveTo(pane.x + pane.w * 0.7, pane.y);
  ctx.lineTo(pane.x + pane.w * 0.9, pane.y);
  ctx.lineTo(pane.x + pane.w * 0.35, pane.y + pane.h);
  ctx.lineTo(pane.x + pane.w * 0.15, pane.y + pane.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** メニュー用: 中心 (x, y) の size × size の枠に、足もとまで入れたブルミ（ふだんは眠たそうな顔） */
export function drawBurumiIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, face: BurumiFace = 'look'): void {
  // リボンの先（-62）から靴（+104）まで
  const k = Math.min(size / FIG_W, size / 170);
  ctx.save();
  ctx.translate(x, y - 21 * k);
  ctx.scale(k, k);
  body(ctx, face, 0);
  ctx.restore();
}

/** 頭の単位（半径 50 くらい。頭の中心が原点）で描くブルミ */
function body(ctx: CanvasRenderingContext2D, face: BurumiFace, time: number): void {
  setGrain(ctx);
  const ink = () => crayon(LINE);
  const eyeInk = () => crayon(EYE);
  // 線の太さはキャラと同じく、画面での大きさで決める（窓に小さく張り付いても線が細くならない）
  const lk = lineScale(ctx, 50);
  const stroke = (lw = 3) => {
    ctx.strokeStyle = ink();
    ctx.lineWidth = lw * lk;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const pressed = face === 'pressed' || face === 'strain';
  const swing = Math.sin(time * 4) * 0.05;

  // 白いタイツの脚と茶色の靴（ふだんは窓の横桟に隠れる。つぶれても桟とのあいだがあかないように下まで描く）
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(side * 7 - 5, 66, 10, 34, 5);
    ctx.fillStyle = TIGHTS;
    ctx.fill();
    stroke(2.2);
    ctx.beginPath();
    ctx.ellipse(side * 8, 100, 7, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = SHOE;
    ctx.fill();
    stroke(2);
  }

  // 低いツインテール: 外へふくらみ、毛先は筆のように 3 つにとがる（毛先ほど濃い金色）
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 30, 20);
    ctx.rotate(side * swing);
    const g = ctx.createLinearGradient(0, -6, side * 14, 46);
    g.addColorStop(0, HAIR);
    g.addColorStop(0.55, HAIR);
    g.addColorStop(1, HAIR_TIP);
    ctx.beginPath();
    ctx.moveTo(side * 2, -8);
    ctx.bezierCurveTo(side * 24, -12, side * 35, 12, side * 31, 32);
    ctx.quadraticCurveTo(side * 30, 39, side * 33, 46);
    ctx.quadraticCurveTo(side * 25, 43, side * 21, 38);
    ctx.quadraticCurveTo(side * 19, 45, side * 20, 51);
    ctx.quadraticCurveTo(side * 12, 46, side * 10, 38);
    ctx.quadraticCurveTo(side * 6, 42, side * 4, 46);
    ctx.quadraticCurveTo(side * -1, 30, side * -2, 10);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    stroke(2.4);
    // 毛の流れとつや
    ctx.beginPath();
    ctx.moveTo(side * 14, 8);
    ctx.quadraticCurveTo(side * 22, 22, side * 20, 34);
    ctx.strokeStyle = HAIR_SHADE;
    ctx.lineWidth = 1.6 * lk;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(side * 22, 10, 3, 6, side * -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 上げた腕（緑のそで。肩から外へ、手はあごの横）
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 12, 47);
    ctx.quadraticCurveTo(side * 30, 44, side * 38, 28);
    ctx.strokeStyle = ink();
    ctx.lineWidth = 8 + 4.4 * lk;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = DRESS;
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  // 緑のワンピース（すそに白いフリル）
  const dress = ctx.createLinearGradient(-23, 0, 23, 0);
  dress.addColorStop(0, DRESS_SHADE);
  dress.addColorStop(0.3, DRESS);
  dress.addColorStop(0.7, DRESS);
  dress.addColorStop(1, DRESS_SHADE);
  const hemY = (x: number) => 76 + 2 * (1 - (x / 23) ** 2);
  ctx.fillStyle = '#ffffff';
  for (let i = -3; i <= 3; i++) {
    const x = i * 6.6;
    ctx.beginPath();
    ctx.arc(x, hemY(x) - 0.5, 3.4, 0, Math.PI);
    ctx.fill();
    stroke(1.6);
  }
  ctx.beginPath();
  ctx.moveTo(-13, 39);
  ctx.lineTo(13, 39);
  ctx.quadraticCurveTo(19, 56, 23, 76);
  ctx.quadraticCurveTo(0, 80, -23, 76);
  ctx.quadraticCurveTo(-19, 56, -13, 39);
  ctx.closePath();
  ctx.fillStyle = dress;
  ctx.fill();
  stroke(2.4);
  // 白い丸えりと、えりもとの黄色い星のブローチ
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 41);
    ctx.quadraticCurveTo(side * 8, 38, side * 14, 40);
    ctx.quadraticCurveTo(side * 15, 49, side * 6, 50);
    ctx.quadraticCurveTo(side * 1, 49, 0, 41);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    stroke(2);
  }
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (Math.PI / 5) * i;
    const rr = i % 2 ? 2.6 : 6;
    ctx.lineTo(Math.cos(a) * rr, 47 + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = STAR;
  ctx.fill();
  stroke(1.6);

  // 顔（下ぶくれのもち顔）
  ctx.beginPath();
  ctx.ellipse(0, 2, 44, 40, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  stroke(3);

  // 金色のボブ: 頭の上をおおい、毛先の丸いぱっつんの前髪、横は耳の下まで
  const hair = ctx.createLinearGradient(0, -48, 0, 24);
  hair.addColorStop(0, HAIR_LIGHT);
  hair.addColorStop(0.5, HAIR);
  hair.addColorStop(1, HAIR_TIP);
  ctx.beginPath();
  ctx.moveTo(-41, 25);
  ctx.bezierCurveTo(-57, -10, -40, -48, 0, -46);
  ctx.bezierCurveTo(40, -48, 57, -10, 41, 25);
  ctx.quadraticCurveTo(35, 22, 34, 12);
  ctx.quadraticCurveTo(33, 4, 30, -4);
  const xs = [30, 20, 10, 0, -10, -20, -30];
  for (let i = 0; i < xs.length - 1; i++) {
    ctx.quadraticCurveTo((xs[i] + xs[i + 1]) / 2, i % 2 ? 1 : -0.5, xs[i + 1], -6);
  }
  ctx.quadraticCurveTo(-33, 4, -34, 12);
  ctx.quadraticCurveTo(-35, 22, -41, 25);
  ctx.closePath();
  ctx.fillStyle = hair;
  ctx.fill();
  stroke(2.6);
  // 前髪のすじと、頭の丸みにそった天使の輪
  ctx.strokeStyle = HAIR_SHADE;
  ctx.lineWidth = 1.6 * lk;
  for (const [x0, x1] of [[-6, -10], [14, 10], [-22, -24]]) {
    ctx.beginPath();
    ctx.moveTo(x0, -22);
    ctx.quadraticCurveTo(x1 + 1, -14, x1, -7);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(0, -4, 33, Math.PI * 1.17, Math.PI * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -4, 33, Math.PI * 1.48, Math.PI * 1.56);
  ctx.stroke();
  // ツインテールの根もとの緑の髪ゴム
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 39, 25, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = LEAF_SHADE;
    ctx.fill();
    stroke(1.8);
  }

  // 頭の上の葉っぱのリボン（2 枚の葉を左右に広げて、まん中で結ぶ）
  ctx.save();
  ctx.translate(0, -44);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (1.1 + swing));
    const g = ctx.createLinearGradient(-8, 0, 8, 0);
    g.addColorStop(0, side < 0 ? LEAF : LEAF_SHADE);
    g.addColorStop(1, side < 0 ? LEAF_SHADE : LEAF);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-9.5, -11, 0, -23);
    ctx.quadraticCurveTo(9.5, -11, 0, 0);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    stroke(2);
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -17);
    ctx.strokeStyle = LEAF_VEIN;
    ctx.lineWidth = 1.4 * lk;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, -1, 4.4, 3.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = LEAF_SHADE;
  ctx.fill();
  stroke(1.8);
  ctx.restore();

  // 白い小花の髪飾り（5 枚の花びら、まん中は黄色）
  ctx.save();
  ctx.translate(24, -25);
  ctx.rotate(0.2);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + ((Math.PI * 2) / 5) * i;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 5, Math.sin(a) * 5, 4.4, 3.6, a, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    stroke(1.4);
  }
  ctx.beginPath();
  ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = STAR;
  ctx.fill();
  stroke(1.2);
  ctx.restore();

  // ガラスに押しつけて白っぽく平たくなったところ
  if (pressed) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 大きなピンクのほっぺ
  ctx.fillStyle = BLUSH;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 28, 17, pressed ? 12.5 : 11.5, pressed ? 8 : 8.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 目: 金色のひとみ。ふだんは眠たそうな半目、ガラスに張り付くとまんまる。
  // ふんばる時は「> <」と涙、つかまってうれしい時は「^ ^」
  for (const side of [-1, 1]) {
    const x = side * 17;
    const y = 6;
    ctx.strokeStyle = eyeInk();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (face === 'happy') {
      ctx.lineWidth = 3.4 * lk;
      ctx.beginPath();
      ctx.moveTo(x - 7, 8);
      ctx.quadraticCurveTo(x, -2, x + 7, 8);
      ctx.stroke();
      continue;
    }
    if (face === 'strain') {
      ctx.lineWidth = 3.4 * lk;
      ctx.beginPath();
      ctx.moveTo(x - side * 6, 0);
      ctx.lineTo(x + side * 5, 6);
      ctx.lineTo(x - side * 6, 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + side * 8, 9);
      ctx.quadraticCurveTo(x + side * 11, 14, x + side * 9, 16);
      ctx.quadraticCurveTo(x + side * 6, 15.5, x + side * 8, 9);
      ctx.closePath();
      ctx.fillStyle = '#bfe6fb';
      ctx.fill();
      ctx.strokeStyle = '#6aa9d0';
      ctx.lineWidth = 1.4 * lk;
      ctx.stroke();
      continue;
    }
    const round = face === 'pressed';
    const ry = round ? 9.4 : 8.6;
    // 半目はまぶたで上を切る
    const lid = round ? y - ry - 2 : y - 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 11, lid, 22, 26);
    ctx.clip();
    const iris = ctx.createLinearGradient(0, y - ry, 0, y + ry);
    iris.addColorStop(0, IRIS_TOP);
    iris.addColorStop(0.5, IRIS);
    iris.addColorStop(1, IRIS_LIGHT);
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 7.6, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = iris;
    ctx.fill();
    ctx.lineWidth = 2.4 * lk;
    ctx.stroke();
    ctx.fillStyle = eyeInk();
    ctx.beginPath();
    ctx.ellipse(x, round ? y + 1 : y + 5, 3.4, round ? 4.4 : 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - 2.8, round ? y - 2.6 : y + 3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 2.6, y + 6.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // まぶたの線。まんまるの目は目尻を少しはね、半目は目尻へ下がってまつ毛を外へ下ろす（眠たそうに）
    ctx.lineWidth = 3.2 * lk;
    ctx.beginPath();
    if (round) {
      ctx.ellipse(x, y + 1, 7.6, ry, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.lineTo(x + side * 10.6, y - 7.2);
    } else {
      ctx.moveTo(x - side * 8, lid + 1);
      ctx.quadraticCurveTo(x - side * 1, lid - 2, x + side * 8.4, lid + 2);
      ctx.lineTo(x + side * 10.6, lid + 4);
    }
    ctx.stroke();
  }

  // 口: ふだんは「ω」、ふんばる時はわめいて開け、うれしい時はにっこり開ける
  ctx.strokeStyle = ink();
  ctx.lineWidth = 2.2 * lk;
  if (face === 'look' || face === 'pressed') {
    const w = face === 'pressed' ? 7.5 : 6.5;
    ctx.beginPath();
    ctx.moveTo(-w, 17);
    ctx.quadraticCurveTo(-w / 2, 23, 0, 18.5);
    ctx.quadraticCurveTo(w / 2, 23, w, 17);
    ctx.stroke();
  } else {
    const [w, top, bottom] = face === 'strain' ? [6.5, 16, 28] : [8, 16, 26];
    const lip = new Path2D();
    lip.moveTo(-w, top);
    lip.quadraticCurveTo(0, top + (face === 'strain' ? -2 : 2), w, top);
    lip.quadraticCurveTo(w * 0.9, bottom, 0, bottom);
    lip.quadraticCurveTo(-w * 0.9, bottom, -w, top);
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
    ctx.lineJoin = 'round';
    ctx.stroke(lip);
  }

  // あごの横に上げた手（張り付いている間は、ガラスに押しつけた 4 本の指を広げる）
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 40, 24);
    ctx.rotate(side * 0.5);
    if (pressed) {
      for (let i = 0; i < 4; i++) {
        const a = -0.75 + i * 0.5;
        ctx.beginPath();
        ctx.ellipse(Math.sin(a) * 8, -Math.cos(a) * 8, 2.8, 3.6, a, 0, Math.PI * 2);
        ctx.fillStyle = SKIN;
        ctx.fill();
        stroke(1.6);
      }
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, pressed ? 7.5 : 6.5, pressed ? 6.8 : 6.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = SKIN;
    ctx.fill();
    stroke(2);
    if (pressed) {
      ctx.fillStyle = 'rgba(255, 190, 190, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 1, 4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
