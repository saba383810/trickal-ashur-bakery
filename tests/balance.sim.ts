import { it } from 'vitest';
import { PLAY_STAGES } from '../src/config/stages';
import { Rng } from '../src/sim/rng';
import { starsFor, World } from '../src/sim/world';
import type { BreadId } from '../src/config/breads';
import { Bot, SKILLS } from './bot';

// `npm run sim` で各モードをボットに遊ばせ、★の目標売上が妥当かを見る。
// エンドレスは営業できた時間とレベルも出す（MAX_TIME で打ち切り）。
// 食 = エルフィンに持っていかれたパン、撃 = バターが追い返した回数、回収 = ネルで回収したツケ（いずれも 1 回あたりの平均）。
// 不足 = 注文が入った時点で手持ち（在庫・トレー・オーブン）では足りなかったパンの割合、連続 = 同じパンが続けて注文に入った最長件数の平均。
// NO_FEVER=1 でフィーバーなしの売上と比べられる。
const RUNS = 200;
const NO_FEVER = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.NO_FEVER === '1';
const DT = 1 / 30;
const MAX_TIME = 900;

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

it('balance report', () => {
  const lines: string[] = [];
  for (const base of PLAY_STAGES) {
    const stage = NO_FEVER ? { ...base, feverServes: undefined } : base;
    lines.push(`\n■ ${stage.title}（${stage.id}）  ★ ${stage.stars.join(' / ')}`);
    for (const skill of SKILLS) {
      const sales: number[] = [];
      const extra = { angry: 0, burnt: 0, tabLeft: 0, tabPaid: 0, ate: 0, shots: 0, nellOk: 0, nellNg: 0, items: 0, short: 0, streak: 0, fevers: 0, feverSales: 0, noFever: 0, served: 0 };
      const starCount = [0, 0, 0, 0];
      const times: number[] = [];
      let level = 0;
      for (let r = 0; r < RUNS; r++) {
        const w = new World(stage, 1000 + r);
        w.autoSpawn = true;
        const rng = new Rng(9000 + r);
        const bot = new Bot(w, skill, () => rng.next());
        let seen = 0;
        let longest = 0;
        const run = new Map<BreadId, number>();
        while (w.phase === 'playing' && w.time < MAX_TIME) {
          const before = w.sales;
          const inFever = w.fever > 0;
          bot.tick();
          w.step(DT);
          if (inFever) extra.feverSales += w.sales - before;
          for (const c of w.customers) {
            if (c.id <= seen) continue;
            seen = c.id;
            // フィーバーの客はパンが減らないので、不足・連続には数えない
            if (c.fever) continue;
            const spare = w.spareBreads();
            for (const b of stage.breads) {
              const n = c.order.filter((x) => x === b).length;
              extra.short += Math.min(n, Math.max(0, -spare[b]));
              run.set(b, n > 0 ? (run.get(b) ?? 0) + 1 : 0);
            }
            extra.items += c.order.length;
            longest = Math.max(longest, ...run.values());
          }
        }
        extra.streak += longest;
        sales.push(w.sales);
        times.push(Math.round(w.time));
        level += w.level;
        starCount[starsFor(stage, w.sales)]++;
        extra.angry += w.stats.angry;
        extra.burnt += w.stats.burnt;
        extra.tabLeft += w.tab;
        extra.tabPaid += w.ledger.tabCollected;
        extra.ate += w.stats.elfinAte;
        extra.shots += w.stats.butterShots;
        extra.nellOk += w.stats.nellSuccess;
        extra.nellNg += w.stats.nellFail;
        extra.fevers += w.stats.fevers;
        extra.served += w.stats.served + w.stats.nellSuccess - w.stats.feverServed;
        if (w.stats.fevers === 0) extra.noFever++;
      }
      sales.sort((a, b) => a - b);
      times.sort((a, b) => a - b);
      const avg = (n: number) => (n / RUNS).toFixed(1);
      lines.push(
        `  ${skill.name.padEnd(4, '　')} p25 ${pct(sales, 0.25)}  中央 ${pct(sales, 0.5)}  p75 ${pct(sales, 0.75)}` +
          `  | ★0-3 ${starCount.join('/')}` +
          `  | 怒 ${avg(extra.angry)} 焦 ${avg(extra.burnt)} 食 ${avg(extra.ate)} 撃 ${avg(extra.shots)} 回収 ${avg(extra.tabPaid)} 残ツケ ${avg(extra.tabLeft)}` +
          `  ネル ${extra.nellOk}/${extra.nellOk + extra.nellNg}` +
          `  | 不足 ${((extra.short / extra.items) * 100).toFixed(1)}% 連続 ${avg(extra.streak)}` +
          `  | 会計 ${avg(extra.served)} フィーバー ${avg(extra.fevers)}回 (0回 ${extra.noFever}) 売上 ${avg(extra.feverSales)}` +
          (stage.endless ? `  | 営業 p25 ${pct(times, 0.25)}s 中央 ${pct(times, 0.5)}s p75 ${pct(times, 0.75)}s 平均Lv ${avg(level)}` : ''),
      );
    }
  }
  console.log(lines.join('\n'));
});
