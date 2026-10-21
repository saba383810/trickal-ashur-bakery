import { it } from 'vitest';
import { PLAY_STAGES } from '../src/config/stages';
import { Rng } from '../src/sim/rng';
import { starsFor, World } from '../src/sim/world';
import { Bot, SKILLS } from './bot';

// `npm run sim` で各モードをボットに遊ばせ、★の目標売上が妥当かを見る。
// エンドレスは営業できた時間とレベルも出す（MAX_TIME で打ち切り）。
const RUNS = 200;
const DT = 1 / 30;
const MAX_TIME = 900;

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

it('balance report', () => {
  const lines: string[] = [];
  for (const stage of PLAY_STAGES) {
    lines.push(`\n■ ${stage.title}（${stage.id}）  ★ ${stage.stars.join(' / ')}`);
    for (const skill of SKILLS) {
      const sales: number[] = [];
      const extra = { angry: 0, burnt: 0, tabLeft: 0, ate: 0, nellOk: 0, nellNg: 0 };
      const starCount = [0, 0, 0, 0];
      const times: number[] = [];
      let level = 0;
      for (let r = 0; r < RUNS; r++) {
        const w = new World(stage, 1000 + r);
        w.autoSpawn = true;
        const rng = new Rng(9000 + r);
        const bot = new Bot(w, skill, () => rng.next());
        while (w.phase === 'playing' && w.time < MAX_TIME) {
          bot.tick();
          w.step(DT);
        }
        sales.push(w.sales);
        times.push(Math.round(w.time));
        level += w.level;
        starCount[starsFor(stage, w.sales)]++;
        extra.angry += w.stats.angry;
        extra.burnt += w.stats.burnt;
        extra.tabLeft += w.tab;
        extra.ate += w.stats.elfinAte;
        extra.nellOk += w.stats.nellSuccess;
        extra.nellNg += w.stats.nellFail;
      }
      sales.sort((a, b) => a - b);
      times.sort((a, b) => a - b);
      const avg = (n: number) => (n / RUNS).toFixed(1);
      lines.push(
        `  ${skill.name.padEnd(4, '　')} p25 ${pct(sales, 0.25)}  中央 ${pct(sales, 0.5)}  p75 ${pct(sales, 0.75)}` +
          `  | ★0-3 ${starCount.join('/')}` +
          `  | 怒 ${avg(extra.angry)} 焦 ${avg(extra.burnt)} 食 ${avg(extra.ate)} 残ツケ ${avg(extra.tabLeft)}` +
          `  ネル ${extra.nellOk}/${extra.nellOk + extra.nellNg}` +
          (stage.endless ? `  | 営業 p25 ${pct(times, 0.25)}s 中央 ${pct(times, 0.5)}s p75 ${pct(times, 0.75)}s 平均Lv ${avg(level)}` : ''),
      );
    }
  }
  console.log(lines.join('\n'));
});
