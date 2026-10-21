import type { Sound } from '../audio/sound';
import { BALANCE } from '../config/balance';
import { BREADS } from '../config/breads';
import { STAGES, type StageDef } from '../config/stages';
import type { World } from '../sim/world';
import type { SaveData } from '../storage';
import { BUTTER, ELFIN, ESHUR, KOMI, NELL, villager } from '../view/draw/characters';
import type { ChibiSpec, Expr } from '../view/draw/chibi';
import { DISCLAIMER, breadCanvas, h, mochiChibi, starsText, yen } from './dom';

export interface MenuHost {
  save: SaveData;
  sound: Sound;
  persist(): void;
}

const reduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function button(label: string, onClick: () => void, cls = 'btn', host?: MenuHost): HTMLButtonElement {
  return h('button', {
    class: cls,
    type: 'button',
    onclick: () => {
      host?.sound.click();
      onClick();
    },
  }, label);
}

function panel(cls: string, ...children: (Node | null | false)[]): HTMLElement {
  return h('div', { class: `panel ${cls}`, role: 'dialog' }, ...children);
}

/** メニューのキャラはどれもほっぺを引っぱれる */
function chara(host: MenuHost, spec: ChibiSpec, expr: Expr, size: number, opts: { body?: boolean; flip?: boolean } = {}): HTMLElement {
  return mochiChibi(spec, expr, size, { ...opts, sound: host.sound });
}

// =================================================================== タイトル

export function titleScreen(host: MenuHost, stage: StageDef, on: { start: () => void; howTo: () => void; settings: () => void }): HTMLElement {
  const best = host.save.best[stage.id] ?? 0;
  const stars = host.save.stars[stage.id] ?? 0;
  const cast = h(
    'div',
    { class: 'title-cast' },
    h('div', { class: 'cast side far' }, chara(host, KOMI, 'normal', 30)),
    h('div', { class: 'cast side' }, chara(host, ELFIN, 'happy', 34)),
    h(
      'div',
      { class: 'cast main' },
      h('div', { class: 'say' }, 'パン屋じゃなくて、大魔法使いの店よ！'),
      chara(host, ESHUR, 'smile', 50),
    ),
    h('div', { class: 'cast side' }, chara(host, NELL, 'smile', 34, { flip: true })),
    h('div', { class: 'cast side far' }, chara(host, BUTTER, 'happy', 30, { flip: true })),
  );
  return h(
    'div',
    { class: 'screen title' },
    h('p', { class: 'logo-sub' }, 'トリッカル・もちもちほっぺ大作戦 ファンゲーム'),
    h('h1', { class: 'logo' }, h('span', { 'data-t': 'エシュールの' }, 'エシュールの'), h('span', { class: 'big', 'data-t': 'パン屋さん' }, 'パン屋さん')),
    cast,
    h('p', { class: 'hint' }, 'みんなのほっぺは、つまんで引っぱれます'),
    button('はじめる', on.start, 'btn primary big', host),
    h('div', { class: 'row' }, button('あそびかた', on.howTo, 'btn sub', host), button('設定', on.settings, 'btn sub', host)),
    best > 0 ? h('p', { class: 'total-stars' }, 'ベスト ', starsText(stars), ` ${yen(best)}`) : null,
    h('p', { class: 'disclaimer' }, DISCLAIMER),
  );
}

// ============================================================== ステージ紹介

