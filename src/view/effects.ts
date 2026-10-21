import type { Point } from './layout';
import { C } from './palette';
import { coin, outlined } from './draw/ui';

type Kind = 'dot' | 'star' | 'crumb' | 'steam' | 'smoke' | 'heart';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

interface Floater {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  size: number;
  color: string;
  stroke: string;
}

interface CoinFly {
  from: Point;
  to: Point;
  t: number;
  dur: number;
  delay: number;
  done?: () => void;
}

export class Effects {
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private coins: CoinFly[] = [];
  shake = 0;
  reduced = false;

  update(dt: number): void {
    for (const p of this.particles) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const f of this.floaters) f.life += dt;
    this.floaters = this.floaters.filter((f) => f.life < f.max);
    for (const c of this.coins) {
      if (c.delay > 0) {
        c.delay -= dt;
        continue;
      }
      c.t += dt;
      if (c.t >= c.dur && c.done) {
        c.done();
        c.done = undefined;
      }
    }
    this.coins = this.coins.filter((c) => c.t < c.dur);
    this.shake = Math.max(0, this.shake - dt * 3);
  }

  burst(x: number, y: number, kind: Kind, count: number, color: string = C.gold, speed = 220): void {
    const n = this.reduced ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      const up = kind === 'steam' || kind === 'smoke';
      this.particles.push({
        kind,
        x: x + (up ? (Math.random() - 0.5) * 40 : 0),
        y,
        vx: up ? (Math.random() - 0.5) * 30 : Math.cos(a) * v,
        vy: up ? -40 - Math.random() * 50 : Math.sin(a) * v - speed * 0.4,
        g: up ? -10 : kind === 'heart' ? -60 : 600,
        life: 0,
        max: up ? 1.2 + Math.random() * 0.6 : 0.6 + Math.random() * 0.4,
        size: kind === 'crumb' ? 3 + Math.random() * 4 : kind === 'smoke' ? 14 + Math.random() * 10 : 6 + Math.random() * 6,
        color,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 10,
      });
    }
  }

  float(text: string, x: number, y: number, color: string = C.gold, size = 30, stroke: string = C.woodDeep): void {
    this.floaters.push({ text, x, y, life: 0, max: 1.1, size, color, stroke });
  }

  coinFly(from: Point, to: Point, count: number, done?: () => void): void {
    const n = Math.min(this.reduced ? 2 : 6, count);
    for (let i = 0; i < n; i++) {
      this.coins.push({
        from: { x: from.x + (Math.random() - 0.5) * 40, y: from.y + (Math.random() - 0.5) * 20 },
        to,
        t: 0,
        dur: 0.55,
        delay: i * 0.06,
        done: i === n - 1 ? done : undefined,
      });
    }
  }

  addShake(amount: number): void {
    if (!this.reduced) this.shake = Math.max(this.shake, amount);
  }

  draw(c: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const k = 1 - p.life / p.max;
      c.save();
      c.globalAlpha = Math.min(1, k * 1.5);
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      switch (p.kind) {
        case 'star':
          c.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            const r = i % 2 === 0 ? p.size : p.size * 0.4;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          c.closePath();
          c.fill();
          break;
        case 'heart':
          c.beginPath();
          c.moveTo(0, p.size * 0.6);
          c.bezierCurveTo(-p.size * 1.2, -p.size * 0.2, -p.size * 0.4, -p.size, 0, -p.size * 0.35);
          c.bezierCurveTo(p.size * 0.4, -p.size, p.size * 1.2, -p.size * 0.2, 0, p.size * 0.6);
          c.fill();
          break;
        case 'steam':
        case 'smoke':
          c.globalAlpha *= p.kind === 'steam' ? 0.5 : 0.7;
          c.beginPath();
          c.arc(0, 0, p.size * (1.4 - k * 0.6), 0, Math.PI * 2);
          c.fill();
          break;
        default:
          c.beginPath();
          c.arc(0, 0, p.size * (0.5 + k * 0.5), 0, Math.PI * 2);
          c.fill();
      }
      c.restore();
    }

    for (const cf of this.coins) {
      if (cf.delay > 0) continue;
      const t = Math.min(1, cf.t / cf.dur);
      const e = t * t * (3 - 2 * t);
      const mx = (cf.from.x + cf.to.x) / 2;
      const my = Math.min(cf.from.y, cf.to.y) - 80;
      const x = (1 - e) * (1 - e) * cf.from.x + 2 * (1 - e) * e * mx + e * e * cf.to.x;
      const y = (1 - e) * (1 - e) * cf.from.y + 2 * (1 - e) * e * my + e * e * cf.to.y;
      coin(c, x, y, 11);
    }

    for (const f of this.floaters) {
      const t = f.life / f.max;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.5 : t < 0.25 ? 1.1 - ((t - 0.15) / 0.1) * 0.1 : 1;
      c.save();
      c.globalAlpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      c.translate(f.x, f.y - t * 50);
      c.scale(pop, pop);
      outlined(c, f.text, 0, 0, f.size, f.color, f.stroke);
      c.restore();
    }
  }
}
