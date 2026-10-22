import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { BREADS, type BreadId } from '../src/config/breads';
import { PLAY_STAGES, STAGES, type EndlessDef, type StageDef } from '../src/config/stages';
import { sameBreads, starsFor, World, type Customer } from '../src/sim/world';

const DT = 1 / 60;

function stage(over: Partial<StageDef> = {}): StageDef {
  return {
    id: 'test',
    title: 'test',
    heat: 1,
    blurb: '',
    duration: 120,
    breads: ['roll', 'croissant', 'melon'],
    ovens: 2,
    seats: 3,
    initialStock: 3,
    burnTime: 7,
    customer: { intervalStart: 5, intervalEnd: 5, jitter: 0, itemWeights: [1], patienceBase: 10, patiencePerItem: 5 },
    elfin: null,
    nellVisits: [],
    nellItems: 3,
    komi: [],
    butter: [],
    stars: [100, 200, 300],
    ...over,
  };
}

/** 自動来店なしのワールド */
function quiet(over: Partial<StageDef> = {}): World {
  const w = new World(stage(over), 1);
  w.autoSpawn = false;
  return w;
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) w.step(DT);
}

function seated(w: World, order: Parameters<World['spawnCustomer']>[0]) {
  const c = w.spawnCustomer(order)!;
  run(w, BALANCE.customer.enterTime + 0.05);
  return c;
}

describe('ショーケースとトレー', () => {
  it('パンをのせると在庫が減り、戻すと増える', () => {
    const w = quiet();
    expect(w.pickBread('roll')).toBe(true);
    expect(w.stock.roll).toBe(2);
    expect(w.tray).toEqual(['roll']);
    w.returnTray(0);
    expect(w.stock.roll).toBe(3);
    expect(w.tray).toEqual([]);
  });

  it('在庫切れとトレー満杯ではのせられない', () => {
    const w = quiet({ initialStock: 5 });
    for (let i = 0; i < BALANCE.trayCapacity; i++) w.pickBread('roll');
    expect(w.pickBread('roll')).toBe(false);
    expect(w.drainEvents().at(-1)).toMatchObject({ type: 'pickFail', reason: 'full' });
    w.tray = [];
    w.stock.melon = 0;
    expect(w.pickBread('melon')).toBe(false);
  });
});

describe('通常客', () => {
  it('注文に含まれるパンだけを受け取り、残りはトレーに残る', () => {
    const w = quiet();
    const c = seated(w, ['roll', 'melon']);
    w.pickBread('roll');
    w.pickBread('croissant');
    expect(w.serve(c.id)).toBe('partial');
    expect(w.tray).toEqual(['croissant']);
    expect(c.received).toEqual([true, false]);
  });

  it('合うパンが無いと待ち時間が減る。トレーが空なら何も起きない', () => {
    const w = quiet();
    const c = seated(w, ['roll']);
    expect(w.serve(c.id)).toBe('none');
    w.pickBread('melon');
    const before = c.patience;
    expect(w.serve(c.id)).toBe('wrong');
    expect(c.patience).toBeCloseTo(before - BALANCE.customer.wrongPenalty);
  });

  it('すぐ渡すと早さチップ、連続で渡すとコンボが乗る', () => {
    const w = quiet();
    const a = seated(w, ['roll']);
    w.pickBread('roll');
    w.serve(a.id);
    const b = seated(w, ['roll']);
    w.pickBread('roll');
    w.serve(b.id);
    const done = w.drainEvents().filter((e) => e.type === 'serveComplete');
    expect(done[0]).toMatchObject({ payment: { base: 100, tip: 20, combo: 0, total: 120 }, combo: 1 });
    expect(done[1]).toMatchObject({ payment: { base: 100, tip: 20, combo: 6, total: 126 }, combo: 2 });
    expect(w.sales).toBe(246);
  });

  it('待ち時間切れで怒って帰り、コンボが途切れる', () => {
    const w = quiet();
    w.combo = 3;
    seated(w, ['roll']);
    run(w, 16);
    expect(w.combo).toBe(0);
    expect(w.stats.angry).toBe(1);
    expect(w.customers).toHaveLength(0);
  });
});

