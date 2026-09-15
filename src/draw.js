import { FONT_FAMILY } from './config.js';

/**
 * 歯車を描く
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x 中心の X 座標
 * @param {number} y 中心の Y 座標
 * @param {number} radius 歯の先までの半径
 * @param {number} teeth 歯の数
 * @param {number} angle 回転角（ラジアン）
 * @param {string} color 塗りの色
 */
export function drawGear(ctx, x, y, radius, teeth, angle, color) {
  const root = radius * 0.8; // 歯の根元の半径
  const hole = radius * 0.28; // 中心の穴の半径
  const step = (Math.PI * 2) / teeth;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    ctx.arc(0, 0, root, a, a + step * 0.46); // 歯と歯のあいだ
    ctx.lineTo(Math.cos(a + step * 0.54) * radius, Math.sin(a + step * 0.54) * radius);
    ctx.lineTo(Math.cos(a + step * 0.92) * radius, Math.sin(a + step * 0.92) * radius);
  }
  ctx.closePath();
  ctx.moveTo(hole, 0);
  ctx.arc(0, 0, hole, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * 横幅に収まるよう、必要なら文字を小さくして中央に書く
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{size: number, weight?: number, maxWidth: number, color: string}} options
 */
export function drawFittedText(ctx, text, x, y, { size, weight = 700, maxWidth, color }) {
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    ctx.font = `${weight} ${Math.floor((size * maxWidth) / width)}px ${FONT_FAMILY}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
