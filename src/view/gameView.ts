import type { Bgm } from '../audio/bgm';
import type { Sound } from '../audio/sound';
import { BALANCE } from '../config/balance';
import { BREADS, type BreadId } from '../config/breads';
import { num, T } from '../i18n';
import type { GameEvent } from '../sim/events';
import { enterTimeOf, leaveTimeOf, type Customer, type ElfinState, type World } from '../sim/world';
import { drawBread } from './draw/breads';
import { MochiBody } from '../mochi/body';
import { BUTTER, ELFIN, KOMI, NELL, SPEAKI, villager } from './draw/characters';
import { FEET_R, type ChibiPose, type ChibiSpec, type Expr } from './draw/chibi';
import { burumiCenter, drawBurumi } from './draw/burumi';
import { bubbleSize, drawBubble, drawOven, drawSlot, drawTray } from './draw/props';
import { SceneCache } from './draw/scene';
import { clock, coin, keycap, outlined, roundRect, star } from './draw/ui';
import { Effects } from './effects';
import { center, inside, makeLayout, type Layout, type Point, type Rect } from './layout';
import { C, font } from './palette';
import { RainbowParade } from './rainbow';
import type { Screen } from './screen';
import { Spring } from './spring';

export type Action =
  | { type: 'pick'; bread: BreadId }
  | { type: 'return'; index: number }
  | { type: 'serve'; customerId: number }
  | { type: 'ovenOpen'; oven: number }
  | { type: 'bake'; oven: number; bread: BreadId }
  | { type: 'ovenTap'; oven: number }
  | { type: 'pinch'; customerId: number }
  | { type: 'burumi' };

interface CustView {
  spec: ChibiSpec;
  body: MochiBody;
  blinkAt: number;
  wobble: Spring;
  bump: number;
  bubble: Rect | null;
}

interface Banner {
  id: number;
  text: string;
  sub?: string;
  color: string;
  t: number;
  dur: number;
  big?: boolean;
  face?: Face;
}

type Face = 'nell' | 'elfin' | 'komi' | 'butter' | 'speaki';
const FACES: Record<Face, ChibiSpec> = { nell: NELL, elfin: ELFIN, komi: KOMI, butter: BUTTER, speaki: SPEAKI };

function bannerFaceKey(b: Banner): string {
  return `banner-${b.id}`;
}

interface Say {
  key: string;
  text: string;
  t: number;
  dur: number;
  at: () => Point | null;
  color: string;
}

/** HUD・お知らせ・チュートリアルの吹き出しの顔。どれもほっぺを引っぱれる（見た目だけで、ゲームには効かない） */
interface DecoFace {
  body: MochiBody;
  /** 最後に描いた頭の中心と半径 */
  x: number;
  y: number;
  r: number;
  /** 最後に描いた render の番号。今の絵に出ていない顔はつまめない */
  frame: number;
  /** その render で描いた順。重なっていたら後から描いた（上の）顔をつまむ */
  z: number;
  grab: { id: number; start: Point; moved: boolean; onTap: (() => void) | null } | null;
}

const SEAT_KEYS = ['A', 'S', 'D', 'F'];
const OVEN_KEYS = ['Z', 'X', 'C'];
/** 窓のブルミをタップするキー */
const BURUMI_KEY = 'B';
/** Shift + 席のキーでほっぺを引っぱるときの、仮の指の id */
const KEY_POINTER = -1;
/** 客を押してからこれ以上動かしたら、渡すのではなくほっぺを引っぱる */
const DRAG_START = 14;
/** バターの石がエルフィンに届くまでの秒数 */
const SHOT_TIME = 0.28;

export class GameView {
  L: Layout;
  readonly fx = new Effects();
  private scene = new SceneCache();
  private custViews = new Map<number, CustView>();
  /** エルフィンはつまめない（指は素通りして、下の客・ショーケース・トレーに届く）。body は髪の揺れだけに使う */
  private elfin = {
    x: -100,
    y: 0,
    dir: 1,
    body: new MochiBody(),
    /** 跳ねていない時の頭の高さ（影はここに落とす） */
    ground: 0,
    /** 前のフレームの sim の状態（帰りはじめを見つける） */
    state: 'absent' as ElfinState,
    /** 帰りはじめた位置（ここから入口へ走る） */
    leaveFrom: { x: 0, y: 0 } as Point,
    /** 帰りはじめるまでその場で固まる秒数（バターの石が当たるまで） */
    leaveDelay: 0,
    /** バターの石がまだ当たっていない（当たった瞬間に音と台詞を出す） */
    hitPending: false,
    /** 帰るときの顔（パンを抱えて / むくれて / 撃たれて / 逃げ出して） */
    leaveExpr: 'happy' as Expr,
    /** 前のフレームの横の速さ（描く向きに合わせた頭の単位 / 秒。髪の揺れに使う） */
    hairVx: 0,
  };
  /**
   * 客を押している指。動かしたらほっぺを引っぱる（pinching）、動かさずに離したら渡す。
   * free は渡せない客（来店中・帰り際・説明中）を押したとき: 引っぱっても効果はなく、動かさずに離したら free を呼ぶ
   */
  private press: { id: number; customerId: number; start: Point; pinching: boolean; free: (() => void) | null } | null = null;
  private faces = new Map<string, DecoFace>();
  private frame = 0;
  private faceZ = 0;
  private bannerSeq = 0;
  /** バターのパチンコの石（t = 経過秒） */
  private shots: { from: Point; t: number }[] = [];
  private seen = new Set<string>();
  /** エンドレスのレベルが上がった直後のはずみ */
  private levelBump = 0;
  private picker: { oven: number; t: number; rect: Rect; items: { bread: BreadId; rect: Rect }[] } | null = null;
  private hover: Point | null = null;
  keyMode = false;
  /** 設定でキーのヒントを切っていれば false */
  keyHints = true;
  private slotFlash: number[] = [];
  private slotPop: number[] = [];
  private trayPulse = 0;
  private banners: Banner[] = [];
  private says: Say[] = [];
  private shownSales = 0;
  private salesBump = 0;
  private tabBump = 0;
  /** 最後に描いた HUD のツケの枠（チュートリアルの指さし用） */
  private tabPill: Rect | null = null;
  private lastCombo = 0;
  /** フィーバーのゲージが進んだ直後のはずみ */
  private feverBump = 0;
  private rainbow = new RainbowParade();
  private time = 0;
  private lastTick = -1;

  /** チュートリアルが操作を絞るためのフック */
  guard: ((a: Action) => boolean) | null = null;
  onAction: ((a: Action) => void) | null = null;
  onPause: (() => void) | null = null;
  /** チュートリアルのオーバーレイ */
  overlay: ((c: CanvasRenderingContext2D) => void) | null = null;
  inputEnabled = true;

  constructor(
    public world: World,
    private screen: Screen,
    private sound: Sound,
    private bgm: Bgm,
  ) {
    this.L = makeLayout(screen.w, screen.h, screen.portrait, world.stage);
    this.fx.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rainbow.reduced = this.fx.reduced;
    this.shownSales = world.sales;
  }

  /** Web フォントが読み込まれたら、文字を含む背景を描き直す */
  invalidateScene(): void {
    this.scene.invalidate();
  }

  relayout(): void {
    this.L = makeLayout(this.screen.w, this.screen.h, this.screen.portrait, this.world.stage);
    this.picker = null;
  }

  // ===================================================================== input

  private act(a: Action): boolean {
    if (!this.inputEnabled || this.world.phase !== 'playing') return false;
    if (this.guard && !this.guard(a)) return false;
    const w = this.world;
    let ok = false;
    switch (a.type) {
      case 'pick':
        ok = w.pickBread(a.bread);
        break;
      case 'return':
        ok = w.returnTray(a.index);
        break;
      case 'serve':
        ok = w.serve(a.customerId) !== 'none';
        break;
      case 'ovenOpen':
        this.openPicker(a.oven);
        ok = true;
        break;
      case 'bake':
        ok = w.bake(a.oven, a.bread);
        this.picker = null;
        break;
      case 'ovenTap':
        ok = w.tapOven(a.oven);
        break;
      case 'pinch':
        ok = w.pinchCustomer(a.customerId) !== 'none';
        break;
      case 'burumi':
        ok = w.tapBurumi();
        break;
    }
    if (ok) this.onAction?.(a);
    return ok;
  }

