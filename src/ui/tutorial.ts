import type { BreadId } from '../config/breads';
import type { World } from '../sim/world';
import { ESHUR } from '../view/draw/characters';
import type { Expr } from '../view/draw/chibi';
import { roundRect } from '../view/draw/ui';
import type { Action, GameView } from '../view/gameView';
import type { Rect } from '../view/layout';
import { C, font } from '../view/palette';

// チュートリアルモードの手順説明。時計を止めた World の上で、指示した操作だけを通す。
// エルフィン・コミー・バター・ネルも順に呼んで、全員の相手のしかたを一度ずつやってもらい、最後にフィーバータイムを体験。いつでもスキップできる。
interface Step {
  text: string;
  expr?: Expr;
  /** tap = 画面タップで次へ / act = 指定の操作で次へ / wait = 条件を満たすまで待つ */
  kind: 'tap' | 'act' | 'wait';
  enter?: () => void;
  allow?: (a: Action) => boolean;
  /** この操作が通ったら次へ */
  advance?: (a: Action) => boolean;
  /** 毎フレーム調べて true なら次へ */
  done?: () => boolean;
  /** 毎フレーム呼ぶ（帰ってしまったエルフィンを呼び直すなど） */
  tick?: () => void;
  /** 明るく残す範囲。先頭が指さしの対象 */
  target?: () => (Rect | null)[];
}

export class Tutorial {
  private steps: Step[];
  private index = 0;
  private t = 0;
  private servedId = -1;
  private ovenIndex = 0;

