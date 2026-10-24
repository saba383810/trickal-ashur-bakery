import { Bgm } from './audio/bgm';
import { Sound } from './audio/sound';
import { PLAY_STAGES, type StageDef } from './config/stages';
import { World, starsFor } from './sim/world';
import { loadSave, writeSave, type SaveData } from './storage';
import { h } from './ui/dom';
import { howToPanel, modeSelect, pausePanel, resultPanel, settingsPanel, stageIntro, titleScreen, tutorialDonePanel, type MenuHost } from './ui/menus';
import { Tutorial } from './ui/tutorial';
import { drawSlot } from './view/draw/props';
import { SceneCache } from './view/draw/scene';
import { outlined } from './view/draw/ui';
import { GameView } from './view/gameView';
import { inside, makeLayout } from './view/layout';
import { C, font } from './view/palette';
import { Screen, pageZoom } from './view/screen';

type Mode = 'menu' | 'tutorial' | 'countdown' | 'playing' | 'paused' | 'closing' | 'result';

/** シミュレーションの固定刻み */
const STEP = 1 / 60;
const COUNTDOWN = 3;
/** 閉店からリザルトを出すまで */
const CLOSING = 2.4;

export class App implements MenuHost {
  readonly save: SaveData = loadSave();
  readonly sound = new Sound();
  private bgm = new Bgm(this.sound);
  private screen: Screen;
  private ui: HTMLElement;
  private mode: Mode = 'menu';
  private pausedFrom: Mode = 'playing';
  private stage: StageDef = PLAY_STAGES[0];
  private world: World | null = null;
  private view: GameView | null = null;
  private tutorial: Tutorial | null = null;
  private backdrop = new SceneCache();
  private acc = 0;
  private last = 0;
  private timer = 0;
  private drawnVersion = -1;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.screen = new Screen(canvas);
    this.ui = ui;
    this.sound.sfxVolume = this.save.sfxVolume;
    this.sound.bgmVolume = this.save.bgmVolume;
    this.sound.muted = this.save.muted;
    this.bindInput(canvas);
    this.watchFonts();
    this.goTitle();
    requestAnimationFrame((t) => {
      this.last = t;
      requestAnimationFrame(this.frame);
    });
  }

  /** 背景キャッシュに焼いた文字が代替フォントのままにならないよう、読み込み後に描き直す */
  private watchFonts(): void {
    const fonts = document.fonts;
    if (!fonts) return;
    const refresh = () => {
      this.backdrop.invalidate();
      this.view?.invalidateScene();
      this.drawnVersion = -1;
    };
    fonts.addEventListener('loadingdone', refresh);
    const sample = 'エシュールのベーカリーロールパンクロワッサンメロンあんカレーチョココロネ食パン0123456789G';
    void Promise.all([fonts.load(font(20, 800), sample), fonts.load(font(20, 700), sample)])
      .then(refresh)
      .catch(() => {});
  }

  persist(): void {
    writeSave(this.save);
  }

  // ================================================================= 画面遷移

  private show(el: HTMLElement): void {
    const layer = h('div', { class: 'layer' }, el);
    this.ui.replaceChildren(layer);
    el.querySelector<HTMLButtonElement>('.btn.primary')?.focus({ preventScroll: true });
  }

  private clearUi(): void {
    this.ui.replaceChildren();
  }

  private toMenu(): void {
    if (this.mode !== 'menu') this.drawnVersion = -1;
    this.mode = 'menu';
    this.world = null;
    this.view = null;
    this.tutorial = null;
    this.bgm.mode = 'title';
    this.startBgm();
  }

  goTitle(): void {
    this.toMenu();
    this.show(
      titleScreen(this, {
        start: () => this.goSelect(),
        howTo: () => this.showHowTo(() => this.goTitle()),
        settings: () => this.showSettings(() => this.goTitle()),
      }),
    );
  }

  private goSelect(): void {
    this.toMenu();
    this.show(
      modeSelect(this, {
        pick: (s) => (s.tutorial ? this.startStage(s) : this.showIntro(s)),
        back: () => this.goTitle(),
      }),
    );
  }

  private showIntro(s: StageDef): void {
    this.toMenu();
    this.stage = s;
    this.drawnVersion = -1;
    this.show(stageIntro(this, s, { start: () => this.startStage(s), back: () => this.goSelect() }));
  }

  private showSettings(back: () => void): void {
    this.show(settingsPanel(this, { close: back }));
  }

  private showHowTo(back: () => void): void {
    this.show(howToPanel(this, { close: back }));
  }

  private startStage(s: StageDef): void {
    this.clearUi();
    this.stage = s;
    this.newGame(s);
    this.bgm.mode = 'title';
    this.startBgm();
    if (s.tutorial) {
      this.mode = 'tutorial';
      this.tutorial = new Tutorial(this.world!, this.view!, () => this.endTutorial(true));
    } else {
      this.beginCountdown();
    }
  }

  /** チュートリアルを最後まで終えた / スキップした */
  private endTutorial(completed: boolean): void {
    this.tutorial?.dispose();
    this.tutorial = null;
    this.save.tutorialDone = true;
    this.persist();
    if (!completed) {
      this.goSelect();
      return;
    }
    this.mode = 'result';
    this.view!.inputEnabled = false;
    const first = PLAY_STAGES[0];
    this.show(tutorialDonePanel(this, first, { play: () => this.showIntro(first), select: () => this.goSelect() }));
  }

  private newGame(s: StageDef): void {
    const world = new World(s, (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
    const view = new GameView(world, this.screen, this.sound, this.bgm);
    view.keyHints = this.save.keyHints;
    view.onPause = () => this.pause();
    this.world = world;
    this.view = view;
    this.acc = 0;
  }

  private beginCountdown(): void {
    this.mode = 'countdown';
    this.timer = COUNTDOWN;
    this.view!.inputEnabled = false;
    this.sound.countdown(false);
  }

  private pause(): void {
    if (this.mode !== 'playing' && this.mode !== 'countdown' && this.mode !== 'tutorial') return;
    this.pausedFrom = this.mode;
    this.mode = 'paused';
    this.view?.cancelGrab();
    this.bgm.stop();
    this.showPause();
  }

  private showPause(): void {
    this.show(
      pausePanel(this, {
        resume: () => this.resume(),
        retry: () => this.startStage(this.stage),
        quit: () => this.goSelect(),
        howTo: () => this.showHowTo(() => this.showPause()),
        skip: this.tutorial ? () => this.endTutorial(false) : undefined,
      }),
    );
  }

  private resume(): void {
    if (this.mode !== 'paused') return;
    this.clearUi();
    this.mode = this.pausedFrom;
    this.startBgm();
  }

  private showResult(): void {
    const w = this.world!;
    const s = this.stage;
    const stars = starsFor(s, w.sales);
    const prevBest = this.save.best[s.id] ?? 0;
    const prevStars = this.save.stars[s.id] ?? 0;
    const prevTime = this.save.bestTime[s.id] ?? 0;
    this.save.best[s.id] = Math.max(prevBest, w.sales);
    this.save.stars[s.id] = Math.max(prevStars, stars);
    if (s.endless) this.save.bestTime[s.id] = Math.max(prevTime, Math.floor(w.time));
    this.persist();
    this.mode = 'result';
    this.bgm.mode = 'title';
    this.show(
      resultPanel(
        this,
        { stage: s, world: w, stars, prevBest, prevStars, prevTime },
        {
          retry: () => this.startStage(s),
          select: () => this.goSelect(),
        },
      ),
    );
  }

  // ===================================================================== 入力

  private unlockAudio(): void {
    this.sound.unlock();
    if (!this.bgm.playing && this.mode !== 'paused') this.startBgm();
  }

  private startBgm(): void {
    if (this.sound.ctx) this.bgm.play(this.bgm.mode);
  }

  private get inGame(): boolean {
    return this.mode === 'playing' || this.mode === 'tutorial' || this.mode === 'countdown';
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    // 音の解禁はユーザー操作の中で行う。タッチは pointerdown では解禁されない端末があるので離した時にも試す
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      document.addEventListener(type, () => this.unlockAudio(), { capture: true });
    }

    canvas.addEventListener('pointerdown', (e) => {
      const view = this.view;
      if (!view || !this.inGame) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      if (e.pointerType !== 'mouse') view.keyMode = false;
      const p = this.screen.toLogical(e.clientX, e.clientY);
      if (this.tutorial && inside(this.tutorial.skipRect(), p, 6)) {
        this.sound.click();
        this.endTutorial(false);
        return;
      }
      // 顔はどこでも（説明を読んでいる間も）ほっぺを引っぱれる。動かさずに離したら、説明のタップになる
      const tap = () => void this.tutorial?.tap();
      if (view.grabFace(e.pointerId, p, tap)) return;
      if (this.tutorial?.talking && !inside(view.L.pauseBtn, p, 8)) {
        if (!view.pressFace(e.pointerId, p, tap)) this.tutorial.tap();
        return;
      }
      view.pointerDown(e.pointerId, p);
    });
    canvas.addEventListener('pointermove', (e) => {
      this.view?.pointerMove(e.pointerId, this.screen.toLogical(e.clientX, e.clientY));
    });
    const up = (e: PointerEvent) => this.view?.pointerUp(e.pointerId, e.pointerType !== 'mouse');
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('pointercancel', (e) => this.view?.pointerCancel(e.pointerId));
    canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.view?.clearHover();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key;
      if (e.repeat && key !== 'Backspace') {
        if (this.inGame || this.mode === 'paused') e.preventDefault();
        return;
      }
      if (this.mode === 'paused') {
        if (key === 'Escape' || key === 'p' || key === 'P') {
          e.preventDefault();
          this.resume();
        }
        return;
      }
      const view = this.view;
      if (!view || !this.inGame) return;
      if (this.tutorial && (key === 'Enter' || key === ' ') && this.tutorial.tap()) {
        e.preventDefault();
        return;
      }
      if (view.keyDown(e)) {
        e.preventDefault();
        return;
      }
      if (key === 'Escape' || key === 'p' || key === 'P') {
        e.preventDefault();
        this.pause();
      }
    });
    window.addEventListener('keyup', (e) => this.view?.keyUp(e));

    const onResize = () => {
      this.screen.resize();
      this.view?.relayout();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // ピンチでページを拡大・縮小した時は resize が来ないので、拡大率が変わったら描き直す
    // （sabanogames ではフレームの中にいるので、外側のページを見る）
    let zoom = pageZoom();
    let zoomTimer = 0;
    const onZoom = () => {
      clearTimeout(zoomTimer);
      zoomTimer = window.setTimeout(() => {
        if (pageZoom() === zoom) return;
        zoom = pageZoom();
        onResize();
      }, 200);
    };
    window.visualViewport?.addEventListener('resize', onZoom);
    try {
      if (window.top && window.top !== window) window.top.visualViewport?.addEventListener('resize', onZoom);
    } catch {
      // 別オリジンのフレームの中では外側を読めない
    }
    // iOS は user-scalable=no を無視して 2 本指で拡大してしまうので止める（ほっぺは pointer で引っぱるので影響しない）
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    // タブを離れたら自動でポーズ
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        this.sound.sleep();
      } else {
        this.sound.wake();
      }
    });
    window.addEventListener('blur', () => this.pause());
  }

  // =================================================================== ループ

  private frame = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.tick(dt);
    requestAnimationFrame(this.frame);
  };

  private tick(dt: number): void {
    const view = this.view;
    const world = this.world;
    switch (this.mode) {
      case 'menu':
        // メニューの背景は動かないので、画面サイズが変わった時だけ描く
        if (this.screen.version !== this.drawnVersion) {
          this.drawnVersion = this.screen.version;
          this.drawBackdrop();
        }
        return;
      case 'tutorial':
        this.stepWorld(dt);
        this.tutorial?.update(dt);
        break;
      case 'countdown': {
        const before = Math.ceil(this.timer);
        this.timer -= dt;
        const after = Math.ceil(this.timer);
        if (this.timer <= 0) {
          this.mode = 'playing';
          view!.inputEnabled = true;
          view!.banner('開店！', undefined, C.eshur, 1.1, undefined, true);
          this.sound.countdown(true);
          this.bgm.mode = 'normal';
          this.startBgm();
        } else if (after !== before) this.sound.countdown(false);
        break;
      }
      case 'playing':
        this.stepWorld(dt);
        if (world!.phase === 'ended') {
          this.mode = 'closing';
          this.timer = CLOSING;
        }
        break;
      case 'closing':
        this.timer -= dt;
        if (this.timer <= 0) this.showResult();
        break;
      case 'paused':
      case 'result':
        // 止まっている間は画面サイズが変わった時だけ描き直す
        if (view && this.screen.version !== this.drawnVersion) {
          this.drawnVersion = this.screen.version;
          view.render();
        }
        return;
    }
    if (!view) return;
    view.update(dt);
    view.render();
    this.drawnVersion = this.screen.version;
    if (this.mode === 'countdown') this.drawCountdown();
  }

  private stepWorld(dt: number): void {
    const world = this.world!;
    this.acc += dt;
    while (this.acc >= STEP) {
      world.step(STEP);
      this.acc -= STEP;
    }
  }

  private drawCountdown(): void {
    const scr = this.screen;
    const c = scr.ctx;
    scr.begin();
    const n = Math.ceil(this.timer);
    const p = 1 - (this.timer - (n - 1));
    const s = 1.4 - Math.min(1, p * 4) * 0.4;
    c.save();
    c.globalAlpha = Math.min(1, (1 - p) * 4);
    c.translate(scr.w / 2, scr.h * 0.42);
    c.scale(s, s);
    outlined(c, String(n), 0, 0, 150, '#ffffff', C.eshur);
    c.restore();
  }

  private drawBackdrop(): void {
    const scr = this.screen;
    const c = scr.ctx;
    const L = makeLayout(scr.w, scr.h, scr.portrait, this.stage);
    const pr = scr.pixelRatio;
    this.backdrop.ensure(L, this.stage, pr);
    scr.clear('#5c3317');
    scr.begin();
    c.save();
    c.filter = 'blur(4px)';
    c.drawImage(this.backdrop.back!, 0, 0, L.w, L.h);
    c.drawImage(this.backdrop.front!, 0, 0, L.w, L.h);
    this.stage.breads.forEach((b, i) => drawSlot(c, L.slots[i], b, 3, pr, { hover: false, flash: 0, pop: 0 }));
    c.restore();
    c.fillStyle = 'rgba(60, 30, 10, 0.42)';
    c.fillRect(0, 0, L.w, L.h);
  }
}
