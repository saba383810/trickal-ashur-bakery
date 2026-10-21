import type { BreadId } from '../config/breads';
import type { World } from '../sim/world';
import { ESHUR } from '../view/draw/characters';
import { drawChibi, type Expr } from '../view/draw/chibi';
import { roundRect } from '../view/draw/ui';
import type { Action, GameView } from '../view/gameView';
import type { Rect } from '../view/layout';
import { C, font } from '../view/palette';

// ステージ 1 冒頭の手順説明。時計を止めた World の上で、指示した操作だけを通す。
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
    const slot = (b: BreadId) => view.L.slots[w.stage.breads.indexOf(b)];
    const cust = () => view.customerRect(this.servedId);
    const servedLeft = () => {
      const c = w.customers.find((x) => x.id === this.servedId);
      return !c || c.state === 'leaving';
    };
    const isServe = (a: Action) => a.type === 'serve' && a.customerId === this.servedId;

    this.steps = [
      {
        kind: 'tap',
        expr: 'happy',
        text: '最強の妖精、大魔法使いエシュールの店へようこそ！ 今日は教主に手伝ってもらうわよ。',
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
        target: () => [union(view.L.showcase, view.L.tray, cust())],
      },
      {
        kind: 'act',
        expr: 'smile',
        text: '待たせすぎるとお客さんは怒って帰っちゃうわ。そんなときは、お客さんを押したまま指をずらして、ほっぺを引っぱってあげて！ ごきげんが満タンに戻るわ（1人1回よ）。',
        enter: () => {
          this.servedId = w.spawnCustomer(['curry'], 2)?.id ?? -1;
        },
        allow: (a) => a.type === 'pinch' && a.customerId === this.servedId,
        advance: (a) => a.type === 'pinch',
        target: () => [cust()],
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
        text: '焼けたわ！ タップして取り出して。放っておくと焦げちゃうから気をつけるのよ！',
        allow: (a) => a.type === 'ovenTap' && a.oven === this.ovenIndex,
        advance: (a) => a.type === 'ovenTap',
        target: () => [view.L.ovens[this.ovenIndex]],
      },
      {
        kind: 'tap',
        expr: 'happy',
        text: `準備はばっちりね。制限時間は${w.stage.duration}秒、たくさん稼ぐわよ！`,
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
    this.view.guard = null;
    this.view.onAction = null;
    this.view.overlay = null;
    this.onFinish();
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
    drawChibi(c, ESHUR, bx + 66, by + Math.min(bh / 2, 70) + 6, 40, { expr: s.expr ?? 'normal', t: this.t, body: false, squash: 1 + Math.sin(this.t * 3) * 0.015 });
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
