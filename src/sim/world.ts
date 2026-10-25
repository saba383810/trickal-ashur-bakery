import { BALANCE } from '../config/balance';
import { BREADS, type BreadId } from '../config/breads';
import type { StageDef } from '../config/stages';
import type { GameEvent, Payment } from './events';
import { Rng } from './rng';

export type CustomerState = 'entering' | 'waiting' | 'leaving';

/** nell = 記憶接客 / komi = 席で居眠りする / butter = 座っている間エルフィンを追い返す */
export type CustomerKind = 'normal' | 'nell' | 'komi' | 'butter';

export interface Customer {
  id: number;
  seat: number;
  kind: CustomerKind;
  order: BreadId[];
  received: boolean[];
  patience: number;
  patienceMax: number;
  state: CustomerState;
  stateTime: number;
  /** 退店時の機嫌 */
  mood: 'happy' | 'angry' | null;
  /** 見た目のシード（view が髪色などを決める） */
  look: number;
  /** 「ちがう」反応の残り秒数 */
  reject: number;
  /** ネル: 注文が見えている残り秒数 */
  reveal: number;
  /** コミー: 居眠り中（注文が見えず、待ち時間も減らない） */
  asleep: boolean;
  /** ほっぺを引っぱって待ち時間を回復済み（1 人 1 回） */
  mochi: boolean;
  /** フィーバータイムに来た客（注文 1 個・出入りが速い） */
  fever: boolean;
}

export type OvenState = 'idle' | 'baking' | 'ready' | 'burnt';

export interface Oven {
  state: OvenState;
  bread: BreadId | null;
  /** 現在の状態に入ってからの秒数 */
  t: number;
}

/**
 * entering = 「おやつ〜」と駆けこんでくる / lingering = ショーケースの前でちょびっと立ち止まる /
 * sulking = 取れるパンが無くてむくれる / leaving = 走って帰る（パンを取れていれば抱えて）
 */
export type ElfinState = 'absent' | 'entering' | 'lingering' | 'sulking' | 'leaving';

export interface Elfin {
  state: ElfinState;
  t: number;
  /** 入口 → ショーケースの進み具合 0..1 */
  enter: number;
  /** 持って帰るパン（取れなかった・追い返された時は null） */
  bread: BreadId | null;
}

/** ブルミ: entering = 飛んできて窓に張り付くところ / stuck = 張り付いている / leaving = はがれて帰る / caught = タップされた */
export type BurumiState = 'absent' | 'entering' | 'stuck' | 'leaving' | 'caught';

export interface Burumi {
  state: BurumiState;
  t: number;
  /** 0 = 左の窓 / 1 = 右の窓 */
  window: 0 | 1;
  /** 来た回数（見た目の変化に使う） */
  visits: number;
}

export interface Ledger {
  base: number;
  tip: number;
  combo: number;
  nell: number;
  tabCollected: number;
  burumi: number;
}

export interface Stats {
  served: number;
  angry: number;
  baked: number;
  burnt: number;
  /** エルフィンに持っていかれたパン */
  elfinAte: number;
  bestCombo: number;
  nellSuccess: number;
  nellFail: number;
  /** ほっぺを引っぱって機嫌を直した客 */
  mochi: number;
  /** バターがエルフィンを追い返した回数 */
  butterShots: number;
  /** エンドレスで延びた秒数の合計 */
  timeAdded: number;
  fevers: number;
  /** フィーバー中に会計した客 */
  feverServed: number;
  /** タップしたブルミ */
  burumi: number;
}

export type Phase = 'playing' | 'ended';

export class World {
  readonly stage: StageDef;
  readonly rng: Rng;
  time = 0;
  phase: Phase = 'playing';
  /**
   * チュートリアル用。時計・客の待ち時間・自動の来店を止める
   * （客の出入り・呼んだエルフィン・バターは動く。オーブンは焼けるが焦げない）
   */
  frozen = false;
  /** チュートリアル用。false の間は自動で客が来ない */
  autoSpawn = true;

  stock: Record<BreadId, number>;
  tray: BreadId[] = [];
  customers: Customer[] = [];
  ovens: Oven[];
  elfin: Elfin = { state: 'absent', t: 0, enter: 0, bread: null };

  /** この時刻で閉店。エンドレスは会計で延びる */
  timeLimit: number;
  /** エンドレスの忙しさ（ほかのモードは 1 のまま） */
  level = 1;
  /** 未回収のツケ */
  tab = 0;
  combo = 0;
  /** ネルの祝福の残り秒数 */
  buff = 0;
  /** フィーバータイムの残り秒数 */
  fever = 0;
  /** フィーバーまでの会計数（stage.feverServes で満タン。フィーバー中は増えない） */
  feverGauge = 0;
  ledger: Ledger = { base: 0, tip: 0, combo: 0, nell: 0, tabCollected: 0, burumi: 0 };
  stats: Stats = {
    served: 0,
    angry: 0,
    baked: 0,
    burnt: 0,
    elfinAte: 0,
    bestCombo: 0,
    nellSuccess: 0,
    nellFail: 0,
    mochi: 0,
    butterShots: 0,
    timeAdded: 0,
    fevers: 0,
    feverServed: 0,
    burumi: 0,
  };
  burumi: Burumi = { state: 'absent', t: 0, window: 0, visits: 0 };
  events: GameEvent[] = [];

