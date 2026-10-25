// 開発用: サイト掲載用サムネイル（800×515）を描く（本番ビルドには含めない）。
// ?og を付けると SNS のリンクの絵（1200×630）。X などは 1.91:1 に切るので、上下が欠けないよう別に描く
import { PLAY_STAGES } from '../config/stages';
import { drawBread } from '../view/draw/breads';
import { MochiBody } from '../mochi/body';
import { BUTTER, ELFIN, ESHUR, KOMI, NELL, SPEAKI } from '../view/draw/characters';
import { drawChibi, feetR } from '../view/draw/chibi';
import { SceneCache } from '../view/draw/scene';
import { makeLayout } from '../view/layout';
import { C, font } from '../view/palette';

const OG = new URLSearchParams(location.search).has('og');
const W = OG ? 1200 : 800;
const H = OG ? 630 : 515;
// 中身は 800×515 で組み、OG は高さに合わせて拡大して真ん中に置く（左右は背景とパンを足す）
const S = H / 515;
const OX = (W - 800 * S) / 2;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const dpr = window.devicePixelRatio || 1;
canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const c = canvas.getContext('2d')!;

async function draw(): Promise<void> {
  await document.fonts.load("800 40px 'M PLUS Rounded 1c'", 'エシュールのパン屋さんベーカリー');
  c.scale(dpr, dpr);
  c.translate(OX, 0);
  c.scale(S, S);
  /** 絵の左右の端（中身の座標） */
  const left = -OX / S;
  const right = (W - OX) / S;
  const stage = PLAY_STAGES.find((s) => s.id === 'spicy')!;
  const L = makeLayout(1280, 720, false, stage);
  const scene = new SceneCache();
  scene.ensure(L, stage, 2);
  // 背景は店内の上半分（壁と窓）を拡大して使う
  const k = 515 / 520;
  c.drawImage(scene.back!, 0, 124 * 2, 1280 * 2, 520 * 2, (800 - 1280 * k) / 2, 0, 1280 * k, 515);
  c.fillStyle = 'rgba(255, 246, 232, 0.25)';
  c.fillRect(left, 0, right - left, 515);

  // カウンター
  c.fillStyle = C.counterTop;
  c.fillRect(left, 392, right - left, 18);
  c.fillStyle = C.wood;
  c.fillRect(left, 410, right - left, 515 - 410);
  c.fillStyle = C.woodDark;
  c.fillRect(left, 410, right - left, 6);

  // エルフィンのほっぺは、ゲームと同じもちほっぺの変形で引っぱった形にする
  const mochi = new MochiBody();
  mochi.grab(1, { x: -40, y: 30 });
  mochi.pinch.move(1, { x: -120, y: 52 });
  for (let i = 0; i < 40; i++) mochi.update(1 / 60);
  mochi.draw(c, ELFIN, 112, 300, 54, { expr: 'pinched', t: 0, turn: -1 });
  drawChibi(c, KOMI, 252, 322, 44, { expr: 'sleep', t: 0, turn: 1 });
  drawChibi(c, BUTTER, 548, 322, 44, { expr: 'happy', t: 0, turn: -1 });
  drawChibi(c, NELL, 690, 300, 54, { expr: 'smile', t: 0, turn: -1 });
  drawChibi(c, ESHUR, 400, 268, 74, { expr: 'happy', t: 0 });
  // スピキはタイトルと同じく、エシュールの右の足もとにしゃがむ
  drawChibi(c, SPEAKI, 466, 414 - feetR(SPEAKI) * 27, 27, { expr: 'happy', t: 0, turn: -1 });

  // カウンターの上のパン
  const breads = ['croissant', 'melon', 'shokupan', 'cornet', 'roll'] as const;
  breads.forEach((b, i) => drawBread(c, b, 120 + i * 140, 452, 96, dpr * 2 * S));
  if (OG) {
    drawBread(c, 'anpan', -20, 452, 96, dpr * 2 * S);
    drawBread(c, 'curry', 820, 452, 96, dpr * 2 * S);
  }

  // タイトル（赤茶の外フチ + 白フチ + コーラル→黄→空色）
  logo('エシュールの', 400, 46, 44);
  logo('パン屋さん', 400, 108, 76);
  logo('★', 190, 40, 34, '#feb44d');
  logo('★', 612, 128, 30, '#feb44d');
}

function logo(text: string, x: number, y: number, size: number, solid?: string): void {
  c.font = font(size);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.save();
  c.translate(0, 5);
  c.lineWidth = size * 0.36;
  c.strokeStyle = 'rgba(40, 20, 6, 0.35)';
  c.strokeText(text, x, y);
  c.restore();
  c.lineWidth = size * 0.36;
  c.strokeStyle = '#6b4b3a';
  c.strokeText(text, x, y);
  c.lineWidth = size * 0.2;
  c.strokeStyle = '#ffffff';
  c.strokeText(text, x, y);
  const w = c.measureText(text).width;
  const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  for (const [at, col] of [[0, '#fe6a7e'], [0.32, '#ffa651'], [0.52, '#ffd84a'], [0.75, '#8fd0ec'], [1, '#17aade']] as const) g.addColorStop(at, col);
  c.fillStyle = solid ?? g;
  c.fillText(text, x, y);
}

void draw();