export function stageIntro(host: MenuHost, s: StageDef, on: { start: () => void; back: () => void }): HTMLElement {
  const n = BALANCE.nell;
  const breads = h('div', { class: 'intro-breads' });
  for (const b of s.breads) {
    breads.append(h('div', { class: 'intro-bread' }, breadCanvas(b, 46), h('span', {}, BREADS[b].name), h('span', { class: 'price' }, `${BREADS[b].price}G`)));
  }
  const goals = h('div', { class: 'goals' });
  s.stars.forEach((v, i) => goals.append(h('div', { class: 'goal' }, starsText(i + 1), h('span', {}, yen(v)))));
  const tip = (spec: ChibiSpec, expr: Expr, title: string, text: string) =>
    h('div', { class: 'tip' }, h('div', { class: 'tip-face' }, chara(host, spec, expr, 26)), h('div', {}, h('h3', {}, title), h('p', {}, text)));
  const tips = h(
    'div',
    { class: 'tips' },
    tip(ELFIN, 'munch', 'エルフィン', 'パンを勝手に食べてツケに。ほっぺを強く引っぱって離すと追い払えます。'),
    tip(NELL, 'smile', 'ネル', `注文は最初の${n.revealTime}秒だけ。覚えてぴったり渡すと、ツケ回収＋${n.buffDuration}秒間 売上×${n.buffRate}。`),
    tip(KOMI, 'sleep', 'コミー', '居眠りしていて注文してくれません。ほっぺを引っぱると起きます。'),
    tip(BUTTER, 'happy', 'バター', '座っている間、エルフィンをパチンコで追い払ってくれます。'),
  );
  return panel(
    'intro',
    h('h2', {}, s.title),
    h('p', { class: 'blurb' }, s.blurb),
    h('p', { class: 'muted' }, `制限時間 ${s.duration}秒 ・ オーブン${s.ovens}台 ・ 客席${s.seats}つ`),
    breads,
    tips,
    h('p', { class: 'muted small' }, 'お客さんを押したままずらすと、ほっぺを引っぱってごきげんに（1人1回）。'),
    h('h3', { class: 'goals-title' }, '目標売上'),
    goals,
    h('div', { class: 'row' }, button('もどる', on.back, 'btn sub', host), button('開店する', on.start, 'btn primary', host)),
  );
}

// ==================================================================== 設定

export function settingsPanel(host: MenuHost, on: { close: () => void; replayTutorial: () => void }): HTMLElement {
  const s = host.save;
  const slider = (label: string, value: number, set: (v: number) => void) => {
    const input = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(value * 100) });
    input.addEventListener('input', () => {
      set(Number(input.value) / 100);
      host.sound.applyVolume();
      host.persist();
    });
    input.addEventListener('change', () => host.sound.pick());
    return h('label', { class: 'setting' }, h('span', {}, label), input);
  };
  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => {
    const input = h('input', { type: 'checkbox' });
    input.checked = value;
    input.addEventListener('change', () => {
      set(input.checked);
      host.sound.applyVolume();
      host.persist();
      host.sound.click();
    });
    return h('label', { class: 'setting toggle' }, h('span', {}, label), input);
  };
  const replay = button(
    s.tutorialDone ? 'チュートリアルをもう一度' : 'チュートリアルは次の開店で始まります',
    () => {
      on.replayTutorial();
      replay.textContent = '次の開店でチュートリアルが始まります';
      replay.disabled = true;
    },
    'btn sub small',
    host,
  );
  replay.disabled = !s.tutorialDone;
  return panel(
    'settings',
    h('h2', {}, '設定'),
    slider('効果音', s.sfxVolume, (v) => {
      s.sfxVolume = v;
      host.sound.sfxVolume = v;
    }),
    slider('BGM', s.bgmVolume, (v) => {
      s.bgmVolume = v;
      host.sound.bgmVolume = v;
    }),
    toggle('ミュート', s.muted, (v) => {
      s.muted = v;
      host.sound.muted = v;
    }),
    toggle('キーボード操作のヒントを出す', s.keyHints, (v) => (s.keyHints = v)),
    replay,
    h('div', { class: 'row' }, button('とじる', on.close, 'btn primary', host)),
  );
}

// =============================================================== あそびかた