  pointerDown(id: number, p: Point): void {
    this.hover = p;
    if (inside(this.L.pauseBtn, p, 8)) {
      this.onPause?.();
      return;
    }
    if (!this.inputEnabled) return;

    if (this.picker) {
      const item = this.picker.items.find((it) => inside(it.rect, p));
      if (item) this.act({ type: 'bake', oven: this.picker.oven, bread: item.bread });
      else if (!inside(this.picker.rect, p)) this.picker = null;
      return;
    }

    // エルフィンは調べない（駆け抜けるだけなので、重なっていても下のショーケースや客に届く）
    const L = this.L;
    const w = this.world;
    // 窓のブルミ（窓のどこを押してもよい）
    if (this.burumiTappable() && inside(L.windows[w.burumi.window], p, 8) && this.act({ type: 'burumi' })) return;
    const trayIdx = L.traySlots.findIndex((r) => inside(r, p, 4));
    if (trayIdx >= 0 && w.tray[trayIdx]) {
      this.act({ type: 'return', index: trayIdx });
      return;
    }
    const slotIdx = L.slots.findIndex((r) => inside(r, p));
    if (slotIdx >= 0) {
      this.act({ type: 'pick', bread: w.stage.breads[slotIdx] });
      return;
    }
    const cust = this.customerAt(p);
    if (cust) {
      // 吹き出しは押した瞬間に渡す。体は、動かさずに離したら渡し、動かしたらほっぺを引っぱる
      const b = this.custViews.get(cust.id)?.bubble;
      if ((b && inside(b, p, 6)) || this.press) this.act({ type: 'serve', customerId: cust.id });
      else this.press = { id, customerId: cust.id, start: p, pinching: false, free: null };
      return;
    }
    if (this.pressFace(id, p, () => {})) return;
    const ovenIdx = L.ovens.findIndex((r) => inside(r, p));
    if (ovenIdx >= 0) this.tapOven(ovenIdx);
  }

  pointerMove(id: number, p: Point): void {
    this.hover = p;
    for (const f of this.faces.values()) {
      if (f.grab?.id !== id) continue;
      if (Math.hypot(p.x - f.grab.start.x, p.y - f.grab.start.y) > DRAG_START) f.grab.moved = true;
      f.body.pinch.move(id, MochiBody.toLocal(p, f.x, f.y, f.r));
    }
    const pr = this.press;
    if (pr?.id !== id) return;
    const c = this.world.customers.find((x) => x.id === pr.customerId);
    if (!c || (c.state !== 'waiting' && !pr.free)) return;
    const body = this.custView(c).body;
    const h = this.custHead(c);
    if (!pr.pinching && Math.hypot(p.x - pr.start.x, p.y - pr.start.y) > DRAG_START) {
      if (!body.grab(id, MochiBody.toLocal(pr.start, h.x, h.y, this.L.headR))) return;
      pr.pinching = true;
      this.sound.mochiGrab();
    }
    if (pr.pinching) body.pinch.move(id, MochiBody.toLocal(p, h.x, h.y, this.L.headR));
  }

  /** touch = マウス以外。指を離したらホバー表示を消す */
  pointerUp(id: number, touch: boolean): void {
    if (touch) this.hover = null;
    if (this.press?.id === id) this.releasePress(false);
    this.releaseFace(id, false);
  }

  /** OS のジェスチャー等で指が奪われた。引っぱりは無効にする */
  pointerCancel(id: number): void {
    this.hover = null;
    if (this.press?.id === id) this.releasePress(true);
    this.releaseFace(id, true);
  }

  /**
   * HUD・お知らせ・吹き出しの顔をつまむ（つまめたら true）。
   * 動かさずに離したら onTap を呼ぶ（チュートリアルの説明は、顔をタップしても読み進められる）
   */
  grabFace(id: number, p: Point, onTap: (() => void) | null = null): boolean {
    let hit: DecoFace | null = null;
    for (const f of this.faces.values()) {
      if (f.frame !== this.frame || f.grab) continue;
      if (Math.hypot(p.x - f.x, p.y - f.y) > Math.max(f.r * 1.2, 24)) continue;
      if (!hit || f.z > hit.z) hit = f;
    }
    if (!hit || !hit.body.grab(id, MochiBody.toLocal(p, hit.x, hit.y, hit.r))) return false;
    hit.grab = { id, start: p, moved: false, onTap };
    this.sound.mochiGrab();
    return true;
  }

  private releaseFace(id: number, cancel: boolean): void {
    for (const f of this.faces.values()) {
      const gr = f.grab;
      if (gr?.id !== id) continue;
      f.grab = null;
      const g = f.body.pinch.release(id);
      const stretch = g ? f.body.pinch.intensity(g) : 0;
      if (stretch > 0.05) this.sound.mochiRelease(stretch, f.body.pinch.params.releaseFreq);
      if (!cancel && !gr.moved) gr.onTap?.();
    }
  }

  /**
   * 渡せない客の顔を押した（来店中・帰り際、チュートリアルの説明中）。押せたら true。
   * 動かしたらほっぺを引っぱるだけ、動かさずに離したら onTap
   */
  pressFace(id: number, p: Point, onTap: () => void): boolean {
    if (this.press) return false;
    const r = this.L.headR;
    const c = this.world.customers.find((cu) => {
      const h = this.custHead(cu);
      return Math.hypot(p.x - h.x, p.y - h.y) < r * 1.3;
    });
    if (!c) return false;
    this.press = { id, customerId: c.id, start: p, pinching: false, free: onTap };
    return true;
  }

  /** 客を押していた指を離した。引っぱっていればほっぺを離し、引っぱっていなければ渡す */
  private releasePress(cancel: boolean): void {
    const pr = this.press!;
    this.press = null;
    const c = this.world.customers.find((x) => x.id === pr.customerId);
    if (!pr.pinching) {
      if (cancel) return;
      if (pr.free) pr.free();
      else if (c) this.act({ type: 'serve', customerId: c.id });
      return;
    }
    const body = c ? this.custViews.get(c.id)?.body : undefined;
    if (!body) return;
    const g = body.pinch.find(pr.id);
    const stretch = g ? body.pinch.intensity(g) : 0;
    body.pinch.release(pr.id);
    if (stretch > 0.05) this.sound.mochiRelease(stretch, body.pinch.params.releaseFreq);
    if (!cancel && c && !pr.free && stretch >= BALANCE.pinchStretch) this.act({ type: 'pinch', customerId: c.id });
  }

  clearHover(): void {
    this.hover = null;
  }

  private tapOven(i: number): void {
    const oven = this.world.ovens[i];
    if (!oven) return;
    if (oven.state === 'idle') this.act({ type: 'ovenOpen', oven: i });
    else this.act({ type: 'ovenTap', oven: i });
  }

  keyDown(e: KeyboardEvent): boolean {
    const w = this.world;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    this.keyMode = this.keyHints;
    if (!this.inputEnabled) return false;
    const num = Number(key);
    if (Number.isInteger(num) && num >= 1 && num <= w.stage.breads.length) {
      const bread = w.stage.breads[num - 1];
      if (this.picker) this.act({ type: 'bake', oven: this.picker.oven, bread });
      else this.act({ type: 'pick', bread });
      return true;
    }
    if (key === 'Escape' && this.picker) {
      this.picker = null;
      return true;
    }
    const seat = SEAT_KEYS.indexOf(key);
    if (seat >= 0) {
      const c = w.customers.find((x) => x.seat === seat && x.state === 'waiting');
      if (c && e.shiftKey) {
        // Shift + 席のキー: ほっぺを引っぱって離したことにする
        const body = this.custView(c).body;
        const side = c.seat < w.stage.seats / 2 ? 1 : -1;
        body.grab(KEY_POINTER, { x: side * 40, y: 30 });
        body.pinch.move(KEY_POINTER, { x: side * 100, y: 40 });
        for (let i = 0; i < 10; i++) body.update(1 / 60);
        body.pinch.release(KEY_POINTER);
        this.sound.mochiRelease(0.7, body.pinch.params.releaseFreq);
        this.act({ type: 'pinch', customerId: c.id });
      } else if (c) this.act({ type: 'serve', customerId: c.id });
      return true;
    }
    const oven = OVEN_KEYS.indexOf(key);
    if (oven >= 0) {
      if (this.picker?.oven === oven) this.picker = null;
      else this.tapOven(oven);
      return true;
    }
    if (key === 'Backspace') {
      if (w.tray.length) this.act({ type: 'return', index: w.tray.length - 1 });
      return true;
    }
    if (key.toUpperCase() === BURUMI_KEY) {
      this.act({ type: 'burumi' });
      return true;
    }
    return false;
  }

  /** ポーズした等で、つまんでいるほっぺを強制的に離す（ごきげんの回復にはしない） */
  cancelGrab(): void {
    if (this.press) this.releasePress(true);
    for (const f of this.faces.values()) if (f.grab) this.releaseFace(f.grab.id, true);
  }

  private openPicker(oven: number): void {
    const L = this.L;
    const r = L.ovens[oven];
    const breads = this.world.stage.breads;
    const cols = Math.min(4, breads.length);
    const rows = Math.ceil(breads.length / cols);
    const cw = 92;
    const ch = 100;
    const w = cols * cw + 24;
    const h = rows * ch + 56;
    const x = Math.max(10, Math.min(L.w - w - 10, r.x + r.w / 2 - w / 2));
    const y = Math.max(L.hud.h + 10, r.y - h + 30);
    const items = breads.map((bread, i) => ({
      bread,
      rect: { x: x + 12 + (i % cols) * cw, y: y + 44 + Math.floor(i / cols) * ch, w: cw - 8, h: ch - 8 },
    }));
    this.picker = { oven, t: 0, rect: { x, y, w, h }, items };
  }

