import type { Sound } from '../audio/sound';
import type { BreadId } from '../config/breads';
import { MochiBody } from '../mochi/body';
import { drawBread } from '../view/draw/breads';
import { FEET_R, drawChibi, type ChibiPose, type ChibiSpec, type Expr } from '../view/draw/chibi';

type Child = Node | string | null | undefined | false;

/** 小さな DOM ビルダー */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v);
    else if (k === 'class') el.className = String(v);
    else if (typeof v === 'boolean') {
      if (v) el.setAttribute(k, '');
    } else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
  return el;
}

function dpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/** キャラの絵の枠（size = 頭の半径 px）。w = 幅、top = 頭の中心の高さ、ht = 高さ */
function chibiBox(size: number, body: boolean): { w: number; top: number; ht: number } {
  const top = size * 1.85;
  return { w: size * 3.7, top, ht: top + (body ? size * (FEET_R + 0.1) : size * 1.25) };
}

/** キャラの絵を canvas 要素として作る（size = 頭の半径 px） */
export function chibiCanvas(spec: ChibiSpec, expr: Expr, size: number, opts: { body?: boolean; flip?: boolean } = {}): HTMLCanvasElement {
  const body = opts.body !== false;
  const { w, top, ht } = chibiBox(size, body);
  const cv = document.createElement('canvas');
  const k = dpr();
  cv.width = Math.ceil(w * k);
  cv.height = Math.ceil(ht * k);
  cv.style.width = `${w}px`;
  cv.style.height = `${ht}px`;
  cv.className = 'chibi';
  const c = cv.getContext('2d')!;
  c.scale(k, k);
  if (opts.flip) {
    c.translate(w, 0);
    c.scale(-1, 1);
  }
  drawChibi(c, spec, w / 2, top, size, { expr, t: 0.4, body });
  return cv;
}

/**
 * ほっぺを引っぱれるキャラ。chibiCanvas と同じ大きさで並び、つまんでいる間と揺れている間だけ、
 * 絵を隠して上に重ねた大きめの canvas へ変形した絵を描く（伸びた分は枠の外へはみ出す）
 */
export function mochiChibi(
  spec: ChibiSpec,
  expr: Expr,
  size: number,
  opts: { body?: boolean; flip?: boolean; sound?: Sound } = {},
): HTMLElement {
  const body = opts.body !== false;
  const base = chibiCanvas(spec, expr, size, opts);
  const { w, top, ht } = chibiBox(size, body);
  const flip = opts.flip ? -1 : 1;
  const mochi = new MochiBody();
  const m = (mochi.pinch.lmax * 1.25 * size) / 50;
  const over = document.createElement('canvas');
  over.className = 'chibi mochi-over';
  // 置き場所ごとの canvas の大きさ指定（!important）より強く、絵の枠に合わせる
  const place = (k: string, v: number) => over.style.setProperty(k, `${v * 100}%`, 'important');
  place('left', -m / w);
  place('top', -m / ht);
  place('width', (w + 2 * m) / w);
  place('height', (ht + 2 * m) / ht);
  const wrap = h('span', { class: 'mochi' }, base, over);

  const shown = () => base.getBoundingClientRect().height / ht || 1;
  const local = (e: PointerEvent) => {
    const r = base.getBoundingClientRect();
    const s = shown();
    return MochiBody.toLocal({ x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }, w / 2, top, size, flip);
  };
  const draw = () => {
    const k = dpr() * shown();
    const pw = Math.ceil((w + 2 * m) * k);
    const ph = Math.ceil((ht + 2 * m) * k);
    if (over.width !== pw || over.height !== ph) {
      over.width = pw;
      over.height = ph;
    }
    const c = over.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, pw, ph);
    c.setTransform(k, 0, 0, k, k * m, k * m);
    if (flip < 0) {
      c.translate(w, 0);
      c.scale(-1, 1);
    }
    const pose: ChibiPose = { expr: mochi.pinch.held ? 'surprised' : expr, t: 0.4, body };
    mochi.draw(c, spec, w / 2, top, size, pose);
  };
  let raf = 0;
  let last = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    over.getContext('2d')!.clearRect(0, 0, over.width, over.height);
    base.style.visibility = '';
  };
  const tick = (t: number) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    mochi.update(dt);
    if (!mochi.pinch.active || !wrap.isConnected) {
      mochi.pinch.reset();
      stop();
      return;
    }
    draw();
    raf = requestAnimationFrame(tick);
  };
  const end = (e: PointerEvent) => {
    const g = mochi.pinch.find(e.pointerId);
    if (!g) return;
    opts.sound?.mochiRelease(mochi.pinch.intensity(g), mochi.pinch.params.releaseFreq);
    mochi.pinch.release(e.pointerId);
  };
  wrap.addEventListener('pointerdown', (e) => {
    if (!mochi.grab(e.pointerId, local(e))) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    opts.sound?.mochiGrab();
    draw();
    base.style.visibility = 'hidden';
    if (!raf) raf = requestAnimationFrame(tick);
  });
  wrap.addEventListener('pointermove', (e) => mochi.pinch.move(e.pointerId, local(e)));
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  return wrap;
}

export function breadCanvas(id: BreadId, size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const k = dpr();
  cv.width = Math.ceil(size * k);
  cv.height = Math.ceil(size * k);
  cv.style.width = `${size}px`;
  cv.style.height = `${size}px`;
  cv.className = 'bread';
  const c = cv.getContext('2d')!;
  c.scale(k, k);
  drawBread(c, id, size / 2, size / 2, size * 0.9, k);
  return cv;
}

export function starsText(n: number, max = 3): HTMLElement {
  const wrap = h('span', { class: 'stars', 'aria-label': `★${n}` });
  for (let i = 0; i < max; i++) wrap.append(h('span', { class: i < n ? 'star on' : 'star' }, '★'));
  return wrap;
}

export function yen(n: number): string {
  return `${Math.round(n).toLocaleString('ja-JP')} G`;
}

export const DISCLAIMER =
  '本作は『トリッカル・もちもちほっぺ大作戦』の非公式ファンゲームです。公式とは関係ありません。原作に関する権利は各権利者に帰属します。';