export function howToPanel(host: MenuHost, on: { close: () => void }): HTMLElement {
  const n = BALANCE.nell;
  const pages: { title: string; art: () => HTMLElement; text: string[] }[] = [
    {
      title: 'お店の流れ',
      art: () => h('div', { class: 'art' }, breadCanvas('croissant', 56), h('span', { class: 'arrow' }, '→'), h('span', { class: 'tray-icon' }, 'トレー'), h('span', { class: 'arrow' }, '→'), chara(host, ESHUR, 'happy', 24)),
      text: [
        `制限時間は${STAGES[0].duration}秒。売上で★が決まります。`,
        'ショーケースのパンをタップすると、トレーにのります（4個まで）。',
        'お客さんをタップすると、トレーから注文のパンだけを渡します。',
        'まちがえてのせたパンは、トレーのパンをタップで戻せます。',
      ],
    },
    {
      title: 'ほっぺを引っぱる',
      art: () => h('div', { class: 'art' }, chara(host, villager(7), 'worried', 30), h('span', { class: 'arrow' }, '→'), h('span', { class: 'big-num' }, 'ごきげん！')),
      text: [
        'お客さんを押したまま指をずらすと、ほっぺを引っぱります（タップは接客）。',
        '引っぱって離すと、待ち時間が満タンに戻ります。1人1回まで。',
        'タイトルやこの画面のキャラも、ほっぺを引っぱれます。',
      ],
    },
    {
      title: 'お会計',
      art: () => h('div', { class: 'art' }, h('span', { class: 'big-num' }, '+20%'), h('span', { class: 'big-num' }, 'コンボ')),
      text: [
        `早く渡すほどチップが増えます（最大+${Math.round(BALANCE.tip.high * 100)}%）。`,
        `怒らせずに会計を続けるとコンボ。1人ごとに+${Math.round(BALANCE.combo.step * 100)}%（最大+${Math.round(BALANCE.combo.step * BALANCE.combo.maxSteps * 100)}%）。`,
        '待たせすぎると怒って帰り、コンボがとぎれます。',
      ],
    },
    {
      title: 'オーブン',
      art: () => h('div', { class: 'art' }, h('span', { class: 'oven-icon' }, 'やく'), h('span', { class: 'arrow' }, '→'), h('span', { class: 'oven-icon ready' }, 'やけた！')),
      text: [
        '空いているオーブンをタップして、焼くパンを選びます。',
        '焼けたらタップで取り出し。ショーケースに並びます。',
        `放っておくと${BALANCE.oven.readyWindow}秒で焦げてしまいます。`,
      ],
    },
    {
      title: 'エルフィン',
      art: () => h('div', { class: 'art' }, chara(host, ELFIN, 'munch', 30)),
      text: [
        'ショーケースのパンを勝手に食べて、ツケにしてしまいます。ツケは売上に入りません。',
        'ほっぺをつまんで引っぱり、離すと追い払えます。引っぱりが弱いとひるむだけ。',
        'つまんでいる間は食べられません。もう片方の手で接客もできます。',
      ],
    },
    {
      title: 'ネルの記憶接客',
      art: () => h('div', { class: 'art' }, chara(host, NELL, 'smile', 30)),
      text: [
        `来店の${BALANCE.nell.announceLead}秒前に予告。注文は最初の${n.revealTime}秒だけ見えます。`,
        '覚えたパンをトレーにそろえて、1回で渡します。多すぎても少なすぎてもダメ（順番は自由）。',
        `成功：ツケを全額回収＋${n.buffDuration}秒間 売上×${n.buffRate}。失敗：ツケはそのまま。`,
        `トレーが空のときにタップするか、ほっぺを引っぱると、もう一度見せてもらえます（${n.peekCost}秒待たせます）。`,
      ],
    },
    {
      title: 'コミーとバター',
      art: () => h('div', { class: 'art' }, chara(host, KOMI, 'sleep', 28), chara(host, BUTTER, 'happy', 28, { flip: true })),
      text: [
        'コミーは席で居眠りしていて、注文してくれません。ほっぺを引っぱると起きます。',
        '起きたあとも待たせすぎると、また寝てしまいます。',
        `バターは座っている間、エルフィンを${BALANCE.butter.shotInterval}秒ごとにパチンコで追い払ってくれます。`,
      ],
    },
    {
      title: 'キーボード',
      art: () => h('div', { class: 'art keys' }, ...['1', '2', 'A', 'Shift', 'Z', 'Space'].map((k) => h('kbd', {}, k))),
      text: [
        '1〜4：パンをトレーへ（焼くパンを選ぶときも）',
        'A S D F：左からお客さんに渡す　Shift＋A S D F：ほっぺを引っぱる',
        'Z X：オーブン　Backspace：トレーの最後を戻す',
        'Space長押し→離す：エルフィンを追い払う　Esc / P：ポーズ',
      ],
    },
  ];
  let page = 0;
  const body = h('div', { class: 'howto-body' });
  const dots = h('div', { class: 'dots' });
  const prev = button('まえ', () => go(page - 1), 'btn sub small', host);
  const next = button('つぎ', () => go(page + 1), 'btn sub small', host);
  const go = (i: number) => {
    page = Math.max(0, Math.min(pages.length - 1, i));
    const p = pages[page];
    body.replaceChildren(h('h3', {}, p.title), p.art(), h('ul', {}, ...p.text.map((t) => h('li', {}, t))));
    dots.replaceChildren(...pages.map((_, j) => h('span', { class: j === page ? 'dot on' : 'dot' })));
    prev.disabled = page === 0;
    next.disabled = page === pages.length - 1;
  };
  go(0);
  return panel(
    'howto',
    h('h2', {}, 'あそびかた'),
    body,
    h('div', { class: 'row pager' }, prev, dots, next),
    h('p', { class: 'disclaimer' }, DISCLAIMER),
    h('div', { class: 'row' }, button('とじる', on.close, 'btn primary', host)),
  );
}

