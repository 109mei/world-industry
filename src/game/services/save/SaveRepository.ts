/**
 * セーブデータの保存先を抽象化する。
 * 今は LocalStorage だが、将来 Supabase / Firebase / 独自API へ差し替えられる。
 */
export interface SaveRepository {
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
  clear(): Promise<void>;
}

export class LocalStorageSaveRepository implements SaveRepository {
  constructor(private key: string) {}
  async load(): Promise<string | null> {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }
  async save(data: string): Promise<void> {
    localStorage.setItem(this.key, data);
  }
  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }
}

/** テストやフォールバック用のメモリ保存 */
export class MemorySaveRepository implements SaveRepository {
  private data: string | null = null;
  async load(): Promise<string | null> {
    return this.data;
  }
  async save(data: string): Promise<void> {
    this.data = data;
  }
  async clear(): Promise<void> {
    this.data = null;
  }
}
