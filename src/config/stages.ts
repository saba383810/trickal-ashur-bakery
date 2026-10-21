import type { BreadId } from './breads';

export type ModeId = 'tutorial' | 'mild' | 'medium' | 'hot' | 'endless';

/** エンドレス: 会計で時間が延び、時間がたつほど忙しくなる */
export interface EndlessDef {
  /** 何秒ごとにレベルが上がるか */
  levelTime: number;
  maxLevel: number;
  /** 会計 1 回で延びる秒数 = timeBase + timePerCombo × min(コンボ, timeComboCap) */
  timeBase: number;
  timePerCombo: number;
  timeComboCap: number;
  /** ネルの記憶接客に成功したときに延びる秒数 */
  nellTime: number;
  /** 残り時間の上限 */
  maxRemaining: number;
  /** レベルが 1 上がるごとに来店間隔に掛ける倍率と、その下限（秒） */
  intervalRate: number;
  intervalMin: number;
  /** レベルが 1 上がるごとに待ち時間に掛ける倍率と、その下限（倍率） */
  patienceRate: number;
  patienceMin: number;
  /** レベルが 1 上がるごとにエルフィンの来る間隔・食べる間隔に掛ける倍率 */
  elfinRate: number;
  /** レベルごとの注文個数の重み（足りないレベルは最後のものを使う） */
  itemWeights: number[][];
  /** ネル・コミー・バターが前回から次に来るまで [最短, 最長]（秒） */
  nellEvery: [number, number];
  komiEvery: [number, number];
  butterEvery: [number, number];
  /** このレベルからネルの注文が 1 個増える */
  nellHardLevel: number;
}

export interface StageDef {
  id: ModeId | string;
  title: string;
  /** 辛さ（モード選択の唐辛子の数）。0 = チュートリアル */
  heat: number;
  /** 紹介画面に出す一言 */
  blurb: string;
  /** 制限時間（秒）。エンドレスは開始時の残り時間 */
  duration: number;
  breads: BreadId[];
  ovens: number;
  seats: number;
  /** 最初にショーケースに並んでいる個数（各パン） */
  initialStock: number;
  customer: {
    /** 来店間隔（秒）。開始時 → 終了時へ線形に変化（エンドレスは intervalStart からレベルで縮む） */
    intervalStart: number;
    intervalEnd: number;
    jitter: number;
    /** 注文個数 1,2,3,4 の重み（長さ = 注文上限） */
    itemWeights: number[];
    patienceBase: number;
    patiencePerItem: number;
  };
  elfin: null | {
    firstAt: number;
    /** 退店してから次に来るまで */
    intervalMin: number;
    intervalMax: number;
    eatInterval: number;
    maxEat: number;
  };
  /** ネルの来店時刻（秒） */
  nellVisits: number[];
  /** ネルの注文個数 */
  nellItems: number;
  /** コミー（居眠り）とバター（見張り番）の来店時刻（秒） */
  komi: number[];
  butter: number[];
  /**
   * ★1/★2/★3 の目標売上。`npm run sim` のボット中央値から
   * ★1 ≒ 初心者×0.6 / ★2 ≒ ふつう×0.7 / ★3 ≒ 上手い×0.8 を目安に置く（人間はボットより遅い前提）
   */
  stars: [number, number, number];
  endless?: EndlessDef;
  /** 手順説明だけのモード（売上・★なし） */
  tutorial?: boolean;
}

const ALL_BREADS: BreadId[] = ['roll', 'croissant', 'melon', 'anpan', 'curry', 'cornet', 'shokupan'];

