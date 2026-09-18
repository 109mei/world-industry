import { useCallback, useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** すでにホーム画面のアプリとして開いているか */
function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}

/**
 * 「ホーム画面に追加」。
 *
 * Android と PC の Chrome は、条件がそろうと beforeinstallprompt を投げてくるので、
 * それを取っておいて、押されたときに出す。iPhone の Safari はこの仕組みが無いので、
 * 代わりに手順を文章で出す（ボタンを出して何も起きない、を避ける）。
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isInstalled());
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') setInstalled(true);
    setDone(true);
  }, [deferred]);

  return {
    /** 押せば追加できる（ボタンを出してよい） */
    canInstall: !installed && deferred !== null,
    /** 手順を文章で出すしかない端末（iPhone の Safari など） */
    needsManual: !installed && deferred === null && isIos(),
    installed,
    done,
    install,
  };
}