  constructor(
    world: World,
    private view: GameView,
    private onFinish: () => void,
  ) {
    const w = world;
    w.frozen = true;
    w.autoSpawn = false;
    view.skipFirstTimeHints();
    const slot = (b: BreadId) => view.L.slots[w.stage.breads.indexOf(b)];
    const cust = () => view.customerRect(this.servedId);
    const target = () => w.customers.find((x) => x.id === this.servedId);
    const servedLeft = () => {
      const c = target();
      return !c || c.state === 'leaving';
    };
    const isServe = (a: Action) => a.type === 'serve' && a.customerId === this.servedId;
    const isPinch = (a: Action) => a.type === 'pinch' && a.customerId === this.servedId;
    /** パンの出し入れとオーブン（在庫が切れても焼いて続けられるように、接客の手順ではいつでも通す） */
    const shop = (a: Action) => a.type === 'pick' || a.type === 'return' || a.type === 'ovenOpen' || a.type === 'bake' || a.type === 'ovenTap';
    const elfinGone = () => w.elfin.state !== 'entering' && w.elfin.state !== 'eating';
    const shopArea = () => union(view.L.showcase, view.L.tray, cust());
    const guest = (kind: 'komi' | 'butter' | 'nell', order: BreadId[], seat: number) => {
      this.servedId = w.spawnGuest(kind, order, seat)?.id ?? -1;
    };

    this.steps = [
      {
        kind: 'tap',
        expr: 'happy',
        text: '最強の妖精、大魔法使いエシュールの店へようこそ！ 今日は教主に手伝ってもらうわよ。（右上の「スキップ」で、いつでも飛ばせます）',
      },
      {
        kind: 'act',
        text: 'お客さんよ！ ほしいパンは吹き出しに出るわ。ショーケースのクロワッサンをタップして、トレーにのせて。',
        enter: () => {
          this.servedId = w.spawnCustomer(['croissant'], 1)?.id ?? -1;
        },
        allow: (a) => a.type === 'pick' && a.bread === 'croissant',
        advance: (a) => a.type === 'pick',
        target: () => [slot('croissant'), cust(), view.L.tray],
      },
      {
        kind: 'act',
        text: 'のったわね。お客さんをタップして渡してあげて！',
        allow: isServe,
        advance: isServe,
        target: () => [cust(), view.L.tray],
      },
      {
        kind: 'tap',
        expr: 'smile',
        text: 'その調子！ 早く渡すほどチップが増えて、続けて接客するとコンボでもっと増えるわ。',
      },
      {
        kind: 'wait',
        text: '注文が2つなら、両方トレーにのせてまとめて渡すと早いわ。まちがえたパンは、トレーでタップすると戻せるわよ。',
        enter: () => {
          this.servedId = w.spawnCustomer(['roll', 'melon'], 0)?.id ?? -1;
        },
        allow: (a) => (a.type === 'pick' && (a.bread === 'roll' || a.bread === 'melon')) || a.type === 'return' || isServe(a),
        done: servedLeft,
        target: () => [shopArea()],
      },
      {
        kind: 'act',
        expr: 'smile',
        text: '待たせすぎるとお客さんは怒って帰っちゃうわ。そんなときは、お客さんを押したまま指をずらして、ほっぺを引っぱってあげて！ ごきげんが満タンに戻るわ（1人1回よ）。',
        enter: () => {
          this.servedId = w.spawnCustomer(['curry'], 2)?.id ?? -1;
        },
        allow: isPinch,
        advance: (a) => a.type === 'pinch',
        target: () => [cust()],
      },
      {
        kind: 'wait',
        expr: 'happy',
        text: 'ごきげんになったわね。カレーパンも渡してあげて。',
        allow: (a) => shop(a) || isServe(a),
        done: servedLeft,
        target: () => [shopArea()],
      },
      {
        kind: 'act',
        text: 'パンは売れると減っていくわ。空いているオーブンをタップして、焼くパンを選んで！',
        allow: (a) => a.type === 'ovenOpen' || a.type === 'bake',
        advance: (a) => {
          if (a.type !== 'bake') return false;
          this.ovenIndex = a.oven;
          return true;
        },
        target: () => [union(...view.L.ovens, view.pickerRect())],
      },
      {
        kind: 'wait',
        text: '焼けるまで少し待ってね。',
        allow: () => false,
        done: () => w.ovens[this.ovenIndex]?.state === 'ready',
        target: () => [view.L.ovens[this.ovenIndex]],
      },
      {
        kind: 'act',
        expr: 'surprised',
        text: '焼けたわ！ タップして取り出して。微辛と中辛では焦げないけど、辛口からは放っておくと焦げちゃうから気をつけるのよ！',
        allow: (a) => a.type === 'ovenTap' && a.oven === this.ovenIndex,
        advance: (a) => a.type === 'ovenTap',
        target: () => [view.L.ovens[this.ovenIndex]],
      },
      // ---- エルフィン
      {
        kind: 'wait',
        expr: 'surprised',
        text: 'あっ、女王様（エルフィン）！ ショーケースのパンを勝手に食べて、ツケにしちゃうの。ツケは売上に入らないのよ……！',
        enter: () => w.summonElfin(),
        allow: () => false,
        done: () => w.elfin.eaten >= 1 && this.t > 1.5,
        target: () => [view.elfinRect(), view.L.showcase],
      },
      {
        kind: 'act',
        expr: 'sulk',
        text: 'ほっぺをつまんで、強く引っぱって離すと追い払えるわ！ 引っぱりが弱いと、ひるむだけよ。',
        allow: (a) => a.type === 'elfinGrab',
        done: () => w.stats.repelled >= 1,
        tick: () => {
          if (w.elfin.state === 'absent') w.summonElfin();
        },
        target: () => [view.elfinRect()],
      },
      // ---- コミー
      {
        kind: 'act',
        text: 'コミーが来たわ。席で居眠りしてて、注文してくれないの。ほっぺを引っぱって起こしてあげて！',
        enter: () => guest('komi', ['roll', 'croissant'], 0),
        allow: isPinch,
        done: () => target()?.asleep === false,
        target: () => [cust()],
      },
      {
        kind: 'wait',
        expr: 'smile',
        text: '起きたわね！ 注文のパンを渡してあげて。待たせすぎると、また寝ちゃうから気をつけて。',
        allow: (a) => shop(a) || isServe(a),
        done: servedLeft,
        target: () => [shopArea()],
      },
      // ---- バター
      {
        kind: 'wait',
        expr: 'happy',
        text: 'バターよ。座っているあいだは、つまみ食いに来たエルフィンをパチンコで追い払ってくれるの！',
        enter: () => {
          guest('butter', ['melon', 'roll'], 2);
          w.summonElfin();
        },
        allow: () => false,
        done: () => w.stats.butterShots >= 1 && this.t > 2,
        target: () => [cust(), view.elfinRect()],
      },
      {
        kind: 'wait',
        text: 'バターにもパンを渡して。渡すと帰っちゃうから、そのあとはエルフィンを自分で追い払ってね。',
        allow: (a) => shop(a) || isServe(a) || a.type === 'elfinGrab',
        done: () => servedLeft() && elfinGone(),
        target: () => [union(view.L.showcase, view.L.tray, cust(), view.elfinRect())],
      },
      // ---- ネル
      {
        kind: 'tap',
        expr: 'smile',
        text: 'さいごはネル。注文は最初の3秒しか見えないから、よーく覚えてね！ ぴったり渡せば、女王様のツケを全部払ってくれるわ。',
      },
      {
        kind: 'wait',
        text: '覚えたパンをトレーにそろえて、1回で渡すのよ。忘れたら、ほっぺを引っぱるともう一度見せてくれるわ。',
        enter: () => guest('nell', ['croissant', 'melon'], 1),
        allow: (a) => shop(a) || isServe(a) || isPinch(a),
        done: servedLeft,
        target: () => [shopArea()],
      },
      // ---- フィーバータイム
      {
        kind: 'tap',
        expr: 'happy',
        text: 'さいごに、ごほうびの時間！ 接客を続けるとスピキのゲージがたまって、満タンになるとフィーバータイムよ！',
      },
      {
        kind: 'wait',
        text: 'フィーバー中はパンが減らないし、パンを1個だけほしいお客さんが次々来るわ。どんどん渡して！',
        enter: () => w.startFever(),
        allow: (a) => shop(a) || a.type === 'serve' || a.type === 'pinch',
        done: () => w.fever <= 0,
        target: () => [union(view.L.floor, view.L.showcase, view.L.tray)],
      },
      {
        kind: 'tap',
        expr: 'happy',
        text: 'これで全員の相手はばっちりね！ まずは微辛から。慣れたら少しずつ辛くして、エンドレスにも挑戦してみて！',
      },
    ];

    view.guard = (a) => {
      const s = this.step;
      return !!s && s.kind !== 'tap' && !!s.allow?.(a);
    };
    view.onAction = (a) => {
      const s = this.step;
      if (s?.advance?.(a)) this.next();
    };
    view.overlay = (c) => this.draw(c);
    this.step?.enter?.();
  }

