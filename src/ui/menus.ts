import type { Sound } from '../audio/sound';
import { BALANCE } from '../config/balance';
import { BREADS } from '../config/breads';
import { PLAY_STAGES, STAGES, type StageDef } from '../config/stages';
import type { World } from '../sim/world';
import type { SaveData } from '../storage';
import { breadName, lang, LANGS, langName, stageBlurb, stageTitle, T, type Lang } from '../i18n';
import { BUTTER, ELFIN, ESHUR, KOMI, NELL, SPEAKI, villager } from '../view/draw/characters';
import type { ChibiSpec, Expr } from '../view/draw/chibi';
import { breadCanvas, burumiCanvas, h, mochiChibi, starsText, yen } from './dom';

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

/** タイトル右上の言語ボタン。押すと 日本語 / 한국어 / English を選べる */
function langPicker(host: MenuHost, onPick: (l: Lang) => void): HTMLElement {
  const menu = h('div', { class: 'lang-menu hidden', role: 'menu' });
  const toggle = h(
    'button',
    {
      class: 'lang-btn',
      type: 'button',
      'aria-haspopup': 'true',
      'aria-label': T.common.language,
      onclick: () => {
        host.sound.click();
        menu.classList.toggle('hidden');
      },
    },
    h('span', { class: 'lang-icon', 'aria-hidden': 'true' }),
    langName(lang),
  );
  for (const l of LANGS) {
    menu.append(
      h(
        'button',
        {
          class: l === lang ? 'lang-item on' : 'lang-item',
          type: 'button',
          role: 'menuitemradio',
          'aria-checked': String(l === lang),
          lang: l,
          onclick: () => {
            host.sound.click();
            menu.classList.add('hidden');
            if (l !== lang) onPick(l);
          },
        },
        langName(l),
      ),
    );
  }
  return h('div', { class: 'lang' }, toggle, menu);
}

export function titleScreen(
  host: MenuHost,
  on: { start: () => void; howTo: () => void; settings: () => void; lang: (l: Lang) => void },
): HTMLElement {
  const stars = PLAY_STAGES.reduce((n, s) => n + (host.save.stars[s.id] ?? 0), 0);
  const cast = h(
    'div',
    { class: 'title-cast' },
    h('div', { class: 'cast side far' }, chara(host, KOMI, 'normal', 30)),
    h('div', { class: 'cast side' }, chara(host, ELFIN, 'happy', 34)),
    h(
      'div',
      { class: 'cast main' },
      h('div', { class: 'say' }, T.title.say),
      chara(host, ESHUR, 'smile', 50),
      // スピキはエシュールとネルの足もとにしゃがむ
      h('div', { class: 'cast pet' }, chara(host, SPEAKI, 'happy', 26, { flip: true })),
    ),
    h('div', { class: 'cast side' }, chara(host, NELL, 'smile', 34, { flip: true })),
    h('div', { class: 'cast side far' }, chara(host, BUTTER, 'happy', 30, { flip: true })),
  );
  return h(
    'div',
    { class: 'screen title' },
    langPicker(host, on.lang),
    h('p', { class: 'logo-sub' }, T.title.sub),
    h('h1', { class: 'logo' }, h('span', { 'data-t': T.title.logo1 }, T.title.logo1), h('span', { class: 'big', 'data-t': T.title.logo2 }, T.title.logo2)),
    cast,
    h('p', { class: 'hint' }, T.title.hint),
    button(T.title.start, on.start, 'btn primary big', host),
    h('div', { class: 'row' }, button(T.common.howTo, on.howTo, 'btn sub', host), button(T.common.settings, on.settings, 'btn sub', host)),
    stars > 0 ? h('p', { class: 'total-stars' }, T.title.stars(stars, PLAY_STAGES.length * 3)) : null,
    h('p', { class: 'disclaimer' }, T.disclaimer),
  );
}

// ============================================================== モード選択

/** モードごとの顔（カードの左に出す。しゃがんだスピキは顔と同じくらいの枠に収まるので体ごと） */
const MODE_FACE: Record<string, [ChibiSpec, Expr]> = {
  tutorial: [SPEAKI, 'happy'],
  mild: [KOMI, 'normal'],
  medium: [ESHUR, 'happy'],
  spicy: [BUTTER, 'happy'],
  hot: [ELFIN, 'munch'],
  endless: [NELL, 'smile'],
};

