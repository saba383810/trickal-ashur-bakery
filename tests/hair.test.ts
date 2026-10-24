import { describe, expect, it } from 'vitest';
import { HAIR, MochiBody } from '../src/mochi/body';

const DT = 1 / 60;

/** 右（side = 1）か左のほっぺをつまみ、外へ引いて hold 秒待つ */
function pulled(side: 1 | -1, hold = 0.6): MochiBody {
  const b = new MochiBody();
  b.grab(1, { x: side * 40, y: 30 });
  b.pinch.move(1, { x: side * 120, y: 30 });
  for (let t = 0; t < hold; t += DT) b.update(DT);
  return b;
}

/** 離してから secs 秒の髪の揺れを記録する */
function sways(b: MochiBody, secs: number): number[] {
  b.pinch.release(1);
  const out: number[] = [];
  for (let t = 0; t < secs; t += DT) {
    b.update(DT);
    out.push(b.sway);
  }
  return out;
}

describe('ほっぺを離すと髪が揺れる', () => {
  it('右のほっぺを離すと、まず右へ揺れてから左右に揺れる', () => {
    const s = sways(pulled(1), 3);
    const peak = s.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
    expect(peak).toBeGreaterThan(3);
    expect(peak).toBeLessThanOrEqual(HAIR.max);
    expect(Math.min(...s)).toBeLessThan(-1);
  });

  it('左のほっぺなら左右が逆', () => {
    const r = sways(pulled(1), 1);
    const l = sways(pulled(-1), 1);
    r.forEach((v, i) => expect(l[i]).toBeCloseTo(-v, 6));
  });

  it('しばらくすると止まり、描き直しも要らなくなる', () => {
    const b = pulled(1);
    sways(b, 3);
    expect(b.sway).toBe(0);
    expect(b.active).toBe(false);
  });

  it('ゆっくり引いてつまんだままなら、髪はほとんど動かない', () => {
    const b = new MochiBody();
    b.grab(1, { x: 40, y: 30 });
    let max = 0;
    for (let t = 0; t < 2; t += DT) {
      b.pinch.move(1, { x: 40 + Math.min(1, t) * 80, y: 30 });
      b.update(DT);
      if (t > 1.6) max = Math.max(max, Math.abs(b.sway));
    }
    expect(max).toBeLessThan(0.5);
  });

  it('体ごと動いた反動でも揺れる', () => {
    const b = new MochiBody();
    b.jolt(600);
    let min = 0;
    for (let t = 0; t < 0.5; t += DT) {
      b.update(DT);
      min = Math.min(min, b.sway);
    }
    expect(min).toBeLessThan(-2);
  });
});
