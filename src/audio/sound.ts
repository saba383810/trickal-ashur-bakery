// 効果音はすべて WebAudio で合成する（公式の音声・効果音は使わない）。

/** 操作しても AudioContext が動かないまま、これだけ経ったら作り直す（ms） */
const STUCK_MS = 1500;

export class Sound {
  ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  bgmGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private stretchOsc: OscillatorNode | null = null;
  private stretchGain: GainNode | null = null;
  sfxVolume = 0.8;
  bgmVolume = 0.5;
  muted = false;
  /** 操作しても AudioContext が動かないままになった時刻（0 = 動いている） */
  private stuckSince = 0;

  /**
   * ユーザー操作の中で呼ぶ（自動再生制限・iOS 対策）。
   * 別のアプリから戻ると、iOS では 'interrupted'、Android では 'suspended' のまま止まっていることがあるので、
   * 動いていなければ操作のたびに起こし直す。それでも STUCK_MS 戻らなければ捨てて作り直す
   */
  unlock(): AudioContext | null {
    if (this.ctx && this.ctx.state !== 'running') {
      const now = performance.now();
      if (this.ctx.state === 'closed' || (this.stuckSince && now - this.stuckSince > STUCK_MS)) this.reset();
      else if (!this.stuckSince) this.stuckSince = now;
    }
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
      const master = this.ctx.createGain();
      master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain.connect(master);
      this.bgmGain.connect(master);
      this.applyVolume();
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.silence();
    }
    if (this.ctx.state === 'running') {
      this.stuckSince = 0;
    } else {
      this.silence();
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  /** 画面を離れる時に止める */
  sleep(): void {
    this.stuckSince = 0;
    void this.ctx?.suspend().catch(() => undefined);
  }

  /** 画面に戻った時に起こす（iOS では操作の中でないと戻らないことがあり、その時は次の unlock で起こし直す） */
  wake(): void {
    void this.ctx?.resume().catch(() => undefined);
  }

  /** iOS: 操作の中で無音を鳴らして解禁する */
  private silence(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  }

  /** 固まった AudioContext を捨てる（呼んだ unlock の中で作り直す。BGM は新しい時計から刻み直す） */
  private reset(): void {
    const old = this.ctx;
    this.ctx = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.noiseBuf = null;
    this.stretchOsc = null;
    this.stretchGain = null;
    this.stuckSince = 0;
    void old?.close().catch(() => undefined);
  }

  applyVolume(): void {
    if (!this.sfxGain || !this.bgmGain) return;
    this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
    this.bgmGain.gain.value = this.muted ? 0 : this.bgmVolume * 0.55;
  }

  // ---------------------------------------------------------------- 部品

  private tone(
    freq: number,
    dur: number,
    opts: { type?: OscillatorType; to?: number; vol?: number; at?: number; attack?: number } = {},
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.muted) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = ctx.createGain();
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, opts: { freq?: number; to?: number; q?: number; vol?: number; at?: number; type?: BiquadFilterType } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || !this.noiseBuf || this.muted) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private bell(freq: number, at = 0, vol = 0.22, dur = 0.6): void {
    this.tone(freq, dur, { at, vol, type: 'sine' });
    this.tone(freq * 2.01, dur * 0.5, { at, vol: vol * 0.35, type: 'sine' });
  }

  // ---------------------------------------------------------------- 効果音

  click(): void {
    this.tone(900, 0.05, { type: 'triangle', vol: 0.15 });
  }

  pick(): void {
    this.tone(620, 0.09, { to: 900, type: 'sine', vol: 0.28 });
  }

  putBack(): void {
    this.tone(700, 0.08, { to: 420, type: 'sine', vol: 0.22 });
  }

  fail(): void {
    this.tone(190, 0.12, { type: 'square', vol: 0.08 });
  }

  arrive(): void {
    this.bell(1318, 0, 0.12, 0.4);
    this.bell(1046, 0.09, 0.12, 0.5);
  }

  partial(): void {
    this.tone(880, 0.1, { type: 'triangle', vol: 0.2 });
  }

  serve(combo: number): void {
    const up = Math.min(combo, 10) * 0.03;
    this.tone(1318 * (1 + up), 0.12, { type: 'triangle', vol: 0.22 });
    this.tone(1760 * (1 + up), 0.35, { type: 'triangle', vol: 0.2, at: 0.07 });
    this.noise(0.25, { freq: 7000, q: 2, vol: 0.06, at: 0.07, type: 'highpass' });
  }

  wrong(): void {
    this.tone(220, 0.12, { type: 'square', vol: 0.1 });
    this.tone(196, 0.18, { type: 'square', vol: 0.1, at: 0.13 });
  }

  angry(): void {
    this.tone(420, 0.25, { to: 180, type: 'sawtooth', vol: 0.08 });
  }

  bake(): void {
    this.noise(0.3, { freq: 300, to: 900, q: 0.8, vol: 0.3, type: 'lowpass' });
  }

  ovenReady(): void {
    this.bell(2093, 0, 0.18, 0.9);
    this.bell(3136, 0.01, 0.06, 0.6);
  }

  takeOut(): void {
    this.noise(0.15, { freq: 2000, to: 600, q: 1, vol: 0.12 });
    this.tone(523, 0.08, { type: 'triangle', vol: 0.18, at: 0.05 });
    this.tone(784, 0.12, { type: 'triangle', vol: 0.18, at: 0.11 });
  }

  burnt(): void {
    this.noise(0.8, { freq: 1600, to: 200, q: 0.7, vol: 0.25 });
    this.tone(300, 0.4, { to: 120, type: 'triangle', vol: 0.12 });
  }