  private get step(): Step | undefined {
    return this.steps[this.index];
  }

  /** 説明を読んでもらっている（タップで進む）手順の途中 */
  get talking(): boolean {
    return this.step?.kind === 'tap';
  }

  get waitingTap(): boolean {
    return this.step?.kind === 'tap' && this.t > 0.35;
  }

  private next(): void {
    this.index++;
    this.t = 0;
    if (!this.step) {
      this.finish();
      return;
    }
    this.step.enter?.();
  }

  private finish(): void {
    this.dispose();
    this.onFinish();
  }

  /** view から外す（スキップしたときも呼ぶ） */
  dispose(): void {
    this.view.guard = null;
    this.view.onAction = null;
    this.view.overlay = null;
  }

  /** 右上の「スキップ」ボタン（ポーズボタンの下） */
  skipRect(): Rect {
    const L = this.view.L;
    return { x: L.w - 166, y: L.hud.h + 10, w: 154, h: 44 };
  }

  /** 画面タップ。説明を読み進めたら true（ゲームには渡さない） */
  tap(): boolean {
    if (this.step?.kind !== 'tap') return false;
    if (this.waitingTap) this.next();
    return true;
  }

  update(dt: number): void {
    this.t += dt;
    const s = this.step;
    s?.tick?.();
    if (s?.done?.() && this.t > 0.3) this.next();
  }

  private draw(c: CanvasRenderingContext2D): void {
    const s = this.step;
    if (!s) return;
    const L = this.view.L;
    const targets = (s.target?.() ?? []).filter((r): r is Rect => !!r);
    const main = targets[0] ?? null;
    const a = Math.min(1, this.t / 0.2);

    // 暗幕（対象だけ明るく残す）
    c.save();
    c.globalAlpha = a;
    c.beginPath();
    c.rect(0, 0, L.w, L.h);
    for (const r of targets) c.roundRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20, 18);
    c.fillStyle = main ? 'rgba(40, 20, 6, 0.45)' : 'rgba(40, 20, 6, 0.3)';
    c.fill('evenodd');
    if (main) {
      const pulse = (Math.sin(this.t * 6) + 1) / 2;
      c.strokeStyle = C.gold;
      c.lineWidth = 4 + pulse * 2;
      roundRect(c, main.x - 10, main.y - 10, main.w + 20, main.h + 20, 18);
      c.stroke();
      if (s.kind === 'act') this.drawPointer(c, main);
    }
    c.restore();
    this.drawSkip(c);