describe('オーブン', () => {
  it('焼いて取り出すと在庫が増える', () => {
    const w = quiet();
    w.bake(0, 'croissant');
    run(w, BREADS.croissant.bakeTime + 0.1);
    expect(w.ovens[0].state).toBe('ready');
    w.tapOven(0);
    expect(w.stock.croissant).toBe(3 + BREADS.croissant.batch);
    expect(w.ovens[0].state).toBe('idle');
  });

  it('放置すると焦げて全損し、片付けると空く', () => {
    const w = quiet();
    w.bake(1, 'roll');
    run(w, BREADS.roll.bakeTime + 7 + 0.1);
    expect(w.ovens[1].state).toBe('burnt');
    expect(w.stats.burnt).toBe(1);
    w.tapOven(1);
    expect(w.ovens[1].state).toBe('idle');
    expect(w.stock.roll).toBe(3);
  });

  it('焦げないモードでは、焼けたパンが取り出すまで待ってくれる', () => {
    const w = quiet({ burnTime: null });
    w.bake(0, 'roll');
    run(w, 60);
    expect(w.ovens[0].state).toBe('ready');
    expect(w.tapOven(0)).toBe(true);
    expect(w.stock.roll).toBe(3 + BREADS.roll.batch);
  });

  it('凍結中（チュートリアル）は焼けるが焦げない', () => {
    const w = quiet();
    w.frozen = true;
    w.bake(0, 'roll');
    run(w, 30);
    expect(w.ovens[0].state).toBe('ready');
    expect(w.time).toBe(0);
  });

  it('凍結中も客は席に着くが、待ち時間は減らない', () => {
    const w = quiet();
    w.frozen = true;
    const c = w.spawnCustomer(['roll'], 0)!;
    run(w, 30);
    expect(c.state).toBe('waiting');
    expect(c.patience).toBe(c.patienceMax);
  });
});

const ELFIN = { firstAt: 1, intervalMin: 10, intervalMax: 10, eatInterval: 2, maxEat: 2 };

describe('エルフィン', () => {
  it('高いパンから食べてツケが貯まり、満腹で帰る', () => {
    const w = quiet({ elfin: ELFIN });
    run(w, 1 + BALANCE.elfin.enterTime + 2.1);
    expect(w.elfin.state).toBe('eating');
    expect(w.stock.melon).toBe(2);
    expect(w.tab).toBe(BREADS.melon.price);
    run(w, 2);
    expect(w.tab).toBe(BREADS.melon.price * 2);
    expect(w.elfin.state).toBe('leaving');
    expect(w.sales).toBe(0);
  });

  it('引っぱって離すと追い払える。足りないとひるむだけ', () => {
    const w = quiet({ elfin: ELFIN });
    run(w, 2);
    expect(w.elfinGrab()).toBe(true);
    expect(w.elfinRelease(0.5)).toBe(false);
    expect(w.elfin.stun).toBeGreaterThan(0);
    w.elfinGrab();
    expect(w.elfinRelease(1.2)).toBe(true);
    expect(w.elfin.state).toBe('launched');
    expect(w.stats.repelled).toBe(1);
  });

  it('つかんでいる間は食べない', () => {
    const w = quiet({ elfin: ELFIN });
    run(w, 1 + BALANCE.elfin.enterTime + 0.1);
    w.elfinGrab();
    run(w, 10);
    expect(w.tab).toBe(0);
  });
});

