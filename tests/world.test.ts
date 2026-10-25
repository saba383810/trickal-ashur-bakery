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

const ELFIN = { firstAt: 1, intervalMin: 10, intervalMax: 10 };
const EB = BALANCE.elfin;

describe('エルフィン', () => {
  it('駆けこんで少し立ち止まり、一番高いパンを 1 個だけツケで持って帰る', () => {
    const w = quiet({ elfin: ELFIN });
    run(w, 1.05);
    expect(w.elfin.state).toBe('entering');
    run(w, EB.enterTime);
    expect(w.elfin.state).toBe('lingering');
    expect(w.tab).toBe(0);
    run(w, EB.lingerTime);
    expect(w.elfin.state).toBe('leaving');
    expect(w.elfin.bread).toBe('melon');
    expect(w.stock.melon).toBe(2);
    expect(w.tab).toBe(BREADS.melon.price);
    expect(w.stats.elfinAte).toBe(1);
    expect(w.sales).toBe(0);
    const types = w.drainEvents().map((e) => e.type);
    expect(types).toEqual(['elfinEnter', 'elfinEat', 'elfinLeave']);
    run(w, EB.leaveTime);
    expect(w.elfin.state).toBe('absent');
    expect(w.tab).toBe(BREADS.melon.price);
  });

  it('取れるパンが無ければ、少しむくれて手ぶらで帰る', () => {
    const w = quiet({ elfin: ELFIN, initialStock: 0 });
    run(w, 1 + EB.enterTime + EB.lingerTime + 0.05);
    expect(w.elfin.state).toBe('sulking');
    expect(w.drainEvents().map((e) => e.type)).toContain('elfinSulk');
    run(w, EB.sulkTime);
    expect(w.elfin.state).toBe('leaving');
    expect(w.elfin.bread).toBeNull();
    expect(w.tab).toBe(0);
    expect(w.stats.elfinAte).toBe(0);
  });

  it('むくれている間にパンが焼けても、取らずに帰る', () => {
    const w = quiet({ elfin: ELFIN, initialStock: 0 });
    run(w, 1 + EB.enterTime + EB.lingerTime + 0.05);
    w.stock.roll = 3;
    run(w, EB.sulkTime);
    expect(w.elfin.state).toBe('leaving');
    expect(w.stock.roll).toBe(3);
    expect(w.tab).toBe(0);
  });

  it('帰ったら間隔をあけて、また来る', () => {
    const w = quiet({ elfin: ELFIN, initialStock: 9 });
    run(w, 1 + EB.enterTime + EB.lingerTime + EB.leaveTime + 0.1);
    expect(w.elfin.state).toBe('absent');
    run(w, ELFIN.intervalMin - 0.2);
    expect(w.elfin.state).toBe('absent');
    run(w, 0.3);
    expect(w.elfin.state).toBe('entering');
  });

  it('閉店間際には来ない', () => {
    const w = quiet({ duration: 20, elfin: { firstAt: 20 - BALANCE.closingTime - 0.5, intervalMin: 1, intervalMax: 1 } });
    run(w, 20);
    expect(w.stats.elfinAte).toBe(0);
    expect(w.elfin.state).toBe('absent');
  });
});

