import type { Sound } from './sound';

// WebAudio の簡易シーケンサで鳴らすオリジナル BGM（ヘ長調・8 小節ループ）。
// 1 小節 = 16 ステップ。メロディは 8 分音符単位で書く（'.' 休符 / '-' のばす）。
const MELODY = [
  'C5 A4 C5 F5 E5 D5 C5 .',
  'D5 F5 A5 G5 F5 E5 D5 .',
  'D5 C5 A#4 D5 F5 - E5 D5',
  'C5 - G4 - C5 D5 E5 .',
  'C5 A4 C5 F5 A5 G5 F5 .',
  'A5 G5 F5 D5 F5 - E5 D5',
  'D5 - A#4 D5 E5 - G5 .',
  'F5 - C5 A4 F4 - - .',
].map((bar) => bar.split(' '));

/** 各小節のコード（前半, 後半） */
const CHORDS: [string[], string[]][] = [
  [['F3', 'A3', 'C4'], ['F3', 'A3', 'C4']],
  [['D3', 'F3', 'A3'], ['D3', 'F3', 'A3']],
  [['A#2', 'D3', 'F3'], ['A#2', 'D3', 'F3']],
  [['C3', 'E3', 'G3'], ['C3', 'E3', 'G3']],
  [['F3', 'A3', 'C4'], ['F3', 'A3', 'C4']],
  [['D3', 'F3', 'A3'], ['D3', 'F3', 'A3']],
  [['G2', 'A#2', 'D3'], ['C3', 'E3', 'G3']],
  [['F3', 'A3', 'C4'], ['F3', 'A3', 'C4']],
];

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function freq(name: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(name)!;
  const midi = 12 * (Number(m[2]) + 1) + NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export type BgmMode = 'title' | 'normal' | 'fever' | 'hurry';

export class Bgm {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  /** nextTime を数えている AudioContext */
  private clock: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  mode: BgmMode = 'title';

  constructor(private sound: Sound) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  play(mode: BgmMode): void {
    this.mode = mode;
    const ctx = this.sound.ctx;
    if (!ctx || this.timer !== null) return;
    this.step = 0;
    this.clock = ctx;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private get bpm(): number {
    switch (this.mode) {
      case 'title':
        return 100;
      case 'fever':
        return 132;
      case 'hurry':
        return 140;
      default:
        return 118;
    }
  }

  private schedule(): void {
    const ctx = this.sound.ctx;
    if (!ctx) return;
    // 固まった AudioContext が作り直されたら、新しい時計から刻み直す
    if (ctx !== this.clock) {
      this.clock = ctx;
      this.nextTime = ctx.currentTime + 0.1;
    }
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm / 4;
      this.step = (this.step + 1) % (16 * MELODY.length);
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const sixteenth = 60 / this.bpm / 4;
    const chord = CHORDS[bar][s < 8 ? 0 : 1];
    const title = this.mode === 'title';

    // メロディ（8 分音符）
    if (s % 2 === 0) {
      const cells = MELODY[bar];
      const note = cells[s / 2];
      if (note !== '.' && note !== '-') {
        let len = 1;
        while (cells[s / 2 + len] === '-') len++;
        this.voice(freq(note), t, sixteenth * 2 * len * 0.92, 'triangle', title ? 0.16 : 0.2, true);
        if (this.mode === 'fever') this.voice(freq(note) * 2, t, sixteenth * 1.5, 'sine', 0.05);
      }
    }

    // ベース
    if (s === 0 || s === 8) this.voice(freq(chord[0]) / 2, t, sixteenth * 3.5, 'sine', 0.32);
    if (!title && (s === 6 || s === 14)) this.voice((freq(chord[2]) / 2) * 0.75, t, sixteenth * 1.5, 'sine', 0.2);

    // 裏拍のコード
    if (s % 4 === 2) {
      for (const n of chord) this.voice(freq(n), t, sixteenth * 1.2, title ? 'sine' : 'square', title ? 0.04 : 0.025);
    }

    // フィーバー中のきらきらアルペジオ
    if (this.mode === 'fever' && s % 2 === 1) {
      const n = chord[(s >> 1) % 3];
      this.voice(freq(n) * 4, t, sixteenth * 0.8, 'sine', 0.035);
    }

    if (title) return;
    // ドラム
    if (s % 4 === 0) this.kick(t);
    if (s === 4 || s === 12) this.snare(t);
    if (s % 2 === 0 || this.mode !== 'normal') this.hat(t, s % 4 === 2 ? 0.05 : 0.025);
  }

  private voice(f: number, t: number, dur: number, type: OscillatorType, vol: number, vibrato = false): void {
    const ctx = this.sound.ctx;
    const out = this.sound.bgmGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    if (vibrato && dur > 0.25) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * 0.008, t + dur);
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(t: number): void {
    const ctx = this.sound.ctx;
    const out = this.sound.bgmGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private snare(t: number): void {
    this.noiseHit(t, 0.12, 1800, 0.12);
  }

  private hat(t: number, vol: number): void {
    this.noiseHit(t, 0.04, 8000, vol);
  }

  private noiseHit(t: number, dur: number, f: number, vol: number): void {
    const ctx = this.sound.ctx;
    const out = this.sound.bgmGain;
    if (!ctx || !out) return;
    if (!this.noise) {
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.02);
  }
}