describe('ネル', () => {
  const nellStage = { nellVisits: [20], seats: 2 } satisfies Partial<StageDef>;

  function nellSeated(w: World) {
    run(w, 20 + BALANCE.customer.enterTime + 0.05);
    return w.customers.find((c) => c.kind === 'nell')!;
  }

  it('予告が来るとエルフィンが逃げ、予告中は新しい客が 1 席空けて座る', () => {
    const hungry = { ...ELFIN, firstAt: 5, maxEat: 99 };
    const w = new World(stage({ ...nellStage, elfin: hungry, initialStock: 9 }), 3);
    run(w, 20 - BALANCE.nell.announceLead - 0.1);
    expect(w.elfin.state).toBe('eating');
    run(w, 0.2);
    expect(w.nellPendingAt).toBe(20);
    expect(w.elfin.state).toBe('leaving');
    run(w, BALANCE.nell.announceLead - 0.5);
    expect(w.customers.filter((c) => c.state !== 'leaving').length).toBeLessThanOrEqual(1);
  });

  it('注文は最初の数秒だけ見え、空トレーでタップするともう一度見せてくれる', () => {
    const w = quiet(nellStage);
    const nell = nellSeated(w);
    expect(nell.order).toHaveLength(3);
    expect(nell.reveal).toBeGreaterThan(0);
    run(w, BALANCE.nell.revealTime);
    expect(nell.reveal).toBe(0);
    const before = nell.patience;
    expect(w.serve(nell.id)).toBe('peek');
    expect(nell.reveal).toBe(BALANCE.nell.peekTime);
    expect(nell.patience).toBeCloseTo(before - BALANCE.nell.peekCost);
  });

  it('過不足があると受け取らず、ぴったりならツケを回収して祝福がつく', () => {
    const w = quiet(nellStage);
    w.tab = 500;
    const nell = nellSeated(w);
    w.stock.roll = w.stock.croissant = w.stock.melon = 9;
    for (const b of nell.order) w.pickBread(b);
    w.pickBread('roll');
    expect(w.serve(nell.id)).toBe('wrong');
    w.returnTray(w.tray.length - 1);
    w.tray.reverse();
    expect(w.serve(nell.id)).toBe('complete');
    expect(w.tab).toBe(0);
    expect(w.ledger.tabCollected).toBe(500);
    expect(w.buff).toBe(BALANCE.nell.buffDuration);

    const c = seated(w, ['roll']);
    w.pickBread('roll');
    w.serve(c.id);
    const done = w.drainEvents().find((e) => e.type === 'serveComplete');
    expect(done).toMatchObject({ payment: { base: 100, tip: 20, nell: 24, total: 144 } });
  });

  it('失敗するとツケは残り、祝福もつかない', () => {
    const w = quiet(nellStage);
    w.tab = 300;
    nellSeated(w);
    run(w, BALANCE.nell.patienceBase + BALANCE.nell.patiencePerItem * 3 + 1);
    expect(w.stats.nellFail).toBe(1);
    expect(w.tab).toBe(300);
    expect(w.buff).toBe(0);
  });
});

describe('ほっぺ', () => {
  it('客のほっぺを引っぱると 1 人 1 回だけ待ち時間が全回復する', () => {
    const w = quiet();
    const c = seated(w, ['roll']);
    run(w, 5);
    expect(c.patience).toBeLessThan(c.patienceMax);
    expect(w.pinchCustomer(c.id)).toBe('refill');
    expect(c.patience).toBe(c.patienceMax);
    run(w, 1);
    expect(w.pinchCustomer(c.id)).toBe('none');
    expect(c.patience).toBeLessThan(c.patienceMax);
    expect(w.stats.mochi).toBe(1);
  });

  it('ネルのほっぺを引っぱると、注文をもう一度見せてくれる', () => {
    const w = quiet({ nellVisits: [1] });
    run(w, 1 + BALANCE.customer.enterTime + BALANCE.nell.revealTime + 0.1);
    const nell = w.customers.find((c) => c.kind === 'nell')!;
    expect(nell.reveal).toBe(0);
    expect(w.pinchCustomer(nell.id)).toBe('peek');
    expect(nell.reveal).toBe(BALANCE.nell.peekTime);
  });
});

