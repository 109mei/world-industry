import { WIDTH, HEIGHT, COLORS, FONT_FAMILY } from '../config.js';
import { drawGear, drawFittedText } from '../draw.js';

const BACK_BUTTON = { x: 24, y: 24, w: 210, h: 56 };
const MAX_GEARS = 40;

// ゲーム画面（いまは動作確認用の仮の画面）
export class PlayScene {
  constructor(game) {
    this.game = game;
    this.gears = [];
  }

  update(dt) {
    const { input } = this.game;

    if (input.wasPressed('Escape')) {
      this.game.goTo('title');
      return;
    }

    if (input.clicked) {
      const { x, y } = input.pointer;
      if (contains(BACK_BUTTON, x, y)) {
        this.game.goTo('title');
        return;
      }
      this.addGear(x, y);
    }

    for (const gear of this.gears) {
      gear.angle += gear.speed * dt;
      gear.age += dt;
    }
  }

  addGear(x, y) {
    this.gears.push({
      x,
      y,
      radius: 28 + Math.random() * 28,
      teeth: 8 + Math.floor(Math.random() * 6),
      speed: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 1.2),
      angle: Math.random() * Math.PI,
      age: 0,
    });
    if (this.gears.length > MAX_GEARS) this.gears.shift();
  }

  render(ctx) {
    const { pointer } = this.game.input;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 動作確認用の歯車（置いた直後に少し弾む）
    for (const gear of this.gears) {
      const grow = easeOutBack(Math.min(gear.age / 0.25, 1));
      drawGear(ctx, gear.x, gear.y, gear.radius * grow, gear.teeth, gear.angle, COLORS.placed);
    }

    // 案内文
    drawFittedText(ctx, 'ゲーム画面', WIDTH / 2, HEIGHT / 2 - 34, {
      size: 44,
      weight: 700,
      maxWidth: WIDTH - 160,
      color: COLORS.text,
    });
    drawFittedText(ctx, 'ここにゲームを作っていきます', WIDTH / 2, HEIGHT / 2 + 22, {
      size: 26,
      weight: 500,
      maxWidth: WIDTH - 160,
      color: COLORS.subText,
    });
    drawFittedText(
      ctx,
      'クリック / タップ：歯車を置く（動作確認用）　Esc：タイトルへ',
      WIDTH / 2,
      HEIGHT - 44,
      { size: 24, weight: 500, maxWidth: WIDTH - 80, color: COLORS.subText },
    );

    // タイトルへ戻るボタン
    const hover = pointer.active && contains(BACK_BUTTON, pointer.x, pointer.y);
    ctx.fillStyle = hover ? COLORS.buttonHover : COLORS.button;
    ctx.beginPath();
    ctx.roundRect(BACK_BUTTON.x, BACK_BUTTON.y, BACK_BUTTON.w, BACK_BUTTON.h, 12);
    ctx.fill();
    ctx.font = `600 24px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('← タイトルへ', BACK_BUTTON.x + BACK_BUTTON.w / 2, BACK_BUTTON.y + BACK_BUTTON.h / 2);
  }
}

function contains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}
