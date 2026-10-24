import { afterEach, describe, expect, it } from 'vitest';
import { loadSave, writeSave } from '../src/storage';

function fakeStorage(init: Record<string, unknown>): Map<string, string> {
  const map = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
  const localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
  (globalThis as { window?: unknown }).window = { localStorage };
  return map;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('保存', () => {
  it('辛口を足す前の記録は、前の「中辛」をいまの「辛口」へ移す', () => {
    fakeStorage({
      'eshur-bakery:v3': {
        best: { mild: 3000, medium: 9000, hot: 15000 },
        stars: { mild: 3, medium: 2, hot: 2 },
        bestTime: { endless: 120 },
        tutorialDone: true,
        muted: true,
      },
    });
    const save = loadSave();
    expect(save.best).toEqual({ mild: 3000, spicy: 9000, hot: 15000 });
    expect(save.stars).toEqual({ mild: 3, spicy: 2, hot: 2 });
    expect(save.bestTime).toEqual({ endless: 120 });
    expect(save.tutorialDone).toBe(true);
    expect(save.muted).toBe(true);
  });

  it('移したあとは新しい場所に保存し、そこから読む', () => {
    const map = fakeStorage({ 'eshur-bakery:v3': { best: { medium: 9000 }, stars: {}, bestTime: {} } });
    const save = loadSave();
    save.best.medium = 5000;
    writeSave(save);
    expect(JSON.parse(map.get('eshur-bakery:v4')!).best).toEqual({ spicy: 9000, medium: 5000 });
    expect(loadSave().best).toEqual({ spicy: 9000, medium: 5000 });
  });
});
