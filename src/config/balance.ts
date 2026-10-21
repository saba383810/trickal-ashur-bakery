// ステージ共通の調整値。ステージ固有の値は stages.ts。
export const BALANCE = {
  trayCapacity: 4,

  tip: {
    /** 待ち時間の残り割合がこれ以上なら high */
    highRatio: 0.66,
    midRatio: 0.33,
    high: 0.2,
    mid: 0.1,
  },
  combo: {
    step: 0.05,
    maxSteps: 10,
  },

  customer: {
    enterTime: 0.7,
    leaveTime: 0.6,
    /** 一部だけ渡したときの待ち時間回復 */
    partialBonus: 2,
    /** 合うパンが 1 個も無いのに渡そうとしたときの減少 */
    wrongPenalty: 2,
    /** 席が空いてから次の客が来るまでの最短秒数 */
    minGapAfterLeave: 0.8,
  },

  oven: {
    /** 焼き上がりから焦げるまでの猶予 */
    readyWindow: 7,
  },

  elfin: {
    enterTime: 2.5,
    leaveTime: 1.4,
    launchTime: 0.9,
    stunTime: 0.6,
    /** 食べるものが無いまま待つ最長秒数 */
    sulkTime: 4,
    /** ネルが帰ってから次にエルフィンが来るまでの最短秒数 */
    afterNell: 5,
    /** ほっぺの伸び（0..1）がこれ以上で離すと追い払える */
    launchStretch: 0.72,
  },

  /** ほっぺを引っぱって離したとき、伸び（0..1）がこれ以上なら客に効く */
  pinchStretch: 0.3,

  /** コミー: 席に着くとすぐ居眠り。ほっぺを引っぱると起きて注文する */
  komi: {
    items: 2,
    patienceBase: 10,
    patiencePerItem: 4,
  },

  /** バター: 注文が多く気が長い。座っている間はエルフィンをパチンコで撃つ */
  butter: {
    items: 3,
    patienceBase: 14,
    patiencePerItem: 4,
    /** 座ってから最初に撃つまで */
    firstShot: 1,
    shotInterval: 2.2,
    shotStun: 1,
  },

  nell: {
    /** 来店の何秒前に予告するか */
    announceLead: 6,
    /** 待ち時間 = patienceBase + patiencePerItem × 注文個数 */
    patienceBase: 16,
    patiencePerItem: 2.5,
    /** 来店直後に注文が見えている秒数 */
    revealTime: 3,
    /** もう一度見せてもらったときに見える秒数 */
    peekTime: 1.5,
    peekCost: 4,
    wrongPenalty: 4,
    buffDuration: 20,
    buffRate: 1.2,
  },

  /** 終了の何秒前から新しい客が来なくなるか（エンドレスは来つづける） */
  closingTime: 4,
  /** 残り何秒で警告を出すか */
  warningTime: 10,
} as const;
