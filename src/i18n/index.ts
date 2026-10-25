// 言語の切り替え。T がいまの言語の文言（import { T } したところからも、切り替えたあとの文言が見える）
import type { BreadId } from '../config/breads';
import type { StageDef } from '../config/stages';
import { en } from './en';
import { ja, type Strings } from './ja';
import { ko } from './ko';

export type Lang = 'ja' | 'ko' | 'en';

export const LANGS: Lang[] = ['ja', 'ko', 'en'];

const TABLE: Record<Lang, Strings> = { ja, ko, en };

export let T: Strings = ja;
export let lang: Lang = 'ja';

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as string[]).includes(v);
}

export function langName(l: Lang): string {
  return TABLE[l].langName;
}

/** ブラウザの言語から選ぶ（日本語 → ja、韓国語 → ko、それ以外 → en。わからなければ ja） */
export function detectLang(): Lang {
  const list = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const l of list) {
    const base = l.toLowerCase().split('-')[0];
    if (base === 'ja' || base === 'ko' || base === 'en') return base;
  }
  return list.length ? 'en' : 'ja';
}

export function setLang(l: Lang): void {
  lang = l;
  T = TABLE[l];
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.title = T.docTitle;
    document.getElementById('game')?.setAttribute('aria-label', T.html.canvas);
  }
}

export function stageTitle(s: StageDef): string {
  return T.stages[s.id as keyof Strings['stages']]?.title ?? s.title;
}

export function stageBlurb(s: StageDef): string {
  return T.stages[s.id as keyof Strings['stages']]?.blurb ?? s.blurb;
}

export function breadName(id: BreadId): string {
  return T.breads[id];
}

/** 数字を 3 桁区切りに */
export function num(n: number): string {
  return Math.round(n).toLocaleString(T.locale);
}
