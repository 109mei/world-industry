import './style.css';
import { Game } from './game.js';
import { TitleScene } from './scenes/title.js';
import { PlayScene } from './scenes/play.js';

// シーンを追加したら、ここに名前と作り方を登録する
const scenes = {
  title: (game) => new TitleScene(game),
  play: (game) => new PlayScene(game),
};

const canvas = document.querySelector('#game');
const game = new Game(canvas, scenes);
game.start('title');
