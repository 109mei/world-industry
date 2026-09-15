// キーボードとポインター（マウス・タッチ・ペン）の入力をまとめて扱う

// ページのスクロールなど、ブラウザ標準の動きを止めたいキー
const BLOCKED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(clientX: number, clientY: number) => {x: number, y: number}} toLogical
   */
  constructor(canvas, toLogical) {
    this.toLogical = toLogical;
    this.down = new Set(); // 押し続けているキー
    this.pressed = new Set(); // 今回の更新で押されたキー
    this.pointer = { x: -1, y: -1, down: false, active: false };
    this.clicked = false; // 今回の更新でクリック／タップされたか

    window.addEventListener('keydown', (e) => {
      if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.pointer.down = false;
    });

    canvas.addEventListener('pointerdown', (e) => {
      this.#move(e);
      this.pointer.down = true;
      this.clicked = true;
    });
    canvas.addEventListener('pointermove', (e) => this.#move(e));
    canvas.addEventListener('pointerup', (e) => {
      this.#move(e);
      this.pointer.down = false;
    });
    canvas.addEventListener('pointercancel', () => {
      this.pointer.down = false;
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointer.active = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  #move(e) {
    const p = this.toLogical(e.clientX, e.clientY);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.active = true;
  }

  /** キーを押し続けているか（例: isDown('ArrowLeft')） */
  isDown(code) {
    return this.down.has(code);
  }

  /** 今回の更新で、指定したキーのどれかが押されたか（例: wasPressed('Enter', 'Space')） */
  wasPressed(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  /** 1回の更新が終わるたびに呼ぶ（「押された瞬間」の情報を消す） */
  endStep() {
    this.pressed.clear();
    this.clicked = false;
  }
}
