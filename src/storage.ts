// 記録と設定の保存。localStorage が使えない環境（プライベートモード等）でも落ちないようにする。
const KEY = 'eshur-bakery:v2';

export interface SaveData {
  /** ステージ id → 最高売上 */
  best: Record<number, number>;
  /** ステージ id → 最高★ */
  stars: Record<number, number>;
  tutorialDone: boolean;
  sfxVolume: number;
  bgmVolume: number;
  muted: boolean;
  keyHints: boolean;
}

function defaults(): SaveData {
  return {
    best: {},
    stars: {},
    tutorialDone: false,
    sfxVolume: 0.8,
    bgmVolume: 0.5,
    muted: false,
    keyHints: true,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...defaults(),
      ...data,
      best: { ...(data.best ?? {}) },
      stars: { ...(data.stars ?? {}) },
    };
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 保存できなくても遊べる
  }
}
