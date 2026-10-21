import { Rng } from '../../sim/rng';
import type { ChibiSpec, HairStyle, HatKind } from './chibi';

// 原作の設定・配色から起こした描き起こし用の仕様（色は低彩度のパステル）。

// 顔は原作の SD に寄せて、縦長の焦げ茶の目・大きな丸い頬・ω や D の口で統一する。

// エシュール: 自称・大魔法使い。サーモンピンクの長いウェーブ髪（毛先はコーラル）、
// 灰青のベレー帽にオレンジの謎の生き物のバッジ、クリーム色のセーターとネクタイ、ローズのプリーツスカート、渦巻きの羽
export const ESHUR: ChibiSpec = {
  skin: '#fff4ef',
  hair: '#e7868a',
  hairShade: '#c76477',
  hairTip: '#ee937a',
  shine: '#ffe8ba',
  brows: '#762b38',
  mouth: 'open',
  style: 'wavy',
  bangs: 'swept',
  outfit: '#ffeddc',
  outfitShade: '#efd3be',
  collar: '#ffffff',
  legs: '#ae8683',
  shoes: '#7a5a5c',
  ears: null,
  hat: 'beret',
  hatColor: '#9a9fb4',
  wings: 'swirl',
  extra: 'eshur',
};

// エルフィン: 妖精王国の女王。床まで届くクリーム金の髪と片側の三つ編み、斜めにかぶったティアラ、
// 八重歯、白いワンピースにコーラルのマント、白い羽
export const ELFIN: ChibiSpec = {
  skin: '#fff4ef',
  hair: '#fff0c0',
  hairShade: '#efbdad',
  hairTip: '#fbe3c0',
  shine: '#fffbe8',
  mouth: 'fang',
  style: 'long',
  bangs: 'blunt',
  outfit: '#f9f6f6',
  outfitShade: '#e7d6da',
  collar: '#ee8584',
  legs: '#ffffff',
  shoes: '#fbf3ee',
  ears: null,
  hat: 'tiara',
  hatColor: '#fdd397',
  wings: 'pink',
  extra: 'elfin',
};

// ネル: 世界樹教団の司祭長でエルフィンの育ての親。白い帯の付いた暗いヴェール、ベージュ金のウェーブ髪、
// 半目、白い小ケープに金の十字、灰青の修道服、先が水色の羽
export const NELL: ChibiSpec = {
  skin: '#fff4ef',
  hair: '#f4ddc8',
  hairShade: '#d09c98',
  hairTip: '#eacaba',
  shine: '#fff8ee',
  halfLid: true,
  mouth: 'cat',
  style: 'wavy',
  bangs: 'blunt',
  outfit: '#7c7891',
  outfitShade: '#6b6780',
  collar: '#ffffff',
  legs: '#785e60',
  shoes: '#b98f87',
  ears: null,
  hat: 'veil',
  hatColor: '#6a5976',
  wings: 'frost',
  extra: 'nell',
};

// コミー: 猫の獣人の「読書王」。眠たげな半目と ω の口、白いロングヘア（毛先は藤色がかったピンク）とアホ毛、
// 内側がピンクの白い猫耳、先が藤色の白いしっぽ。片方の肩がずり落ちたぶかぶかの白いシャツにピンクの短パン
export const KOMI: ChibiSpec = {
  skin: '#fff4ef',
  hair: '#f6f3f4',
  hairShade: '#dec4ce',
  hairTip: '#d8a1aa',
  shine: '#ffffff',
  halfLid: true,
  mouth: 'cat',
  style: 'long',
  bangs: 'split',
  outfit: '#ffffff',
  outfitShade: '#e9e0e6',
  collar: '#f3a3ad',
  legs: '#8f6f72',
  shoes: '#6f5557',
  ears: 'cat',
  tail: { kind: 'cat', color: '#ffffff', tip: '#cca3ac' },
  ahoge: true,
  hat: null,
  hatColor: '#ffffff',
  wings: null,
  extra: 'komi',
};

