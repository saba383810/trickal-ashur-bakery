import { defineConfig } from 'vitest/config';

// バランス調整用のボットシミュレーション。通常の test には含めない。
export default defineConfig({
  test: {
    include: ['tests/**/*.sim.ts'],
    testTimeout: 600_000,
  },
});