describe('コミー', () => {
  function komiSeated(w: World) {
    run(w, 1 + BALANCE.customer.enterTime + 0.05);
    return w.customers.find((c) => c.kind === 'komi')!;
  }

  it('席に着くと居眠りし、寝ている間は受け取らず待ち時間も減らない', () => {
    const w = quiet({ komi: [1] });
    const komi = komiSeated(w);
    expect(komi.asleep).toBe(true);
    expect(komi.order).toHaveLength(BALANCE.komi.items);
    run(w, 20);
    expect(komi.state).toBe('waiting');
    expect(komi.patience).toBe(komi.patienceMax);
    w.pickBread(komi.order[0]);
    expect(w.serve(komi.id)).toBe('asleep');
    expect(w.tray).toHaveLength(1);
  });

  it('ほっぺを引っぱると起きて注文し、待ちくたびれると怒らずにまた眠る', () => {
    const w = quiet({ komi: [1] });
    const komi = komiSeated(w);
    expect(w.pinchCustomer(komi.id)).toBe('wake');
    expect(komi.asleep).toBe(false);
    run(w, komi.patienceMax + 0.1);
    expect(komi.asleep).toBe(true);
    expect(komi.state).toBe('waiting');
    expect(w.stats.angry).toBe(0);
    w.pinchCustomer(komi.id);
    w.stock.roll = w.stock.croissant = w.stock.melon = 9;
    for (const b of komi.order) w.pickBread(b);
    expect(w.serve(komi.id)).toBe('complete');
  });
});

describe('バター', () => {
  it('座っている間はエルフィンをパチンコで撃ち、つまみ食いさせない', () => {
    const w = quiet({ elfin: { ...ELFIN, firstAt: 1, maxEat: 99 }, butter: [0.5], initialStock: 9 });
    run(w, 12);
    const butter = w.customers.find((c) => c.kind === 'butter')!;
    expect(butter.state).toBe('waiting');
    expect(butter.order).toHaveLength(BALANCE.butter.items);
    expect(w.stats.butterShots).toBeGreaterThan(0);
    expect(w.tab).toBe(0);
  });

  it('バターが帰るとエルフィンはまた食べはじめる', () => {
    const w = quiet({ elfin: { ...ELFIN, firstAt: 1, maxEat: 99 }, butter: [0.5], initialStock: 9 });
    run(w, 3);
    const butter = w.customers.find((c) => c.kind === 'butter')!;
    for (const b of butter.order) w.pickBread(b);
    expect(w.serve(butter.id)).toBe('complete');
    run(w, 5);
    expect(w.tab).toBeGreaterThan(0);
  });
});

describe('エンドレス', () => {
  const ENDLESS = STAGES.find((x) => x.endless)!.endless!;
  const endless = (over: Partial<EndlessDef> = {}) => quiet({ duration: 30, endless: { ...ENDLESS, ...over } });

  it('会計するたびに時間が延び、コンボが続くほど長く延びる', () => {
    const w = endless({ maxRemaining: 999 });
    const before = w.timeLimit;
    const a = w.spawnCustomer(['roll'], 0)!;
    run(w, 1);
    w.pickBread('roll');
    expect(w.serve(a.id)).toBe('complete');
    const first = w.timeLimit - before;
    expect(first).toBeCloseTo(ENDLESS.timeBase + ENDLESS.timePerCombo * 1);
    const b = w.spawnCustomer(['roll'], 1)!;
    run(w, 1);
    w.pickBread('roll');
    w.serve(b.id);
    expect(w.timeLimit - before - first).toBeCloseTo(ENDLESS.timeBase + ENDLESS.timePerCombo * 2);
    expect(w.stats.timeAdded).toBeCloseTo(w.timeLimit - before);
  });

  it('残り時間は上限までしか延びず、延びなければ時間切れで終わる', () => {
    const w = endless({ maxRemaining: 29.5 });
    const c = w.spawnCustomer(['roll'], 0)!;
    run(w, 1);
    w.pickBread('roll');
    w.serve(c.id);
    expect(w.remaining).toBeCloseTo(29.5, 5);
    run(w, 31);
    expect(w.phase).toBe('ended');
  });

  it('時間がたつとレベルが上がり、来店が早く・待ち時間が短くなる', () => {
    const w = endless();
    w.timeLimit = 1e9;
    const first = w.spawnCustomer(['roll'], 0)!;
    run(w, ENDLESS.levelTime * 3 + 0.1);
    expect(w.level).toBe(4);
    expect(w.drainEvents().filter((e) => e.type === 'levelUp')).toHaveLength(3);
    const later = w.spawnCustomer(['roll'], 1)!;
    expect(later.patienceMax).toBeLessThan(first.patienceMax);
  });

  it('焼けたパンは burnLevel になるまで焦げず、そこから焦げるまでの時間を数えはじめる', () => {
    const w = endless({ levelTime: 20, burnLevel: 2 });
    w.timeLimit = 1e9;
    w.bake(0, 'roll');
    run(w, 19);
    expect(w.burnTime).toBeNull();
    expect(w.ovens[0].state).toBe('ready');
    run(w, 1.1);
    expect(w.level).toBe(2);
    expect(w.burnTime).toBe(7);
    expect(w.ovens[0].state).toBe('ready');
    run(w, 7);
    expect(w.ovens[0].state).toBe('burnt');
  });

  it('ネル・コミー・バターは何度もやってくる', () => {
    const w = quiet({ duration: 30, endless: ENDLESS, nellVisits: [5], komi: [3], butter: [4], seats: 4 });
    w.timeLimit = 1e9;
    let nell = 0;
    let komi = 0;
    for (let t = 0; t < 400; t += 0.5) {
      run(w, 0.5);
      for (const e of w.drainEvents()) {
        if (e.type === 'nellAnnounce') nell++;
        if (e.type === 'komiArrive') komi++;
      }
      // 席が空くように、来た客はすぐ帰す
      for (const c of w.customers) {
        if (c.state !== 'waiting' || c.kind === 'nell') continue;
        c.kind = 'normal';
        c.asleep = false;
        c.patience = 0;
      }
    }
    expect(nell).toBeGreaterThan(2);
    expect(komi).toBeGreaterThan(2);
  });

  it('ふつうのモードでは時間が延びない', () => {
    const w = quiet();
    const c = w.spawnCustomer(['roll'], 0)!;
    run(w, 1);
    w.pickBread('roll');
    w.serve(c.id);
    expect(w.timeLimit).toBe(w.stage.duration);
  });
});