    // エシュールの吹き出し: 指さしの対象と重ならない場所に置く
    const size = L.portrait ? 23 : 22;
    c.save();
    c.font = font(size, 800);
    let bw = Math.min(L.w - 32, 820);
    let bx = (L.w - bw) / 2;
    let below = true;
    if (main) {
      const mx = main.x + main.w / 2;
      const my = main.y + main.h / 2;
      if (L.portrait) below = my < L.h * 0.72;
      else if (my > L.h * 0.5) {
        bw = Math.min(560, L.w / 2 - 24);
        bx = mx < L.w / 2 ? L.w - bw - 16 : 16;
      }
    }
    const lines = wrap(c, s.text, bw - 150);
    const lh = size * 1.45;
    const bh = Math.max(116, 40 + lines.length * lh + (s.kind === 'tap' ? 26 : 0));
    const by = below ? L.h - bh - 16 : L.showcase.y;
    c.globalAlpha = a;
    c.translate(0, (1 - a) * 20);
    c.fillStyle = 'rgba(90, 58, 34, 0.3)';
    roundRect(c, bx + 4, by + 6, bw, bh, 26);
    c.fill();
    c.fillStyle = C.cream;
    roundRect(c, bx, by, bw, bh, 26);
    c.fill();
    c.strokeStyle = C.eshur;
    c.lineWidth = 5;
    c.stroke();
    // 話している間もほっぺを引っぱれる（顔をタップしても読み進められる）
    this.view.drawFace(c, 'tutor', ESHUR, bx + 66, by + Math.min(bh / 2, 70) + 6, 40, { expr: s.expr ?? 'normal', t: this.t, body: false, squash: 1 + Math.sin(this.t * 3) * 0.015 });
    c.fillStyle = C.ink;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    lines.forEach((ln, i) => c.fillText(ln, bx + 128, by + 20 + lh / 2 + i * lh));
    if (s.kind === 'tap' && this.waitingTap) {
      const bob = Math.sin(this.t * 5) * 3;
      c.font = font(16, 800);
      c.fillStyle = C.inkSoft;
      c.textAlign = 'right';
      c.fillText('タップでつぎへ ▶', bx + bw - 24 + bob, by + bh - 20);
    }
    c.restore();
  }

  private drawSkip(c: CanvasRenderingContext2D): void {
    const r = this.skipRect();
    c.save();
    c.fillStyle = 'rgba(40, 20, 6, 0.35)';
    roundRect(c, r.x, r.y + 3, r.w, r.h, r.h / 2);
    c.fill();
    c.fillStyle = C.cream;
    roundRect(c, r.x, r.y, r.w, r.h, r.h / 2);
    c.fill();
    c.strokeStyle = C.woodDeep;
    c.lineWidth = 3;
    c.stroke();
    c.font = font(19, 800);
    c.fillStyle = C.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('スキップ ▶▶', r.x + r.w / 2, r.y + r.h / 2 + 1);
    c.restore();
  }

  private drawPointer(c: CanvasRenderingContext2D, r: Rect): void {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const k = (this.t % 1.2) / 1.2;
    c.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - k)})`;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(cx, cy, 12 + k * 46, 0, Math.PI * 2);
    c.stroke();
    // 上から指す三角
    const y = r.y - 30 - Math.abs(Math.sin(this.t * 5)) * 12;
    c.fillStyle = C.gold;
    c.strokeStyle = C.woodDeep;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(cx - 18, y - 22);
    c.lineTo(cx + 18, y - 22);
    c.lineTo(cx, y);
    c.closePath();
    c.stroke();
    c.fill();
  }
}

function union(...rects: (Rect | null)[]): Rect {
  const rs = rects.filter((r): r is Rect => !!r);
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x, y, w: x1 - x, h: y1 - y };
}

/** 日本語向けの 1 文字単位の折り返し（句読点は行頭に来ないようにする） */
function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (c.measureText(test).width > maxW && line) {
      if ('、。！？）」'.includes(ch)) {
        out.push(test);
        line = '';
        continue;
      }
      out.push(line);
      line = ch === ' ' ? '' : ch;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}