// エルフィン・ネル・コミー・バターはどのモードにも来る。辛いほど長く、パンも客も多くなる。
export const STAGES: StageDef[] = [
  {
    id: 'tutorial',
    title: 'チュートリアル',
    heat: 0,
    blurb: 'エシュールが、接客から全員の相手のしかたまで教えてくれます。',
    duration: 60,
    breads: ['roll', 'croissant', 'melon', 'curry'],
    ovens: 2,
    seats: 4,
    initialStock: 5,
    customer: { intervalStart: 6, intervalEnd: 6, jitter: 0, itemWeights: [1], patienceBase: 16, patiencePerItem: 5 },
    // 手順の中で呼ぶ。追い払う前に帰ってしまわないよう、たくさん食べる
    elfin: { firstAt: Infinity, intervalMin: 2, intervalMax: 2, eatInterval: 2.4, maxEat: 9 },
    nellVisits: [],
    nellItems: 2,
    komi: [],
    butter: [],
    stars: [0, 0, 0],
    tutorial: true,
  },
  {
    id: 'mild',
    title: '微辛',
    heat: 1,
    blurb: 'のんびり営業。パンは4種類、お客さんも少なめ。',
    duration: 90,
    breads: ['roll', 'croissant', 'melon', 'anpan'],
    ovens: 2,
    seats: 3,
    initialStock: 3,
    customer: { intervalStart: 5.5, intervalEnd: 4.2, jitter: 0.25, itemWeights: [6, 4], patienceBase: 16, patiencePerItem: 5 },
    elfin: { firstAt: 12, intervalMin: 11, intervalMax: 16, eatInterval: 1.9, maxEat: 3 },
    nellVisits: [48],
    nellItems: 3,
    komi: [22],
    butter: [66],
    stars: [4000, 5500, 7000],
  },
  {
    id: 'medium',
    title: '中辛',
    heat: 2,
    blurb: 'お昼どき。客席が4つ、オーブンも3台フル回転。',
    duration: 120,
    breads: ['roll', 'croissant', 'melon', 'anpan', 'curry', 'cornet'],
    ovens: 3,
    seats: 4,
    initialStock: 3,
    customer: { intervalStart: 4.6, intervalEnd: 3.2, jitter: 0.25, itemWeights: [4, 4, 3], patienceBase: 15, patiencePerItem: 5 },
    elfin: { firstAt: 10, intervalMin: 9, intervalMax: 14, eatInterval: 1.7, maxEat: 4 },
    nellVisits: [45, 95],
    nellItems: 3,
    komi: [25, 80],
    butter: [60],
    stars: [6000, 10000, 15500],
  },
  {
    id: 'hot',
    title: '激辛',
    heat: 3,
    blurb: '全部のパン、全部の客、全部のつまみ食い。',
    duration: 150,
    breads: ALL_BREADS,
    ovens: 3,
    seats: 4,
    initialStock: 3,
    customer: { intervalStart: 4, intervalEnd: 2.7, jitter: 0.25, itemWeights: [3, 4, 3, 2], patienceBase: 14, patiencePerItem: 5 },
    elfin: { firstAt: 8, intervalMin: 7, intervalMax: 12, eatInterval: 1.5, maxEat: 5 },
    nellVisits: [42, 105],
    nellItems: 4,
    komi: [20, 75, 125],
    butter: [55, 110],
    stars: [6500, 11500, 20000],
  },
  {
    id: 'endless',
    title: 'エンドレス',
    heat: 4,
    blurb: 'コンボを続けて時間を延ばそう。どんどん忙しくなる店で、どこまで続けられる？',
    duration: 45,
    breads: ['roll', 'croissant', 'melon', 'anpan', 'curry', 'cornet'],
    ovens: 3,
    seats: 4,
    initialStock: 3,
    customer: { intervalStart: 4.6, intervalEnd: 4.6, jitter: 0.25, itemWeights: [5, 4, 1], patienceBase: 15, patiencePerItem: 5 },
    elfin: { firstAt: 10, intervalMin: 11, intervalMax: 16, eatInterval: 1.8, maxEat: 4 },
    nellVisits: [40],
    nellItems: 3,
    komi: [15],
    butter: [28],
    stars: [4000, 11000, 30000],
    endless: {
      levelTime: 20,
      maxLevel: 20,
      timeBase: 1.2,
      timePerCombo: 0.25,
      timeComboCap: 12,
      nellTime: 6,
      maxRemaining: 60,
      intervalRate: 0.91,
      intervalMin: 1.9,
      patienceRate: 0.94,
      patienceMin: 0.5,
      elfinRate: 0.93,
      itemWeights: [
        [5, 4, 1],
        [4, 4, 2],
        [4, 4, 3],
        [3, 4, 3, 1],
        [3, 4, 4, 2],
        [2, 4, 4, 3],
      ],
      nellEvery: [55, 75],
      komiEvery: [35, 50],
      butterEvery: [45, 65],
      nellHardLevel: 5,
    },
  },
];

export const TUTORIAL = STAGES[0];
/** 売上で★がつくモード（チュートリアル以外） */
export const PLAY_STAGES = STAGES.filter((s) => !s.tutorial);

export function stageById(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}
