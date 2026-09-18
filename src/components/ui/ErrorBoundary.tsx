import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** 落ちたときに代わりに出すもの。関数なら、やり直す手段を渡して呼ぶ */
  fallback?: ReactNode | ((retry: () => void, error: Error) => ReactNode);
}

interface State {
  error: Error | null;
}

/**
 * 画面が落ちたときに、真っ白にしないための受け皿。
 *
 * とくに効くのが**あとから読み込む部分**（本社を選ぶ地図など）で、
 * 電波が悪い・公開直後で古いファイル名を取りに行った、といったときに
 * 読み込みが失敗する。受け皿が無いと React ごと落ちて真っ白になり、
 * 読み直しても同じ画面に戻るので先に進めなくなる。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('画面でエラーが起きました', error, info.componentStack);
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback(this.retry, error);
    if (fallback !== undefined) return fallback;
    return (
      <div className="card" style={{ padding: 16 }}>
        <div className="card__title">この部分を表示できませんでした</div>
        <div className="card__sub" style={{ marginTop: 4 }}>{error.message}</div>
        <div className="card__actions">
          <button type="button" className="btn btn--secondary btn--block" onClick={this.retry}>
            もう一度ためす
          </button>
        </div>
      </div>
    );
  }
}
