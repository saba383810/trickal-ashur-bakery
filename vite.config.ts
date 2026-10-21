/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// sabanogames の CI は `npm run build -- --base=/entertainments/<slug>/app/` で base を上書きする。
// 単体で開くときは相対パスで動くようにしておく。
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
