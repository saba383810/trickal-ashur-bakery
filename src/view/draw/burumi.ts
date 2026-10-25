// ブルミ: 窓の外からガラスに張り付く、小さくて丸いもちもちの子。
// 金髪にレンギョウ（黄色い小花）の髪飾り、オリーブ色の服、4 本指の手。原作の絵は見られていないので、設定の文章から描いている。
import { BALANCE } from '../../config/balance';
import type { Burumi } from '../../sim/world';
import type { Point, Rect } from '../layout';
import { crayon, EYE, LINE } from './chibi';

const SKIN = '#fff3ea';
const HAIR = '#ffe08a';
const HAIR_SHADE = '#f0bf55';
const CLOTH = '#768963';
const CLOTH_SHADE = '#5f7350';
const FLOWER = '#ffd43b';
const FLOWER_CORE = '#f59f00';
const BLUSH = '#ffaab0';

type Face = 'look' | 'pressed' | 'strain' | 'happy';

/** 窓の左下の枠（ブルミが張り付くガラス 1 枚）。窓の縦横の桟と外枠の内側 */
export function burumiPane(win: Rect): Rect {
  const top = win.y + win.h * 0.55 + 2;
  return { x: win.x + 3, y: top, w: win.w / 2 - 5, h: win.y + win.h - 3 - top };
}

