/**
 * 研究ツリーの並べ方を計算する。
 *
 * 前提条件をたどって「何段目か（depth）」を決め、系統ごとの帯に分けて縦に積む。
 * 線でつなぐので、どの研究がどこにつながっているかが一目で分かる。
 */
import { RESEARCH, RESEARCH_MAP, type ResearchBranch, type ResearchDef } from '@/game/data/research';

export interface TreeNode {
  def: ResearchDef;
  depth: number;
  branch: ResearchBranch;
  x: number;
  y: number;
}

export interface TreeEdge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
  /** 系統ごとの帯（見出しを出すため） */
  bands: { branch: ResearchBranch; top: number; height: number }[];
}

export const NODE_W = 148;
export const NODE_H = 52;
export const COL_GAP = 56;
export const ROW_GAP = 16;
export const BAND_GAP = 28;
export const BAND_LABEL_H = 22;

const BRANCH_ORDER: ResearchBranch[] = ['industry', 'logistics', 'energy', 'management', 'tech', 'service'];

/** その研究が何段目か（前提をいちばん深くたどった数） */
function depthOf(id: string, cache: Map<string, number>, guard = 0): number {
  const cached = cache.get(id);
  if (cached !== undefined) return cached;
  const def = RESEARCH_MAP[id as keyof typeof RESEARCH_MAP] as ResearchDef | undefined;
  if (!def || guard > 40) return 0;
  let d = 0;
  for (const q of def.requires) d = Math.max(d, depthOf(q, cache, guard + 1) + 1);
  cache.set(id, d);
  return d;
}

/** 指定した系統だけを並べる（null ならすべて） */
export function buildTreeLayout(only: ResearchBranch | null = null): TreeLayout {
  const defs = (RESEARCH as readonly ResearchDef[]).filter((r) => (only ? (r.branch ?? 'industry') === only : true));
  const cache = new Map<string, number>();
  const nodes: TreeNode[] = defs.map((def) => ({
    def,
    depth: depthOf(def.id, cache),
    branch: (def.branch ?? 'industry') as ResearchBranch,
    x: 0,
    y: 0,
  }));
  const maxDepth = nodes.reduce((a, n) => Math.max(a, n.depth), 0);

  // 系統ごとに帯を作り、その中で段ごとに縦に積む
  const branches = BRANCH_ORDER.filter((b) => nodes.some((n) => n.branch === b));
  const bands: TreeLayout['bands'] = [];
  let top = 0;
  for (const branch of branches) {
    const mine = nodes.filter((n) => n.branch === branch);
    const perDepth = new Map<number, number>();
    let rows = 0;
    for (const n of mine.sort((a, b) => a.depth - b.depth || a.def.cost - b.def.cost)) {
      const row = perDepth.get(n.depth) ?? 0;
      perDepth.set(n.depth, row + 1);
      rows = Math.max(rows, row + 1);
      n.x = n.depth * (NODE_W + COL_GAP);
      n.y = top + BAND_LABEL_H + row * (NODE_H + ROW_GAP);
    }
    const height = BAND_LABEL_H + rows * (NODE_H + ROW_GAP);
    bands.push({ branch, top, height });
    top += height + BAND_GAP;
  }

  const byId = new Map(nodes.map((n) => [n.def.id, n]));
  const edges: TreeEdge[] = [];
  for (const n of nodes) {
    for (const q of n.def.requires) {
      const from = byId.get(q);
      if (!from) continue;
      edges.push({
        from: q,
        to: n.def.id,
        x1: from.x + NODE_W,
        y1: from.y + NODE_H / 2,
        x2: n.x,
        y2: n.y + NODE_H / 2,
      });
    }
  }

  return {
    nodes,
    edges,
    width: (maxDepth + 1) * (NODE_W + COL_GAP),
    height: Math.max(0, top - BAND_GAP),
    bands,
  };
}