// =================================================================== ポーズ

export function pausePanel(host: MenuHost, on: { resume: () => void; retry: () => void; quit: () => void; howTo: () => void }): HTMLElement {
  const mute = h('input', { type: 'checkbox' });
  mute.checked = host.save.muted;
  mute.addEventListener('change', () => {
    host.save.muted = mute.checked;
    host.sound.muted = mute.checked;
    host.sound.applyVolume();
    host.persist();
  });
  return panel(
    'pause',
    h('h2', {}, 'ポーズ'),
    h('div', { class: 'col' }, button('つづける', on.resume, 'btn primary', host), button('あそびかた', on.howTo, 'btn sub', host), button('はじめからやり直す', on.retry, 'btn sub', host), button('タイトルにもどる', on.quit, 'btn sub', host)),
    h('label', { class: 'setting toggle' }, h('span', {}, 'ミュート'), mute),
  );
}

// ================================================================= リザルト

export interface ResultInfo {
  stage: StageDef;
  world: World;
  stars: number;
  prevBest: number;
  prevStars: number;
}

function eshurComment(r: ResultInfo): { text: string; expr: 'happy' | 'smile' | 'worried' | 'sulk' } {
  const w = r.world;
  if (r.stars >= 3) return { text: 'すごいじゃない！ これで魔法の研究費もばっちりね！', expr: 'happy' };
  if (w.ledger.tabCollected > 0 && r.stars >= 1) return { text: 'ネルのおかげで女王様のツケが返ってきたわ。助かったわね！', expr: 'smile' };
  if (r.stars === 2) return { text: 'なかなかやるわね。さすが私の助手よ！', expr: 'smile' };
  if (r.stars === 1) {
    if (w.tab > 0) return { text: 'まあまあね。……女王様のツケ、また増えちゃったけど。', expr: 'worried' };
    return { text: 'まあまあね。次はもっと稼ぐわよ、教主！', expr: 'smile' };
  }
  if (w.stats.burnt >= 3) return { text: 'パンが焦げてる……！ 焼けたらすぐ取り出すのよ！', expr: 'sulk' };
  if (w.stats.angry >= 4) return { text: 'お客さんを待たせすぎよ！ トレーにまとめてのせると速いわ。', expr: 'sulk' };
  return { text: 'うう、今日も赤字……。大魔法使いの店なのに！', expr: 'sulk' };
}

