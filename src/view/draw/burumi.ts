// ブルミ: ときどき窓の外からガラスに張り付く子。原作のガチャ画面で窓に張り付く姿の特徴を参考にした描き起こし。
// 金髪のボブと外にはねる低いツインテール、頭の上の双葉、白い小花の髪飾り、白目だけの丸い目とうずまきのほっぺ、
// 大きく開けた口、白い服の上に丈の長いオリーブ色のベスト（えりもとに黄色いボタン）、深緑の短パン。両手を上げて張り付く
import { BALANCE } from '../../config/balance';
import type { Burumi } from '../../sim/world';
import type { Point, Rect } from '../layout';
import { crayon, EYE, LINE, lineScale, setGrain } from './chibi';

const SKIN = '#fff3ea';
const HAIR = '#ffd65a';
const HAIR_TIP = '#f6a93b';
const LEAF = '#8fb35f';
const LEAF_SHADE = '#6a8f45';
const VEST = '#7f9a5e';
const VEST_SHADE = '#66804a';
const SHORTS = '#4b6141';
const BUTTON = '#f7c948';
const CHEEK = '#f191a3';
const MOUTH = '#f08a95';
const LEGS = '#5f4146';

type Face = 'look' | 'pressed' | 'strain' | 'happy';

/** 頭の中心から、窓の横桟で切れるところ（短パンの裾）まで。これより下は桟に隠れる */
const CUT = 70;
/** 双葉の先からツインテールの端まで（幅）と、双葉の先から CUT まで（高さ） */
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
  let face: Face = 'pressed';
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

/** メニュー用: 中心 (x, y) の size × size の枠に、足もとまで入れたブルミ（ふつうの顔） */
export function drawBurumiIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  // 双葉の先（-62）から足（+104）まで
  const k = Math.min(size / FIG_W, size / 170);
  ctx.save();
  ctx.translate(x, y - 21 * k);
  ctx.scale(k, k);
  body(ctx, 'look', 0);
  ctx.restore();
}

