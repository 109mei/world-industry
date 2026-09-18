/**
 * 案件の工程と、出来の良さ（品質）。
 *
 * 案件は「設計 → 試作 → 量産」の3工程で進む。
 * 工程ごとに、そのときの人手・ブランド・進め方から出来の良さが決まり、
 * 3つを合わせたものがその案件の品質になる。
 * 品質は報酬と評判（ブランド・知名度）に効き、製品なら利用者の数と離れにくさにも効く。
 */

export type ProjectPhaseId = 'design' | 'prototype' | 'production';

export interface ProjectPhaseDef {
  id: ProjectPhaseId;
  name: string;
  icon: string;
  /** 全体の仕事量のうち、この工程が占める割合 */
  share: number;
  /** この工程で特に効くもの（表示用） */
  weight: { staff: number; brand: number };
  note: string;
}

export const PROJECT_PHASES: readonly ProjectPhaseDef[] = [
  {
    id: 'design',
    name: '設計',
    icon: 'icon_office_blueprint',
    share: 0.25,
    weight: { staff: 0.8, brand: 1.4 },
    note: '何を作るかを決める。ここでの判断が後の全部に効く。腕のいい人（＝ブランド）がものを言う工程',
  },
  {
    id: 'prototype',
    name: '試作',
    icon: 'icon_office_lab_bench',
    share: 0.3,
    weight: { staff: 1.2, brand: 1 },
    note: '一度作ってみて確かめる。ここで不具合を潰しておかないと、量産してから大事になる',
  },
  {
    id: 'production',
    name: '量産',
    icon: 'icon_ui_factory',
    share: 0.45,
    weight: { staff: 1.6, brand: 0.6 },
    note: '数をそろえて仕上げる。人手が足りないまま押し切ると、粗が残る',
  },
];

export const PHASE_MAP: Record<ProjectPhaseId, ProjectPhaseDef> = Object.fromEntries(
  PROJECT_PHASES.map((p) => [p.id, p]),
) as Record<ProjectPhaseId, ProjectPhaseDef>;

export const PHASE_ORDER: ProjectPhaseId[] = PROJECT_PHASES.map((p) => p.id);

/** 進め方。急ぐほど早く終わるが、雑になる */
export type ProjectPace = 'careful' | 'normal' | 'rush';

export interface PaceDef {
  id: ProjectPace;
  name: string;
  /** 必要な仕事量の倍率 */
  workMult: number;
  /** 出来の良さに足す点 */
  quality: number;
  /** 着手金の倍率 */
  costMult: number;
  note: string;
}

export const PACES: readonly PaceDef[] = [
  { id: 'careful', name: 'じっくり', workMult: 1.45, quality: 16, costMult: 1.15, note: '時間とお金はかかるが、良いものになる' },
  { id: 'normal', name: 'ふつう', workMult: 1, quality: 0, costMult: 1, note: '普通に作る' },
  { id: 'rush', name: '急ぐ', workMult: 0.6, quality: -24, costMult: 0.9, note: '早く安く出せるが、粗が残る' },
];

export const PACE_MAP: Record<ProjectPace, PaceDef> = Object.fromEntries(PACES.map((p) => [p.id, p])) as Record<ProjectPace, PaceDef>;

/** 品質の呼び名 */
export function qualityLabel(q: number): string {
  if (q >= 85) return '傑作';
  if (q >= 70) return '上出来';
  if (q >= 55) return '及第点';
  if (q >= 40) return 'いまひとつ';
  if (q >= 25) return '粗が目立つ';
  return '欠陥品';
}

/** 品質から報酬の倍率（0.6〜1.45） */
export function qualityRewardMult(q: number): number {
  return 0.6 + (Math.max(0, Math.min(100, q)) / 100) * 0.85;
}

/** 品質から評判（ブランド・知名度）の倍率。低いと逆に評判を落とす */
export function qualityBrandMult(q: number): number {
  // 40点を境に、下回ると負の値になる
  return (Math.max(0, Math.min(100, q)) - 40) / 45;
}

/** 品質から、発売した製品の利用者の倍率（0.45〜1.6） */
export function qualityUsersMult(q: number): number {
  return 0.45 + (Math.max(0, Math.min(100, q)) / 100) * 1.15;
}

/** 品質から、製品が飽きられる速さの倍率（良いほど長持ち） */
export function qualityDecayMult(q: number): number {
  return 1.45 - (Math.max(0, Math.min(100, q)) / 100) * 0.75;
}

/** その案件にちょうどいい人数の目安（仕事量から決める） */
export function crewSize(work: number): number {
  return Math.max(1, Math.round(Math.sqrt(work) / 8));
}
