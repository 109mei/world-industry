import { useState } from 'react';
import { iconUrl } from '@/utils/assets';

interface IconProps {
  name: string;
  size?: number;
  /** 画像がないときに表示する短い文字（1〜2文字） */
  fallback?: string;
  alt?: string;
  className?: string;
}

/**
 * assets/icons の PNG を表示する。ファイルが無いときはシンプルなプレースホルダーを出す。
 * 絵文字は使わない。
 */
export function Icon({ name, size = 32, fallback, alt = '', className = '' }: IconProps) {
  const [failed, setFailed] = useState(false);
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
      <img src={iconUrl(name)} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} draggable={false} />
    </span>
  );
}