/** ガラスに張り付いたブルミの中心 */
export function burumiCenter(win: Rect): Point {
  const p = burumiPane(win);
  return { x: p.x + p.w / 2, y: p.y + p.h * 0.48 };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** 窓 win のガラスに、b の状態のブルミを描く（time = 揺れに使う経過秒） */
export function drawBurumi(ctx: CanvasRenderingContext2D, win: Rect, b: Burumi, time: number): void {
  if (b.state === 'absent') return;
  const cfg = BALANCE.burumi;
  const pane = burumiPane(win);
  const c = burumiCenter(win);
  const R = Math.min(pane.w, pane.h) * 0.42;
  let scale = 1;
  let sx = 1.1;
  let sy = 0.95;
  let dy = 0;
  let alpha = 1;
  let face: Face = 'pressed';
  let fog = 0;
  switch (b.state) {
    case 'entering': {
      // 遠くから近づいてきて、ぺたっとぶつかる
      const p = Math.min(1, b.t / cfg.enterTime);
      const e = easeOut(Math.min(1, p / 0.85));
      scale = 0.35 + 0.65 * e;
      dy = (1 - e) * R * 0.7;
      sx = 1 + 0.1 * e;
      sy = 1 - 0.05 * e;
      face = 'look';
      break;
    }
    case 'stuck': {
      // ぶつかった勢いでつぶれてから、ガラスに張り付いたまま少しずつずり落ちる
      const k = Math.exp(-b.t * 9) * Math.cos(b.t * 28);
      sx = 1.1 + 0.16 * k + 0.015 * Math.sin(time * 5);
      sy = 0.95 - 0.13 * k - 0.015 * Math.sin(time * 5);
      dy = R * 0.32 * Math.pow(b.t / cfg.stay, 2);
      face = b.t > cfg.stay - 1.2 ? 'strain' : 'pressed';
      fog = Math.min(1, b.t / 0.6) * (0.75 + 0.25 * Math.sin(time * 3));
      break;
    }
    case 'leaving': {
      // ガラスからはがれて、遠ざかりながら上へ帰る
      const p = Math.min(1, b.t / cfg.leaveTime);
      scale = 1 - 0.6 * p * p;
      dy = R * 0.32 - R * 0.8 * p;
      sx = 1.1 - 0.1 * p;
      sy = 0.95 + 0.05 * p;
      alpha = 1 - p;
      face = 'look';
      fog = 1 - p;
      break;
    }
    case 'caught': {
      // タップされて、うれしそうにぽよんと跳ねて消える
      const p = Math.min(1, b.t / cfg.leaveTime);
      scale = 1 + 0.3 * Math.sin(p * Math.PI);
      dy = -R * 0.3 * p;
      sx = 1;
      sy = 1;
      alpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
      face = 'happy';
      break;
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.w, pane.h);
  ctx.clip();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.save();
  ctx.translate(c.x, c.y + dy);
  const k = (R / 50) * scale;
  ctx.scale(k * sx, k * sy);
  body(ctx, face);
  ctx.restore();
  // 息でくもったガラス
  if (fog > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.32 * fog})`;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + dy + R * 0.62, R * 0.38, R * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // ガラスの照り（ブルミがガラスの向こうにいるように見せる）
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.moveTo(pane.x + pane.w * 0.62, pane.y);
  ctx.lineTo(pane.x + pane.w * 0.82, pane.y);
  ctx.lineTo(pane.x + pane.w * 0.3, pane.y + pane.h);
  ctx.lineTo(pane.x + pane.w * 0.1, pane.y + pane.h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 頭の単位（半径 50）で描くブルミ。体は頭ひとつのまんまる */
function body(ctx: CanvasRenderingContext2D, face: Face): void {
  const ink = crayon(ctx, LINE);
  const eyeInk = crayon(ctx, EYE);
  const stroke = (lw = 3) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  const blob = () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 50, 48, 0, 0, Math.PI * 2);
  };

  // まんまるの体と、下のオリーブ色の服
  blob();
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.save();
  blob();
  ctx.clip();
  const cloth = ctx.createLinearGradient(-50, 0, 50, 0);
  cloth.addColorStop(0, CLOTH);
  cloth.addColorStop(1, CLOTH_SHADE);
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-60, 34);
  ctx.quadraticCurveTo(-30, 26, -12, 33);
  ctx.lineTo(0, 40);
  ctx.lineTo(12, 33);
  ctx.quadraticCurveTo(30, 26, 60, 34);
  ctx.lineTo(60, 60);
  ctx.lineTo(-60, 60);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-12, 34);
  ctx.lineTo(0, 41);
  ctx.lineTo(12, 34);
  ctx.stroke();

  // 金髪: 頭の上半分をおおい、前髪は丸く 3 つに分かれる
  const hair = ctx.createLinearGradient(0, -50, 0, 0);
  hair.addColorStop(0, HAIR);
  hair.addColorStop(1, HAIR_SHADE);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-56, 18);
  ctx.lineTo(-56, -60);
  ctx.lineTo(56, -60);
  ctx.lineTo(56, 18);
  ctx.quadraticCurveTo(46, 10, 42, -6);
  ctx.quadraticCurveTo(32, 2, 22, -6);
  ctx.quadraticCurveTo(12, 4, 0, -8);
  ctx.quadraticCurveTo(-12, 4, -22, -6);
  ctx.quadraticCurveTo(-32, 2, -42, -6);
  ctx.quadraticCurveTo(-46, 10, -56, 18);
  ctx.closePath();
  ctx.fill();
  stroke(2.4);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-20, -32, 12, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  blob();
  stroke(3.2);

  // ぴょんと立った毛
  ctx.beginPath();
  ctx.moveTo(-2, -47);
  ctx.quadraticCurveTo(-6, -64, 8, -66);
  ctx.quadraticCurveTo(16, -66, 12, -58);
  ctx.fillStyle = HAIR;
  ctx.fill();
  stroke(2.4);

  // レンギョウの髪飾り（4 枚の花びら）
  ctx.save();
  ctx.translate(31, -34);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((Math.PI / 2) * i + 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -7.5, 4.6, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = FLOWER;
    ctx.fill();
    stroke(1.8);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = FLOWER_CORE;
  ctx.fill();
  ctx.restore();

  // ガラスに押しつけて平たくなったほっぺ
  if (face === 'pressed' || face === 'strain') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 32, 17, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const pressed = face !== 'look' && face !== 'happy';
  ctx.fillStyle = BLUSH;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 29, 17, pressed ? 13 : 10, pressed ? 8 : 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 目
  ctx.strokeStyle = eyeInk;
  ctx.fillStyle = eyeInk;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const x = side * 17;
    if (face === 'happy') {
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(x - 6, 8);
      ctx.quadraticCurveTo(x, 0, x + 6, 8);
      ctx.stroke();
    } else if (face === 'strain') {
      // ずり落ちそうでふんばる「> <」
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(x - side * 5, 1);
      ctx.lineTo(x + side * 4, 6);
      ctx.lineTo(x - side * 5, 11);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, 6, 4.8, 6.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 1.5, 3.4, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = eyeInk;
    }
  }

  // 口
  ctx.beginPath();
  if (face === 'happy') {
    ctx.moveTo(-6, 20);
    ctx.quadraticCurveTo(0, 30, 6, 20);
    ctx.closePath();
  } else if (pressed) {
    ctx.ellipse(0, 22, 5.5, 3.4, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(0, 21, 3.4, 3, 0, 0, Math.PI * 2);
  }
  ctx.fillStyle = '#e8707e';
  ctx.fill();
  stroke(2);

  // ガラスに押しつけた 4 本指の手（張り付いている間だけ）
  if (pressed) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 45, 20);
      ctx.rotate(side * 0.35);
      for (let i = 0; i < 4; i++) {
        const a = -0.75 + i * 0.5;
        ctx.beginPath();
        ctx.ellipse(Math.sin(a) * 10, -Math.cos(a) * 10, 3.6, 4.4, a, 0, Math.PI * 2);
        ctx.fillStyle = SKIN;
        ctx.fill();
        stroke(1.8);
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, 9.5, 8.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = SKIN;
      ctx.fill();
      stroke(2.2);
      ctx.fillStyle = 'rgba(255, 190, 190, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 1, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