/** 頭の単位（半径 50 くらい。頭の中心が原点）で描くブルミ */
function body(ctx: CanvasRenderingContext2D, face: Face, time: number): void {
  const ink = crayon(ctx, LINE);
  const eyeInk = crayon(ctx, EYE);
  setGrain(ctx, [ink, eyeInk]);
  // 線の太さはキャラと同じく、画面での大きさで決める（窓に小さく張り付いても線が細くならない）
  const lk = lineScale(ctx, 50);
  const stroke = (lw = 3) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = lw * lk;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const pressed = face === 'pressed' || face === 'strain';
  const swing = Math.sin(time * 4) * 0.05;

  // 脚（ふだんは窓の横桟に隠れる。つぶれても桟とのあいだがあかないように下まで描く）
  ctx.beginPath();
  ctx.roundRect(-10, 66, 20, 38, 6);
  ctx.fillStyle = LEGS;
  ctx.fill();
  stroke(2.4);

  // 外にはねる低いツインテール（毛先はオレンジがかる）
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 36, 16);
    ctx.rotate(side * swing);
    const g = ctx.createLinearGradient(0, 0, side * 26, 44);
    g.addColorStop(0, HAIR);
    g.addColorStop(1, HAIR_TIP);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.bezierCurveTo(side * 22, -6, side * 30, 18, side * 26, 34);
    ctx.quadraticCurveTo(side * 25, 44, side * 18, 48);
    ctx.quadraticCurveTo(side * 20, 40, side * 13, 36);
    ctx.quadraticCurveTo(side * 4, 30, side * 2, 12);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    stroke(2.4);
    ctx.restore();
  }

  // 上げた腕（肩から外へ、手はあごの横）
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 12, 47);
    ctx.quadraticCurveTo(side * 30, 44, side * 38, 28);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 6.6 + 4.4 * lk;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = SKIN;
    ctx.lineWidth = 6.6;
    ctx.stroke();
  }

  // 白い服と短パン
  ctx.beginPath();
  ctx.moveTo(-12, 40);
  ctx.lineTo(12, 40);
  ctx.quadraticCurveTo(18, 56, 19, 68);
  ctx.lineTo(-19, 68);
  ctx.quadraticCurveTo(-18, 56, -12, 40);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  stroke(2.4);
  ctx.beginPath();
  ctx.moveTo(-17, 64);
  ctx.lineTo(17, 64);
  ctx.lineTo(18, 76);
  ctx.lineTo(1.5, 76);
  ctx.lineTo(0, 71);
  ctx.lineTo(-1.5, 76);
  ctx.lineTo(-18, 76);
  ctx.closePath();
  ctx.fillStyle = SHORTS;
  ctx.fill();
  stroke(2.2);
  // 白い服のすそのフリル
  ctx.fillStyle = '#ffffff';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * 6.4, 66, 3.4, 0, Math.PI);
    ctx.fill();
    stroke(1.6);
  }
  // 丈の長いオリーブ色のベスト（前は開いていて、えりもとを黄色いボタンで留める）
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(side * 4, 0, side * 22, 0);
    g.addColorStop(0, VEST);
    g.addColorStop(1, VEST_SHADE);
    ctx.beginPath();
    ctx.moveTo(side * 2, 43);
    ctx.lineTo(side * 13, 39);
    ctx.quadraticCurveTo(side * 21, 58, side * 23, 80);
    ctx.lineTo(side * 9, 82);
    ctx.quadraticCurveTo(side * 6, 60, side * 2, 43);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    stroke(2.4);
  }
  ctx.beginPath();
  ctx.arc(0, 45, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = BUTTON;
  ctx.fill();
  stroke(1.8);

  // 顔（下ぶくれのもち顔）
  const head = () => {
    ctx.beginPath();
    ctx.ellipse(0, 2, 44, 40, 0, 0, Math.PI * 2);
  };
  head();
  ctx.fillStyle = SKIN;
  ctx.fill();
  stroke(3);

  // 金髪のボブ: 頭の上をおおい、ぱっつんの前髪、横は耳の下まで
  const hair = ctx.createLinearGradient(0, -48, 0, 24);
  hair.addColorStop(0, HAIR);
  hair.addColorStop(1, '#ffc84a');
  ctx.beginPath();
  ctx.moveTo(-40, 24);
  ctx.bezierCurveTo(-56, -10, -40, -48, 0, -46);
  ctx.bezierCurveTo(40, -48, 56, -10, 40, 24);
  ctx.quadraticCurveTo(36, 14, 34, -2);
  ctx.lineTo(28, -4);
  ctx.lineTo(25, -10);
  ctx.lineTo(14, -6);
  ctx.lineTo(9, -12);
  ctx.lineTo(-2, -7);
  ctx.lineTo(-8, -12);
  ctx.lineTo(-18, -6);
  ctx.lineTo(-24, -10);
  ctx.lineTo(-30, -4);
  ctx.lineTo(-34, -2);
  ctx.quadraticCurveTo(-36, 14, -40, 24);
  ctx.closePath();
  ctx.fillStyle = hair;
  ctx.fill();
  stroke(2.6);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.ellipse(-18, -32, 11, 4.5, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // 頭の上の双葉
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 2, -45);
    ctx.rotate(side * (0.95 + swing));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-7, -10, 0, -19);
    ctx.quadraticCurveTo(7, -10, 0, 0);
    ctx.closePath();
    ctx.fillStyle = side < 0 ? LEAF : LEAF_SHADE;
    ctx.fill();
    stroke(2);
    ctx.restore();
  }

  // 白い小花の髪飾り（6 枚の花びら）
  ctx.save();
  ctx.translate(24, -26);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    stroke(1.4);
  }
  ctx.beginPath();
  ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = BUTTON;
  ctx.fill();
  ctx.restore();

  // ガラスに押しつけて白っぽく平たくなったところ
  if (pressed) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 30, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // うずまきのほっぺ
  ctx.strokeStyle = CHEEK;
  ctx.lineWidth = 2 * lk;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = side * t * Math.PI * 3.2;
      const rr = 1 + t * 6.5;
      const x = side * 27 + Math.cos(a) * rr;
      const y = 15 + Math.sin(a) * rr * 0.8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 目: 白目だけのまんまるの目。ふんばる時は「> <」、つかまってうれしい時は「^ ^」
  for (const side of [-1, 1]) {
    const x = side * 16;
    ctx.strokeStyle = eyeInk;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (face === 'happy') {
      ctx.lineWidth = 3.4 * lk;
      ctx.beginPath();
      ctx.moveTo(x - 7, 7);
      ctx.quadraticCurveTo(x, -3, x + 7, 7);
      ctx.stroke();
    } else if (face === 'strain') {
      ctx.lineWidth = 3.4 * lk;
      ctx.beginPath();
      ctx.moveTo(x - side * 6, -1);
      ctx.lineTo(x + side * 5, 5);
      ctx.lineTo(x - side * 6, 11);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, 4, 7.6, pressed ? 8.6 : 9.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3 * lk;
      ctx.stroke();
    }
  }

  // 大きく開けた口
  ctx.beginPath();
  if (face === 'strain') {
    ctx.moveTo(-7, 24);
    ctx.quadraticCurveTo(-3.5, 20, 0, 24);
    ctx.quadraticCurveTo(3.5, 28, 7, 24);
    ctx.lineTo(7, 26);
    ctx.quadraticCurveTo(0, 31, -7, 26);
    ctx.closePath();
  } else {
    const w = face === 'happy' ? 10 : pressed ? 8 : 9;
    ctx.moveTo(-w, 18);
    ctx.quadraticCurveTo(0, 21, w, 18);
    ctx.quadraticCurveTo(w * 0.9, 33, 0, 33);
    ctx.quadraticCurveTo(-w * 0.9, 33, -w, 18);
    ctx.closePath();
  }
  ctx.fillStyle = MOUTH;
  ctx.fill();
  stroke(2.2);
  if (face !== 'strain') {
    ctx.fillStyle = '#e0606f';
    ctx.beginPath();
    ctx.ellipse(0, 29, 4.6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
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