  // ================================================================= queries

  private customerAt(p: Point): Customer | null {
    for (const c of this.world.customers) {
      if (c.state !== 'waiting') continue;
      const seat = this.L.seats[c.seat];
      const r = this.L.headR;
      if (Math.hypot(p.x - seat.x, p.y - seat.y) < r * 1.35) return c;
      if (Math.abs(p.x - seat.x) < r * 1.1 && p.y > seat.y && p.y < this.L.counter.y) return c;
      const b = this.custViews.get(c.id)?.bubble;
      if (b && inside(b, p, 6)) return c;
    }
    return null;
  }

  private elfinR(): number {
    return this.L.headR * 0.85;
  }

  private elfinHead(): Point {
    return { x: this.elfin.x, y: this.elfin.y };
  }

  /** エルフィン（頭〜足）の範囲。店にいなければ null */
  elfinRect(): Rect | null {
    if (this.world.elfin.state === 'absent') return null;
    const h = this.elfinHead();
    const r = this.elfinR();
    return { x: h.x - r * 1.3, y: h.y - r * 1.3, w: r * 2.6, h: r * (1.3 + FEET_R) };
  }

  /** 客（頭〜カウンター + 注文の吹き出し）の範囲 */
  customerRect(id: number): Rect | null {
    const c = this.world.customers.find((x) => x.id === id);
    if (!c) return null;
    const s = this.L.seats[c.seat];
    const r = this.L.headR;
    let x0 = s.x - r * 1.3;
    let y0 = s.y - r * 1.4;
    let x1 = s.x + r * 1.3;
    const b = this.custViews.get(id)?.bubble;
    if (b) {
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.w);
    }
    return { x: x0, y: y0, w: x1 - x0, h: this.L.counter.y - y0 };
  }

  pickerRect(): Rect | null {
    return this.picker?.rect ?? null;
  }

  /** HUD のツケの枠 */
  tabRect(): Rect | null {
    return this.tabPill;
  }

  hudSalesPos(): Point {
    return this.L.portrait ? { x: 200, y: 36 } : { x: 222, y: 32 };
  }

  private hudTabPos(): Point {
    return this.L.portrait ? { x: 430, y: 38 } : { x: 600, y: 34 };
  }

  // ==================================================================== update

  update(dt: number): void {
    this.time += dt;
    this.fx.update(dt);
    for (const ev of this.world.drainEvents()) this.onEvent(ev);

    this.slotFlash = this.slotFlash.map((v) => Math.max(0, v - dt * 3));
    this.slotPop = this.slotPop.map((v) => Math.max(0, v - dt * 5));
    this.trayPulse = Math.max(0, this.trayPulse - dt * 5);
    this.salesBump = Math.max(0, this.salesBump - dt * 4);
    this.tabBump = Math.max(0, this.tabBump - dt * 4);
    this.levelBump = Math.max(0, this.levelBump - dt * 3);
    this.feverBump = Math.max(0, this.feverBump - dt * 4);
    this.rainbow.update(dt, this.L, this.world.fever > 0 && this.world.phase === 'playing');
    if (this.picker) this.picker.t += dt;

    const target = this.world.sales;
    this.shownSales += (target - this.shownSales) * Math.min(1, dt * 8);
    if (Math.abs(target - this.shownSales) < 1) this.shownSales = target;

    // 顔をつまんでいる間は、お知らせを消さずに待つ
    for (const b of this.banners) if (!this.faces.get(bannerFaceKey(b))?.grab) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    for (const [key, f] of this.faces) {
      f.body.update(dt);
      if (f.frame === this.frame) continue;
      // 描かれなくなった（お知らせが消えた・ネルの表示が終わった等）
      if (f.grab) f.body.pinch.release(f.grab.id);
      this.faces.delete(key);
    }
    for (const s of this.says) s.t += dt;
    this.says = this.says.filter((s) => s.t < s.dur);

    for (const c of this.world.customers) {
      const v = this.custView(c);
      v.wobble.step(dt);
      v.bump = Math.max(0, v.bump - dt * 4);
      v.body.update(dt);
    }
    // 客が帰った・渡し終えた等で、押していた指の相手がいなくなった
    const pr = this.press;
    if (pr && !this.world.customers.some((c) => c.id === pr.customerId && (pr.free || c.state === 'waiting'))) {
      if (pr.pinching) this.custViews.get(pr.customerId)?.body.pinch.release(pr.id);
      this.press = null;
    }
    for (const sh of this.shots) sh.t += dt;
    this.shots = this.shots.filter((sh) => sh.t < SHOT_TIME);
    for (const id of this.custViews.keys()) {
      if (!this.world.customers.some((c) => c.id === id)) this.custViews.delete(id);
    }

    this.updateElfin(dt);

    // 焼き上がり・焦げのオーブンから湯気と煙
    this.world.ovens.forEach((oven, i) => {
      const r = this.L.ovens[i];
      if (oven.state === 'ready' && Math.random() < dt * 3) this.fx.burst(r.x + r.w / 2, r.y + r.h * 0.5, 'steam', 1, '#ffffff');
      if (oven.state === 'burnt' && Math.random() < dt * 5) this.fx.burst(r.x + r.w / 2, r.y + r.h * 0.45, 'smoke', 1, 'rgba(60,50,50,0.8)');
    });

    const rem = Math.ceil(this.world.remaining);
    if (this.world.phase === 'playing' && !this.world.frozen && rem <= 5 && rem !== this.lastTick && rem > 0) {
      this.lastTick = rem;
      this.sound.tick();
    }
  }

  private updateElfin(dt: number): void {
    const e = this.elfin;
    const w = this.world;
    const we = w.elfin;
    const state = we.state;
    const target = this.elfinTargetPos();
    const door = { x: this.L.elfinDoor.x, y: target.y };
    if (state !== e.state) {
      if (state === 'leaving') e.leaveFrom = { x: e.x, y: e.ground };
      e.state = state;
    }
    e.body.update(dt);

    const prevX = e.x;
    // 駆けている間は小刻みに跳ねる
    const hop = (h: number) => Math.abs(Math.sin(this.time * 16)) * h;
    switch (state) {
      case 'absent':
        e.x = door.x;
        e.ground = e.y = door.y;
        break;
      case 'entering': {
        // 勢いよく駆けこんで、ショーケースの前でぴたっと止まる
        const p = we.enter;
        e.x = door.x + (target.x - door.x) * (1 - Math.pow(1 - p, 3));
        e.ground = target.y;
        e.y = e.ground - hop(12) * (1 - p * p);
        break;
      }
      case 'lingering':
      case 'sulking':
        // ほしいパンが売れて変わったら、その棚の前へ寄る
        e.x += (target.x - e.x) * Math.min(1, dt * 10);
        e.ground += (target.y - e.ground) * Math.min(1, dt * 10);
        e.y = e.ground;
        break;
      case 'leaving': {
        // バターの石が当たるまではその場で固まり、当たったら入口へ駆けだす（だんだん速く）
        if (e.hitPending && we.t >= e.leaveDelay) {
          e.hitPending = false;
          this.sound.stun();
          this.fx.burst(e.x, e.y - 10, 'star', 8, C.gold, 220);
          this.fx.addShake(0.2);
          this.say('elfin', T.game.elfinShot, () => this.elfinSayPos(), C.elfin, 1);
        }
        const p = Math.max(0, Math.min(1, (we.t - e.leaveDelay) / (BALANCE.elfin.leaveTime - e.leaveDelay)));
        e.x = e.leaveFrom.x + (door.x - e.leaveFrom.x) * Math.pow(p, 1.6);
        e.ground = e.leaveFrom.y;
        e.y = e.ground - (p > 0 ? hop(12) : 0);
        break;
      }
    }
    const vx = (e.x - prevX) / Math.max(dt, 1e-4);
    if (Math.abs(vx) > 20) e.dir = vx > 0 ? 1 : -1;
    if (state === 'lingering' || state === 'sulking') e.dir = 1;
    // 走り出し・立ち止まりの反動で髪を揺らす（drawElfin の左右反転に合わせる）
    const hairVx = state === 'absent' ? 0 : (vx * e.dir * 50) / this.elfinR();
    e.body.jolt(hairVx - e.hairVx);
    e.hairVx = hairVx;
  }

  private elfinTargetPos(): Point {
    const w = this.world;
    const bread = w.elfinTarget();
    const idx = bread ? w.stage.breads.indexOf(bread) : 0;
    const slot = this.L.slots[Math.max(0, idx)];
    // 足もとが棚の下端に来るように立つ（そのパンの棚をふさぐ）
    return { x: slot.x + slot.w / 2, y: slot.y + slot.h - this.elfinR() * FEET_R - 2 };
  }

  /** 客のほっぺをぷるんとさせ、顔を向けた側（店の真ん中）へ跳ねた反動で髪も揺らす */
  private jiggle(c: Customer, kick: number): void {
    const v = this.custView(c);
    v.wobble.kick(kick);
    v.body.jolt((this.custHead(c).x < this.L.w / 2 ? 1 : -1) * kick * 4);
  }

  private custView(c: Customer): CustView {
    let v = this.custViews.get(c.id);
    if (!v) {
      v = {
        spec: c.kind === 'normal' ? villager(c.look) : FACES[c.kind],
        body: new MochiBody(),
        blinkAt: this.time + 1 + Math.random() * 3,
        wobble: new Spring(300, 6),
        bump: 0,
        bubble: null,
      };
      this.custViews.set(c.id, v);
    }
    return v;
  }

  private custHead(c: Customer): Point {
    const seat = this.L.seats[c.seat];
    if (c.state === 'entering') {
      const p = Math.min(1, c.stateTime / enterTimeOf(c));
      const back = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
      return { x: seat.x, y: seat.y + (1 - back) * 150 };
    }
    if (c.state === 'leaving') {
      const p = Math.min(1, c.stateTime / leaveTimeOf(c));
      if (c.mood === 'angry') return { x: seat.x + Math.sin(p * 40) * 6 * (1 - p), y: seat.y + p * p * 170 };
      return { x: seat.x, y: seat.y - Math.sin(p * Math.PI) * 28 + p * p * 150 };
    }
    return seat;
  }

  // ==================================================================== events

  private onEvent(ev: GameEvent): void {
    const s = this.sound;
    const w = this.world;
    const L = this.L;
    const cust = (id: number) => w.customers.find((c) => c.id === id);
    switch (ev.type) {
      case 'pick': {
        s.pick();
        const i = w.stage.breads.indexOf(ev.bread);
        this.slotPop[i] = 1;
        this.trayPulse = 1;
        break;
      }
      case 'pickFail': {
        s.fail();
        if (ev.reason === 'empty') this.slotFlash[w.stage.breads.indexOf(ev.bread)] = 1;
        else this.flashTrayFull();
        break;
      }
      case 'return':
        s.putBack();
        break;
      case 'customerArrive':
        s.arrive();
        break;
      case 'servePartial': {
        s.partial();
        const c = cust(ev.customerId);
        if (c) {
          this.jiggle(c, 80);
          this.custView(c).bump = 1;
          const h = this.custHead(c);
          this.fx.burst(h.x, h.y - 20, 'star', 6, C.gold, 160);
        }
        break;
      }
      case 'serveWrong':
        s.wrong();
        break;
      case 'serveComplete': {
        s.serve(ev.combo);
        const c = cust(ev.customerId);
        const h = c ? this.custHead(c) : center(L.tray);
        if (c) this.jiggle(c, 120);
        this.fx.burst(h.x, h.y, 'heart', 5, '#f7808c', 140);
        this.fx.coinFly(h, this.hudSalesPos(), 1 + Math.floor(ev.payment.total / 150), () => {
          this.salesBump = 1;
        });
        this.fx.float(`+${ev.payment.total}`, h.x, h.y - 60, w.buff > 0 ? '#bfe3ff' : C.gold, 34);
        if (w.fever > 0) this.fx.burst(h.x, h.y - 20, 'star', 5, `hsl(${(this.time * 300) % 360}, 90%, 65%)`);
        else this.feverBump = 1;
        if (ev.payment.tipRate >= BALANCE.tip.high) this.fx.float(T.game.fast, h.x, h.y - 100, '#ffffff', 22, C.good);
        if (ev.combo >= 2) this.fx.float(T.game.combo(ev.combo), h.x + 60, h.y - 20, '#ffe08a', 22, '#a0461e');
        this.lastCombo = ev.combo;
        break;
      }
      case 'customerMochi': {
        const c = cust(ev.customerId);
        if (c) {
          const v = this.custView(c);
          v.bump = 1;
          const h = this.custHead(c);
          this.fx.burst(h.x, h.y - 20, 'heart', 6, '#f7808c', 150);
          this.fx.float(T.game.happy, h.x, h.y - 80, '#ffffff', 24, C.good);
        }
        break;
      }
      case 'komiArrive':
        s.arrive();
        this.say(`cust:${ev.customerId}`, T.game.komiArrive, () => this.custSayPos(ev.customerId), C.komi, 2.2);
        this.firstTime('komi', T.game.komiTitle, T.game.komiHint, C.komi);
        break;
      case 'komiSleep':
        this.say(`cust:${ev.customerId}`, ev.again ? T.game.komiSleepAgain : T.game.komiSleep, () => this.custSayPos(ev.customerId), C.komi, 1.4);
        if (!ev.again) {
          s.wrong();
          const c = cust(ev.customerId);
          if (c) this.fx.float(T.game.komiHint, this.custHead(c).x, this.custHead(c).y - 90, '#ffffff', 20, C.komi);
        }
        break;
      case 'komiWake': {
        s.partial();
        this.say(`cust:${ev.customerId}`, T.game.komiWake, () => this.custSayPos(ev.customerId), C.komi, 1.8);
        const c = cust(ev.customerId);
        if (c) this.jiggle(c, 120);
        break;
      }
      case 'butterArrive':
        s.arrive();
        this.say(`cust:${ev.customerId}`, T.game.butterArrive, () => this.custSayPos(ev.customerId), C.butter, 2.2);
        this.firstTime('butter', T.game.butterTitle, T.game.butterHint, C.butter);
        break;
      case 'butterShot': {
        const c = cust(ev.customerId);
        if (!c) break;
        const h = this.custHead(c);
        this.shots.push({ from: { x: h.x, y: h.y + this.L.headR * 0.9 }, t: 0 });
        s.click();
        this.say(`cust:${ev.customerId}`, T.game.butterShot, () => this.custSayPos(ev.customerId), C.butter, 0.8);
        break;
      }
      case 'customerAngry': {
        s.angry();
        const c = cust(ev.customerId);
        if (c) {
          const h = this.custHead(c);
          this.fx.burst(h.x, h.y - 30, 'smoke', 6, 'rgba(120,110,110,0.8)', 80);
          if (this.lastCombo >= 2) this.fx.float(T.game.comboBroken, h.x, h.y - 80, '#ffffff', 20, C.bad);
        }
        this.lastCombo = 0;
        break;
      }
      case 'bakeStart':
        s.bake();
        break;
      case 'ovenReady': {
        s.ovenReady();
        const r = L.ovens[ev.oven];
        this.fx.burst(r.x + r.w / 2, r.y + 40, 'steam', 6, '#ffffff');
        break;
      }
      case 'ovenTakeOut': {
        s.takeOut();
        const r = L.ovens[ev.oven];
        const slot = L.slots[w.stage.breads.indexOf(ev.bread)];
        this.fx.burst(r.x + r.w / 2, r.y + r.h * 0.6, 'crumb', 10, '#f2c27a', 200);
        if (slot) {
          this.fx.float(`+${ev.count}`, slot.x + slot.w / 2, slot.y + 20, '#ffffff', 26, C.woodDark);
          this.slotPop[w.stage.breads.indexOf(ev.bread)] = 1;
        }
        break;
      }
      case 'ovenBurnt': {
        s.burnt();
        const r = L.ovens[ev.oven];
        this.fx.burst(r.x + r.w / 2, r.y + 60, 'smoke', 14, 'rgba(60,50,50,0.9)');
        this.fx.addShake(0.4);
        break;
      }
      case 'ovenClear':
        s.click();
        break;
      case 'elfinEnter': {
        s.elfinEnter();
        const e = this.elfin;
        e.x = L.elfinDoor.x;
        e.leaveDelay = 0;
        e.hitPending = false;
        e.leaveExpr = 'happy';
        this.say('elfin', T.game.elfinEnter, () => this.elfinSayPos(), C.elfin, 1.4);
        this.firstTime('elfin', T.game.elfinTitle, T.game.elfinHint, C.elfin);
        break;
      }
      case 'elfinEat': {
        // 1 個さっと取って、そのまま抱えて走って帰る
        s.munch();
        const h = this.elfinHead();
        const i = w.stage.breads.indexOf(ev.bread);
        this.slotPop[i] = 1;
        this.fx.burst(h.x, h.y + this.elfinR() * 1.3, 'crumb', 6, '#e7b072', 150);
        this.fx.float(T.game.elfinEat(ev.price), h.x, h.y - 70, '#ffd6d6', 22, C.tab);
        this.tabBump = 1;
        break;
      }
      case 'elfinSulk':
        this.say('elfin', T.game.elfinSulk, () => this.elfinSayPos(), C.elfin, BALANCE.elfin.sulkTime + 0.4);
        break;
      case 'elfinLeave':
        this.elfin.leaveExpr = ev.took ? 'happy' : 'sulk';
        if (ev.took) this.say('elfin', T.game.elfinTook, () => this.elfinSayPos(), C.elfin, 1.2);
        break;
      case 'elfinFlee':
        if (ev.reason === 'butter') {
          // 石が届くまで固まり、当たったら目を回して逃げる（当たった瞬間の音と台詞は updateElfin で出す）
          this.elfin.leaveDelay = SHOT_TIME;
          this.elfin.hitPending = true;
          this.elfin.leaveExpr = 'dizzy';
          break;
        }
        this.elfin.leaveExpr = 'surprised';
        this.say('elfin', ev.reason === 'nell' ? T.game.elfinFleeNell : T.game.elfinFleeFever, () => this.elfinSayPos(), C.elfin, 1.2);
        break;
      case 'nellAnnounce':
        s.nellAnnounce();
        this.banner(T.game.nellAnnounce, T.game.nellAnnounceSub(BALANCE.nell.revealTime), C.nell, 3, 'nell');
        break;
      case 'nellArrive':
        this.say(`cust:${ev.customerId}`, w.tab > 0 ? T.game.nellArriveTab : T.game.nellArrive, () => this.custSayPos(ev.customerId), C.nell, 2.6);
        break;
      case 'nellPeek':
        s.nellPeek();
        this.say(`cust:${ev.customerId}`, T.game.nellPeek, () => this.custSayPos(ev.customerId), C.nell, 1.6);
        break;
      case 'nellWrong':
        s.nellWrong();
        this.say(`cust:${ev.customerId}`, T.game.nellWrong, () => this.custSayPos(ev.customerId), C.nell, 1.6);
        break;
      case 'nellSuccess': {
        s.nellSuccess();
        const c = cust(ev.customerId);
        const h = c ? this.custHead(c) : center(L.tray);
        this.fx.burst(h.x, h.y, 'star', 20, '#bfe3ff', 320);
        this.fx.coinFly(h, this.hudSalesPos(), 6, () => (this.salesBump = 1));
        this.fx.float(`+${ev.payment.total}`, h.x, h.y - 60, C.gold, 34);
        if (ev.tabPaid > 0) this.fx.float(T.game.tabPaid(ev.tabPaid), h.x, h.y - 110, '#ffffff', 28, C.tab);
        this.say(`cust:${ev.customerId}`, ev.tabPaid > 0 ? T.game.nellSuccessTab : T.game.nellSuccess, () => this.custSayPos(ev.customerId), C.nell, 2);
        this.banner(T.game.nellBlessing, T.game.nellBlessingSub(BALANCE.nell.buffDuration, BALANCE.nell.buffRate), C.nell, 2.4, 'nell');
        this.feverBump = 1;
        this.refreshBgm();
        break;
      }
      case 'nellFail':
        s.fail2();
        this.lastCombo = 0;
        this.say(`cust:${ev.customerId}`, T.game.nellBye, () => this.custSayPos(ev.customerId), C.nell, 1.8);
        this.banner(T.game.nellFail, T.game.nellFailSub, '#9aa5b1', 2.2);
        break;
      case 'buffEnd':
        s.buffEnd();
        this.refreshBgm();
        break;
      case 'burumiArrive':
        s.burumiArrive();
        // 初めて来た時だけ、窓の上に遊び方を出す（真ん中のお知らせは窓と客にかぶる）
        if (!this.seen.has('burumi')) {
          this.seen.add('burumi');
          this.say('burumi', T.game.burumiHint(BALANCE.burumi.reward), () => this.burumiSayPos(ev.window), C.burumi, BALANCE.burumi.stay);
        }
        break;
      case 'burumiCatch': {
        s.burumiCatch();
        const p = burumiCenter(L.windows[ev.window]);
        this.fx.burst(p.x, p.y, 'star', 12, C.burumi, 220);
        this.fx.coinFly(p, this.hudSalesPos(), 2, () => (this.salesBump = 1));
        this.fx.float(`+${ev.reward}`, p.x, p.y + 10, C.gold, 30);
        this.say('burumi', T.game.burumiCaught, () => this.burumiSayPos(ev.window), C.burumi, 1.6);
        break;
      }
      case 'burumiLeave':
        s.burumiLeave();
        break;
      case 'feverStart':
        s.feverStart();
        this.rainbow.start(L);
        this.banner(T.game.feverStart, T.game.feverStartSub, '#e0569b', 2.2, 'speaki');
        this.refreshBgm();
        break;
      case 'feverEnd':
        // 時間切れのあとのフィーバーが終わったら、そのまま閉店の知らせだけ出す
        if (this.world.phase === 'playing') {
          s.feverEnd();
          this.fx.float(T.game.feverEnd, L.banner.x, L.banner.y - 40, '#ffffff', 26, '#e0569b');
        }
        this.refreshBgm();
        break;
      case 'timeWarning':
        this.banner(T.game.timeLeft(BALANCE.warningTime), undefined, C.bad, 1.6);
        this.refreshBgm();
        break;
      case 'timeExtend': {
        const cy = L.portrait ? 36 : 32;
        // 時計の下のレベル札の右に出す
        this.fx.float(T.game.timeExtend(ev.seconds.toFixed(1)), 160, cy + 46, '#e9ffd0', 24, C.good);
        this.refreshBgm();
        break;
      }
      case 'levelUp':
        this.levelBump = 1;
        s.levelUp();
        this.banner(T.game.levelUp(ev.level), this.levelLine(ev.level), C.eshur, 1.8);
        break;
      case 'timeUp':
        s.timeUp();
        this.cancelGrab();
        this.picker = null;
        this.banner(T.game.closed, undefined, C.eshur, 2.2, undefined, true);
        break;
    }
  }

  /** フィーバー > ネルの祝福 > 残りわずか > ふだん */
  private refreshBgm(): void {
    const w = this.world;
    this.bgm.mode = w.fever > 0 ? 'rainbow' : w.buff > 0 ? 'fever' : w.remaining <= BALANCE.warningTime ? 'hurry' : 'normal';
  }

  /** チュートリアル中は説明が重なるので、初回の案内を出さない */
  skipFirstTimeHints(): void {
    for (const face of ['elfin', 'komi', 'butter']) this.seen.add(face);
  }

  /** そのキャラが初めて来たときだけ、何をすればいいかを出す */
  private firstTime(face: Face, text: string, sub: string, color: string): void {
    if (this.seen.has(face)) return;
    this.seen.add(face);
    this.banner(text, sub, color, 2.2, face);
  }

  private flashTrayFull(): void {
    this.fx.float(T.game.trayFull, this.L.tray.x + this.L.tray.w / 2, this.L.tray.y - 6, '#ffffff', 20, C.bad);
  }

  /** ブルミの吹き出しは窓の上のほうに出す（窓の下には客の注文の吹き出しがある） */
  /** ブルミの吹き出しは、ブルミが張り付く左上のガラスを隠さないよう、窓の横桟の下に出す */
  private burumiSayPos(window: 0 | 1): Point {
    const r = this.L.windows[window];
    return { x: r.x + r.w / 2, y: r.y + r.h * 0.55 + 8 };
  }

  private burumiTappable(): boolean {
    const st = this.world.burumi.state;
    return st === 'entering' || st === 'stuck';
  }

  /** 走って帰ったあとも、言い残した台詞は画面の左端に少し残す */
  private elfinSayPos(): Point {
    return { x: Math.max(120, this.elfin.x), y: this.elfin.ground - this.elfinR() * 1.5 };
  }

  private custSayPos(id: number): Point | null {
    const c = this.world.customers.find((x) => x.id === id);
    if (!c) return null;
    const h = this.custHead(c);
    return { x: h.x, y: h.y + this.L.headR * 1.25 };
  }

  /** エンドレスのレベルアップでエシュールがかける一言 */
  private levelLine(level: number): string {
    const e = this.world.stage.endless;
    if (e && level === e.burnLevel) return T.game.levelBurn(this.world.burnTime ?? 0);
    return level === 2 ? T.game.level2 : T.game.levelMore;
  }

  banner(text: string, sub: string | undefined, color: string, dur: number, face?: Face, big = false): void {
    this.banners = this.banners.filter((b) => !!b.big !== big);
    this.banners.push({ id: ++this.bannerSeq, text, sub, color, t: 0, dur, face, big });
  }

  /** HUD・お知らせ・吹き出しの顔を描く。key ごとにほっぺの揺れを持ち、描いた場所は grabFace でつまめる */
  drawFace(c: CanvasRenderingContext2D, key: string, spec: ChibiSpec, x: number, y: number, r: number, pose: ChibiPose): void {
    let f = this.faces.get(key);
    if (!f) {
      f = { body: new MochiBody(), x, y, r, frame: 0, z: 0, grab: null };
      this.faces.set(key, f);
    }
    f.x = x;
    f.y = y;
    f.r = r;
    f.frame = this.frame;
    f.z = ++this.faceZ;
    f.body.draw(c, spec, x, y, r, f.body.pinch.held ? { ...pose, expr: 'pinched' } : pose);
  }

  /** キャラのセリフ。同じ key（同じ話し手）の前のセリフは消す */
  say(key: string, text: string, at: () => Point | null, color: string, dur: number): void {
    this.says = this.says.filter((s) => s.key !== key);
    this.says.push({ key, text, t: 0, dur, at, color });
  }

  // ==================================================================== render

  render(): void {
    const scr = this.screen;
    const c = scr.ctx;
    const L = this.L;
    const w = this.world;
    const pr = scr.pixelRatio;
    this.scene.ensure(L, w.stage, pr);

    this.frame++;
    this.faceZ = 0;
    scr.clear('#5c3317');
    scr.begin();
    c.save();
    if (this.fx.shake > 0) {
      const s = this.fx.shake * 8;
      c.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    c.drawImage(this.scene.back!, 0, 0, L.w, L.h);
    if (w.burumi.state !== 'absent') drawBurumi(c, L.windows[w.burumi.window], w.burumi, this.time);
    this.rainbow.drawBack(c, L, pr);

    const sorted = [...w.customers].sort((a, b) => a.seat - b.seat);
    for (const cu of sorted) this.drawCustomer(c, cu);

    c.drawImage(this.scene.front!, 0, 0, L.w, L.h);
    this.rainbow.drawCounter(c, L, pr);

    drawTray(c, L.tray, L.traySlots, w.tray, pr, this.trayPulse);

    w.stage.breads.forEach((bread, i) => {
      const r = L.slots[i];
      drawSlot(c, r, bread, w.stock[bread], pr, {
        hover: !!this.hover && inside(r, this.hover) && !this.picker,
        flash: this.slotFlash[i] ?? 0,
        pop: this.slotPop[i] ?? 0,
        infinite: w.fever > 0 ? (this.time * 200 + i * 50) % 360 : undefined,
      });
    });
    this.drawGlass(c);

    w.ovens.forEach((oven, i) => {
      const r = L.ovens[i];
      drawOven(c, r, oven, pr, { hover: !!this.hover && inside(r, this.hover), t: this.time, burnTime: this.world.burnTime });
    });

    this.drawElfin(c, pr);
    this.drawShots(c);

    for (const cu of sorted) this.drawCustomerBubble(c, cu, pr);

    this.fx.draw(c);
    this.drawSays(c);
    this.rainbow.drawEdge(c, L, pr);
    if (w.fever > 0) this.drawFeverFrame(c);
    c.restore();

    this.drawHud(c);
    if (this.picker) this.drawPicker(c, pr);
    if (this.keyMode) this.drawKeyHints(c);
    this.drawBanners(c);
    this.overlay?.(c);
  }

  private drawCustomer(c: CanvasRenderingContext2D, cu: Customer): void {
    const v = this.custView(cu);
    const h = this.custHead(cu);
    if (this.time > v.blinkAt + 0.12) v.blinkAt = this.time + 2 + Math.random() * 3;
    const blink = this.time > v.blinkAt;
    const ratio = cu.patience / cu.patienceMax;
    let expr: Expr = cu.kind === 'nell' ? 'smile' : 'normal';
    if (v.body.pinch.held) expr = 'pinched';
    else if (cu.state === 'leaving') expr = cu.mood === 'happy' ? 'happy' : cu.kind === 'nell' ? 'stern' : 'angry';
    else if (cu.asleep) expr = 'sleep';
    else if (cu.reject > 0) expr = cu.kind === 'nell' ? 'stern' : 'sulk';
    else if (v.bump > 0) expr = 'happy';
    else if (cu.kind === 'nell') expr = ratio < 0.3 ? 'stern' : cu.reveal > 0 ? 'normal' : 'smile';
    else if (ratio < 0.25) expr = 'angry';
    else if (ratio < 0.5) expr = 'worried';
    const breathe = 1 + Math.sin(this.time * (cu.asleep ? 1.6 : 2.4) + cu.seat) * (cu.asleep ? 0.025 : 0.012);
    const r = this.L.headR;
    v.body.draw(c, v.spec, h.x, h.y, r, {
      expr,
      t: this.time,
      blink,
      squash: breathe,
      wobble: v.wobble.x / 40,
      // 店の真ん中へ顔を向ける
      turn: h.x < this.L.w / 2 ? 1 : -1,
    });
    if (cu.asleep && cu.state === 'waiting') {
      for (let i = 0; i < 3; i++) {
        const k = (this.time * 0.7 + i / 3) % 1;
        c.save();
        c.globalAlpha = Math.sin(k * Math.PI);
        outlined(c, 'z', h.x + r * (0.9 + k * 0.5), h.y - r * (0.9 + k * 0.8), 18 + k * 14, '#ffffff', C.komi);
        c.restore();
      }
    }
  }

  private drawCustomerBubble(c: CanvasRenderingContext2D, cu: Customer, pr: number): void {
    const v = this.custView(cu);
    if (cu.state !== 'waiting') {
      v.bubble = null;
      return;
    }
    const L = this.L;
    const seat = L.seats[cu.seat];
    const cell = L.portrait ? 50 : 46;
    const pop = Math.min(1, cu.stateTime / 0.18);
    const nell = cu.kind === 'nell';
    c.save();
    const bottom = seat.y - L.headR * 1.3;
    c.translate(seat.x, bottom);
    c.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
    c.translate(-seat.x, -bottom);
    v.bubble = drawBubble(
      c,
      seat.x,
      bottom,
      L.bubbleMaxW,
      cell,
      {
        order: cu.order,
        received: cu.received,
        ratio: cu.patience / cu.patienceMax,
        hidden: nell && cu.reveal <= 0,
        sleep: cu.asleep,
        nell,
        shake: cu.reject,
        reveal: nell ? cu.reveal / BALANCE.nell.revealTime : 0,
      },
      pr,
    );
    c.restore();
    if (nell && cu.reveal <= 0 && this.world.tray.length === 0 && cu.stateTime > 1) {
      const b = v.bubble;
      outlined(c, T.game.nellTapAgain, seat.x, b.y - 14, 15, '#ffffff', C.nell);
    }
  }

  private drawGlass(c: CanvasRenderingContext2D): void {
    const s = this.L.showcase;
    c.save();
    c.beginPath();
    c.roundRect(s.x + 10, s.y + 10, s.w - 20, s.h - 20, 14);
    c.clip();
    c.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (const off of [0.18, 0.62]) {
      const x = s.x + s.w * off;
      c.beginPath();
      c.moveTo(x, s.y);
      c.lineTo(x + 40, s.y);
      c.lineTo(x - 60, s.y + s.h);
      c.lineTo(x - 100, s.y + s.h);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  private drawElfin(c: CanvasRenderingContext2D, pr: number): void {
    const we = this.world.elfin;
    const state = we.state;
    if (state === 'absent') return;
    const e = this.elfin;
    const r = this.elfinR();
    const running = state === 'leaving' && we.t >= e.leaveDelay;
    const dash = state === 'entering' || running;
    let expr: Expr = 'happy';
    if (state === 'sulking') expr = 'sulk';
    if (running) expr = e.leaveExpr;

    c.save();
    // 影（跳ねた分だけ小さく）
    const lift = Math.min(1, (e.ground - e.y) / 30);
    c.fillStyle = C.shadow;
    c.beginPath();
    c.ellipse(e.x, e.ground + r * FEET_R, r * 0.8 * (1 - lift * 0.3), r * 0.16, 0, 0, Math.PI * 2);
    c.fill();
    // 進む向きへ左右反転し、駆けている間は前のめりに
    c.translate(e.x, e.y);
    c.scale(e.dir, 1);
    e.body.draw(c, ELFIN, 0, 0, r, {
      expr,
      t: this.time,
      squash: dash ? 1 + Math.sin(this.time * 32) * 0.04 : 1 + Math.sin(this.time * 8) * 0.02,
      tilt: dash ? 0.14 : Math.sin(this.time * 6) * 0.04,
      turn: 1,
    });
    // 取ったパンは胸に抱えて持って帰る（取った瞬間はぽんと大きく）
    if (state === 'leaving' && we.bread) {
      const pop = 1 + Math.max(0, 0.2 - we.t) * 1.5;
      drawBread(c, we.bread, r * 0.32, r * 1.3, r * 0.95 * pop, pr);
    }
    c.restore();
  }

  /** バターのパチンコの石。席からエルフィンへ山なりに飛ぶ */
  private drawShots(c: CanvasRenderingContext2D): void {
    const to = this.elfinHead();
    for (const sh of this.shots) {
      const k = sh.t / SHOT_TIME;
      const x = sh.from.x + (to.x - sh.from.x) * k;
      const y = sh.from.y + (to.y - sh.from.y) * k - Math.sin(k * Math.PI) * 60;
      c.fillStyle = '#9b8c86';
      c.strokeStyle = C.ink;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(x, y, 7, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      if (k > 0.85 && this.world.elfin.state !== 'absent') this.fx.burst(to.x, to.y - 10, 'star', 1, C.gold, 160);
    }
  }

  private drawSays(c: CanvasRenderingContext2D): void {
    for (const s of this.says) {
      const p = s.at();
      if (!p) continue;
      const a = s.t < 0.15 ? s.t / 0.15 : s.t > s.dur - 0.25 ? (s.dur - s.t) / 0.25 : 1;
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.font = font(18, 800);
      const tw = Math.min(c.measureText(s.text).width, 360);
      const w = tw + 28;
      const h = 36;
      const x = Math.max(8, Math.min(this.L.w - w - 8, p.x - w / 2));
      const y = p.y;
      roundRect(c, x, y, w, h, 18);
      c.fillStyle = '#ffffff';
      c.fill();
      c.strokeStyle = s.color;
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = C.ink;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(s.text, x + w / 2, y + h / 2 + 1, 360);
      c.restore();
    }
  }

  private drawHud(c: CanvasRenderingContext2D): void {
    const L = this.L;
    const w = this.world;
    const portrait = L.portrait;
    const cy = portrait ? 36 : 32;

    // 残り時間
    const ratio = Math.min(1, w.remaining / w.stage.duration);
    // 時間切れのあと、フィーバーが終わるまでは「延長」
    const overtime = w.remaining <= 0 && w.fever > 0;
    const hurry = w.remaining <= BALANCE.warningTime && w.phase === 'playing' && !overtime;
    const sec = Math.ceil(w.remaining);
    const label = overtime ? T.game.overtime : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const pulse = hurry ? 1 + Math.max(0, Math.sin(this.time * 10)) * 0.12 : 1;
    const timeSize = portrait ? 28 : 30;
    hudPill(c, 8, cy, 66 + measure(c, label, timeSize) + 14 - 8);
    clock(c, 34, cy, 19, ratio, hurry ? C.bad : C.good);
    c.save();
    c.translate(66, cy);
    c.scale(pulse, pulse);
    outlined(c, label, 0, 1, timeSize, overtime ? '#e0569b' : hurry ? C.bad : HUD_INK, '#ffffff', 'left');
    c.restore();
    if (w.stage.endless) this.drawLevel(c, cy);

    // 売上
    const sp = this.hudSalesPos();
    const bump = 1 + this.salesBump * 0.15;
    const salesText = Math.round(this.shownSales).toLocaleString('ja-JP');
    const salesSize = portrait ? 30 : 32;
    hudPill(c, sp.x - 28, cy, 48 + Math.max(measure(c, salesText, salesSize), 70) + 14);
    coin(c, sp.x - 4, cy, 15);
    c.save();
    c.translate(sp.x + 20, cy);
    c.scale(bump, bump);
    outlined(c, salesText, 0, 1, salesSize, w.buff > 0 ? '#2f7fc0' : HUD_INK, '#ffffff', 'left');
    c.restore();
    if (w.combo >= 2 && !portrait) outlined(c, T.game.hudCombo(w.combo), 450, cy, 18, '#ffe08a', '#7c4721');

    // ★の目標バー（チュートリアルは★がない）
    if (!w.stage.tutorial) this.drawStarBar(c);

    // ツケ
    if (w.stage.elfin) {
      const tp = this.hudTabPos();
      const tabText = T.game.hudTab(num(w.tab));
      const tabSize = portrait ? 21 : 24;
      const tabW = 48 + measure(c, tabText, tabSize) + 14;
      hudPill(c, tp.x - 22, cy, tabW);
      this.tabPill = { x: tp.x - 22, y: cy - 21, w: tabW, h: 42 };
      this.drawFace(c, 'hud-tab', ELFIN, tp.x, tp.y - 2, 13, { expr: w.tab > 0 ? 'happy' : 'normal', t: this.time, body: false });
      const tb = 1 + this.tabBump * 0.2;
      c.save();
      c.translate(tp.x + 26, cy);
      c.scale(tb, tb);
      outlined(c, tabText, 0, 1, tabSize, w.tab > 0 ? C.bad : HUD_INK, '#ffffff', 'left');
      c.restore();
    }

    // ネル
    const nx = portrait ? L.w / 2 : 900;
    const ny = portrait ? 96 : cy;
    if (w.buff > 0) {
      hudPill(c, nx - 136, ny, 246);
      this.drawFace(c, 'hud-nell', NELL, nx - 110, ny + 2, 15, { expr: 'smile', t: this.time, body: false });
      const bw = 120;
      c.fillStyle = '#e4e8f2';
      roundRect(c, nx - 86, ny - 6, bw, 12, 6);
      c.fill();
      c.fillStyle = '#7fb6ea';
      roundRect(c, nx - 86, ny - 6, bw * (w.buff / BALANCE.nell.buffDuration), 12, 6);
      c.fill();
      outlined(c, `×${BALANCE.nell.buffRate}`, nx + 76, ny + 1, 22, '#2f6fae', '#ffffff');
    } else if (w.nellPendingAt !== null) {
      const left = Math.max(0, Math.ceil(w.nellPendingAt - w.time));
      hudPill(c, nx - 120, ny, 240);
      this.drawFace(c, 'hud-nell', NELL, nx - 95, ny + 2, 15, { expr: 'smile', t: this.time, body: false });
      outlined(c, left > 0 ? T.game.hudNellIn(left) : T.game.hudNellNow, nx + 10, ny + 1, 20, '#3f5f86', '#ffffff');
    }

    this.drawFeverGauge(c);

    // ポーズ
    const pb = L.pauseBtn;
    c.beginPath();
    c.arc(pb.x + pb.w / 2, pb.y + pb.h / 2, pb.w / 2 - 1, 0, Math.PI * 2);
    c.fillStyle = '#5ca735';
    c.fill();
    c.strokeStyle = HUD_INK;
    c.lineWidth = 3;
    c.stroke();
    c.beginPath();
    c.arc(pb.x + pb.w / 2, pb.y + pb.h / 2, pb.w / 2 - 4.5, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    c.lineWidth = 2.5;
    c.stroke();
    c.fillStyle = '#ffffff';
    c.fillRect(pb.x + pb.w / 2 - 9, pb.y + pb.h / 2 - 11, 6, 22);
    c.fillRect(pb.x + pb.w / 2 + 3, pb.y + pb.h / 2 - 11, 6, 22);
  }

  /** フィーバーのゲージ（左端 x・中心 cy・幅 w）。縦画面は 2 段目の右（チュートリアルはスキップボタンをよけて左） */
  private feverGaugeRect(): { x: number; cy: number; w: number } {
    const L = this.L;
    if (!L.portrait) return { x: L.pauseBtn.x - 198, cy: 32, w: 186 };
    return this.world.stage.tutorial ? { x: 14, cy: 96, w: 196 } : { x: L.w - 206, cy: 96, w: 196 };
  }

  private drawFeverGauge(c: CanvasRenderingContext2D): void {
    const w = this.world;
    const need = w.stage.feverServes ?? 0;
    const on = w.fever > 0;
    if (!need && !on) return;
    const g = this.feverGaugeRect();
    const bump = 1 + this.feverBump * 0.08;
    c.save();
    c.translate(g.x + g.w / 2, g.cy);
    c.scale(bump, bump);
    c.translate(-g.x - g.w / 2, -g.cy);
    hudPill(c, g.x, g.cy, g.w);
    const bx = g.x + 44;
    const bw = g.w - 58;
    const bh = 16;
    const by = g.cy - bh / 2;
    c.fillStyle = '#efe4d8';
    roundRect(c, bx, by, bw, bh, bh / 2);
    c.fill();
    const hue = (this.time * 240) % 360;
    if (on) {
      const grad = c.createLinearGradient(bx, 0, bx + bw, 0);
      for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${(hue + i * 60) % 360}, 90%, 62%)`);
      c.fillStyle = grad;
      roundRect(c, bx, by, Math.max(bh, bw * (w.fever / BALANCE.fever.duration)), bh, bh / 2);
      c.fill();
    } else {
      // 会計 1 回ぶんずつの目盛り
      const gap = 2;
      const pw = (bw - 4 - gap * (need - 1)) / need;
      c.fillStyle = '#f0a53a';
      for (let i = 0; i < w.feverGauge; i++) {
        roundRect(c, bx + 2 + i * (pw + gap), by + 2, pw, bh - 4, 4);
        c.fill();
      }
    }
    c.strokeStyle = HUD_INK;
    c.lineWidth = 2;
    roundRect(c, bx, by, bw, bh, bh / 2);
    c.stroke();
    if (on) outlined(c, T.game.hudFever, bx + bw / 2, g.cy + 1, 17, '#ffffff', HUD_INK);
    this.drawFace(c, 'hud-fever', SPEAKI, g.x + 24, g.cy + 3, 14, { expr: on ? 'happy' : 'normal', t: this.time, body: false });
    c.restore();
  }

  /** フィーバー中は画面のふちを虹色に光らせる */
  private drawFeverFrame(c: CanvasRenderingContext2D): void {
    const L = this.L;
    const w = this.world;
    const fade = Math.min(1, w.fever / 0.5, (BALANCE.fever.duration - w.fever) / 0.3);
    const hue = (this.time * 160) % 360;
    const t = 10;
    c.save();
    c.globalAlpha = fade * (0.55 + 0.25 * Math.sin(this.time * 8));
    const edge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(hue + i * 60) % 360}, 95%, 62%)`);
      c.fillStyle = g;
      c.fillRect(rx, ry, rw, rh);
    };
    edge(0, 0, 0, L.h, 0, 0, t, L.h);
    edge(0, L.h, 0, 0, L.w - t, 0, t, L.h);
    edge(0, 0, L.w, 0, 0, L.h - t, L.w, t);
    c.restore();
  }

  /** エンドレス: 時計の下にレベルの札を下げる */
  private drawLevel(c: CanvasRenderingContext2D, cy: number): void {
    const bump = 1 + this.levelBump * 0.25;
    const x = 18;
    const y = cy + 30;
    const wd = 84;
    const ht = 28;
    c.save();
    c.fillStyle = 'rgba(40, 20, 10, 0.3)';
    roundRect(c, x, y + 2, wd, ht, ht / 2);
    c.fill();
    c.fillStyle = C.eshur;
    roundRect(c, x, y, wd, ht, ht / 2);
    c.fill();
    c.strokeStyle = HUD_INK;
    c.lineWidth = 2.5;
    c.stroke();
    c.translate(x + wd / 2, y + ht / 2);
    c.scale(bump, bump);
    outlined(c, `Lv.${this.world.level}`, 0, 1, 18, '#ffffff', HUD_INK);
    c.restore();
  }

  private drawStarBar(c: CanvasRenderingContext2D): void {
    const L = this.L;
    const stars = this.world.stage.stars;
    const max = stars[2] * 1.08;
    const x = 0;
    const y = L.hud.h - 5;
    const wd = L.w;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x, y, wd, 5);
    c.fillStyle = C.gold;
    c.fillRect(x, y, wd * Math.min(1, this.shownSales / max), 5);
    stars.forEach((s) => {
      const sx = x + (wd * s) / max;
      star(c, sx, y + 2, 9, this.shownSales >= s);
    });
  }

  private drawPicker(c: CanvasRenderingContext2D, pr: number): void {
    const p = this.picker!;
    const r = p.rect;
    const s = Math.min(1, p.t / 0.12);
    c.save();
    c.translate(r.x + r.w / 2, r.y + r.h);
    c.scale(0.85 + s * 0.15, 0.85 + s * 0.15);
    c.translate(-(r.x + r.w / 2), -(r.y + r.h));
    c.fillStyle = 'rgba(90, 58, 34, 0.3)';
    roundRect(c, r.x + 4, r.y + 8, r.w, r.h, 20);
    c.fill();
    c.fillStyle = C.cream;
    roundRect(c, r.x, r.y, r.w, r.h, 20);
    c.fill();
    c.strokeStyle = C.woodDark;
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = C.ink;
    c.font = font(18);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(T.game.bakeWhat, r.x + r.w / 2, r.y + 24);
    p.items.forEach((it, i) => {
      const b = it.rect;
      const hov = !!this.hover && inside(b, this.hover);
      c.fillStyle = hov ? '#ffe9c4' : '#ffffff';
      roundRect(c, b.x, b.y, b.w, b.h, 14);
      c.fill();
      c.strokeStyle = '#e2c49c';
      c.lineWidth = 2;
      c.stroke();
      drawBread(c, it.bread, b.x + b.w / 2, b.y + b.h * 0.4, b.w * 0.6, pr);
      c.fillStyle = C.inkSoft;
      c.font = font(13, 700);
      c.fillText(T.game.bakeInfo(BREADS[it.bread].bakeTime, BREADS[it.bread].batch), b.x + b.w / 2, b.y + b.h - 14);
      if (this.keyMode) keycap(c, String(i + 1), b.x + 14, b.y + 14);
    });
    c.restore();
  }

  private drawKeyHints(c: CanvasRenderingContext2D): void {
    const L = this.L;
    L.slots.forEach((r, i) => keycap(c, String(i + 1), r.x + 16, r.y + 16));
    L.seats.forEach((s, i) => keycap(c, SEAT_KEYS[i], s.x - L.headR - 8, s.y + 20));
    L.ovens.forEach((r, i) => keycap(c, OVEN_KEYS[i], r.x + 16, r.y + r.h - 34));
    keycap(c, 'BS', L.tray.x + L.tray.w + 22, L.tray.y + L.tray.h / 2);
    if (this.burumiTappable()) {
      const r = L.windows[this.world.burumi.window];
      keycap(c, BURUMI_KEY, r.x + r.w - 14, r.y + r.h - 14);
    }
  }

  private drawBanners(c: CanvasRenderingContext2D): void {
    const L = this.L;
    for (const b of this.banners) {
      const inT = Math.min(1, b.t / 0.22);
      const outT = Math.max(0, (b.t - (b.dur - 0.3)) / 0.3);
      const ease = 1 - Math.pow(1 - inT, 3);
      c.save();
      c.globalAlpha = 1 - outT;
      if (b.big) {
        const s = 0.5 + ease * 0.5 + Math.sin(inT * Math.PI) * 0.15;
        c.translate(L.w / 2, L.h * 0.42);
        c.scale(s, s);
        outlined(c, b.text, 0, 0, 96, '#ffffff', b.color);
        c.restore();
        continue;
      }
      // 客の顔と吹き出しを隠さない場所（L.banner）に、幅 L.bannerW まで。収まらない文字は縮める
      const cx = L.banner.x;
      const y = L.banner.y + (1 - ease) * -30;
      // 顔つきは左 FACE_W を顔に空けて、文字は残りの幅の中央に置く（いちばん長い行でも髪にかからない）
      const pad = b.face ? FACE_W + 28 : 70;
      const room = L.bannerW - pad;
      c.font = font(30);
      const size = Math.min(30, (30 * room) / c.measureText(b.text).width);
      const subSize = b.sub ? Math.min(18, (18 * room) / measure(c, b.sub, 18)) : 0;
      c.font = font(size);
      const mw = c.measureText(b.text).width;
      const tw = Math.max(mw, b.sub ? measure(c, b.sub, subSize) : 0);
      const w = Math.min(L.bannerW, tw + pad);
      const h = b.sub ? 92 : 64;
      const x = cx - w / 2;
      c.fillStyle = 'rgba(90, 58, 34, 0.25)';
      roundRect(c, x + 4, y - h / 2 + 6, w, h, 24);
      c.fill();
      c.fillStyle = '#fffdf6';
      roundRect(c, x, y - h / 2, w, h, 24);
      c.fill();
      c.strokeStyle = HUD_INK;
      c.lineWidth = 4;
      c.stroke();
      c.strokeStyle = b.color;
      c.lineWidth = 3.5;
      roundRect(c, x + 6, y - h / 2 + 6, w - 12, h - 12, 18);
      c.stroke();
      const tx = b.face ? x + FACE_W + (w - pad) / 2 : cx;
      if (b.face) {
        const key = bannerFaceKey(b);
        c.save();
        // 引っぱっている間は、伸びたほっぺを枠の外まで見せる
        if (!this.faces.get(key)?.body.pinch.active) {
          roundRect(c, x, y - h / 2, w, h, 24);
          c.clip();
        }
        this.drawFace(c, key, FACES[b.face], x + 56, y + 8, 26, { expr: b.face === 'nell' ? 'smile' : 'happy', t: this.time, body: false });
        c.restore();
      }
      const ty = y - (b.sub ? 14 : 0);
      c.fillStyle = 'rgba(255, 236, 110, 0.75)';
      c.fillRect(tx - mw / 2 - 6, ty + size * 0.03, mw + 12, size * 0.43);
      c.fillStyle = HUD_INK;
      c.font = font(size);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(b.text, tx, ty);
      if (b.sub) {
        c.fillStyle = C.inkSoft;
        c.font = font(subSize, 700);
        c.fillText(b.sub, tx, y + 22);
      }
      c.restore();
    }
  }
}

function measure(c: CanvasRenderingContext2D, text: string, size: number): number {
  c.font = font(size, 700);
  return c.measureText(text).width;
}

export { bubbleSize };

/** お知らせの顔に空ける幅 */
const FACE_W = 112;

/** HUD の文字色（原作の線と同じ赤茶） */
const HUD_INK = '#5a2d32';

/** HUD の白いカプセル（左端 x・中心 y・幅 w） */
function hudPill(c: CanvasRenderingContext2D, x: number, cy: number, w: number): void {
  const h = 42;
  c.fillStyle = 'rgba(40, 20, 10, 0.3)';
  roundRect(c, x, cy - h / 2 + 3, w, h, h / 2);
  c.fill();
  c.fillStyle = '#fffdf6';
  roundRect(c, x, cy - h / 2, w, h, h / 2);
  c.fill();
  c.strokeStyle = HUD_INK;
  c.lineWidth = 3;
  c.stroke();
}
