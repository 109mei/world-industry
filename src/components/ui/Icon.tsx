import { memo, useEffect, useRef, useState } from 'react';
import { iconFallback, iconUrl } from '@/utils/assets';

interface IconProps {
  name: string;
  size?: number;
  /** 画像がないときに表示する短い文字（1〜2文字） */
  fallback?: string;
  /** 画像がないときに代わりに出すアイコン（素材がまだ無いものに使う） */
  fallbackIcon?: string;
  alt?: string;
  className?: string;
}

/**
 * assets/icons の PNG を表示する。
 * ファイルが無いときは、代わりのアイコン → 短い文字、の順に落とす。絵文字は使わない。
 */
function IconBase({ name, size = 32, fallback, fallbackIcon, alt = '', className = '' }: IconProps) {
  const [src, setSrc] = useState(name);
  const [failed, setFailed] = useState(false);
  // すでに試して駄目だったもの（同じものを何度も試して無限に回らないように）
  const tried = useRef<Set<string>>(new Set());
  // name が変わったら最初から試しなおす
  useEffect(() => {
    tried.current = new Set([name]);
    setSrc(name);
    setFailed(false);
  }, [name]);
  const style = { width: size, height: size, fontSize: size };
  if (failed) {
    return (
      <span className={`icon icon--placeholder ${className}`} style={style} aria-label={alt} title={alt}>
        {(fallback ?? name.replace(/^icon_[a-z]+_/, '').slice(0, 2)).toUpperCase()}
      </span>
    );
  }
  return (
    <span className={`icon ${className}`} style={style}>
      <img
        src={iconUrl(src)}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => {
          // 指定された代わり → 共通の代わり表 → 文字、の順に落とす。
          // どちらか片方で止めると、表に用意した絵に届かないことがある
          tried.current.add(src);
          const chain = [fallbackIcon, iconFallback(name)].filter((x): x is string => !!x);
          const next = chain.find((c) => !tried.current.has(c));
          if (next) {
            tried.current.add(next);
            setSrc(next);
          } else setFailed(true);
        }}
      />
    </span>
  );
}

/**
 * 同じ内容なら描き直さない。
 * 一覧にたくさん並ぶ部品なので、毎回の画面更新でここまで作り直さないようにしている。
 */
export const Icon = memo(IconBase);
