import { BREADS, type BreadId } from '../src/config/breads';
import type { Customer, World } from '../src/sim/world';

// バランス調整用のボット。人間と同じく「1 回に 1 操作」で、操作ごとに時間がかかる。
export interface BotSkill {
  name: string;
  /** 1 操作にかかる秒数 */
  actionTime: number;
  /** エルフィンに気づくまでの秒数 */
  noticeElfin: number;
  /** ほっぺを引っぱって離すまでの秒数 */
  pullTime: number;
  /** ネルの注文を覚えられる確率 */
  memory: number;
  /** 焼き上がりに気づくまでの秒数 */
  noticeOven: number;
}

export const SKILLS: BotSkill[] = [
  { name: '初心者', actionTime: 0.95, noticeElfin: 4.5, pullTime: 0.9, memory: 0.6, noticeOven: 3 },
  { name: 'ふつう', actionTime: 0.7, noticeElfin: 3, pullTime: 0.7, memory: 0.85, noticeOven: 2 },
  { name: '上手い', actionTime: 0.5, noticeElfin: 1.5, pullTime: 0.5, memory: 0.97, noticeOven: 1 },
];

export class Bot {
  private busyUntil = 0;
  private pulling = false;
  private remembered = new Map<number, boolean>();
  /** エルフィンが現れた時刻 */
  private elfinSince: number | null = null;

  constructor(
    private w: World,
    private skill: BotSkill,
    private rand: () => number,
  ) {}

  tick(): void {
    const w = this.w;
    if (w.time < this.busyUntil) return;
    if (this.pulling) {
      this.pulling = false;
      w.elfinRelease(1.2);
    }
    const cost = this.act();
    this.busyUntil = w.time + cost;
  }

  /** 1 操作を行い、かかった秒数を返す */
  private act(): number {
    const w = this.w;
    const s = this.skill;
    const t = s.actionTime;

    const ready = w.ovens.findIndex((o) => o.state === 'ready' && o.t >= s.noticeOven);
    if (ready >= 0) return w.tapOven(ready), t;
    const burnt = w.ovens.findIndex((o) => o.state === 'burnt');
    if (burnt >= 0) return w.tapOven(burnt), t;

    const e = w.elfin;
    const active = e.state === 'entering' || e.state === 'eating';
    if (!active) this.elfinSince = null;
    else this.elfinSince ??= w.time;
    if (active && w.time - this.elfinSince! >= s.noticeElfin) {
      if (w.elfinGrab()) {
        this.pulling = true;
        return s.pullTime;
      }
    }

    const all = w.customers.filter((c) => c.state === 'waiting').sort((a, b) => a.patience - b.patience);
    // 寝ているコミーと、帰りそうな客はほっぺを引っぱる
    const pinch = all.find((c) => c.asleep || (c.kind !== 'nell' && !c.mochi && c.patience < 2.5));
    if (pinch) return w.pinchCustomer(pinch.id), s.pullTime;
    const waiting = all.filter((c) => !c.asleep);

    const nell = waiting.find((c) => c.kind === 'nell');
    if (nell) {
      const done = this.handleNell(nell);
      if (done !== null) return done;
    }

    for (const c of waiting) {
      if (c.kind === 'nell') continue;
      if (this.need(c).some((b) => w.tray.includes(b))) return w.serve(c.id), t;
    }

    // トレーを埋める（ネルのために空けておく判断はしない）
    if (w.tray.length < 4) {
      for (const c of waiting) {
        if (c.kind === 'nell') continue;
        const missing = this.missingFromTray(c);
        const bread = missing.find((b) => w.stock[b] > 0);
        if (bread) return w.pickBread(bread), t;
      }
    } else if (!waiting.some((c) => c.kind === 'normal' && this.need(c).some((b) => w.tray.includes(b)))) {
      return w.returnTray(0), t;
    }

    const idle = w.ovens.findIndex((o) => o.state === 'idle');
    if (idle >= 0) {
      const bread = this.mostNeeded();
      if (bread) return w.bake(idle, bread), t;
    }
    return 0.1;
  }

  private handleNell(nell: Customer): number | null {
    const w = this.w;
    const t = this.skill.actionTime;
    if (!this.remembered.has(nell.id)) this.remembered.set(nell.id, this.rand() < this.skill.memory);
    if (!this.remembered.get(nell.id)) {
      if (w.tray.length > 0) return w.returnTray(0), t;
      w.serve(nell.id);
      this.remembered.set(nell.id, this.rand() < this.skill.memory);
      return t + 1;
    }
    // 足りないパンがあるうちは焼くだけにして、トレーは他の客に使う
    const lacking = nell.order.find((b) => w.stock[b] + w.tray.filter((x) => x === b).length < count(nell.order, b));
    if (lacking) {
      const idle = w.ovens.findIndex((o) => o.state === 'idle');
      if (idle >= 0 && !w.ovens.some((o) => o.bread === lacking)) return w.bake(idle, lacking), t;
      return null;
    }
    const want = [...nell.order];
    for (const b of w.tray) {
      const i = want.indexOf(b);
      if (i >= 0) want.splice(i, 1);
      else return w.returnTray(w.tray.indexOf(b)), t;
    }
    if (want.length === 0) return w.serve(nell.id), t;
    const bread = want.find((b) => w.stock[b] > 0);
    if (bread && w.tray.length < 4) return w.pickBread(bread), t;
    return null;
  }

  private need(c: Customer): BreadId[] {
    return c.order.filter((_, i) => !c.received[i]);
  }

  private missingFromTray(c: Customer): BreadId[] {
    const tray = [...this.w.tray];
    return this.need(c).filter((b) => {
      const i = tray.indexOf(b);
      if (i < 0) return true;
      tray.splice(i, 1);
      return false;
    });
  }

  /** 在庫 + 焼成中 が需要に比べて一番少ないパン */
  private mostNeeded(): BreadId | null {
    const w = this.w;
    let best: BreadId | null = null;
    let bestScore = Infinity;
    for (const b of w.stage.breads) {
      const demand = w.customers.reduce((n, c) => n + this.need(c).filter((x) => x === b).length, 0);
      const baking = w.ovens.filter((o) => o.bread === b).length * BREADS[b].batch;
      const score = w.stock[b] + baking - demand * 1.5 - BREADS[b].popularity * 0.3;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }
}

function count(list: readonly BreadId[], b: BreadId): number {
  return list.filter((x) => x === b).length;
}
