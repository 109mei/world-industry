/**
 * セーブデータの保存先を抽象化する。
 * 今は LocalStorage だが、将来 Supabase / Firebase / 独自API へ差し替えられる。
 */
export interface SaveRepository {
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
  clear(): Promise<void>;
  /** 補助キー（バックアップなど）の読み書き */
  getItem(key: string): Promise<string | null>;
  setItem(key: string, data: string): Promise<void>;
  /** 補助キーごと消す（古い保存先の破棄に使う） */
  removeItem(key: string): Promise<void>;
}

export class LocalStorageSaveRepository implements SaveRepository {
  constructor(private key: string) {}
  async load(): Promise<string | null> {
    return this.getItem(this.key);
  }
  async save(data: string): Promise<void> {
    localStorage.setItem(this.key, data);
    // 書けたことを読み直して確かめる（容量不足などで黙って失敗しないように）
    const back = localStorage.getItem(this.key);
    if (back !== data) throw new Error('セーブデータを保存できませんでした（保存先の容量が足りない可能性があります）');
  }
  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  async setItem(key: string, data: string): Promise<void> {
    localStorage.setItem(key, data);
  }
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      /* 消せなくても進める */
    }
  }
}

/** テストやフォールバック用のメモリ保存 */
export class MemorySaveRepository implements SaveRepository {
  private items = new Map<string, string>();
  constructor(private key = 'main') {}
  async load(): Promise<string | null> {
    return this.items.get(this.key) ?? null;
  }
  async save(data: string): Promise<void> {
    this.items.set(this.key, data);
  }
  async clear(): Promise<void> {
    this.items.delete(this.key);
  }
  async getItem(key: string): Promise<string | null> {
    return this.items.get(key) ?? null;
  }
  async setItem(key: string, data: string): Promise<void> {
    this.items.set(key, data);
  }
  async removeItem(key: string): Promise<void> {
    this.items.delete(key);
  }
}
