import type { BreadId } from './breads';

export type ModeId = 'tutorial' | 'mild' | 'medium' | 'spicy' | 'hot' | 'endless';

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
  /** レベルが 1 上がるごとにエルフィンの来る間隔に掛ける倍率（下限は BALANCE.elfin.endlessMin） */
  elfinRate: number;
  /** レベルごとの注文個数の重み（足りないレベルは最後のものを使う） */
  itemWeights: number[][];
  /** ネル・コミー・バターが前回から次に来るまで [最短, 最長]（秒） */
  nellEvery: [number, number];
  komiEvery: [number, number];
  butterEvery: [number, number];
  /** このレベルからネルの注文が 1 個増える */
  nellHardLevel: number;
  /** このレベルから焼けたパンが焦げる（それまでは焦げない） */
  burnLevel: number;
}

export interface StageDef {
  id: ModeId | string;
  title: string;
  /** 辛さ（モード選択の唐辛子の数）。0 = チュートリアル、5 = エンドレス（∞） */
  heat: number;
  /** 紹介画面でエシュールがかける一言（このモードの特徴と気をつけること） */
  blurb: string;
  /** 制限時間（秒）。エンドレスは開始時の残り時間 */
  duration: number;
  breads: BreadId[];
  ovens: number;
  seats: number;
  /** 最初にショーケースに並んでいる個数（各パン） */
  initialStock: number;
  /** 焼き上がりから焦げるまでの秒数。null = 焦げない（取り出すまで待ってくれる） */
  burnTime: number | null;
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
  /** エルフィン（1 回来るたびにパンを 1 個持っていく。動きの秒数は BALANCE.elfin） */
  elfin: null | {
    firstAt: number;
    /** 帰ってから次に来るまで */
    intervalMin: number;
    intervalMax: number;
  };
  /** ネルの来店時刻（秒） */
  nellVisits: number[];
  /** ネルの注文個数 */
  nellItems: number;
  /** コミー（居眠り）とバター（見張り番）の来店時刻（秒） */
  komi: number[];
  butter: number[];
  /** コミー・バターの注文個数（省略時は BALANCE の値） */
  guestItems?: { komi: number; butter: number };
  /**
   * ★1/★2/★3 の目標売上。`npm run sim` のボット中央値から
   * ★1 ≒ 初心者×0.6 / ★2 ≒ ふつう×0.7 / ★3 ≒ 上手い×0.8 を目安に置く（人間はボットより遅い前提）
   */
  stars: [number, number, number];
  /** 窓にブルミが来る（BALANCE.burumi） */
  burumi?: boolean;
  /** 会計この回数でフィーバータイム（BALANCE.fever）。省略 = 自動では起きない（チュートリアルは手順の中で起こす） */
  feverServes?: number;
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
    blurb: '接客から、女王様たちの相手のしかたまで、私がひととおり教えるわね！',
    duration: 60,
    breads: ['roll', 'croissant', 'melon', 'curry'],
    ovens: 2,
    seats: 4,
    initialStock: 5,
    burnTime: null,
    customer: { intervalStart: 6, intervalEnd: 6, jitter: 0, itemWeights: [1], patienceBase: 16, patiencePerItem: 5 },
    // 手順の中で呼ぶ（自分からは来ない）
    elfin: { firstAt: Infinity, intervalMin: 2, intervalMax: 2 },
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
    blurb: 'のんびり営業よ。パンは2種類、注文もひとつずつ。焼けたパンは焦げないから、あわてなくて大丈夫！',
    duration: 60,
    // はじめの一歩: 見分けやすい 2 種だけ。注文は通常客 1 個・コミー 1 個・ネルとバター 2 個。焦げない。
    // 4 人とも来る。エルフィンは止められないので、ネル（32 秒）までにツケが 2〜3 個分貯まる間隔で来る
    breads: ['roll', 'melon'],
    ovens: 2,
    seats: 3,
    initialStock: 3,
    burnTime: null,
    customer: { intervalStart: 5, intervalEnd: 3.8, jitter: 0.25, itemWeights: [1], patienceBase: 16, patiencePerItem: 5 },
    elfin: { firstAt: 5, intervalMin: 6, intervalMax: 8 },
    nellVisits: [32],
    nellItems: 2,
    komi: [14],
    butter: [44],
    burumi: true,
    guestItems: { komi: 1, butter: 2 },
    // 来店ペースで売上が頭打ちになり、腕前の差が出にくい。★はボット中央値（初心者 約 5,150 / ふつう 約 7,000 / 上手い 約 8,250）の約 58% / 62% / 73%
    stars: [3700, 5200, 7400],
    feverServes: 8,
  },
  {
    id: 'medium',
    title: '中辛',
    heat: 2,
    blurb: 'お客さんが増えてきたわ。パンは3種類で、ふたつまとめての注文もあるの。まだ焦げないから、注文をよく見て渡してね！',
    duration: 75,
    // 微辛の次の一歩: パン 3 種・注文は 1〜2 個。オーブンはパンの数だけあり、まだ焦げない
    breads: ['roll', 'croissant', 'melon'],
    ovens: 3,
    seats: 3,
    initialStock: 3,
    burnTime: null,
    customer: { intervalStart: 4.9, intervalEnd: 3.7, jitter: 0.25, itemWeights: [3, 1], patienceBase: 16, patiencePerItem: 5 },
    elfin: { firstAt: 5, intervalMin: 5, intervalMax: 7 },
    nellVisits: [30, 58],
    nellItems: 2,
    komi: [15, 48],
    butter: [40],
    burumi: true,
    guestItems: { komi: 2, butter: 2 },
    // 微辛と同じく来店ペースで頭打ちぎみ。★はボット中央値（約 6,450 / 9,800 / 11,850）の約 61% / 69% / 84%
    stars: [4700, 9100, 13100],
    feverServes: 9,
  },
  {
    id: 'spicy',
    title: '辛口',
    heat: 3,
    blurb: 'お昼どきよ。パンは4種類。ここからは焼けたパンを放っておくと焦げちゃうから、「やけた！」が出たらすぐ取り出してね。',
    duration: 90,
    // 中辛の次の一歩: パン 4 種・注文はほぼ 1〜2 個（たまに 3 個）。ここで「焦げる」が入る（猶予は長め）
    breads: ['roll', 'croissant', 'melon', 'anpan'],
    ovens: 3,
    seats: 4,
    initialStock: 3,
    burnTime: 10,
    customer: { intervalStart: 4.8, intervalEnd: 3.6, jitter: 0.25, itemWeights: [5, 4, 1], patienceBase: 16, patiencePerItem: 5 },
    elfin: { firstAt: 5, intervalMin: 6, intervalMax: 8 },
    nellVisits: [35, 70],
    nellItems: 3,
    komi: [18, 58],
    butter: [46],
    burumi: true,
    stars: [5500, 10900, 16200],
    feverServes: 10,
  },
  {
    id: 'hot',
    title: '激辛',
    heat: 4,
    blurb: '全部のパンに全部のお客さん。焦げるのも早いし、女王様もおなかぺこぺこよ。教主、覚悟はいい？',
    duration: 120,
    breads: ALL_BREADS,
    ovens: 3,
    seats: 4,
    initialStock: 3,
    burnTime: 8,
    customer: { intervalStart: 4.2, intervalEnd: 3, jitter: 0.25, itemWeights: [4, 4, 3, 1], patienceBase: 15, patiencePerItem: 5 },
    elfin: { firstAt: 5, intervalMin: 5, intervalMax: 8 },
    nellVisits: [38, 85],
    nellItems: 4,
    komi: [18, 60, 100],
    butter: [48, 92],
    burumi: true,
    stars: [8200, 15600, 24600],
    feverServes: 10,
  },
  {
    id: 'endless',
    title: 'エンドレス',
    heat: 5,
    blurb: 'コンボを続けると時間が延びるの。どんどん忙しくなるお店で、どこまで続けられるかしら？',
    duration: 45,
    breads: ['roll', 'croissant', 'melon', 'anpan', 'curry', 'cornet'],
    ovens: 3,
    seats: 4,
    initialStock: 3,
    // 焦げるのは endless.burnLevel から
    burnTime: 8,
    customer: { intervalStart: 4.6, intervalEnd: 4.6, jitter: 0.25, itemWeights: [5, 4, 1], patienceBase: 15, patiencePerItem: 5 },
    elfin: { firstAt: 6, intervalMin: 7, intervalMax: 10 },
    nellVisits: [40],
    nellItems: 3,
    komi: [15],
    butter: [28],
    burumi: true,
    stars: [6200, 19100, 61500],
    feverServes: 9,
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
      elfinRate: 0.95,
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
      burnLevel: 3,
    },
  },
];

export const TUTORIAL = STAGES[0];
/** 売上で★がつくモード（チュートリアル以外） */
export const PLAY_STAGES = STAGES.filter((s) => !s.tutorial);

export function stageById(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}
