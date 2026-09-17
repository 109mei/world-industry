import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getRuntime } from '@/game/runtime';
import { bumpGame, useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { hqLocation } from '@/game/engine/hq';
import { formatDuration } from '@/utils/format';
import { sfx } from '@/utils/sfx';

export function SettingsPanel() {
  const { state, engine } = useGame();
  const [name, setName] = useState(state.company.name);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [message, setMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const setTab = useUiStore((st) => st.setTab);
  const setMapSubTab = useUiStore((st) => st.setMapSubTab);

  const update = (patch: Partial<typeof state.settings>) => {
    engine.updateSettings(patch);
    bumpGame();
  };

  return (
    <div className="list" style={{ gap: 14 }}>
      <div className="field">
        <span className="field__label">会社名</span>
        <div className="row">
          <input className="input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          <Button
            variant="primary"
            onClick={() => {
              engine.renameCompany(name);
              bumpGame();
              setMessage('会社名を変更しました');
            }}
          >
            変更
          </Button>
        </div>
      </div>

      <div className="field">
        <span className="field__label">本社の場所</span>
        <div className="text-sub" style={{ fontSize: 12, marginBottom: 6 }}>
          いまの本社: {hqLocation(state).label}（{hqLocation(state).lat.toFixed(4)}, {hqLocation(state).lon.toFixed(4)}）。地図にこの場所で本社が出ます。
        </div>
        <div className="btn-row">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (!navigator.geolocation) {
                setMessage('この端末では位置情報が使えません。地図の「ここを本社に」で決められます');
                return;
              }
              setMessage('位置情報を取得しています…');
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  engine.setHqLocation(pos.coords.latitude, pos.coords.longitude);
                  bumpGame();
                  setMessage('本社を現在地にしました');
                },
                () => setMessage('位置情報を取得できませんでした。ブラウザの設定で許可するか、地図の「ここを本社に」で決められます'),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
              );
            }}
          >
            現在地にする
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setTab('map');
              setMapSubTab('map');
              setMessage('地図を動かして「ここを本社に」を押してください');
            }}
          >
            地図で選ぶ
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!state.settings.hqLocation}
            onClick={() => {
              engine.resetHqLocation();
              bumpGame();
              setMessage('本社の場所を初期値（大阪）に戻しました');
            }}
          >
            初期値に戻す
          </Button>
        </div>
      </div>

      <div className="field">
        <span className="field__label">画面の配色</span>
        <div className="btn-row">
          <Button variant={state.settings.theme === 'dark' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ theme: 'dark' })}>
            ダーク
          </Button>
          <Button variant={state.settings.theme === 'light' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ theme: 'light' })}>
            ライト（白）
          </Button>
          <Button variant={state.settings.theme === 'system' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ theme: 'system' })}>
            端末に合わせる
          </Button>
        </div>
      </div>

      <div className="field">
        <span className="field__label">数字の表記</span>
        <div className="btn-row">
          <Button variant={state.settings.numberFormat === 'short' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ numberFormat: 'short' })}>
            省略 (1.24万)
          </Button>
          <Button variant={state.settings.numberFormat === 'full' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ numberFormat: 'full' })}>
            通常 (12,400)
          </Button>
        </div>
      </div>

      <label className="switch">
        <input type="checkbox" checked={state.settings.showTutorial} onChange={(e) => update({ showTutorial: e.target.checked })} />
        チュートリアルを表示する
      </label>

      <div className="field">
        <span className="field__label">効果音</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={state.settings.sound}
            onChange={(e) => {
              update({ sound: e.target.checked });
              if (e.target.checked) sfx('buy');
            }}
          />
          効果音を鳴らす
        </label>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="text-sub" style={{ fontSize: 12, minWidth: 40 }}>
            音量
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(state.settings.volume * 100)}
            aria-label="音量"
            disabled={!state.settings.sound}
            onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
            onMouseUp={() => sfx('tap')}
            onTouchEnd={() => sfx('tap')}
            style={{ flex: 1 }}
          />
          <span className="num text-sub" style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>
            {Math.round(state.settings.volume * 100)}%
          </span>
        </div>
      </div>

      <label className="switch">
        <input type="checkbox" checked={state.settings.events} onChange={(e) => update({ events: e.target.checked })} />
        ランダムイベント（相場変動・災害など）を起こす
      </label>

      <div className="text-sub" style={{ fontSize: 12 }}>
        自動保存: {state.settings.autosaveSeconds}秒ごと ／ オフライン進行の上限: {formatDuration(state.settings.maxOfflineSeconds)}
      </div>

      <div className="field">
        <span className="field__label">セーブデータ</span>
        <div className="btn-row">
          <Button
            size="sm"
            onClick={async () => {
              await getRuntime().save();
              setMessage('保存しました');
            }}
          >
            今すぐ保存
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setExportText(getRuntime().exportState());
              setMessage('下の欄の文字列をコピーして保管してください');
            }}
          >
            書き出し
          </Button>
        </div>
        {exportText && <textarea className="input" readOnly value={exportText} onFocus={(e) => e.currentTarget.select()} />}
        <textarea className="input" placeholder="書き出した文字列を貼り付けて読み込み" value={importText} onChange={(e) => setImportText(e.target.value)} />
        <div className="btn-row">
          <Button
            size="sm"
            disabled={!importText.trim()}
            onClick={async () => {
              try {
                await getRuntime().importState(importText);
                setImportText('');
                setMessage('読み込みました');
              } catch (e) {
                setMessage(`読み込みに失敗: ${(e as Error).message}`);
              }
            }}
          >
            読み込み
          </Button>
          {!confirmReset ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              データを消して最初から
            </Button>
          ) : (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await getRuntime().reset();
                  setConfirmReset(false);
                  setMessage('初期化しました');
                }}
              >
                本当に消す
              </Button>
              <Button size="sm" onClick={() => setConfirmReset(false)}>
                やめる
              </Button>
            </>
          )}
        </div>
      </div>
      {message && (
        <div className="text-profit" style={{ fontSize: 12 }}>
          {message}
        </div>
      )}
    </div>
  );
}
