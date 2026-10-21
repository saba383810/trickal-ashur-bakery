// 開発用: キャラとパンの見た目を一覧で確認する（本番ビルドには含めない）
import { BREADS, type BreadId } from '../config/breads';
import { drawBread } from '../view/draw/breads';
import { drawChibi, type Expr } from '../view/draw/chibi';
import { BUTTER, ELFIN, ESHUR, KOMI, NELL, villager } from '../view/draw/characters';
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
  const cast = [ESHUR, ELFIN, NELL, KOMI, BUTTER, villager(3 * 7919 + 13)].map((spec, i) => ({ spec, body: new MochiBody(), x: 130 + i * 228, y: 420, r: 80 }));
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
      c.body.draw(ctx, c.spec, c.x, c.y, c.r, { expr: c.body.pinch.held ? 'surprised' : 'normal', t: now / 1000, turn: c.x < W / 2 ? 1 : -1 });
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
} else if (location.search.includes('big')) {
  [ESHUR, ELFIN, NELL, KOMI, BUTTER].forEach((spec, i) => drawChibi(ctx, spec, 150 + i * 275, 330, 105, { expr: 'normal', t: 0.3, prop: true, turn: i % 2 ? -1 : 1 }));
  const mobExprs: Expr[] = ['normal', 'happy', 'worried', 'normal'];
  [3, 1, 5, 9].forEach((seed, i) => drawChibi(ctx, villager(seed * 7919 + 13), 190 + i * 340, 870, 105, { expr: mobExprs[i], t: 0, turn: i % 2 ? -1 : 1 }));
} else {
  // 立ち絵（持ち物つき）・ほっぺを引っぱった顔・顔アイコン
  // 表情の一覧（5 人 × 11 表情）
  const exprs: Expr[] = ['normal', 'happy', 'smile', 'angry', 'worried', 'munch', 'surprised', 'sulk', 'dizzy', 'stern', 'sleep'];
  [ESHUR, ELFIN, NELL, KOMI, BUTTER].forEach((spec, row) => {
    exprs.forEach((expr, i) => {
      drawChibi(ctx, spec, 60 + i * 125, 90 + row * 165, 34, { expr, t: 0.3 });
    });
  });
  const mobExprs: Expr[] = ['normal', 'happy', 'normal', 'worried', 'normal', 'angry', 'normal', 'surprised', 'happy', 'normal'];
  for (let i = 0; i < 10; i++) {
    drawChibi(ctx, villager(i * 7919 + 13), 70 + i * 130, 980, 42, { expr: mobExprs[i], t: 0, turn: i % 2 ? -1 : 1 });
  }
  (Object.keys(BREADS) as BreadId[]).forEach((id, i) => drawBread(ctx, id, 200 + i * 130, 1190, 80, dpr));
}
