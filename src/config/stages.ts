import type { BreadId } from './breads';

export interface StageDef {
  id: number;
  title: string;
  /** 紹介画面に出す一言 */
  blurb: string;
  duration: number;
  breads: BreadId[];
  ovens: number;
  seats: number;
  /** 最初にショーケースに並んでいる個数（各パン） */
  initialStock: number;
  customer: {
    /** 来店間隔（秒）。開始時 → 終了時へ線形に変化 */
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
  /** コミー（居眠り）とバター（見張り番）の来店時刻（秒）。null なら来ない */
  komiAt: number | null;
  butterAt: number | null;
  /**
   * ★1/★2/★3 の目標売上。`npm run sim` のボット中央値から
   * ★1 ≒ 初心者×0.6 / ★2 ≒ ふつう×0.7 / ★3 ≒ 上手い×0.8 を目安に置く（人間はボットより遅い前提）
   */
  stars: [number, number, number];
  tutorial?: boolean;
}

// 30 秒 1 本勝負のミニゲーム。エルフィンは開店直後から、コミー・バター・ネルも序盤のうちに来る。
export const STAGES: StageDef[] = [
  {
    id: 1,
    title: '30びょう営業',
    blurb: 'エルフィンもネルも、コミーもバターもやってくる。30秒でどれだけ稼げる？',
    duration: 30,
    breads: ['roll', 'croissant', 'melon', 'curry'],
    ovens: 2,
    seats: 4,
    initialStock: 3,
    customer: {
      intervalStart: 2.2,
      intervalEnd: 1.7,
      jitter: 0.25,
      itemWeights: [5, 4, 2],
      patienceBase: 8,
      patiencePerItem: 2.5,
    },
    elfin: { firstAt: 1.5, intervalMin: 2.5, intervalMax: 4, eatInterval: 1.3, maxEat: 3 },
    nellVisits: [13],
    nellItems: 3,
    komiAt: 7,
    butterAt: 4,
    stars: [1000, 1800, 2800],
    tutorial: true,
  },
];
