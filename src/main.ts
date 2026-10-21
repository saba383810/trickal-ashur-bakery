import { App } from './app';
import './style.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const app = new App(canvas, ui);
// 開発中だけ、ブラウザのコンソールから状態を触れるようにする
if (import.meta.env.DEV) (window as unknown as { app: App }).app = app;
