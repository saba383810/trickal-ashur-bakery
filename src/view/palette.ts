// 色はここに集約する。パン屋らしい暖色 + キャラのテーマカラー。
export const C = {
  ink: '#5a3a22',
  inkSoft: '#8a6446',
  white: '#ffffff',
  cream: '#fff6e8',
  wall: '#fdeed6',
  wallStripe: '#f8e2c2',
  woodLight: '#e7b072',
  wood: '#c98446',
  woodDark: '#8a5228',
  woodDeep: '#6b3d1e',
  counterTop: '#f5d7aa',
  floor: '#d9a36a',
  tile: '#efd9b8',
  tileLine: '#e2c49c',
  sky: '#cdeefa',
  glass: 'rgba(214, 240, 248, 0.35)',
  gold: '#f2c14e',
  goldDeep: '#d39a26',
  good: '#5fb85d',
  warn: '#f0a43a',
  bad: '#e2574c',
  tab: '#d9434f',
  eshur: '#e5848b',
  elfin: '#ee9e7c',
  nell: '#8ea3b8',
  komi: '#c79bb5',
  butter: '#e0a83c',
  burumi: '#e8b928',
  shadow: 'rgba(90, 58, 34, 0.18)',
} as const;

/** 韓国語の文字は M PLUS Rounded 1c に無いので、丸い Jua で描く */
export const FONT = "'M PLUS Rounded 1c', 'Jua', 'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Apple SD Gothic Neo', system-ui, sans-serif";

export function font(size: number, weight = 800): string {
  return `${weight} ${size}px ${FONT}`;
}