/** 辛さ 1〜4 は唐辛子の数、5（エンドレス）は ∞ */
function chilis(heat: number): HTMLElement {
  const el = h('span', { class: 'chilis', 'aria-label': T.modes.heat(heat) });
  if (heat > 4) el.append(h('span', { class: 'chili' }), h('span', { class: 'chili-inf' }, '∞'));
  else for (let i = 0; i < heat; i++) el.append(h('span', { class: 'chili' }));
  return el;
}

export function formatTime(sec: number): string {
  const t = Math.floor(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function modeMeta(s: StageDef): string {
  if (s.tutorial) return T.modes.metaTutorial;
  if (s.endless) return T.modes.metaEndless(s.duration, s.breads.length);
  return T.modes.meta(s.duration, s.breads.length, s.seats);
}

function modeRecord(host: MenuHost, s: StageDef): HTMLElement | null {
  const save = host.save;
  if (s.tutorial) return h('p', { class: 'mode-rec' }, save.tutorialDone ? T.modes.cleared : T.modes.recommend);
  const best = save.best[s.id] ?? 0;
  if (best <= 0) return h('p', { class: 'mode-rec none' }, T.modes.noRecord);
  const time = s.endless && save.bestTime[s.id] ? ` ・ ${formatTime(save.bestTime[s.id])}` : '';
  return h('p', { class: 'mode-rec' }, starsText(save.stars[s.id] ?? 0), ` ${yen(best)}${time}`);
}

export function modeSelect(host: MenuHost, on: { pick: (s: StageDef) => void; back: () => void }): HTMLElement {
  const list = h('div', { class: 'modes' });
  for (const s of STAGES) {
    const [spec, expr] = MODE_FACE[s.id] ?? [ESHUR, 'normal'];
    const recommend = s.tutorial && !host.save.tutorialDone;
    list.append(
      h(
        'button',
        {
          class: `mode-card heat-${s.heat}${recommend ? ' recommend' : ''}`,
          type: 'button',
          onclick: () => {
            host.sound.click();
            on.pick(s);
          },
        },
        h('span', { class: `mode-face${spec.crouch ? ' crouch' : ''}` }, chara(host, spec, expr, 26, { body: !!spec.crouch })),
        h(
          'span',
          { class: 'mode-body' },
          h('span', { class: 'mode-head' }, h('span', { class: 'mode-name' }, stageTitle(s)), s.heat > 0 ? chilis(s.heat) : null),
          h('span', { class: 'mode-meta' }, modeMeta(s)),
          modeRecord(host, s),
        ),
      ),
    );
  }
  return panel(
    'modes-panel',
    h('h2', {}, T.modes.heading),
    list,
    h('div', { class: 'row' }, button(T.common.back, on.back, 'btn sub', host)),
  );
}

// ============================================================== ステージ紹介

export function stageIntro(host: MenuHost, s: StageDef, on: { start: () => void; back: () => void }): HTMLElement {
  const n = BALANCE.nell;
  const e = s.endless;
  const breads = h('div', { class: 'intro-breads' });
  for (const b of s.breads) {
    breads.append(h('div', { class: 'intro-bread' }, breadCanvas(b, 46), h('span', {}, breadName(b)), h('span', { class: 'price' }, `${BREADS[b].price}G`)));
  }
  const goals = h('div', { class: 'goals' });
  s.stars.forEach((v, i) => goals.append(h('div', { class: 'goal' }, starsText(i + 1), h('span', {}, yen(v)))));
  const tip = (spec: ChibiSpec, expr: Expr, title: string, text: string) =>
    h('div', { class: 'tip' }, h('div', { class: 'tip-face' }, chara(host, spec, expr, 26)), h('div', {}, h('h3', {}, title), h('p', {}, text)));
  const burumiTip = (title: string, text: string) =>
    h('div', { class: 'tip' }, h('div', { class: 'tip-face' }, burumiCanvas(64)), h('div', {}, h('h3', {}, title), h('p', {}, text)));
  const tips = h(
    'div',
    { class: 'tips' },
    tip(ELFIN, 'munch', T.intro.elfin, T.intro.elfinTip),
    tip(NELL, 'smile', T.intro.nell, T.intro.nellTip(n.revealTime, n.buffDuration, n.buffRate)),
    tip(KOMI, 'sleep', T.intro.komi, T.intro.komiTip),
    tip(BUTTER, 'happy', T.intro.butter, T.intro.butterTip),
    s.feverServes ? tip(SPEAKI, 'happy', T.intro.fever, T.intro.feverTip(s.feverServes, BALANCE.fever.duration)) : null,
    s.burumi ? burumiTip(T.intro.burumi, T.intro.burumiTip(BALANCE.burumi.reward)) : null,
  );
  return panel(
    'intro',
    h('h2', {}, stageTitle(s)),
    h('div', { class: 'comment' }, h('div', { class: 'comment-face' }, chara(host, ESHUR, 'happy', 28, { body: false })), h('p', {}, stageBlurb(s))),
    h('p', { class: 'muted' }, (e ? T.intro.endlessInfo : T.intro.timedInfo)(s.duration, s.ovens, s.seats)),
    breads,
    e
      ? h(
          'ul',
          { class: 'endless-rules' },
          h('li', {}, T.intro.ruleExtend(e.timeBase, e.timePerCombo, e.maxRemaining, e.nellTime)),
          h('li', {}, T.intro.ruleLevel(e.levelTime)),
          h('li', {}, T.intro.ruleFever),
          s.burnTime !== null ? h('li', {}, T.intro.ruleBurn(e.burnLevel, s.burnTime)) : null,
        )
      : null,
    tips,
    h('p', { class: 'muted small' }, T.intro.mochiHint),
    h('h3', { class: 'goals-title' }, T.intro.goals),
    goals,
    h('div', { class: 'row' }, button(T.common.back, on.back, 'btn sub', host), button(T.intro.open, on.start, 'btn primary', host)),
  );
}

// ======================================================= チュートリアルのあと

export function tutorialDonePanel(host: MenuHost, first: StageDef, on: { play: () => void; select: () => void }): HTMLElement {
  return panel(
    'tutorial-done',
    h('h2', {}, T.tutorialDone.heading),
    h(
      'div',
      { class: 'comment' },
      h('div', { class: 'comment-face' }, chara(host, ESHUR, 'happy', 28, { body: false })),
      h('p', {}, T.tutorialDone.text(stageTitle(first))),
    ),
    h('div', { class: 'row' }, button(T.common.modeSelect, on.select, 'btn sub', host), button(T.tutorialDone.play(stageTitle(first)), on.play, 'btn primary', host)),
  );
}

// ==================================================================== 設定

export function settingsPanel(host: MenuHost, on: { close: () => void }): HTMLElement {
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
  return panel(
    'settings',
    h('h2', {}, T.common.settings),
    slider(T.settings.sfx, s.sfxVolume, (v) => {
      s.sfxVolume = v;
      host.sound.sfxVolume = v;
    }),
    slider(T.settings.bgm, s.bgmVolume, (v) => {
      s.bgmVolume = v;
      host.sound.bgmVolume = v;
    }),
    toggle(T.common.mute, s.muted, (v) => {
      s.muted = v;
      host.sound.muted = v;
    }),
    toggle(T.settings.keyHints, s.keyHints, (v) => (s.keyHints = v)),
    h('p', { class: 'muted small' }, T.settings.tutorialNote),
    h('div', { class: 'row' }, button(T.common.close, on.close, 'btn primary', host)),
  );
}

// =============================================================== あそびかた

/** 焦げる時間の説明（例: 「微辛・中辛では焦げません。辛口は10秒、激辛・エンドレス（レベル3から）は8秒で焦げてしまいます。」） */
function burnText(): string {
  const label = (s: StageDef) => (s.endless ? T.howTo.burnFrom(stageTitle(s), s.endless.burnLevel) : stageTitle(s));
  const names = (pick: (s: StageDef) => boolean) => T.howTo.burnNames(PLAY_STAGES.filter(pick).map(label));
  const safe = PLAY_STAGES.some((s) => s.burnTime === null) ? names((s) => s.burnTime === null) : '';
  const times = [...new Set(PLAY_STAGES.map((s) => s.burnTime).filter((t): t is number => t !== null))].sort((a, b) => b - a);
  return T.howTo.burnText(safe, times.map((t) => T.howTo.burnAt(names((s) => s.burnTime === t), t)));
}

export function howToPanel(host: MenuHost, on: { close: () => void }): HTMLElement {
  const n = BALANCE.nell;
  const H = T.howTo;
  const timed = PLAY_STAGES.filter((s) => !s.endless);
  const pct = (v: number) => Math.round(v * 100);
  const pages: { page: { title: string; text: string[] }; art: () => HTMLElement }[] = [
    {
      page: H.flow,
      art: () => h('div', { class: 'art' }, breadCanvas('croissant', 56), h('span', { class: 'arrow' }, '→'), h('span', { class: 'tray-icon' }, H.tray), h('span', { class: 'arrow' }, '→'), chara(host, ESHUR, 'happy', 24)),
    },
    {
      page: H.cheek,
      art: () => h('div', { class: 'art' }, chara(host, villager(7), 'worried', 30), h('span', { class: 'arrow' }, '→'), h('span', { class: 'big-num' }, H.happy)),
    },
    {
      page: H.pay(pct(BALANCE.tip.high), pct(BALANCE.combo.step), pct(BALANCE.combo.step * BALANCE.combo.maxSteps)),
      art: () => h('div', { class: 'art' }, h('span', { class: 'big-num' }, '+20%'), h('span', { class: 'big-num' }, H.combo)),
    },
    {
      page: H.oven(burnText()),
      art: () => h('div', { class: 'art' }, h('span', { class: 'oven-icon' }, H.bake), h('span', { class: 'arrow' }, '→'), h('span', { class: 'oven-icon ready' }, H.baked)),
    },
    { page: H.elfin, art: () => h('div', { class: 'art' }, chara(host, ELFIN, 'munch', 30)) },
    {
      page: H.nell(n.announceLead, n.revealTime, n.buffDuration, n.buffRate, n.peekCost),
      art: () => h('div', { class: 'art' }, chara(host, NELL, 'smile', 30)),
    },
    {
      page: H.fever(BALANCE.fever.duration),
      art: () => h('div', { class: 'art' }, chara(host, SPEAKI, 'happy', 26), h('span', { class: 'big-num' }, '∞')),
    },
    {
      page: H.guests(BALANCE.butter.shotInterval),
      art: () => h('div', { class: 'art' }, chara(host, KOMI, 'sleep', 28), chara(host, BUTTER, 'happy', 28, { flip: true })),
    },
    { page: H.burumi(BALANCE.burumi.reward), art: () => h('div', { class: 'art' }, burumiCanvas(72)) },
    {
      page: H.modes(timed.map(stageTitle), timed.map((s) => s.duration)),
      art: () => h('div', { class: 'art' }, ...PLAY_STAGES.map((s) => h('span', { class: 'mode-chip' }, stageTitle(s)))),
    },
    { page: H.keys, art: () => h('div', { class: 'art keys' }, ...['1', '2', 'A', 'Shift', 'Z', 'Space', 'B'].map((k) => h('kbd', {}, k))) },
  ];
  let page = 0;
  const body = h('div', { class: 'howto-body' });
  const dots = h('div', { class: 'dots' });
  const prev = button(H.prev, () => go(page - 1), 'btn sub small', host);
  const next = button(H.next, () => go(page + 1), 'btn sub small', host);
  const go = (i: number) => {
    page = Math.max(0, Math.min(pages.length - 1, i));
    const p = pages[page];
    body.replaceChildren(h('h3', {}, p.page.title), p.art(), h('ul', {}, ...p.page.text.map((t) => h('li', {}, t))));
    dots.replaceChildren(...pages.map((_, j) => h('span', { class: j === page ? 'dot on' : 'dot' })));
    prev.disabled = page === 0;
    next.disabled = page === pages.length - 1;
  };
  go(0);
  return panel(
    'howto',
    h('h2', {}, T.common.howTo),
    body,
    h('div', { class: 'row pager' }, prev, dots, next),
    h('p', { class: 'disclaimer' }, T.disclaimer),
    h('div', { class: 'row' }, button(T.common.close, on.close, 'btn primary', host)),
  );
}

// =================================================================== ポーズ

export function pausePanel(
  host: MenuHost,
  on: { resume: () => void; retry: () => void; quit: () => void; howTo: () => void; skip?: () => void },
): HTMLElement {
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
    h('h2', {}, T.pause.heading),
    h(
      'div',
      { class: 'col' },
      button(T.pause.resume, on.resume, 'btn primary', host),
      on.skip ? button(T.pause.skipTutorial, on.skip, 'btn sub', host) : null,
      button(T.common.howTo, on.howTo, 'btn sub', host),
      button(T.pause.restart, on.retry, 'btn sub', host),
      button(T.pause.quit, on.quit, 'btn sub', host),
    ),
    h('label', { class: 'setting toggle' }, h('span', {}, T.common.mute), mute),
  );
}

// ================================================================= リザルト

export interface ResultInfo {
  stage: StageDef;
  world: World;
  stars: number;
  prevBest: number;
  prevStars: number;
  /** エンドレス: これまでの最長営業時間 */
  prevTime: number;
}

function eshurComment(r: ResultInfo): { text: string; expr: 'happy' | 'smile' | 'worried' | 'sulk' } {
  const w = r.world;
  const R = T.result;
  if (r.stars >= 3) return { text: R.comment3, expr: 'happy' };
  if (w.ledger.tabCollected > 0 && r.stars >= 1) return { text: R.commentTab, expr: 'smile' };
  if (r.stars === 2) return { text: R.comment2, expr: 'smile' };
  if (r.stars === 1) {
    if (w.tab > 0) return { text: R.comment1Tab, expr: 'worried' };
    return { text: R.comment1, expr: 'smile' };
  }
  if (w.stats.burnt >= 3) return { text: R.commentBurnt, expr: 'sulk' };
  if (w.stats.angry >= 4) return { text: R.commentAngry, expr: 'sulk' };
  return { text: R.comment0, expr: 'sulk' };
}

export function resultPanel(
  host: MenuHost,
  r: ResultInfo,
  on: { retry: () => void; select: () => void },
): HTMLElement {
  const w = r.world;
  const endless = !!w.stage.endless;
  const l = w.ledger;
  const sales = w.sales;
  const newRecord = sales > r.prevBest;
  const total = h('div', { class: 'result-total' }, '0 G');
  const starsEl = h('div', { class: 'result-stars' });
  const starEls = [0, 1, 2].map(() => h('span', { class: 'star' }, '★'));
  starsEl.append(...starEls);

  const R = T.result;
  const line = (label: string, v: number, cls = '') => h('div', { class: `line ${cls}` }, h('span', {}, label), h('span', {}, v ? `${v >= 0 ? '+' : ''}${yen(v)}` : '—'));
  const breakdown = h(
    'div',
    { class: 'breakdown' },
    line(R.base, l.base),
    line(R.tip, l.tip),
    line(R.combo, l.combo),
    line(R.nell(BALANCE.nell.buffRate), l.nell, 'nell'),
    line(R.tab, l.tabCollected, 'nell'),
    w.stage.burumi ? line(R.burumi, l.burumi, 'burumi') : null,
    w.stage.elfin ? h('div', { class: 'line bad' }, h('span', {}, R.unpaid), h('span', {}, w.tab ? yen(w.tab) : R.none)) : null,
  );
  const st = w.stats;
  const stats = h(
    'div',
    { class: 'stats' },
    endless ? h('span', { class: 'wide' }, R.endlessTime(formatTime(w.time), Math.round(st.timeAdded))) : null,
    endless ? h('span', {}, R.level(w.level)) : null,
    h('span', {}, R.served(st.served)),
    h('span', {}, R.bestCombo(st.bestCombo)),
    h('span', {}, R.angry(st.angry)),
    h('span', {}, R.burnt(st.burnt)),
    w.stage.elfin ? h('span', {}, R.repelled(st.repelled)) : null,
    h('span', {}, R.nellServed(st.nellSuccess, st.nellSuccess + st.nellFail)),
    st.fevers > 0 ? h('span', {}, R.fever(st.fevers, st.feverServed)) : null,
    h('span', {}, R.mochi(st.mochi)),
    h('span', {}, R.butter(st.butterShots)),
    w.stage.burumi ? h('span', {}, R.burumiTimes(st.burumi)) : null,
  );
  const c = eshurComment(r);
  const comment = h('div', { class: 'comment' }, h('div', { class: 'comment-face' }, chara(host, ESHUR, c.expr, 28, { body: false })), h('p', {}, c.text));
  const badge = h('div', { class: 'badge hidden' }, endless && w.time > r.prevTime && !(sales > r.prevBest) ? R.longest : R.best);
  const newTime = endless && r.prevTime > 0 && w.time > r.prevTime;

  const buttons = h('div', { class: 'row' }, button(T.common.modeSelect, on.select, 'btn sub', host), button(T.common.retry, on.retry, 'btn primary', host));

  const el = panel(
    'result',
    h(
      'div',
      { class: 'result-main' },
      h('p', { class: 'stage-label' }, stageTitle(r.stage)),
      h('h2', {}, R.heading),
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
      if ((newRecord && sales > 0) || newTime) badge.classList.remove('hidden');
      if (r.stars >= 3) host.sound.fanfare();
    }
  };
  requestAnimationFrame(tick);
  return el;
}
