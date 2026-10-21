import { it } from 'vitest';
import { STAGES } from '../src/config/stages';
import { Rng } from '../src/sim/rng';
import { starsFor, World } from '../src/sim/world';
import { Bot, SKILLS } from './bot';

// `npm run sim` で各ステージをボットに遊ばせ、★の目標売上が妥当かを見る。
const RUNS = 200;
const DT = 1 / 30;

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

it('balance report', () => {
  const lines: string[] = [];
  for (const stage of STAGES) {
    lines.push(`\n■ Stage ${stage.id} ${stage.title}  ★ ${stage.stars.join(' / ')}`);
    for (const skill of SKILLS) {
      const sales: number[] = [];
      const extra = { angry: 0, burnt: 0, tabLeft: 0, ate: 0, nellOk: 0, nellNg: 0 };
      const starCount = [0, 0, 0, 0];
      for (let r = 0; r < RUNS; r++) {
        const w = new World(stage, 1000 + r);
        w.autoSpawn = true;
        const rng = new Rng(9000 + r);
        const bot = new Bot(w, skill, () => rng.next());
        while (w.phase === 'playing') {
          bot.tick();
          w.step(DT);
        }
        sales.push(w.sales);
        starCount[starsFor(stage, w.sales)]++;
        extra.angry += w.stats.angry;
        extra.burnt += w.stats.burnt;
        extra.tabLeft += w.tab;
        extra.ate += w.stats.elfinAte;
        extra.nellOk += w.stats.nellSuccess;
        extra.nellNg += w.stats.nellFail;
      }
      sales.sort((a, b) => a - b);
      const avg = (n: number) => (n / RUNS).toFixed(1);
      lines.push(
        `  ${skill.name.padEnd(4, '　')} p25 ${pct(sales, 0.25)}  中央 ${pct(sales, 0.5)}  p75 ${pct(sales, 0.75)}` +
          `  | ★0-3 ${starCount.join('/')}` +
          `  | 怒 ${avg(extra.angry)} 焦 ${avg(extra.burnt)} 食 ${avg(extra.ate)} 残ツケ ${avg(extra.tabLeft)}` +
          `  ネル ${extra.nellOk}/${extra.nellOk + extra.nellNg}`,
      );
    }
  }
  console.log(lines.join('\n'));
});
