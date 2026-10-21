export type BreadId = 'roll' | 'croissant' | 'melon' | 'anpan' | 'curry' | 'cornet' | 'shokupan';

export interface BreadDef {
  id: BreadId;
  name: string;
  price: number;
  /** 焼成にかかる秒数 */
  bakeTime: number;
  /** 1 回の焼成でできる個数 */
  batch: number;
  /** 注文される頻度の重み */
  popularity: number;
}

export const BREADS: Record<BreadId, BreadDef> = {
  roll: { id: 'roll', name: 'ロールパン', price: 100, bakeTime: 5, batch: 3, popularity: 5 },
  croissant: { id: 'croissant', name: 'クロワッサン', price: 150, bakeTime: 7, batch: 3, popularity: 4 },
  melon: { id: 'melon', name: 'メロンパン', price: 180, bakeTime: 8, batch: 3, popularity: 4 },
  anpan: { id: 'anpan', name: 'あんパン', price: 160, bakeTime: 7, batch: 3, popularity: 3 },
  curry: { id: 'curry', name: 'カレーパン', price: 220, bakeTime: 9, batch: 3, popularity: 3 },
  cornet: { id: 'cornet', name: 'チョココロネ', price: 200, bakeTime: 8, batch: 3, popularity: 3 },
  shokupan: { id: 'shokupan', name: '食パン', price: 320, bakeTime: 12, batch: 2, popularity: 2 },
};
