import { useEffect, useState } from 'react';

/**
 * 新しい版が出たときのお知らせ。
 *
 * 一度開いたページは、裏で新しいファイルが用意されても古いまま動き続ける。
 * 黙っていると「直したはずなのに直っていない」と見えるので、ここで知らせる。
 * 読み込み直すかどうかは本人に決めてもらう（遊んでいる途中で勝手に切り替えない）。
 * セーブは保存済みなので、読み込み直しても進みは失われない。
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener('wi:update-ready', onReady);
    return () => window.removeEventListener('wi:update-ready', onReady);
  }, []);

  if (!ready) return null;

  return (
    <div className="update-banner" role="status">
      <div className="update-banner__text">
        <strong>新しい版が出ています。</strong>
        <span className="text-sub"> 読み込み直すと最新になります（進みはそのままです）。</span>
      </div>
      <div className="update-banner__actions">
        <button type="button" className="btn btn--sm btn--secondary" onClick={() => setReady(false)}>
          あとで
        </button>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          disabled={reloading}
          onClick={() => {
            setReloading(true);
            window.location.reload();
          }}
        >
          {reloading ? '読み込み中…' : '読み込み直す'}
        </button>
      </div>
    </div>
  );
}
