import { WIDTH, HEIGHT, COLORS } from '../config.js';
import { drawGear, drawFittedText } from '../draw.js';

// タイトル画面
export class TitleScene {
  constructor(game) {
    this.game = game;
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    const { input } = this.game;
    if (input.clicked || input.wasPressed('Enter', 'Space')) {
      this.game.goTo('play');
    }
  }

  render(ctx) {
    const t = this.time;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 背景でゆっくり回る歯車
    drawGear(ctx, 200, 600, 240, 18, t * 0.12, COLORS.gear);
    drawGear(ctx, 1110, 140, 170, 13, -t * 0.17, COLORS.gear);

    // タイトル
    drawFittedText(ctx, 'WORLD INDUSTRY', WIDTH / 2, HEIGHT / 2 - 50, {
      size: 110,
      weight: 800,
      maxWidth: WIDTH - 160,
      color: COLORS.accent,
    });

    // 区切り線
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(WIDTH / 2 - 150, HEIGHT / 2 + 28, 300, 4);

    // スタートの案内（ゆっくり点滅）
    ctx.globalAlpha = 0.725 + 0.275 * Math.sin(t * 3);
    drawFittedText(ctx, 'クリック / タップ / Enter でスタート', WIDTH / 2, HEIGHT / 2 + 110, {
      size: 32,
      weight: 600,
      maxWidth: WIDTH - 160,
      color: COLORS.text,
    });
    ctx.globalAlpha = 1;
  }
}
