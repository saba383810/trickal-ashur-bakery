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

  /**
   * 注文の偏りを抑える。同じパンばかり続けて頼まれて品切れにならないよう、パンを選ぶ重み（人気）に掛ける:
   * 直近 recentOrders 件の注文と、いま選んでいる注文に入っている数ぶん recentRate、
   * 待っている注文に対して手持ち（在庫・トレー・オーブン）が足りなくなる数ぶん shortRate
   */
  orderBias: {
    recentOrders: 2,
    recentRate: 0.5,
    shortRate: 0.35,
    /** 同じパンが続けて注文に入るのは最大この件数まで（直近この件数すべてに入っていたパンは次の注文に入れない） */
    maxRun: 3,
  },

  /**
   * エルフィン: 「おやつ〜」と駆けこみ、ショーケースの前でちょびっと立ち止まってパンを 1 個取り、抱えて走って帰る。
   * 教主には止められない（ツケはネルで回収、止められるのはバターだけ）ので、店に長居はさせない
   */
  elfin: {
    /** 入口からショーケースまで駆けこむ秒数 */
    enterTime: 0.6,
    /** ショーケースの前で立ち止まってからパンを取るまで */
    lingerTime: 0.75,
    /** 取れるパンが無いときに、むくれてから帰るまで */
    sulkTime: 0.9,
    /** 走って帰る秒数（画面の外へ出るまで） */
    leaveTime: 0.75,
    /** ネルが帰ってから次にエルフィンが来るまでの最短秒数 */
    afterNell: 5,
    /** エンドレスで縮んでいく来る間隔の下限 [最短, 最長]（秒） */
    endlessMin: [4, 6],
  },

  /** ほっぺを引っぱって離したとき、伸び（0..1）がこれ以上なら客に効く */
  pinchStretch: 0.3,

  /** コミー: 席に着くとすぐ居眠り。ほっぺを引っぱると起きて注文する */
  komi: {
    items: 2,
    patienceBase: 10,
    patiencePerItem: 4,
  },

  /** バター: 注文が多く気が長い。座っている間は、パンを取る前のエルフィンをパチンコで撃って追い返す */
  butter: {
    items: 3,
    patienceBase: 14,
    patiencePerItem: 4,
    /**
     * エルフィンが来てから（バターが後から座ったならそこから）撃つまで。
     * elfin.enterTime + lingerTime より短くして、座っていれば必ず間に合うようにする
     */
    aim: 0.35,
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

  /**
   * フィーバータイム: 会計 stage.feverServes 回でゲージが満タンになると始まる。
   * パンが減らず、注文 1 個のお客さんが空いた席に次々来る。待ち時間は減らず、エルフィン・ネル・コミー・バターは終わるまで来ない
   */
  fever: {
    duration: 8,
    /** フィーバーの客が来る最短間隔 */
    spawnGap: 0.25,
    /** 席が空いてから次のフィーバーの客が来るまで */
    seatGap: 0.15,
    /** フィーバーの客の入店・退店（ふだんより速い） */
    enterTime: 0.45,
    leaveTime: 0.4,
    /** フィーバーの客の待ち時間（フィーバー中は減らず、終わってから減りはじめる） */
    patience: 10,
    /** フィーバーが終わってからエルフィンが来るまでの最短秒数 */
    elfinAfter: 3,
  },

  /**
   * ブルミ: ときどき左右どちらかの窓の外に張り付く。張り付いている間にタップすると reward G（売上に入る）。
   * 最初は firstAt 秒後、帰ってから interval 秒後にまた来る。フィーバー中と閉店間際は来ない
   */
  burumi: {
    firstAt: [12, 20],
    interval: [16, 28],
    enterTime: 0.45,
    stay: 4.5,
    leaveTime: 0.5,
    reward: 150,
  },

  /** 終了の何秒前から新しい客が来なくなるか（エンドレスは来つづける） */
  closingTime: 4,
  /** 残り何秒で警告を出すか */
  warningTime: 10,
} as const;
