import { useEffect } from 'react';
import { setMusicSettings, setTrack, type TrackId } from '@/game/services/audio/music';
import { useGame } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';

/**
 * いまの画面に合う曲を選んで流す。
 *
 * 曲はまだカジノの1曲だけなので、賭け事を開いているあいだだけ鳴る。
 * 曲のファイルが増えたら、ここの表に足していけば切り替わる。
 */
export function useSceneMusic(): void {
  const { state } = useGame();
  const tab = useUiStore((s) => s.tab);
  const homeSub = useUiStore((s) => s.homeSubTab);
  const openGame = useUiStore((s) => s.openGameId);

  const music = state.settings.music !== false && state.settings.mute !== true;
  const musicVolume = state.settings.musicVolume ?? 0.45;

  useEffect(() => {
    setMusicSettings(music, musicVolume);
  }, [music, musicVolume]);

  useEffect(() => {
    let track: TrackId | null = null;
    // ミニゲームを開いているとき、または事業タブの賭け事を見ているとき
    if (openGame) track = 'casino';
    else if (tab === 'home' && homeSub === 'business' && state.research.completed.gaming_license) track = 'casino';
    setTrack(track);
  }, [tab, homeSub, openGame, state.research.completed.gaming_license]);
}
