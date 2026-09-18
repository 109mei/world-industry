import { useState } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { ResearchLabHint } from './ResearchLabHint';
import { ResearchPanel } from './ResearchPanel';
import { ResearchTree } from './ResearchTree';

/** 研究。ツリー図と一覧を切り替えられる */
export function ResearchPage() {
  const [view, setView] = useState<'tree' | 'list'>('tree');
  return (
    <div className="page">
      <h1 className="page__title">
        研究<small>研究ポイントで生産と解放を進める</small>
      </h1>
      <ResearchLabHint />
      <Segmented
        ariaLabel="研究の表示"
        items={[
          { id: 'tree', label: 'ツリー図' },
          { id: 'list', label: '一覧' },
        ]}
        value={view}
        onChange={(v) => setView(v as 'tree' | 'list')}
      />
      {view === 'tree' ? <ResearchTree /> : <ResearchPanel />}
    </div>
  );
}