describe('チュートリアル用の操作', () => {
  it('時計を止めたまま、呼んだエルフィンは入ってきて食べ、バターは撃つ', () => {
    const w = quiet({ elfin: { ...ELFIN, firstAt: Infinity, maxEat: 9 }, initialStock: 5 });
    w.frozen = true;
    w.summonElfin();
    run(w, BALANCE.elfin.enterTime + ELFIN.eatInterval + 0.2);
    expect(w.time).toBe(0);
    expect(w.elfin.state).toBe('eating');
    expect(w.tab).toBeGreaterThan(0);
    const butter = w.spawnGuest('butter', ['roll', 'melon'], 0)!;
    run(w, 3);
    expect(butter.order).toEqual(['roll', 'melon']);
    expect(w.stats.butterShots).toBeGreaterThan(0);
  });
});

describe('モード定義', () => {
  it('どのモードにもエルフィン・ネル・コミー・バターが来て、制限時間内に収まる', () => {
    for (const s of PLAY_STAGES) {
      expect(s.elfin, s.id).not.toBeNull();
      expect(s.nellVisits.length, s.id).toBeGreaterThan(0);
      expect(s.komi.length, s.id).toBeGreaterThan(0);
      expect(s.butter.length, s.id).toBeGreaterThan(0);
      for (const t of [...s.nellVisits, ...s.komi, ...s.butter]) expect(t, s.id).toBeLessThan(s.duration - BALANCE.closingTime);
      expect(s.stars[0]).toBeLessThan(s.stars[1]);
      expect(s.stars[1]).toBeLessThan(s.stars[2]);
    }
  });

  it('微辛 → 中辛 → 激辛 の順に長く・忙しくなる', () => {
    const [mild, medium, hot] = PLAY_STAGES.filter((s) => !s.endless);
    expect(mild.duration).toBeLessThan(medium.duration);
    expect(medium.duration).toBeLessThan(hot.duration);
    expect(mild.breads.length).toBeLessThan(hot.breads.length);
    expect(mild.customer.intervalEnd).toBeGreaterThan(hot.customer.intervalEnd);
  });
});