export function resultPanel(
  host: MenuHost,
  r: ResultInfo,
  on: { retry: () => void; title: () => void },
): HTMLElement {
  const w = r.world;
  const l = w.ledger;
  const sales = w.sales;
  const newRecord = sales > r.prevBest;
  const total = h('div', { class: 'result-total' }, '0 G');
  const starsEl = h('div', { class: 'result-stars' });
  const starEls = [0, 1, 2].map(() => h('span', { class: 'star' }, '★'));
  starsEl.append(...starEls);

  const line = (label: string, v: number, cls = '') => h('div', { class: `line ${cls}` }, h('span', {}, label), h('span', {}, v ? `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString('ja-JP')} G` : '—'));
  const breakdown = h(
    'div',
    { class: 'breakdown' },
    line('パン代', l.base),
    line('早さチップ', l.tip),
    line('コンボ', l.combo),
    w.stage.nellVisits.length ? line(`ネルの祝福 ×${BALANCE.nell.buffRate}`, l.nell, 'nell') : null,
    w.stage.nellVisits.length ? line('ツケ回収', l.tabCollected, 'nell') : null,
    w.stage.elfin ? h('div', { class: 'line bad' }, h('span', {}, '未回収のツケ（売上外）'), h('span', {}, w.tab ? `${w.tab.toLocaleString('ja-JP')} G` : 'なし')) : null,
  );
  const st = w.stats;
  const stats = h(
    'div',
    { class: 'stats' },
    h('span', {}, `接客 ${st.served}人`),
    h('span', {}, `最大コンボ ${st.bestCombo}`),
    h('span', {}, `怒らせた ${st.angry}人`),
    h('span', {}, `焦がした ${st.burnt}回`),
    w.stage.elfin ? h('span', {}, `追い払った ${st.repelled}回`) : null,
    w.stage.nellVisits.length ? h('span', {}, `ネル接客 ${st.nellSuccess}/${st.nellSuccess + st.nellFail}`) : null,
    h('span', {}, `ほっぺ ${st.mochi}回`),
    w.stage.butterAt !== null ? h('span', {}, `バターの援護 ${st.butterShots}回`) : null,
  );
  const c = eshurComment(r);
  const comment = h('div', { class: 'comment' }, h('div', { class: 'comment-face' }, chara(host, ESHUR, c.expr, 28, { body: false })), h('p', {}, c.text));
  const badge = h('div', { class: 'badge hidden' }, 'ベスト更新！');

  const buttons = h('div', { class: 'row' }, button('タイトル', on.title, 'btn sub', host), button('もう一度', on.retry, 'btn primary', host));

  const el = panel(
    'result',
    h(
      'div',
      { class: 'result-main' },
      h('p', { class: 'stage-label' }, r.stage.title),
      h('h2', {}, '本日の売上'),
      total,
      badge,
      starsEl,
      breakdown,
    ),
    h('div', { class: 'result-side' }, stats, comment, buttons),
  );

  // 売上のカウントアップ → ★を順に点ける
  const dur = reduced() ? 0 : 1.1;
  const t0 = performance.now();
  let lit = 0;
  const tick = () => {
    const p = dur === 0 ? 1 : Math.min(1, (performance.now() - t0) / 1000 / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = sales * eased;
    total.textContent = yen(v);
    while (lit < 3 && v >= r.stage.stars[lit]) {
      starEls[lit].classList.add('on');
      host.sound.star(lit);
      lit++;
    }
    if (p < 1 && el.isConnected) requestAnimationFrame(tick);
    else if (p >= 1) {
      if (newRecord && sales > 0) badge.classList.remove('hidden');
      if (r.stars >= 3) host.sound.fanfare();
    }
  };
  requestAnimationFrame(tick);
  return el;
}
