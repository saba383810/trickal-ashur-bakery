// 記録と設定の保存。localStorage が使えない環境（プライベートモード等）でも落ちないようにする。
const KEY = 'eshur-bakery:v4';
/** 辛口を足す前の保存。前の「中辛」はいまの「辛口」なので、記録をそちらへ移す */
const V3_KEY = 'eshur-bakery:v3';
/** 30 秒版の保存。記録は付け方が違うので捨て、設定だけ引き継ぐ */
const OLD_KEY = 'eshur-bakery:v2';

export interface SaveData {
  /** モード id → 最高売上 */
  best: Record<string, number>;
  /** モード id → 最高★ */
  stars: Record<string, number>;
  /** モード id → いちばん長く営業できた秒数（エンドレス） */
  bestTime: Record<string, number>;
  tutorialDone: boolean;
  sfxVolume: number;
  bgmVolume: number;
  muted: boolean;
  keyHints: boolean;
  /** 遊ぶ言語。null = まだ選んでいない（ブラウザの言語から決める） */
  lang: string | null;
}

function defaults(): SaveData {
  return {
    best: {},
    stars: {},
    bestTime: {},
    tutorialDone: false,
    sfxVolume: 0.8,
    bgmVolume: 0.5,
    muted: false,
    keyHints: true,
    lang: null,
  };
}

function parse(raw: string): SaveData {
  const data = JSON.parse(raw) as Partial<SaveData>;
  return {
    ...defaults(),
    ...data,
    best: { ...(data.best ?? {}) },
    stars: { ...(data.stars ?? {}) },
    bestTime: { ...(data.bestTime ?? {}) },
  };
}

function rename(rec: Record<string, number>, from: string, to: string): void {
  if (from in rec) rec[to] = rec[from];
  delete rec[from];
}

export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return parse(raw);
    const v3 = window.localStorage.getItem(V3_KEY);
    if (v3) {
      const data = parse(v3);
      for (const rec of [data.best, data.stars, data.bestTime]) rename(rec, 'medium', 'spicy');
      return data;
    }
    const old = window.localStorage.getItem(OLD_KEY);
    if (!old) return defaults();
    const o = JSON.parse(old) as Partial<SaveData>;
    const d = defaults();
    return { ...d, sfxVolume: o.sfxVolume ?? d.sfxVolume, bgmVolume: o.bgmVolume ?? d.bgmVolume, muted: o.muted ?? d.muted, keyHints: o.keyHints ?? d.keyHints };
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
