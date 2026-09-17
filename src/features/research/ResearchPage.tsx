import { ResearchPanel } from './ResearchPanel';

/** 研究ツリー */
export function ResearchPage() {
  return (
    <div className="page">
      <h1 className="page__title">
        研究<small>研究ポイントで生産と解放を進める</small>
      </h1>
      <ResearchPanel />
    </div>
  );
}
