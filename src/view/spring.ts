// ほっぺの「ぷるん」用の減衰バネ。
export class Spring {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;

  constructor(
    private stiffness = 260,
    private damping = 9,
  ) {}

  /** (tx, ty) に向かって dt 秒進める。低 FPS でも発散しないよう 1/120 秒以下に刻む */
  step(dt: number, tx = 0, ty = 0): void {
    const n = Math.max(1, Math.ceil(dt * 120));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const ax = -this.stiffness * (this.x - tx) - this.damping * this.vx;
      const ay = -this.stiffness * (this.y - ty) - this.damping * this.vy;
      this.vx += ax * h;
      this.vy += ay * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
    }
  }

  set(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  kick(vx: number, vy = 0): void {
    this.vx += vx;
    this.vy += vy;
  }
}