  /** 予告済みでまだ座っていないネルの来店時刻 */
  nellPendingAt: number | null = null;
  private nellQueue: number[];
  /** コミーとバターの来店予定 */
  private guests: { kind: 'komi' | 'butter'; at: number }[];
  /** バターがエルフィンに気づいてから撃つまでの残り秒数 */
  private butterAim = 0;
  private nextId = 1;
  private nextSpawnAt = 1;
  private nextElfinAt: number;
  /** 席の空く時刻。frozen でも進む clock で数える（チュートリアルのフィーバーでも席が回るように） */
  private seatFreeAt: number[];
  private clock = 0;
  private feverSpawnAt = 0;
  private warned = false;
  /** 直近の注文（BALANCE.orderBias の recentOrders と maxRun の多いほうの件数） */
  private recentOrders: BreadId[][] = [];
  /** ブルミ専用の乱数（ブルミが来ても客の注文などの並びは変わらない） */
  private burumiRng: Rng;
  private nextBurumiAt: number;

  constructor(stage: StageDef, seed: number) {
    this.stage = stage;
    this.rng = new Rng(seed);
    this.timeLimit = stage.duration;
    this.stock = Object.fromEntries(
      (Object.keys(BREADS) as BreadId[]).map((id) => [id, stage.breads.includes(id) ? stage.initialStock : 0]),
    ) as Record<BreadId, number>;
    this.ovens = Array.from({ length: stage.ovens }, () => ({ state: 'idle', bread: null, t: 0 }));
    this.seatFreeAt = Array.from({ length: stage.seats }, () => 0);
    this.nextElfinAt = stage.elfin?.firstAt ?? Infinity;
    this.burumiRng = new Rng(seed ^ 0x5bd1e995);
    this.nextBurumiAt = stage.burumi ? this.burumiRng.range(...BALANCE.burumi.firstAt) : Infinity;
    this.nellQueue = [...stage.nellVisits].sort((a, b) => a - b);
    this.guests = [
      ...stage.komi.map((at) => ({ kind: 'komi' as const, at })),
      ...stage.butter.map((at) => ({ kind: 'butter' as const, at })),
    ].sort((a, b) => a.at - b.at);
  }

  get sales(): number {
    const l = this.ledger;
    return l.base + l.tip + l.combo + l.nell + l.tabCollected + l.burumi;
  }

  get remaining(): number {
    return Math.max(0, this.timeLimit - this.time);
  }

  /** エンドレスで待ち時間に掛ける倍率 */
  private get patienceScale(): number {
    const e = this.stage.endless;
    return e ? Math.max(e.patienceMin, Math.pow(e.patienceRate, this.level - 1)) : 1;
  }

  /** いまのエルフィンの設定（エンドレスはレベルで来る間隔が縮む） */
  private get elfinCfg(): StageDef['elfin'] {
    const cfg = this.stage.elfin;
    const e = this.stage.endless;
    if (!cfg || !e) return cfg;
    const k = Math.pow(e.elfinRate, this.level - 1);
    const min = BALANCE.elfin.endlessMin;
    return {
      ...cfg,
      intervalMin: Math.max(min[0], cfg.intervalMin * k),
      intervalMax: Math.max(min[1], cfg.intervalMax * k),
    };
  }

  /** いま焼けたパンが焦げるまでの秒数。null = 焦げない（エンドレスは burnLevel から焦げる） */
  get burnTime(): number | null {
    const e = this.stage.endless;
    return e && this.level < e.burnLevel ? null : this.stage.burnTime;
  }

  /** ネルが予告〜退店のあいだ店に関わっているか（エルフィンが寄りつかない） */
  get nellInShop(): boolean {
    return this.nellPendingAt !== null || this.customers.some((c) => c.kind === 'nell' && c.state !== 'leaving');
  }

  /** ショーケースから取れるか（フィーバー中はいくらでも取れる） */
  hasBread(bread: BreadId): boolean {
    return this.fever > 0 || this.stock[bread] > 0;
  }

  // ---------------------------------------------------------------- commands

  pickBread(bread: BreadId): boolean {
    if (this.phase !== 'playing') return false;
    if (!this.hasBread(bread)) {
      this.emit({ type: 'pickFail', bread, reason: 'empty' });
      return false;
    }
    if (this.tray.length >= BALANCE.trayCapacity) {
      this.emit({ type: 'pickFail', bread, reason: 'full' });
      return false;
    }
    if (this.fever <= 0) this.stock[bread]--;
    this.tray.push(bread);
    this.emit({ type: 'pick', bread });
    return true;
  }

