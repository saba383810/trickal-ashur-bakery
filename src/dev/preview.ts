// 開発用: キャラとパンの見た目を一覧で確認する（本番ビルドには含めない）
import { BREADS, type BreadId } from '../config/breads';
import { drawBread } from '../view/draw/breads';
import { FEET_R, drawChibi, feetR, type Expr } from '../view/draw/chibi';
import { BUTTER, ELFIN, ESHUR, KOMI, NELL, SPEAKI, villager } from '../view/draw/characters';
import { MochiBody } from '../mochi/body';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const W = 1400;
const H = 1260;
const dpr = window.devicePixelRatio || 1;
canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const ctx = canvas.getContext('2d')!;
ctx.scale(dpr, dpr);

// ?mochi ならドラッグでほっぺを引っぱれる（もちほっぺの手触りの確認用）
if (location.search.includes('mochi')) {
  const cast = [ESHUR, ELFIN, NELL, KOMI, BUTTER, SPEAKI, villager(3 * 7919 + 13)].map((spec, i) => ({ spec, body: new MochiBody(), x: 110 + i * 196, y: 420, r: 72 }));
  const at = (e: PointerEvent) => ({ x: e.offsetX, y: e.offsetY });
  canvas.addEventListener('pointerdown', (e) => {
    const p = at(e);
    const c = cast.find((c) => Math.abs(p.x - c.x) < c.r * 1.4 && Math.abs(p.y - c.y) < c.r * 1.2);
    if (c && c.body.grab(e.pointerId, MochiBody.toLocal(p, c.x, c.y, c.r))) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    for (const c of cast) c.body.pinch.move(e.pointerId, MochiBody.toLocal(at(e), c.x, c.y, c.r));
  });
  canvas.addEventListener('pointerup', (e) => {
    for (const c of cast) c.body.pinch.release(e.pointerId);
  });
  let last = performance.now();
  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    ctx.fillStyle = '#fdf0dc';
    ctx.fillRect(0, 0, W, H);
    for (const c of cast) {
      c.body.update(dt);
      c.body.draw(ctx, c.spec, c.x, c.y, c.r, { expr: c.body.pinch.held ? 'pinched' : 'normal', t: now / 1000, turn: c.x < W / 2 ? 1 : -1 });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
} else if (location.search.includes('pull')) {
  // 上の段: ほっぺを引っぱっている最中（左右交互）、下の段: 離して 0.1 秒後の髪の揺れ
  [ESHUR, ELFIN, NELL, KOMI, BUTTER, SPEAKI].forEach((spec, i) => {
    const side = i % 2 ? -1 : 1;
    const turn = side as -1 | 1;
    const x = 125 + i * 230;
    const held = new MochiBody();
    held.grab(1, { x: side * 40, y: 30 });
    held.pinch.move(1, { x: side * 110, y: 20 });
    for (let f = 0; f < 40; f++) held.update(1 / 60);
    held.draw(ctx, spec, x, 300 + (FEET_R - feetR(spec)) * 92, 92, { expr: 'pinched', t: 0.3, turn });
    const swing = new MochiBody();
    swing.grab(1, { x: side * 40, y: 30 });
    swing.pinch.move(1, { x: side * 110, y: 20 });
    for (let f = 0; f < 40; f++) swing.update(1 / 60);
    swing.pinch.release(1);
    for (let f = 0; f < 6; f++) swing.update(1 / 60);
    swing.draw(ctx, spec, x, 820 + (FEET_R - feetR(spec)) * 92, 92, { expr: 'normal', t: 0.3, turn });
  });
} else if (location.search.includes('sway')) {
  // 髪を揺らしきった形（上の段: 右へ、下の段: 左へ。モブはツインテール・ポニーテールも）
  const cast = [ESHUR, ELFIN, NELL, KOMI, BUTTER, SPEAKI];
  for (const [row, sway] of [[0, 10], [1, -10]]) {
    cast.forEach((spec, i) => drawChibi(ctx, spec, 125 + i * 230, 260 + row * 330 + (FEET_R - feetR(spec)) * 80, 80, { expr: 'normal', t: 0.3, sway }));
  }
  [3, 1, 5, 9, 4, 7].forEach((seed, i) => drawChibi(ctx, villager(seed * 7919 + 13), 125 + i * 230, 1000, 70, { expr: 'normal', t: 0, sway: i % 2 ? -10 : 10 }));
} else if (location.search.includes('big')) {
  // 足の裏をそろえる（しゃがんだスピキは頭が低い）
  [ESHUR, ELFIN, NELL, KOMI, BUTTER, SPEAKI].forEach((spec, i) =>
    drawChibi(ctx, spec, 125 + i * 230, 330 + (FEET_R - feetR(spec)) * 92, 92, { expr: 'normal', t: 0.3, prop: true, turn: i % 2 ? -1 : 1 }),
  );
  const mobExprs: Expr[] = ['normal', 'happy', 'worried', 'normal'];
  [3, 1, 5, 9].forEach((seed, i) => drawChibi(ctx, villager(seed * 7919 + 13), 190 + i * 340, 870, 105, { expr: mobExprs[i], t: 0, turn: i % 2 ? -1 : 1 }));
} else {
  // 立ち絵（持ち物つき）・ほっぺを引っぱった顔・顔アイコン
  // 表情の一覧（6 人 × 12 表情）
  const exprs: Expr[] = ['normal', 'happy', 'smile', 'angry', 'worried', 'munch', 'surprised', 'sulk', 'dizzy', 'stern', 'sleep', 'pinched'];
  [ESHUR, ELFIN, NELL, KOMI, BUTTER, SPEAKI].forEach((spec, row) => {
    exprs.forEach((expr, i) => {
      drawChibi(ctx, spec, 60 + i * 112, 80 + row * 140, 30, { expr, t: 0.3 });
    });
  });
  const mobExprs: Expr[] = ['normal', 'happy', 'normal', 'worried', 'normal', 'angry', 'normal', 'surprised', 'happy', 'normal'];
  for (let i = 0; i < 10; i++) {
    drawChibi(ctx, villager(i * 7919 + 13), 70 + i * 130, 980, 42, { expr: mobExprs[i], t: 0, turn: i % 2 ? -1 : 1 });
  }
  (Object.keys(BREADS) as BreadId[]).forEach((id, i) => drawBread(ctx, id, 200 + i * 130, 1190, 80, dpr));
}