describe('ネル', () => {
  const nellStage = { nellVisits: [20], seats: 2 } satisfies Partial<StageDef>;

  function nellSeated(w: World) {
    run(w, 20 + BALANCE.customer.enterTime + 0.05);
    return w.customers.find((c) => c.kind === 'nell')!;
  }

  it('予告が来るとエルフィンが手ぶらで逃げ、予告中は新しい客が 1 席空けて座る', () => {
    const early = { ...ELFIN, firstAt: 20 - BALANCE.nell.announceLead - 0.3 };
    const w = new World(stage({ ...nellStage, elfin: early, initialStock: 9 }), 3);
    run(w, 20 - BALANCE.nell.announceLead - 0.1);
    expect(w.elfin.state).toBe('entering');
    run(w, 0.2);
    expect(w.nellPendingAt).toBe(20);
    expect(w.elfin.state).toBe('leaving');
    expect(w.elfin.bread).toBeNull();
    expect(w.drainEvents()).toContainEqual({ type: 'elfinFlee', reason: 'nell' });
    run(w, BALANCE.nell.announceLead - 0.5);
    expect(w.customers.filter((c) => c.state !== 'leaving').length).toBeLessThanOrEqual(1);
  });

  it('ネルが店にいる間はエルフィンが来ず、帰ってから afterNell 秒で戻ってくる', () => {
    const w = quiet({ nellVisits: [8], seats: 2, elfin: { firstAt: 1, intervalMin: 0.5, intervalMax: 0.5 }, initialStock: 9 });
    run(w, 1.2);
    expect(w.elfin.state).toBe('entering');
    // 予告からネルが席に着いて待つまで、一度も入ってこず、ツケも増えない
    let came = false;
    let tabAtAnnounce: number | null = null;
    const waitingNell = () => w.customers.find((c) => c.kind === 'nell' && c.state === 'waiting');
    for (let i = 0; i < 1200 && !waitingNell(); i++) {
      w.step(DT);
      if (w.nellInShop) tabAtAnnounce ??= w.tab;
      if (w.nellInShop && w.elfinInShop) came = true;
    }
    expect(came).toBe(false);
    expect(w.tab).toBe(tabAtAnnounce);
    const nell = waitingNell()!;
    for (const b of nell.order) w.pickBread(b);
    expect(w.serve(nell.id)).toBe('complete');
    run(w, EB.afterNell - 0.2);
    expect(w.elfin.state).toBe('absent');
    run(w, 0.4);
    expect(w.elfin.state).toBe('entering');
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
  it('座っている間は、パンを取る前のエルフィンをパチンコで撃って手ぶらで追い返す', () => {
    const w = quiet({ elfin: { ...ELFIN, firstAt: 2 }, butter: [0.5], initialStock: 9 });
    run(w, 2 + BALANCE.butter.aim + 0.05);
    const butter = w.customers.find((c) => c.kind === 'butter')!;
    expect(butter.state).toBe('waiting');
    expect(butter.order).toHaveLength(BALANCE.butter.items);
    expect(w.stats.butterShots).toBe(1);
    expect(w.elfin.state).toBe('leaving');
    expect(w.elfin.bread).toBeNull();
    const types = w.drainEvents().map((e) => e.type);
    expect(types).toContain('butterShot');
    expect(types).toContain('elfinFlee');
    // 座っている間は、来るたびに追い返す
    run(w, 23);
    expect(w.stats.butterShots).toBe(3);
    expect(w.tab).toBe(0);
    expect(w.stats.elfinAte).toBe(0);
  });

  it('エルフィンが先に来ていても、パンを取られる前に撃つ', () => {
    const w = quiet({ elfin: ELFIN, butter: [0.6], initialStock: 9 });
    run(w, 1 + EB.enterTime + EB.lingerTime + 0.1);
    expect(w.stats.butterShots).toBe(1);
    expect(w.tab).toBe(0);
  });

  it('座っていれば必ず間に合う（エルフィンがパンを取るより早く撃つ）', () => {
    expect(BALANCE.butter.aim).toBeLessThan(EB.enterTime + EB.lingerTime);
  });

  it('バターが帰るとエルフィンはまたパンを持っていく', () => {
    const w = quiet({ elfin: { ...ELFIN, firstAt: 3 }, butter: [0.5], initialStock: 9 });
    run(w, 2);
    const butter = w.customers.find((c) => c.kind === 'butter')!;
    for (const b of butter.order) w.pickBread(b);
    expect(w.serve(butter.id)).toBe('complete');
    run(w, 3);
    expect(w.stats.butterShots).toBe(0);
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
  it('時計を止めたまま、呼んだエルフィンはパンを持って帰り、座ったバターは撃つ', () => {
    const w = quiet({ elfin: { ...ELFIN, firstAt: Infinity }, initialStock: 5 });
    w.frozen = true;
    w.summonElfin();
    run(w, EB.enterTime + EB.lingerTime + 0.1);
    expect(w.time).toBe(0);
    expect(w.elfin.state).toBe('leaving');
    expect(w.tab).toBe(BREADS.melon.price);
    // 時計が止まっている間は、自分からはまた来ない
    run(w, EB.leaveTime + 12);
    expect(w.elfin.state).toBe('absent');
    const butter = w.spawnGuest('butter', ['roll', 'melon'], 0)!;
    run(w, BALANCE.customer.enterTime + 0.1);
    w.summonElfin();
    run(w, BALANCE.butter.aim + 0.1);
    expect(butter.order).toEqual(['roll', 'melon']);
    expect(w.stats.butterShots).toBe(1);
    expect(w.elfin.bread).toBeNull();
    expect(w.tab).toBe(BREADS.melon.price);
  });
});

describe('フィーバータイム', () => {
  const F = BALANCE.fever;

  /** 1 個注文の客を座らせて会計する */
  function serveOne(w: World): void {
    const c = seated(w, ['roll']);
    w.pickBread('roll');
    w.serve(c.id);
    run(w, BALANCE.customer.leaveTime + BALANCE.customer.minGapAfterLeave + 0.05);
  }

  it('会計 feverServes 回でゲージが満タンになって始まり、時間がたつと終わってゲージが空になる', () => {
    const w = quiet({ feverServes: 3, initialStock: 9 });
    serveOne(w);
    serveOne(w);
    expect(w.feverGauge).toBe(2);
    expect(w.fever).toBe(0);
    const c = seated(w, ['roll']);
    w.pickBread('roll');
    w.drainEvents();
    w.serve(c.id);
    expect(w.drainEvents().map((e) => e.type)).toEqual(['serveComplete', 'feverStart']);
    expect(w.fever).toBe(F.duration);
    expect(w.stats.fevers).toBe(1);
    run(w, F.duration + 0.1);
    expect(w.fever).toBe(0);
    expect(w.feverGauge).toBe(0);
    expect(w.drainEvents().some((e) => e.type === 'feverEnd')).toBe(true);
  });

  it('feverServes が無いモードでは自動で始まらない', () => {
    const w = quiet({ initialStock: 9 });
    for (let i = 0; i < 5; i++) serveOne(w);
    expect(w.fever).toBe(0);
    expect(w.feverGauge).toBe(0);
  });

  it('フィーバー中はパンが減らず、在庫 0 でも取れて、戻しても増えない', () => {
    const w = quiet({ initialStock: 0 });
    expect(w.pickBread('roll')).toBe(false);
    w.startFever();
    expect(w.pickBread('roll')).toBe(true);
    expect(w.pickBread('roll')).toBe(true);
    expect(w.stock.roll).toBe(0);
    w.returnTray(0);
    expect(w.stock.roll).toBe(0);
    expect(w.tray).toEqual(['roll']);
  });

  it('フィーバー中は注文 1 個の客が空いた席に次々来て、待ち時間は減らず、会計してもゲージは進まない', () => {
    const w = quiet({ feverServes: 5, seats: 4 });
    const before = seated(w, ['roll', 'melon']);
    const patience = before.patience;
    w.startFever();
    run(w, 1.5);
    expect(w.customers).toHaveLength(4);
    const fevers = w.customers.filter((c) => c.fever);
    expect(fevers).toHaveLength(3);
    for (const c of fevers) expect(c.order).toHaveLength(1);
    expect(before.patience).toBe(patience);

    const c = fevers.find((x) => x.state === 'waiting')!;
    w.pickBread(c.order[0]);
    expect(w.serve(c.id)).toBe('complete');
    expect(w.stats.feverServed).toBe(1);
    expect(w.feverGauge).toBe(5);
    // 空いた席にはすぐ次の客が来る
    run(w, F.leaveTime + F.seatGap + F.spawnGap + 0.1);
    expect(w.customers.filter((x) => x.state !== 'leaving')).toHaveLength(4);
  });

  it('フィーバー中は焼けたパンが焦げない', () => {
    const w = quiet({ burnTime: 2 });
    w.bake(0, 'roll');
    run(w, BREADS.roll.bakeTime + 0.05);
    w.startFever();
    run(w, F.duration - 0.5);
    expect(w.ovens[0].state).toBe('ready');
    run(w, 3);
    expect(w.ovens[0].state).toBe('burnt');
  });

  it('来ていたエルフィンは手ぶらで逃げ出し、終わるまで来ない。ネル・コミー・バターも終わってから来る', () => {
    const w = quiet({
      elfin: { firstAt: 1, intervalMin: 1, intervalMax: 1 },
      komi: [2],
      nellVisits: [8],
      seats: 4,
    });
    run(w, 1.1);
    expect(w.elfin.state).toBe('entering');
    w.startFever();
    expect(w.drainEvents()).toContainEqual({ type: 'elfinFlee', reason: 'fever' });
    expect(w.elfin.bread).toBeNull();
    run(w, F.duration - 0.2);
    expect(['leaving', 'absent']).toContain(w.elfin.state);
    expect(w.tab).toBe(0);
    expect(w.customers.some((c) => c.kind === 'komi' || c.kind === 'nell')).toBe(false);
    expect(w.nellPendingAt).toBeNull();
    // 終わったらコミーが来て、ネルの予告が出る（席はフィーバーの客が帰ってから）
    for (const c of w.customers) {
      w.pickBread(c.order[0]);
      w.serve(c.id);
    }
    run(w, 2);
    expect(w.customers.some((c) => c.kind === 'komi')).toBe(true);
    expect(w.nellPendingAt).not.toBeNull();
    expect(w.elfin.state).toBe('absent');
  });

  it('エンドレスのフィーバー中は残り時間が減らず、会計でも延びない', () => {
    const ENDLESS = STAGES.find((x) => x.endless)!.endless!;
    const w = quiet({ duration: 30, endless: ENDLESS, seats: 4 });
    run(w, 1);
    const left = w.remaining;
    w.startFever();
    run(w, 2);
    expect(w.remaining).toBeCloseTo(left, 5);
    const c = w.customers.find((x) => x.fever && x.state === 'waiting')!;
    w.pickBread(c.order[0]);
    w.serve(c.id);
    expect(w.remaining).toBeCloseTo(left, 5);
    expect(w.stats.timeAdded).toBe(0);
    run(w, F.duration);
    expect(w.remaining).toBeLessThan(left);
  });

  it('フィーバー中に時間が切れても閉店せず、フィーバーが終わってから閉店する', () => {
    // ネルの予告（来店の announceLead 秒前）はフィーバーの最中に来るはずだった
    const w = quiet({ duration: 30, seats: 4, nellVisits: [26 + BALANCE.nell.announceLead + 1] });
    run(w, 26);
    w.startFever();
    run(w, 4.5);
    expect(w.remaining).toBe(0);
    expect(w.phase).toBe('playing');
    // 延長中も渡せる
    const c = w.customers.find((x) => x.fever && x.state === 'waiting')!;
    w.pickBread(c.order[0]);
    expect(w.serve(c.id)).toBe('complete');
    w.drainEvents();
    run(w, F.duration - 4.5 - 0.1);
    expect(w.phase).toBe('playing');
    run(w, 0.2);
    expect(w.phase).toBe('ended');
    const types = w.drainEvents().map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['feverEnd', 'timeUp']));
    // 待たせていたネルは、閉店まぎわに予告しなおさない
    expect(types).not.toContain('nellAnnounce');
    expect(types).not.toContain('nellArrive');
  });

  it('時計を止めたチュートリアルでも、呼べば客が来て時間どおりに終わる', () => {
    const w = quiet();
    w.frozen = true;
    w.startFever();
    run(w, 1);
    expect(w.customers.filter((c) => c.fever).length).toBe(3);
    expect(w.time).toBe(0);
    run(w, F.duration);
    expect(w.fever).toBe(0);
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
      expect(s.feverServes, s.id).toBeGreaterThan(0);
      expect(s.stars[0]).toBeLessThan(s.stars[1]);
      expect(s.stars[1]).toBeLessThan(s.stars[2]);
    }
  });

  it('微辛 → 中辛 → 辛口 → 激辛 の順に長く・忙しくなり、焦げるのは辛口から', () => {
    const timed = PLAY_STAGES.filter((s) => !s.endless);
    expect(timed.map((s) => s.title)).toEqual(['微辛', '中辛', '辛口', '激辛']);
    expect(timed.map((s) => s.breads.length)).toEqual([2, 3, 4, 7]);
    expect(timed.map((s) => s.burnTime)).toEqual([null, null, 10, 8]);
    for (let i = 1; i < timed.length; i++) {
      const [a, b] = [timed[i - 1], timed[i]];
      expect(a.duration, b.id).toBeLessThan(b.duration);
      expect(a.customer.intervalEnd, b.id).toBeGreaterThan(b.customer.intervalEnd);
      expect(a.customer.itemWeights.length, b.id).toBeLessThanOrEqual(b.customer.itemWeights.length);
      expect(a.heat, b.id).toBeLessThan(b.heat);
    }
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

describe('中辛', () => {
  it('パンは 3 種で焦げない。注文は 2 個まで', () => {
    const medium = PLAY_STAGES.find((s) => s.id === 'medium')!;
    expect(medium.breads).toHaveLength(3);
    expect(medium.burnTime).toBeNull();
    const w = new World(medium, 3);
    const seen = new Map<number, Customer>();
    while (w.phase === 'playing') {
      w.step(DT);
      for (const c of w.customers) seen.set(c.id, c);
    }
    const sizes = new Set([...seen.values()].map((c) => c.order.length));
    expect(Math.max(...sizes)).toBe(2);
    expect(sizes.has(1)).toBe(true);
    for (const c of seen.values()) expect(c.order.every((b) => medium.breads.includes(b))).toBe(true);
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

describe('ブルミ', () => {
  const B = BALANCE.burumi;

  it('来ないモードでは来ない', () => {
    const w = new World(stage(), 1);
    for (let i = 0; i < 60 * 60; i++) w.step(DT);
    expect(w.burumi.state).toBe('absent');
    expect(w.tapBurumi()).toBe(false);
  });

  it('ときどき窓に張り付き、タップすると売上に入る。タップしないとそのまま帰る', () => {
    const w = new World(stage({ burumi: true }), 1);
    const until = (state: string) => {
      for (let i = 0; i < 60 * 60 && w.burumi.state !== state; i++) w.step(DT);
      expect(w.burumi.state).toBe(state);
    };
    until('entering');
    expect(w.time).toBeGreaterThanOrEqual(B.firstAt[0]);
    expect(w.time).toBeLessThanOrEqual(B.firstAt[1] + DT);
    expect(w.drainEvents().some((e) => e.type === 'burumiArrive')).toBe(true);
    until('stuck');
    const before = w.sales;
    expect(w.tapBurumi()).toBe(true);
    expect(w.tapBurumi()).toBe(false);
    expect(w.sales).toBe(before + B.reward);
    expect(w.ledger.burumi).toBe(B.reward);
    expect(w.stats.burumi).toBe(1);
    until('absent');
    until('stuck');
    for (let i = 0; i < Math.ceil((B.stay + 0.1) * 60); i++) w.step(DT);
    expect(w.burumi.state).toBe('leaving');
    expect(w.tapBurumi()).toBe(false);
    expect(w.stats.burumi).toBe(1);
  });

  it('ブルミが来ても、客の注文の並びは変わらない', () => {
    const orders = (burumi: boolean) => {
      const w = new World(stage({ burumi }), 7);
      for (let i = 0; i < 60 * 40; i++) w.step(DT);
      return w.customers.map((c) => c.order.join());
    };
    expect(orders(true)).toEqual(orders(false));
  });
});