  returnTray(index: number): boolean {
    if (this.phase !== 'playing') return false;
    const bread = this.tray[index];
    if (!bread) return false;
    this.tray.splice(index, 1);
    if (this.fever <= 0) this.stock[bread]++;
    this.emit({ type: 'return', bread });
    return true;
  }

  serve(customerId: number): 'complete' | 'partial' | 'wrong' | 'peek' | 'asleep' | 'none' {
    if (this.phase !== 'playing') return 'none';
    const c = this.customers.find((x) => x.id === customerId);
    if (!c || c.state !== 'waiting') return 'none';
    if (c.asleep) {
      this.emit({ type: 'komiSleep', customerId: c.id, again: false });
      return 'asleep';
    }
    return c.kind === 'nell' ? this.serveNell(c) : this.serveNormal(c);
  }

  /**
   * ほっぺを引っぱって離した。コミーは目を覚まし、ネルは注文をもう一度見せてくれる。
   * ほかの客は 1 人 1 回だけ、機嫌が直って待ち時間が全回復する
   */
  pinchCustomer(customerId: number): 'wake' | 'peek' | 'refill' | 'none' {
    if (this.phase !== 'playing') return 'none';
    const c = this.customers.find((x) => x.id === customerId);
    if (!c || c.state !== 'waiting') return 'none';
    if (c.asleep) {
      c.asleep = false;
      c.patience = c.patienceMax;
      this.emit({ type: 'komiWake', customerId: c.id });
      return 'wake';
    }
    if (c.kind === 'nell') {
      this.nellPeek(c);
      return 'peek';
    }
    if (c.mochi) return 'none';
    c.mochi = true;
    c.patience = c.patienceMax;
    this.stats.mochi++;
    this.emit({ type: 'customerMochi', customerId: c.id });
    return 'refill';
  }

  /**
   * フィーバータイムを始める（ゲージ満タンで自動。チュートリアルは直接呼ぶ）。
   * パンを取る前のエルフィンは手ぶらで逃げ出す
   */
  startFever(): void {
    if (this.phase !== 'playing' || this.fever > 0) return;
    const d = BALANCE.fever.duration;
    this.fever = d;
    this.feverGauge = this.stage.feverServes ?? 0;
    this.feverSpawnAt = this.clock;
    this.stats.fevers++;
    this.emit({ type: 'feverStart', duration: d });
    if (this.elfinInShop) this.elfinFlee('fever');
  }

  /** チュートリアル用: エルフィンをすぐ呼ぶ */
  summonElfin(): void {
    if (this.elfin.state === 'absent') this.elfinArrive();
  }

  /** チュートリアル用: コミー・バター・ネルを直接呼ぶ */
  spawnGuest(kind: 'komi' | 'butter' | 'nell', order: BreadId[], seat?: number): Customer | null {
    const s = seat ?? this.pickFreeSeat(false);
    if (s === null) return null;
    const cfg = BALANCE[kind];
    const c = this.addCustomer(kind, s, order, cfg.patienceBase + cfg.patiencePerItem * order.length);
    if (kind === 'butter') this.butterAim = BALANCE.butter.aim;
    return c;
  }

  bake(ovenIndex: number, bread: BreadId): boolean {
    const oven = this.ovens[ovenIndex];
    if (this.phase !== 'playing' || !oven || oven.state !== 'idle' || !this.stage.breads.includes(bread)) return false;
    oven.state = 'baking';
    oven.bread = bread;
    oven.t = 0;
    this.emit({ type: 'bakeStart', oven: ovenIndex, bread });
    return true;
  }

  /** 焼き上がりの取り出し / 焦げの片付け */
  tapOven(ovenIndex: number): boolean {
    const oven = this.ovens[ovenIndex];
    if (this.phase !== 'playing' || !oven) return false;
    if (oven.state === 'ready' && oven.bread) {
      const count = BREADS[oven.bread].batch;
      this.stock[oven.bread] += count;
      this.stats.baked += count;
      this.emit({ type: 'ovenTakeOut', oven: ovenIndex, bread: oven.bread, count });
      this.resetOven(oven);
      return true;
    }
    if (oven.state === 'burnt') {
      this.emit({ type: 'ovenClear', oven: ovenIndex });
      this.resetOven(oven);
      return true;
    }
    return false;
  }

  /** 窓に張り付いたブルミをタップした */
  tapBurumi(): boolean {
    const b = this.burumi;
    if (b.state !== 'entering' && b.state !== 'stuck') return false;
    const reward = BALANCE.burumi.reward;
    b.state = 'caught';
    b.t = 0;
    this.ledger.burumi += reward;
    this.stats.burumi++;
    this.emit({ type: 'burumiCatch', window: b.window, reward });
    return true;
  }

  // ------------------------------------------------------------------- step