  elfinEnter(): void {
    [784, 659, 784, 523].forEach((f, i) => this.tone(f, 0.08, { type: 'triangle', vol: 0.14, at: i * 0.11 }));
  }

  munch(): void {
    this.tone(210, 0.07, { to: 280, type: 'triangle', vol: 0.22 });
    this.tone(230, 0.07, { to: 300, type: 'triangle', vol: 0.2, at: 0.12 });
  }

  /** ほっぺをつまんだ「むに」（もちほっぺメーカーと同じ音） */
  mochiGrab(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(185, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.3, t + 0.008);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(og).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);
    this.noise(0.07, { type: 'lowpass', freq: 500, vol: 0.1 });
  }

  /** 離した「ぷるん」。揺れと同じ周波数のトレモロで音もぷるぷるさせる */
  mochiRelease(intensity: number, freqHz: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.muted || intensity < 0.05) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(165, t + 0.3);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.12 + 0.3 * intensity, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    const trem = ctx.createGain();
    trem.gain.setValueAtTime(1, t);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = freqHz;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(trem.gain);
    osc.connect(env).connect(trem).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);
    lfo.start(t);
    lfo.stop(t + 0.45);
  }

  /** 引っぱっている間の「むにー」。power は 0..1.5 */
  stretch(power: number | null): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    if (power === null || this.muted) {
      if (this.stretchOsc && this.stretchGain) {
        this.stretchGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
        this.stretchOsc.stop(ctx.currentTime + 0.1);
        this.stretchOsc = null;
        this.stretchGain = null;
      }
      return;
    }
    if (!this.stretchOsc) {
      this.stretchOsc = ctx.createOscillator();
      this.stretchOsc.type = 'triangle';
      this.stretchGain = ctx.createGain();
      this.stretchGain.gain.value = 0.0001;
      this.stretchOsc.connect(this.stretchGain).connect(this.sfxGain);
      this.stretchOsc.start();
    }
    const f = 160 + Math.min(power, 1.4) * 260;
    this.stretchOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.03);
    this.stretchGain!.gain.setTargetAtTime(0.05 + Math.min(power, 1) * 0.07, ctx.currentTime, 0.03);
  }

  grab(): void {
    this.tone(260, 0.08, { to: 200, type: 'sine', vol: 0.3 });
  }

  stun(): void {
    this.tone(330, 0.15, { to: 260, type: 'sine', vol: 0.28 });
  }

  launch(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.45);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lg = ctx.createGain();
    lg.gain.value = 40;
    lfo.connect(lg).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.52);
    lfo.stop(t + 0.52);
    this.noise(0.08, { freq: 3000, vol: 0.15 });
  }

  nellAnnounce(): void {
    [1046, 1318, 1568, 2093].forEach((f, i) => this.bell(f, i * 0.12, 0.13, 0.7));
  }

  nellPeek(): void {
    [1568, 1318].forEach((f, i) => this.bell(f, i * 0.08, 0.1, 0.4));
  }

  nellWrong(): void {
    this.tone(330, 0.3, { type: 'sine', vol: 0.15 });
    this.tone(311, 0.4, { type: 'sine', vol: 0.15, at: 0.05 });
  }

  nellSuccess(): void {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.18, at: i * 0.07 }));
    this.noise(0.8, { freq: 8000, q: 3, vol: 0.06, at: 0.3, type: 'highpass' });
  }

  fail2(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.15, at: i * 0.13 }));
  }

  /** エンドレスのレベルアップ: 上がっていく 3 音 */
  levelUp(): void {
    [659, 880, 1175].forEach((f, i) => this.tone(f, 0.16, { type: 'square', vol: 0.08, at: i * 0.09 }));
  }

  /** フィーバータイム: 虹のように駆け上がって、鈴がきらめく */
  feverStart(): void {
    [523, 659, 784, 988, 1175, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.13, at: i * 0.045 }));
    [1568, 2093, 2637].forEach((f, i) => this.bell(f, 0.4 + i * 0.08, 0.12, 0.6));
    this.noise(0.9, { freq: 9000, q: 2, vol: 0.05, at: 0.2, type: 'highpass' });
  }

  feverEnd(): void {
    [1319, 1047, 784].forEach((f, i) => this.bell(f, i * 0.1, 0.1, 0.5));
  }

  buffEnd(): void {
    this.tone(784, 0.15, { type: 'triangle', vol: 0.14 });
    this.tone(523, 0.25, { type: 'triangle', vol: 0.14, at: 0.14 });
  }

  countdown(go: boolean): void {
    if (go) {
      this.tone(1046, 0.4, { type: 'square', vol: 0.12 });
      this.tone(1568, 0.4, { type: 'triangle', vol: 0.15 });
    } else {
      this.tone(784, 0.12, { type: 'square', vol: 0.1 });
    }
  }

  tick(): void {
    this.tone(1200, 0.03, { type: 'square', vol: 0.05 });
  }

  timeUp(): void {
    for (let i = 0; i < 6; i++) this.tone(i % 2 ? 1760 : 1568, 0.07, { type: 'sine', vol: 0.18, at: i * 0.07 });
    this.tone(1568, 0.5, { type: 'sine', vol: 0.18, at: 0.42 });
  }

  star(i: number): void {
    this.bell([1046, 1318, 1568][i] ?? 2093, 0, 0.2, 0.8);
  }

  fanfare(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.16, at: i * 0.1 }));
    this.tone(1046, 0.8, { type: 'triangle', vol: 0.16, at: 0.45 });
    this.tone(1318, 0.8, { type: 'triangle', vol: 0.12, at: 0.45 });
  }
}