// バター: 犬の獣人で「友達大好き」。ミルクティー色のロングヘアと髪と同じ色の大きな垂れ耳、アホ毛、
// 黄色いリボンのカチューシャ（片耳にもリボン）、ふさふさのしっぽ。白いブラウスに黄色のベスト、金の鈴の首輪、犬のポーチ
export const BUTTER: ChibiSpec = {
  skin: '#fff4ef',
  hair: '#e2c0a5',
  hairShade: '#c59485',
  hairTip: '#d6ad92',
  shine: '#fff3e2',
  mouth: 'fang',
  style: 'long',
  bangs: 'blunt',
  outfit: '#ffffff',
  outfitShade: '#ebe2dc',
  collar: '#ffffff',
  legs: '#8f6f72',
  shoes: '#6f5557',
  ears: 'dog',
  tail: { kind: 'dog', color: '#f1cfbc', tip: '#fbe6d8' },
  ahoge: true,
  hat: 'bowband',
  hatColor: '#fed588',
  wings: null,
  extra: 'butter',
};

// 妖精村の人たち（原作キャラではないオリジナルのお客さん）。
// 原作のモブらしく、重い前髪で目を隠し、大きな頬と小さな口で表情を出す。髪と服はくすんだ色
const HAIR: [string, string, string][] = [
  ['#d98b58', '#b5683f', '#e6a072'],
  ['#c1b09b', '#9b8873', '#d2c3b0'],
  ['#6c7090', '#4e526f', '#8286a5'],
  ['#6d5c7c', '#4f425f', '#86769a'],
  ['#a97559', '#83553f', '#bf8e73'],
  ['#e3b9a2', '#c5917b', '#ecc9b6'],
  ['#9fae93', '#7b8d71', '#b6c3ab'],
  ['#c99aa6', '#a57583', '#d8b0ba'],
];
const OUTFIT: [string, string][] = [
  ['#5d6788', '#4b5473'],
  ['#8fae94', '#77967d'],
  ['#e8c77e', '#d2ad63'],
  ['#9fb1cc', '#8597b4'],
  ['#d9a3a8', '#c18b91'],
  ['#b8a6c9', '#9f8db2'],
  ['#c9b39a', '#b09980'],
];
const STYLES: HairStyle[] = ['bob', 'bob', 'long', 'pony', 'twin', 'short'];
const HATS: HatKind[] = [null, null, 'maid', 'maid', 'ribbon', 'leaf'];
const HAT_COLORS = ['#ffffff', '#ffffff', '#fff3d6', '#8fb59a', '#e9a3ae', '#8fa6cf'];
const SHOES = ['#8a5e4c', '#c9773f', '#a9b88f', '#6b5a6e', '#b98f87'];

/** 客の見た目をシードから決める（妖精村の人たち） */
export function villager(look: number): ChibiSpec {
  const r = new Rng(look);
  const [hair, hairShade, hairTip] = r.pick(HAIR);
  const [outfit, outfitShade] = r.pick(OUTFIT);
  const hat = r.pick(HATS);
  const skin = r.next() < 0.85 ? '#fff4ef' : '#f8e2d4';
  return {
    skin,
    hair,
    hairShade,
    hairTip,
    shine: '#ffffff',
    mouth: r.next() < 0.4 ? 'open' : 'line',
    style: r.pick(STYLES),
    bangs: 'heavy',
    outfit,
    outfitShade,
    collar: r.next() < 0.6 ? '#ffffff' : '#fff3d6',
    legs: skin,
    shoes: r.pick(SHOES),
    ears: r.next() < 0.15 ? 'elf' : null,
    hat,
    hatColor: hat === 'leaf' ? '#8fcf8a' : r.pick(HAT_COLORS),
    wings: null,
    mob: true,
    apron: r.next() < 0.6 ? (r.next() < 0.7 ? '#fff8ec' : '#f4ead8') : undefined,
  };
}
