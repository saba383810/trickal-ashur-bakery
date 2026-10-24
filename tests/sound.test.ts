import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sound } from '../src/audio/sound';

// unlock が使う分だけの偽の AudioContext（state は iOS の 'interrupted' も入れられるよう string）
class FakeNode {
  gain = { value: 1 };
  buffer: unknown = null;
  connect(): void {}
  start(): void {}
}

class FakeContext {
  static made: FakeContext[] = [];
  state = 'running';
  sampleRate = 8000;
  currentTime = 0;
  destination = {};
  resumes = 0;
  constructor() {
    FakeContext.made.push(this);
  }
  createGain(): FakeNode {
    return new FakeNode();
  }
  createBufferSource(): FakeNode {
    return new FakeNode();
  }
  createBuffer(_ch: number, len: number): { getChannelData: () => Float32Array } {
    return { getChannelData: () => new Float32Array(len) };
  }
  resume(): Promise<void> {
    this.resumes++;
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

let now = 0;

beforeEach(() => {
  FakeContext.made = [];
  now = 1000;
  vi.stubGlobal('AudioContext', FakeContext);
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const fake = (s: Sound) => s.ctx as unknown as FakeContext;

describe('音の解禁（別のアプリから戻った時）', () => {
  it('iOS の interrupted のままでも、操作のたびに起こし直す', () => {
    const s = new Sound();
    s.unlock();
    const ctx = fake(s);
    ctx.state = 'interrupted';
    s.unlock();
    now += 300;
    s.unlock();
    expect(ctx.resumes).toBe(2);
    expect(fake(s)).toBe(ctx);
  });

  it('操作しても 1.5 秒以上戻らなければ、その操作の中で作り直す', () => {
    const s = new Sound();
    s.unlock();
    const old = fake(s);
    old.state = 'interrupted';
    s.unlock();
    now += 1400;
    s.unlock();
    expect(fake(s)).toBe(old);
    now += 200;
    s.unlock();
    expect(old.state).toBe('closed');
    expect(FakeContext.made).toHaveLength(2);
    expect(fake(s)).toBe(FakeContext.made[1]);
  });

  it('画面を離れていた時間は、固まった時間に数えない', () => {
    const s = new Sound();
    s.unlock();
    const ctx = fake(s);
    ctx.state = 'interrupted';
    s.unlock();
    s.sleep();
    now += 60_000;
    s.wake();
    s.unlock();
    expect(fake(s)).toBe(ctx);
    expect(FakeContext.made).toHaveLength(1);
  });

  it('閉じられていたら作り直す', () => {
    const s = new Sound();
    s.unlock();
    fake(s).state = 'closed';
    s.unlock();
    expect(FakeContext.made).toHaveLength(2);
  });
});
