import { WIDTH, HEIGHT, COLORS, FONT_FAMILY } from './config.js';
import { Input } from './input.js';

const STEP = 1 / 60; // 1回の更新で進める時間（秒）。画面の更新頻度に関係なく一定間隔で動かす
const MAX_DELTA = 0.25; // タブ復帰時などに、一度に進める時間の上限（秒）

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Record<string, (game: Game) => {update: Function, render: Function}>} scenes
   *   シーン名 → シーンを作る関数
   */
  constructor(canvas, scenes) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scenes = scenes;
    this.scene = null;
    this.input = new Input(canvas, (x, y) => this.toLogical(x, y));
    // URL の末尾に ?debug を付けると FPS を表示する
    this.debug = new URLSearchParams(window.location.search).has('debug');

    this.lastTime = 0;
    this.accumulator = 0;
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTimer = 0;

    this.frame = this.frame.bind(this);
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  /** ウィンドウに合わせて、縦横比を保ったまま画面を拡大縮小する */
  resize() {
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    const cssWidth = Math.max(1, Math.floor(WIDTH * scale));
    const cssHeight = Math.max(1, Math.floor(HEIGHT * scale));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    // これ以降の描画は 1280×720 の座標で書けばよい
    this.ctx.setTransform(this.canvas.width / WIDTH, 0, 0, this.canvas.height / HEIGHT, 0, 0);
  }

  /** 画面上の位置（clientX, clientY）をゲーム内の座標に変換する */
  toLogical(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  /** シーンを切り替える（例: game.goTo('play')） */
  goTo(name) {
    const create = this.scenes[name];
    if (!create) throw new Error(`シーン "${name}" は登録されていません`);
    this.scene?.exit?.();
    this.scene = create(this);
    this.scene.enter?.();
  }

  /** ゲームを開始する */
  start(firstScene) {
    this.goTo(firstScene);
    requestAnimationFrame((time) => {
      this.lastTime = time;
      requestAnimationFrame(this.frame);
    });
  }

  frame(time) {
    const delta = Math.min(Math.max((time - this.lastTime) / 1000, 0), MAX_DELTA);
    this.lastTime = time;

    this.accumulator += delta;
    while (this.accumulator >= STEP) {
      this.scene.update(STEP);
      this.input.endStep();
      this.accumulator -= STEP;
    }

    this.scene.render(this.ctx);
    if (this.debug) this.renderDebug(delta);

    requestAnimationFrame(this.frame);
  }

  renderDebug(delta) {
    this.fpsFrames += 1;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    const { ctx } = this;
    ctx.save();
    ctx.font = `600 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`${this.fps} FPS`, WIDTH - 16, 12);
    ctx.restore();
  }
}
