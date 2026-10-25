import type { Sound } from '../audio/sound';
import type { BreadId } from '../config/breads';
import { num } from '../i18n';
import { MochiBody } from '../mochi/body';
import { drawBread } from '../view/draw/breads';
import { drawBurumiIcon } from '../view/draw/burumi';
import { drawChibi, feetR, type ChibiPose, type ChibiSpec, type Expr } from '../view/draw/chibi';
import { renderRatio } from '../view/screen';

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
  return renderRatio();
}

/** キャラの絵の枠（size = 頭の半径 px）。w = 幅、top = 頭の中心の高さ、ht = 高さ */
function chibiBox(spec: ChibiSpec, size: number, body: boolean): { w: number; top: number; ht: number } {
  const top = size * 1.85;
  return { w: size * 3.7, top, ht: top + (body ? size * (feetR(spec) + 0.1) : size * 1.25) };
}

/** キャラの絵を canvas 要素として作る（size = 頭の半径 px） */
export function chibiCanvas(spec: ChibiSpec, expr: Expr, size: number, opts: { body?: boolean; flip?: boolean } = {}): HTMLCanvasElement {
  const body = opts.body !== false;
  const { w, top, ht } = chibiBox(spec, size, body);
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
  const { w, top, ht } = chibiBox(spec, size, body);
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
    const pose: ChibiPose = { expr: mochi.pinch.held ? 'pinched' : expr, t: 0.4, body };
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
    wrap.style.zIndex = '';
  };
  const tick = (t: number) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 1 / 60;
    last = t;
    mochi.update(dt);
    if (!mochi.active || !wrap.isConnected) {
      mochi.reset();
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
  // ボタンの中のキャラ（モード選択）は、引っぱったあとに離してもボタンを押したことにしない
  let start: { x: number; y: number } | null = null;
  let pulled = false;
  wrap.addEventListener('pointerdown', (e) => {
    if (e.isTrusted && passDown(wrap, base, e)) return;
    if (!mochi.grab(e.pointerId, local(e))) return;
    e.preventDefault();
    wrap.setPointerCapture(e.pointerId);
    // 重ねて並べたキャラの上へ、伸びたほっぺを出す
    wrap.style.zIndex = '2';
    start = { x: e.clientX, y: e.clientY };
    pulled = false;
    opts.sound?.mochiGrab();
    draw();
    base.style.visibility = 'hidden';
    if (!raf) raf = requestAnimationFrame(tick);
  });
  wrap.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) pulled = true;
    mochi.pinch.move(e.pointerId, local(e));
  });
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
  wrap.addEventListener(
    'click',
    (e) => {
      if (!pulled) return;
      pulled = false;
      e.preventDefault();
      e.stopPropagation();
    },
    { capture: true },
  );
  return wrap;
}

/**
 * 絵の透明な所を押されて、その下に別のキャラが重なっていたら、そちらへ押したことを渡す。
 * 下に何もなければ渡さない（絵の少し外を押しても、今までどおりそのキャラをつまめる）
 */
function passDown(wrap: HTMLElement, base: HTMLCanvasElement, e: PointerEvent): boolean {
  const r = base.getBoundingClientRect();
  const px = Math.floor(((e.clientX - r.left) / r.width) * base.width);
  const py = Math.floor(((e.clientY - r.top) / r.height) * base.height);
  // 枠の外は読まない（Chrome は枠の外を透明で返さないことがある）
  const x0 = Math.max(0, px - 4);
  const y0 = Math.max(0, py - 4);
  const x1 = Math.min(base.width, px + 5);
  const y1 = Math.min(base.height, py + 5);
  if (x1 <= x0 || y1 <= y0) return false;
  const near = base.getContext('2d')!.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  for (let i = 3; i < near.length; i += 4) if (near[i] > 0) return false;
  const below = document
    .elementsFromPoint(e.clientX, e.clientY)
    .map((el) => el.closest('.mochi'))
    .find((m) => m && m !== wrap);
  if (!below) return false;
  if (!below.dispatchEvent(new PointerEvent('pointerdown', e))) e.preventDefault();
  return true;
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

/** メニューに出すブルミ（ガラスに張り付いていない顔） */
export function burumiCanvas(size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const k = dpr();
  cv.width = Math.ceil(size * k);
  cv.height = Math.ceil(size * k);
  cv.style.width = `${size}px`;
  cv.style.height = `${size}px`;
  cv.className = 'chibi';
  const c = cv.getContext('2d')!;
  c.scale(k, k);
  drawBurumiIcon(c, size / 2, size / 2, size);
  return cv;
}

export function starsText(n: number, max = 3): HTMLElement {
  const wrap = h('span', { class: 'stars', 'aria-label': `★${n}` });
  for (let i = 0; i < max; i++) wrap.append(h('span', { class: i < n ? 'star on' : 'star' }, '★'));
  return wrap;
}

export function yen(n: number): string {
  return `${num(n)} G`;
}

