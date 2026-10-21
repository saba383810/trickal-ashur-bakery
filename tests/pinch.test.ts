import { describe, expect, it } from 'vitest';
import { MOCHI, outward, Pinch } from '../src/mochi/pinch';

describe('ほっぺは外側へだけ伸びる', () => {
  it('つまんだ側の外へ引けば、そのまま', () => {
    expect(outward(30, -10, 1)).toEqual({ x: 30, y: -10 });
    expect(outward(-30, 10, -1)).toEqual({ x: -30, y: 10 });
  });

  it('真内側へ引いても伸びない', () => {
    expect(outward(-30, 0, 1)).toEqual({ x: 0, y: 0 });
    expect(outward(30, 0, -1)).toEqual({ x: 0, y: 0 });
  });

  it('真下へ引くと、外側の範囲の端へ寄せる', () => {
    const v = outward(0, 40, 1);
    const max = MOCHI.outwardAngle;
    expect(Math.atan2(v.y, v.x)).toBeCloseTo(max);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(40 * Math.cos(Math.PI / 2 - max));
    const w = outward(0, -40, -1);
    expect(w.x).toBeLessThan(0);
    expect(w.y).toBeLessThan(0);
  });

  it('右のほっぺをつまんで内側へ引いても、伸びは 0 のまま', () => {
    const p = new Pinch();
    p.grab(1, { x: 40, y: 30 }, { x: 40, y: 30 });
    p.move(1, { x: 0, y: 30 });
    for (let i = 0; i < 30; i++) p.update(1 / 60);
    const g = p.find(1)!;
    expect(Math.hypot(g.pull.x, g.pull.y)).toBeLessThan(0.01);
    p.move(1, { x: 80, y: 30 });
    for (let i = 0; i < 30; i++) p.update(1 / 60);
    expect(g.pull.x).toBeGreaterThan(20);
  });
});