  step(dt: number): void {
    if (this.phase !== 'playing') return;

    this.clock += dt;
    this.updateOvens(dt);
    this.updateFever(dt);
    if (this.frozen) {
      this.updateCustomers(dt, false);
      this.updateElfin(dt);
      this.updateButter(dt);
      return;
    }

    this.time += dt;
    this.updateLevel();
    // フィーバー中はネル・コミー・バターを待たせ、ふだんの客も来ない（席はフィーバーの客で埋める）。
    // 時間切れのあとのフィーバーが終わった時は、そのまま閉店するので呼ばない
    if (this.fever <= 0 && this.time < this.timeLimit) {
      this.updateNell();
      this.updateGuests();
      this.updateSpawner();
    }
    this.updateCustomers(dt);
    this.updateElfin(dt);
    this.updateButter(dt);
    this.updateBuff(dt);
    this.updateBurumi(dt);

    if (!this.warned && this.remaining <= BALANCE.warningTime) {
      this.warned = true;
      this.emit({ type: 'timeWarning' });
    } else if (this.warned && this.remaining > BALANCE.warningTime + 3) {
      // エンドレスで時間が延びたら、また警告できるようにする
      this.warned = false;
    }
    // フィーバー中に時間が切れても、閉店はフィーバーが終わってから
    if (this.time >= this.timeLimit && this.fever <= 0) {
      this.phase = 'ended';
      this.emit({ type: 'timeUp' });
    }
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------------------------------------------------------------- serving

  private serveNormal(c: Customer): 'complete' | 'partial' | 'wrong' | 'none' {
    if (this.tray.length === 0) return 'none';
    const taken: BreadId[] = [];
    c.order.forEach((bread, i) => {
      if (c.received[i]) return;
      const at = this.tray.indexOf(bread);
      if (at < 0) return;
      this.tray.splice(at, 1);
      c.received[i] = true;
      taken.push(bread);
    });

    if (taken.length === 0) {
      c.patience = Math.max(0.1, c.patience - BALANCE.customer.wrongPenalty);
      c.reject = 0.6;
      this.emit({ type: 'serveWrong', customerId: c.id });
      return 'wrong';
    }
    if (c.received.every(Boolean)) {
      const payment = this.paymentFor(c);
      this.book(payment);
      this.stats.served++;
      this.combo++;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
      this.leave(c, 'happy');
      this.emit({ type: 'serveComplete', customerId: c.id, payment, combo: this.combo });
      const e = this.stage.endless;
      // エンドレスのフィーバー中は時計が止まっているので延ばさない
      if (e && this.fever <= 0) this.extendTime(e.timeBase + e.timePerCombo * Math.min(this.combo, e.timeComboCap));
      this.countFever();
      return 'complete';
    }
    c.patience = Math.min(c.patienceMax, c.patience + BALANCE.customer.partialBonus);
    this.emit({ type: 'servePartial', customerId: c.id, breads: taken });
    return 'partial';
  }

  private serveNell(c: Customer): 'complete' | 'wrong' | 'peek' {
    const cfg = BALANCE.nell;
    if (this.tray.length === 0) {
      this.nellPeek(c);
      return 'peek';
    }
    if (!sameBreads(this.tray, c.order)) {
      c.patience = Math.max(0.1, c.patience - cfg.wrongPenalty);
      c.reject = 0.6;
      this.emit({ type: 'nellWrong', customerId: c.id });
      return 'wrong';
    }

    this.tray = [];
    c.received = c.order.map(() => true);
    const base = c.order.reduce((sum, b) => sum + BREADS[b].price, 0);
    const payment: Payment = { total: base, base, tip: 0, combo: 0, nell: 0, tipRate: 0 };
    this.book(payment);
    const tabPaid = this.tab;
    this.ledger.tabCollected += tabPaid;
    this.tab = 0;
    this.buff = cfg.buffDuration;
    this.stats.nellSuccess++;
    this.leave(c, 'happy');
    this.emit({ type: 'nellSuccess', customerId: c.id, tabPaid, payment });
    if (this.stage.endless && this.fever <= 0) this.extendTime(this.stage.endless.nellTime);
    this.countFever();
    return 'complete';
  }

  /** 会計 1 回ぶんゲージを進め、満タンならフィーバー */
  private countFever(): void {
    if (this.fever > 0) {
      this.stats.feverServed++;
      return;
    }
    const need = this.stage.feverServes;
    if (!need) return;
    this.feverGauge = Math.min(need, this.feverGauge + 1);
    if (this.feverGauge >= need) this.startFever();
  }

  // ------------------------------------------------------------------ fever

  private updateFever(dt: number): void {
    if (this.fever <= 0) return;
    // エンドレスは残り時間が減らない（会計でも延びない）
    if (this.stage.endless && !this.frozen) this.timeLimit += Math.min(dt, this.fever);
    this.fever = Math.max(0, this.fever - dt);
    if (this.fever === 0) {
      this.feverGauge = 0;
      this.nextElfinAt = Math.max(this.nextElfinAt, this.time + BALANCE.fever.elfinAfter);
      // 予告できなかったネルは、ここから予告しなおす（予告から来店まで announceLead 秒あける）
      const lead = BALANCE.nell.announceLead;
      if (this.nellQueue.length > 0 && this.nellQueue[0] - lead < this.time) this.nellQueue[0] = this.time + lead;
      this.emit({ type: 'feverEnd' });
      return;
    }
    if (this.clock < this.feverSpawnAt) return;
    const seat = this.pickFreeSeat(false);
    if (seat === null) return;
    this.feverSpawnAt = this.clock + BALANCE.fever.spawnGap;
    this.addCustomer('normal', seat, this.randomBreads(1), BALANCE.fever.patience).fever = true;
  }

  // ---------------------------------------------------------------- endless

  private extendTime(seconds: number): void {
    const e = this.stage.endless;
    if (!e || this.frozen) return;
    const limit = Math.min(this.timeLimit + seconds, this.time + e.maxRemaining);
    const added = limit - this.timeLimit;
    if (added <= 0) return;
    this.timeLimit = limit;
    this.stats.timeAdded += added;
    this.emit({ type: 'timeExtend', seconds: added });
  }

  private updateLevel(): void {
    const e = this.stage.endless;
    if (!e) return;
    const level = Math.min(e.maxLevel, 1 + Math.floor(this.time / e.levelTime));
    if (level === this.level) return;
    // 焦げはじめるレベルでは、焼き上がって待っていたパンもここから数えはじめる
    if (this.level < e.burnLevel && level >= e.burnLevel) {
      for (const o of this.ovens) if (o.state === 'ready') o.t = 0;
    }
    this.level = level;
    this.emit({ type: 'levelUp', level });
  }

  /** エンドレス: 次の来店予定を入れる */
  private scheduleNext(kind: 'komi' | 'butter' | 'nell'): void {
    const e = this.stage.endless;
    if (!e) return;
    const [lo, hi] = kind === 'nell' ? e.nellEvery : kind === 'komi' ? e.komiEvery : e.butterEvery;
    const at = this.time + this.rng.range(lo, hi);
    if (kind === 'nell') {
      this.nellQueue.push(at);
      this.nellQueue.sort((a, b) => a - b);
    } else {
      this.guests.push({ kind, at });
      this.guests.sort((a, b) => a.at - b.at);
    }
  }

  private nellPeek(c: Customer): void {
    const cfg = BALANCE.nell;
    c.reveal = cfg.peekTime;
    c.patience = Math.max(0.1, c.patience - cfg.peekCost);
    this.emit({ type: 'nellPeek', customerId: c.id });
  }

  private paymentFor(c: Customer): Payment {
    const base = c.order.reduce((sum, b) => sum + BREADS[b].price, 0);
    const ratio = c.patience / c.patienceMax;
    const t = BALANCE.tip;
    const tipRate = ratio > t.highRatio ? t.high : ratio > t.midRatio ? t.mid : 0;
    const comboRate = Math.min(this.combo, BALANCE.combo.maxSteps) * BALANCE.combo.step;
    const nellRate = this.buff > 0 ? BALANCE.nell.buffRate - 1 : 0;
    const tip = Math.round(base * tipRate);
    const combo = Math.round((base + tip) * comboRate);
    const nell = Math.round((base + tip + combo) * nellRate);
    return { total: base + tip + combo + nell, base, tip, combo, nell, tipRate };
  }

  private book(p: Payment): void {
    this.ledger.base += p.base;
    this.ledger.tip += p.tip;
    this.ledger.combo += p.combo;
    this.ledger.nell += p.nell;
  }

  // -------------------------------------------------------------- customers

  /** チュートリアルや演出から客を直接呼ぶ */
  spawnCustomer(order?: BreadId[], seat?: number): Customer | null {
    const s = seat ?? this.pickFreeSeat(false);
    if (s === null) return null;
    const items = order ?? this.makeOrder();
    const cfg = this.stage.customer;
    const patience = (cfg.patienceBase + cfg.patiencePerItem * items.length) * this.patienceScale;
    return this.addCustomer('normal', s, items, patience);
  }

  private addCustomer(kind: Customer['kind'], seat: number, order: BreadId[], patience: number): Customer {
    const c: Customer = {
      id: this.nextId++,
      seat,
      kind,
      order,
      received: order.map(() => false),
      patience,
      patienceMax: patience,
      state: 'entering',
      stateTime: 0,
      mood: null,
      look: this.rng.int(1 << 30),
      reject: 0,
      reveal: 0,
      asleep: kind === 'komi',
      mochi: false,
      fever: false,
    };
    this.customers.push(c);
    const type = ({ normal: 'customerArrive', nell: 'nellArrive', komi: 'komiArrive', butter: 'butterArrive' } as const)[kind];
    this.emit({ type, customerId: c.id });
    return c;
  }

  private makeOrder(): BreadId[] {
    const e = this.stage.endless;
    const weights = e ? e.itemWeights[Math.min(this.level, e.itemWeights.length) - 1] : this.stage.customer.itemWeights;
    const count = Math.min(1 + this.rng.weighted(weights), BALANCE.trayCapacity);
    return this.randomBreads(count);
  }

  /** 注文のパンを選ぶ。同じパンが続いたり、足りないパンに注文が重なったりしにくくする（BALANCE.orderBias） */
  private randomBreads(count: number): BreadId[] {
    const menu = this.stage.breads;
    const bias = BALANCE.orderBias;
    const spare = this.spareBreads();
    const run = this.recentOrders.slice(-bias.maxRun);
    const near = this.recentOrders.slice(-bias.recentOrders);
    // 全部のパンが続いているとき（パンが少なく注文が多いとき）は締め出さない
    const streak = menu.filter((b) => run.length >= bias.maxRun && run.every((o) => o.includes(b)));
    // フィーバー中はパンが減らないので、続いても足りなくても構わない
    const blocked = streak.length < menu.length && this.fever <= 0 ? streak : [];
    const items: BreadId[] = [];
    for (let i = 0; i < count; i++) {
      const weights = menu.map((b) => {
        if (blocked.includes(b)) return 0;
        const recent = [...near, items].reduce((n, o) => n + countOf(o, b), 0);
        const short = this.fever > 0 ? 0 : Math.max(0, countOf(items, b) + 1 - spare[b]);
        return BREADS[b].popularity * bias.recentRate ** recent * bias.shortRate ** short;
      });
      items.push(menu[this.rng.weighted(weights)]);
    }
    this.recentOrders.push(items);
    if (this.recentOrders.length > Math.max(bias.recentOrders, bias.maxRun)) this.recentOrders.shift();
    return [...items].sort((a, b) => menu.indexOf(a) - menu.indexOf(b));
  }

  /** パンごとの手持ち（在庫・トレー・オーブンの中）から、待っている注文でまだ渡していない分を引いた数 */
  spareBreads(): Record<BreadId, number> {
    const spare = { ...this.stock };
    for (const b of this.tray) spare[b]++;
    for (const o of this.ovens) {
      if (o.bread && (o.state === 'baking' || o.state === 'ready')) spare[o.bread] += BREADS[o.bread].batch;
    }
    for (const c of this.customers) {
      if (c.state === 'leaving') continue;
      c.order.forEach((b, i) => {
        if (!c.received[i]) spare[b]--;
      });
    }
    return spare;
  }

  /** keepOne: ネルの予告中やコミー・バターが来る直前は 1 席空けておく */
  private pickFreeSeat(keepOne: boolean): number | null {
    const free: number[] = [];
    for (let s = 0; s < this.stage.seats; s++) {
      if (this.clock >= this.seatFreeAt[s] && !this.customers.some((c) => c.seat === s)) free.push(s);
    }
    if (free.length === 0 || (keepOne && free.length <= 1)) return null;
    return this.rng.pick(free);
  }

  private updateGuests(): void {
    const g = this.guests[0];
    if (!g || this.time < g.at) return;
    const seat = this.pickFreeSeat(false);
    if (seat === null) return;
    this.guests.shift();
    const cfg = BALANCE[g.kind];
    const order = this.randomBreads(this.stage.guestItems?.[g.kind] ?? cfg.items);
    this.addCustomer(g.kind, seat, order, (cfg.patienceBase + cfg.patiencePerItem * order.length) * this.patienceScale);
    if (g.kind === 'butter') this.butterAim = BALANCE.butter.aim;
    this.scheduleNext(g.kind);
  }

  private updateSpawner(): void {
    if (!this.autoSpawn || this.time < this.nextSpawnAt) return;
    const e = this.stage.endless;
    if (!e && this.remaining <= BALANCE.closingTime) return;
    // 店が混んでいても時間どおりに来られるよう、少し前から席を取っておく
    const guestSoon = this.guests.length > 0 && this.time >= this.guests[0].at - 4;
    const seat = this.pickFreeSeat(this.nellPendingAt !== null || guestSoon);
    if (seat === null) return;
    this.spawnCustomer(undefined, seat);
    const cfg = this.stage.customer;
    const interval = e
      ? Math.max(e.intervalMin, cfg.intervalStart * Math.pow(e.intervalRate, this.level - 1))
      : cfg.intervalStart + (cfg.intervalEnd - cfg.intervalStart) * (this.time / this.stage.duration);
    this.nextSpawnAt = this.time + interval * (1 + cfg.jitter * (this.rng.next() * 2 - 1));
  }

  private updateCustomers(dt: number, drain = true): void {
    const cfg = BALANCE.customer;
    for (const c of this.customers) {
      c.stateTime += dt;
      c.reject = Math.max(0, c.reject - dt);
      if (c.state === 'entering' && c.stateTime >= enterTimeOf(c)) {
        c.state = 'waiting';
        c.stateTime = 0;
        if (c.kind === 'nell') c.reveal = BALANCE.nell.revealTime;
      } else if (c.state === 'waiting') {
        c.reveal = Math.max(0, c.reveal - dt);
        // フィーバー中は誰も待ちくたびれない
        if (drain && !c.asleep && this.fever <= 0) c.patience -= dt;
        if (c.patience <= 0 && c.kind === 'komi') {
          // コミーは怒って帰らず、また眠ってしまう（席はふさがったまま）
          c.asleep = true;
          c.patience = c.patienceMax;
          this.emit({ type: 'komiSleep', customerId: c.id, again: true });
        } else if (c.patience <= 0) {
          c.patience = 0;
          this.combo = 0;
          this.leave(c, 'angry');
          if (c.kind === 'nell') {
            this.stats.nellFail++;
            this.emit({ type: 'nellFail', customerId: c.id });
          } else {
            this.stats.angry++;
            this.emit({ type: 'customerAngry', customerId: c.id });
          }
        }
      }
    }
    const gone = this.customers.filter((c) => c.state === 'leaving' && c.stateTime >= leaveTimeOf(c));
    const gap = this.fever > 0 ? BALANCE.fever.seatGap : cfg.minGapAfterLeave;
    for (const c of gone) this.seatFreeAt[c.seat] = this.clock + gap;
    if (gone.length) this.customers = this.customers.filter((c) => !gone.includes(c));
  }

  private leave(c: Customer, mood: 'happy' | 'angry'): void {
    c.state = 'leaving';
    c.stateTime = 0;
    c.mood = mood;
    if (c.kind === 'nell') this.nextElfinAt = Math.max(this.nextElfinAt, this.time + BALANCE.elfin.afterNell);
  }

  // ------------------------------------------------------------------- nell

  private updateNell(): void {
    const next = this.nellQueue[0];
    if (next !== undefined && this.nellPendingAt === null && this.time >= next - BALANCE.nell.announceLead) {
      this.nellQueue.shift();
      this.nellPendingAt = next;
      this.emit({ type: 'nellAnnounce' });
      this.scheduleNext('nell');
    }
    if (this.nellPendingAt !== null && this.time >= this.nellPendingAt) {
      const seat = this.pickFreeSeat(false);
      if (seat === null) return;
      this.nellPendingAt = null;
      const e = this.stage.endless;
      const n = Math.min(BALANCE.trayCapacity, this.stage.nellItems + (e && this.level >= e.nellHardLevel ? 1 : 0));
      this.addCustomer('nell', seat, this.randomBreads(n), BALANCE.nell.patienceBase + BALANCE.nell.patiencePerItem * n);
    }
  }

  private updateBuff(dt: number): void {
    if (this.buff <= 0) return;
    this.buff = Math.max(0, this.buff - dt);
    if (this.buff === 0) this.emit({ type: 'buffEnd' });
  }

  // ------------------------------------------------------------------ ovens

  private updateOvens(dt: number): void {
    this.ovens.forEach((oven, i) => {
      if (oven.state === 'baking' && oven.bread) {
        oven.t += dt;
        if (oven.t >= BREADS[oven.bread].bakeTime) {
          oven.state = 'ready';
          oven.t = 0;
          this.emit({ type: 'ovenReady', oven: i });
        }
      } else if (oven.state === 'ready' && !this.frozen && this.fever <= 0) {
        oven.t += dt;
        if (this.burnTime !== null && oven.t >= this.burnTime) {
          oven.state = 'burnt';
          oven.t = 0;
          this.stats.burnt++;
          this.emit({ type: 'ovenBurnt', oven: i });
        }
      } else if (oven.state === 'burnt') {
        oven.t += dt;
      }
    });
  }

  private resetOven(oven: Oven): void {
    oven.state = 'idle';
    oven.bread = null;
    oven.t = 0;
  }

  // ------------------------------------------------------------------ elfin

  private updateElfin(dt: number): void {
    const cfg = this.elfinCfg;
    if (!cfg) return;
    const e = this.elfin;
    const b = BALANCE.elfin;
    e.t += dt;
    // ネルの予告〜退店のあいだは、パンを取る前なら手ぶらで逃げ出す
    if (this.elfinInShop && this.nellInShop) return this.elfinFlee('nell');

    switch (e.state) {
      case 'absent':
        if (
          this.time >= this.nextElfinAt &&
          this.fever <= 0 &&
          !this.nellInShop &&
          (this.stage.endless || this.remaining > BALANCE.closingTime + 1)
        ) {
          this.elfinArrive();
        }
        break;
      case 'entering':
        e.enter = Math.min(1, e.enter + dt / b.enterTime);
        if (e.enter >= 1) this.setElfin('lingering');
        break;
      case 'lingering': {
        if (e.t < b.lingerTime) break;
        const bread = this.elfinTarget();
        if (!bread) {
          this.setElfin('sulking');
          this.emit({ type: 'elfinSulk' });
          break;
        }
        // 1 個だけ取って、そのまま抱えて走って帰る。代金はツケに
        const price = BREADS[bread].price;
        this.stock[bread]--;
        this.tab += price;
        e.bread = bread;
        this.stats.elfinAte++;
        this.emit({ type: 'elfinEat', bread, price });
        this.elfinLeave(true);
        break;
      }
      case 'sulking':
        if (e.t >= b.sulkTime) this.elfinLeave(false);
        break;
      case 'leaving':
        if (e.t >= b.leaveTime) this.elfinGone(this.rng.range(cfg.intervalMin, cfg.intervalMax));
        break;
    }
  }

  private updateBurumi(dt: number): void {
    const b = this.burumi;
    const cfg = BALANCE.burumi;
    b.t += dt;
    switch (b.state) {
      case 'absent':
        if (this.time >= this.nextBurumiAt && this.fever <= 0 && (this.stage.endless || this.remaining > BALANCE.closingTime + 1)) {
          b.state = 'entering';
          b.t = 0;
          b.window = this.burumiRng.int(2) as 0 | 1;
          b.visits++;
          this.emit({ type: 'burumiArrive', window: b.window });
        }
        break;
      case 'entering':
        if (b.t >= cfg.enterTime) {
          b.state = 'stuck';
          b.t = 0;
        }
        break;
      case 'stuck':
        if (b.t >= cfg.stay) {
          b.state = 'leaving';
          b.t = 0;
          this.emit({ type: 'burumiLeave', window: b.window });
        }
        break;
      case 'leaving':
      case 'caught':
        if (b.t >= cfg.leaveTime) {
          b.state = 'absent';
          b.t = 0;
          this.nextBurumiAt = this.time + this.burumiRng.range(...cfg.interval);
        }
        break;
    }
  }

  /**
   * バターが座って待っている間、パンを取る前のエルフィンをパチンコで撃ち、手ぶらで追い返す。
   * エルフィンが来てから（バターが後から座ったならそこから）aim 秒で撃つ
   */
  private updateButter(dt: number): void {
    const butter = this.customers.find((c) => c.kind === 'butter' && c.state === 'waiting');
    if (!butter || !this.elfinInShop) return;
    this.butterAim = Math.max(0, this.butterAim - dt);
    if (this.butterAim > 0) return;
    this.stats.butterShots++;
    this.emit({ type: 'butterShot', customerId: butter.id });
    this.elfinFlee('butter');
  }

  /** エルフィンが駆けこんできてからパンを取るまで（バター・ネル・フィーバーで追い返せる間） */
  get elfinInShop(): boolean {
    const s = this.elfin.state;
    return s === 'entering' || s === 'lingering' || s === 'sulking';
  }

  /** エルフィンが次に取るパン（在庫のあるパンのうち一番高いもの） */
  elfinTarget(): BreadId | null {
    let best: BreadId | null = null;
    for (const id of this.stage.breads) {
      if (this.stock[id] > 0 && (!best || BREADS[id].price > BREADS[best].price)) best = id;
    }
    return best;
  }

  private elfinArrive(): void {
    const e = this.elfin;
    this.setElfin('entering');
    e.enter = 0;
    e.bread = null;
    this.butterAim = BALANCE.butter.aim;
    this.emit({ type: 'elfinEnter' });
  }

  /** took = パンを抱えて帰る / false = むくれて手ぶらで帰る */
  private elfinLeave(took: boolean): void {
    this.setElfin('leaving');
    this.emit({ type: 'elfinLeave', took });
  }

  /** ネルが来る / フィーバーが始まった / バターに撃たれた（どれもパンを取る前なので手ぶら） */
  private elfinFlee(reason: 'nell' | 'fever' | 'butter'): void {
    this.setElfin('leaving');
    this.elfin.bread = null;
    this.emit({ type: 'elfinFlee', reason });
  }

  private elfinGone(cooldown: number): void {
    this.setElfin('absent');
    this.elfin.bread = null;
    this.nextElfinAt = this.time + cooldown;
  }

  private setElfin(state: ElfinState): void {
    this.elfin.state = state;
    this.elfin.t = 0;
  }

  private emit(e: GameEvent): void {
    this.events.push(e);
  }
}

/** 入店・退店にかかる秒数（フィーバーの客は速い） */
export function enterTimeOf(c: Customer): number {
  return c.fever ? BALANCE.fever.enterTime : BALANCE.customer.enterTime;
}

export function leaveTimeOf(c: Customer): number {
  return c.fever ? BALANCE.fever.leaveTime : BALANCE.customer.leaveTime;
}

/** 種類と個数が一致するか（順番は問わない） */
export function sameBreads(a: readonly BreadId[], b: readonly BreadId[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

function countOf(items: readonly BreadId[], bread: BreadId): number {
  return items.filter((b) => b === bread).length;
}

export function starsFor(stage: StageDef, sales: number): number {
  return stage.stars.filter((s) => sales >= s).length;
}