describe('注文の偏り', () => {
  /** 1 個ずつの注文を n 件。毎回すぐ帰すので、ほかの待っている注文は変わらない */
  function orders(w: World, n: number): BreadId[] {
    const out: BreadId[] = [];
    for (let i = 0; i < n; i++) {
      const c = w.spawnCustomer(undefined, 0)!;
      out.push(c.order[0]);
      w.customers.splice(w.customers.indexOf(c), 1);
    }
    return out;
  }

  function longestRun(items: BreadId[]): number {
    let best = 0;
    let n = 0;
    items.forEach((b, i) => {
      n = b === items[i - 1] ? n + 1 : 1;
      best = Math.max(best, n);
    });
    return best;
  }

  const share = (items: BreadId[], b: BreadId) => items.filter((x) => x === b).length / items.length;

  it('同じパンが続くのは maxRun 件まで。続けて同じパンになることも少ない', () => {
    let repeats = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const items = orders(new World(stage(), seed), 300);
      expect(longestRun(items)).toBeLessThanOrEqual(BALANCE.orderBias.maxRun);
      repeats += items.filter((b, i) => b === items[i - 1]).length;
    }
    // 偏りを抑えないと、人気 5/4/4 の 3 種では約 34% が直前と同じになる
    expect(repeats / 1500).toBeLessThan(0.28);
  });

  it('パンが 1 種だけでも注文は作れる', () => {
    const items = orders(new World(stage({ breads: ['roll'] }), 1), 10);
    expect(items.every((b) => b === 'roll')).toBe(true);
  });

  it('手持ちが足りないパンは頼まれにくく、焼いている分は手持ちに数える', () => {
    const w = quiet();
    expect(share(orders(w, 600), 'roll')).toBeGreaterThan(0.3);
    w.stock.roll = 0;
    expect(share(orders(w, 600), 'roll')).toBeLessThan(0.25);
    w.bake(0, 'roll');
    expect(share(orders(w, 600), 'roll')).toBeGreaterThan(0.3);
  });

  it('待っている注文に取られた分は手持ちから引く', () => {
    const w = quiet();
    w.spawnCustomer(['roll', 'roll', 'roll'], 1);
    w.spawnCustomer(['roll', 'roll'], 2);
    expect(w.spareBreads().roll).toBe(-2);
    expect(share(orders(w, 600), 'roll')).toBeLessThan(0.1);
  });
});

describe('微辛', () => {
  it('パンは 2 種で焦げない。注文は通常客とコミーが 1 個、ネルとバターが 2 個', () => {
    const mild = PLAY_STAGES.find((s) => s.id === 'mild')!;
    expect(mild.breads).toHaveLength(2);
    expect(mild.burnTime).toBeNull();
    const w = new World(mild, 7);
    const seen = new Map<number, Customer>();
    while (w.phase === 'playing') {
      w.step(DT);
      for (const c of w.customers) seen.set(c.id, c);
    }
    const sizes = (kind: Customer['kind']) => [...new Set([...seen.values()].filter((c) => c.kind === kind).map((c) => c.order.length))];
    expect(sizes('normal')).toEqual([1]);
    expect(sizes('komi')).toEqual([1]);
    expect(sizes('nell')).toEqual([2]);
    expect(sizes('butter')).toEqual([2]);
    for (const c of seen.values()) expect(c.order.every((b) => mild.breads.includes(b))).toBe(true);
  });
});

describe('終了と評価', () => {
  it('時間切れで終了し、以降の操作は受け付けない', () => {
    const w = quiet({ duration: 3 });
    run(w, 3.1);
    expect(w.phase).toBe('ended');
    expect(w.pickBread('roll')).toBe(false);
  });

  it('★は目標売上で決まる', () => {
    const s = stage();
    expect([0, 150, 250, 999].map((v) => starsFor(s, v))).toEqual([0, 1, 2, 3]);
  });

  it('sameBreads は順番を問わない', () => {
    expect(sameBreads(['roll', 'melon'], ['melon', 'roll'])).toBe(true);
    expect(sameBreads(['roll', 'roll'], ['roll', 'melon'])).toBe(false);
  });
});
