import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InstallCard } from '@/features/settings/InstallCard';
import { GUIDES, GUIDE_GROUP_LABEL, type GuideGroup } from '@/game/data/guides';
import { useUiStore } from '@/stores/uiStore';
import { getRuntime } from '@/game/runtime';
import { bumpGame, useGame } from '@/stores/gameStore';
import { hqLocation } from '@/game/engine/hq';
import { formatDuration, formatMoney } from '@/utils/format';
import { CURRENCIES } from '@/game/data/currencies';
import { TIME_SCALE_NOTE } from '@/game/data/calendar';
import { sfx } from '@/utils/sfx';

export function SettingsPanel() {
  const { state, engine } = useGame();
  const openGuide = useUiStore((s) => s.setOpenGuide);
  const [name, setName] = useState(state.company.name);
  const [message, setMessage] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

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
        <div className="text-sub" style={{ fontSize: 12 }}>
          {hqLocation(state).label}（{hqLocation(state).lat.toFixed(4)}, {hqLocation(state).lon.toFixed(4)}）
          {state.settings.hqChosen ? '。最初に決めた場所なので、変えられません。' : '。まだ決めていません。ホームの「本社をどこに置きますか」から決められます。'}
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

      <div className="field">
        <span className="field__label">単位の付け方</span>
        <div className="btn-row">
          <Button variant={(state.settings.unitStyle ?? 'ja') === 'ja' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ unitStyle: 'ja' })}>
            日本式 (1.2億)
          </Button>
          <Button variant={state.settings.unitStyle === 'western' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ unitStyle: 'western' })}>
            英語式 (120M)
          </Button>
          <Button variant={state.settings.unitStyle === 'none' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ unitStyle: 'none' })}>
            付けない (120,000,000)
          </Button>
        </div>
      </div>

      <div className="field">
        <span className="field__label">通貨</span>
        <div className="text-sub" style={{ fontSize: 12, marginBottom: 4 }}>
          表示だけが変わります。ゲームの中の計算は変わりません（レートは固定の目安です）。
        </div>
        <div className="grid grid--2">
          {CURRENCIES.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={(state.settings.currency ?? 'jpy') === c.id ? 'primary' : 'secondary'}
              onClick={() => update({ currency: c.id })}
            >
              {c.name}（{c.symbol.trim()}）
            </Button>
          ))}
        </div>
        <div className="text-sub num" style={{ fontSize: 12, marginTop: 4 }}>
          例: {formatMoney(12_345_678, state.settings.numberFormat)}
        </div>
      </div>

      <div className="field">
        <span className="field__label">地図の表示</span>
        <div className="btn-row">
          <Button variant={state.settings.map3D !== true ? 'primary' : 'secondary'} size="sm" onClick={() => update({ map3D: false })}>
            平面（2D）
          </Button>
          <Button variant={state.settings.map3D === true ? 'primary' : 'secondary'} size="sm" onClick={() => update({ map3D: true })}>
            立体（3D）
          </Button>
        </div>
        <div className="text-sub" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
          <strong>立体（3D）は端末によっては重くなります。</strong>
          建物の高さを描くぶん、地図を動かすのが遅くなったり、電池の減りが早くなったりすることがあります。
          重くて地図の上のボタンが押せなくなったときは、ここから平面（2D）に戻せます。
        </div>
      </div>

      <label className="switch">
        <input type="checkbox" checked={state.settings.showTutorial} onChange={(e) => update({ showTutorial: e.target.checked })} />
        チュートリアルを表示する
      </label>

      <div className="field">
        <span className="field__label">使い方ガイド</span>
        <label className="switch">
          <input type="checkbox" checked={state.settings.guidesOff !== true} onChange={(e) => update({ guidesOff: !e.target.checked })} />
          初めての画面で自動的に出す
        </label>
        <div className="text-sub" style={{ fontSize: 12, margin: '4px 0 8px', lineHeight: 1.6 }}>
          読むだけの案内です。操作は求めません。下から好きなものをいつでも読み返せます。
        </div>
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <Button size="sm" onClick={() => update({ guidesSeen: [] })}>
            もう一度すべて出す
          </Button>
          <Button size="sm" onClick={() => update({ guidesSeen: GUIDES.map((g) => g.id) })}>
            出さない（読んだことにする）
          </Button>
        </div>
        {(Object.keys(GUIDE_GROUP_LABEL) as GuideGroup[]).map((group) => {
          const items = GUIDES.filter((g) => g.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: 8 }}>
              <div className="text-dim" style={{ fontSize: 11.5, fontWeight: 700, margin: '4px 0' }}>
                {GUIDE_GROUP_LABEL[group]}
              </div>
              <div className="guidelist">
                {items.map((g) => {
                  const read = (state.settings.guidesSeen ?? []).includes(g.id);
                  return (
                    <button key={g.id} className="guidelist__item" onClick={() => openGuide(g.id)}>
                      <Icon name={g.icon} size={26} fallback={g.title.slice(0, 2)} />
                      <span className="row__grow">
                        <span className="guidelist__title">{g.title}</span>
                        <span className="guidelist__sub" style={{ display: 'block' }}>
                          {g.summary}
                        </span>
                      </span>
                      <span className="guidelist__read">{read ? '読んだ' : 'まだ'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="field">
        <span className="field__label">アプリとして使う</span>
        <InstallCard compact />
        <div className="text-dim" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.6 }}>
          すでに追加ずみの端末や、対応していないブラウザでは何も出ません。
        </div>
      </div>

      <div className="field">
        <span className="field__label">時間の進み方</span>
        <div className="text-sub" style={{ fontSize: 12, lineHeight: 1.6 }}>
          {TIME_SCALE_NOTE}
          <br />
          <span className="text-dim">
            速さは変えられません。離れているあいだに進んだぶんも同じ速さで数えているため、途中で変えると日付が合わなくなるからです。
          </span>
        </div>
      </div>

      <div className="field">
        <span className="field__label">文字の大きさ</span>
        <div className="btn-row">
          <Button variant={(state.settings.fontScale ?? 'normal') === 'small' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ fontScale: 'small' })}>
            小さめ
          </Button>
          <Button variant={(state.settings.fontScale ?? 'normal') === 'normal' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ fontScale: 'normal' })}>
            標準
          </Button>
          <Button variant={state.settings.fontScale === 'large' ? 'primary' : 'secondary'} size="sm" onClick={() => update({ fontScale: 'large' })}>
            大きめ
          </Button>
        </div>
      </div>

      <div className="field">
        <span className="field__label">画面の動き</span>
        <label className="switch">
          <input type="checkbox" checked={state.settings.reduceMotion === true} onChange={(e) => update({ reduceMotion: e.target.checked })} />
          動きを減らす
        </label>
        <div className="text-sub" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
          数字が飛ぶ演出やカードの動きを止めます。<strong>画面が軽くなる</strong>ので、動きがもたつく端末でも試してみてください。
        </div>
      </div>

      <div className="field">
        <span className="field__label">画面を消さない</span>
        <label className="switch">
          <input type="checkbox" checked={state.settings.keepAwake === true} onChange={(e) => update({ keepAwake: e.target.checked })} />
          遊んでいるあいだ画面を消さない
        </label>
        <div className="text-sub" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
          放っておいても画面が暗くなりません。そのぶん電池を使います。対応していない端末では効きません。
        </div>
      </div>

      <div className="field">
        <span className="field__label">手ごたえ（振動）</span>
        <label className="switch">
          <input type="checkbox" checked={state.settings.haptics !== false} onChange={(e) => update({ haptics: e.target.checked })} />
          押したときに軽く震わせる
        </label>
        <div className="text-dim" style={{ fontSize: 11.5, marginTop: 4 }}>
          対応している端末（多くの Android）でのみ効きます。
        </div>
      </div>

      <div className="field">
        <span className="field__label">音をまとめて止める</span>
        <label className="switch">
          <input type="checkbox" checked={state.settings.mute === true} onChange={(e) => update({ mute: e.target.checked })} />
          すべての音を止める（消音）
        </label>
        <div className="text-dim" style={{ fontSize: 11.5, marginTop: 4 }}>
          下の効果音・BGM の設定より優先されます。外して戻すと、元の音量に戻ります。
        </div>
      </div>

      <div className="field">
        <span className="field__label">効果音</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={state.settings.sound && state.settings.mute !== true}
            disabled={state.settings.mute === true}
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
            disabled={!state.settings.sound || state.settings.mute === true}
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

      <div className="field">
        <span className="field__label">BGM</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={state.settings.music !== false && state.settings.mute !== true}
            disabled={state.settings.mute === true}
            onChange={(e) => update({ music: e.target.checked })}
          />
          曲を流す
        </label>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="text-sub" style={{ fontSize: 12, minWidth: 40 }}>
            音量
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((state.settings.musicVolume ?? 0.45) * 100)}
            aria-label="BGMの音量"
            disabled={state.settings.music === false || state.settings.mute === true}
            onChange={(e) => update({ musicVolume: Number(e.target.value) / 100 })}
            style={{ flex: 1 }}
          />
          <span className="num text-sub" style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }}>
            {Math.round((state.settings.musicVolume ?? 0.45) * 100)}%
          </span>
        </div>
        <div className="text-dim" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.5 }}>
          画面に合わせて曲が変わります。いまはカジノ（賭け事）の曲が入っています。
          ブラウザの決まりで、最初に画面を1回さわるまでは鳴りません。
        </div>
      </div>

      <div className="field">
        <span className="field__label">ランダムイベント</span>
        <div className="text-sub" style={{ fontSize: 12 }}>
          相場の急変・災害・好景気などは常に起こります（止められません）。イベントに備えるのも経営のうちです。
        </div>
      </div>

      <div className="field">
        <span className="field__label">セーブ</span>
        <div className="text-sub" style={{ fontSize: 12 }}>
          つねに自動で保存され、開くと自動で読み込まれます。操作のたびに保存し、閉じるときにも保存します
          （オフライン進行の上限は {formatDuration(state.settings.maxOfflineSeconds)}）。
        </div>
      </div>

      <div className="field">
        <span className="field__label">やり直し</span>
        <div className="btn-row">
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
        <div className="text-sub" style={{ fontSize: 12, marginTop: 4 }}>
          消すと永続ポイントも含めてすべて失われます。
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
