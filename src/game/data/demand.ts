/**
 * 地元の市場が受け止められる量（需要容量）と、その広げ方。
 *
 * これまで市場は、いくら出しても値崩れしない場所だった。
 * 機械部品なら毎秒12,000個——部品工房およそ1万4千棟ぶん——を売って
 * ようやく値段が半分になる設定で、実質「押し続けるのが最適解」になっていた。
 *
 * ここでは市場を**町の市場**として扱う。
 * ひとつの町が買い取れる量には限りがあり、それを超えて出せば値が崩れる。
 * もっと売りたければ、売り先そのものを増やすしかない——
 * 地図で取引先に営業する、自分の店を出す、よその土地に物件を持つ、輸出する。
 * これが「地図を歩き回る理由」になる。
 *
 * ## 容量の決め方
 *
 * 品目ごとに数字を手で置くと、施設を足すたびに合わなくなる。
 * そこで「その品を作る**いちばん小さい施設**、およそ 25 棟ぶんの出荷までは
 * 町が受け止める」という一本の決め方にしてある。
 * 施設を足しても、生産量を変えても、容量は勝手に付いてくる。
 *
 * 飽和量は τ 秒で 1/e に減るので、毎秒 R だけ出し続けたときの
 * 落ち着き先は R×τ になる。これが容量と釣り合う点で値段が半分になる。
 *   容量 = 1棟の毎秒出力 × 25棟 × τ
 */
import { CONFIG } from './config';
import { FACILITIES, type FacilityDef } from './facilities';
import { RESOURCE_MAP, type ResourceId } from './resources';

/** 地元の市場が値崩れせずに受け止める「棟数」の目安 */
export const LOCAL_DEMAND_UNITS = 25;

/**
 * 施設では作れないもの（手作りだけの品、鉱脈から直に出るもの）の受け皿。
 * liquidity に掛けて容量にする。手で作れる量はたかが知れているので広めに取る。
 */
const FALLBACK_LIQUIDITY_MULT = 0.08;

/** 転売するもの（GPU・暗号資産）は市場で売り買いするのが本分なので締めない */
const BUYABLE_MULT = 12;

let rateCache: Partial<Record<ResourceId, number>> | null = null;

/**
 * その資源を作る施設のうち、いちばん小さいものの毎秒の出力。
 * 「最初に建てる1棟」を物差しにしたいので、最大ではなく最小を採る。
 */
function smallestOutputRate(id: ResourceId): number {
  if (!rateCache) {
    const m: Partial<Record<ResourceId, number>> = {};
    for (const f of FACILITIES as readonly FacilityDef[]) {
      for (const [rid, rate] of Object.entries(f.production?.outputs ?? {}) as [ResourceId, number][]) {
        if (!(rate > 0)) continue;
        const cur = m[rid];
        if (cur === undefined || rate < cur) m[rid] = rate;
      }
    }
    rateCache = m;
  }
  return rateCache[id] ?? 0;
}

/**
 * 地元の市場の受け止められる量（飽和量の目安）。
 * ここに飽和量が届くと売値が半分になる。
 */
export function localDemandBase(id: ResourceId): number {
  const def = RESOURCE_MAP[id];
  if (!def) return 1;
  const tau = CONFIG.market.demandRecoverySeconds;
  const rate = smallestOutputRate(id);
  const base = rate > 0 ? rate * LOCAL_DEMAND_UNITS * tau : def.liquidity * FALLBACK_LIQUIDITY_MULT;
  return Math.max(1, base * (def.buyable ? BUYABLE_MULT : 1));
}

// ---------------------------------------------------------------------------
// 売り先を増やす
// ---------------------------------------------------------------------------

/**
 * 売り先を増やす手立てと、その効き方。
 *
 * どれも「地図の上で何かを持っている・つないでいる」ことを数える。
 * 数字はそのまま画面に出すので、ここを唯一の出どころにする。
 */
export interface DemandSource {
  id: 'property' | 'client' | 'shop' | 'country';
  label: string;
  /** 1つあたり需要が何割増えるか */
  per: number;
  /** この手立てで増やせる上限（倍） */
  cap: number;
  hint: string;
}

export const DEMAND_SOURCES = [
  {
    id: 'property',
    label: '持っている物件',
    per: 0.05,
    cap: 2,
    hint: '地図で物件や区画を買うほど、その土地の売り先が増える。',
  },
  {
    id: 'client',
    label: '取引先',
    per: 0.08,
    cap: 3,
    hint: '地図の建物に営業して関係を作ると、そのぶん引き取り先が増える。',
  },
  {
    id: 'shop',
    label: '自分の店',
    per: 0.1,
    cap: 2,
    hint: '商業施設を建てると、市場を通さず自分でさばける量が増える。',
  },
  {
    id: 'country',
    label: '物件のある国',
    per: 0.35,
    cap: 1.4,
    hint: 'よその国に足場を作ると、その国の市場にも流せるようになる。',
  },
] as const satisfies readonly DemandSource[];

export const DEMAND_SOURCE_MAP: Record<DemandSource['id'], DemandSource> = Object.fromEntries(
  DEMAND_SOURCES.map((s) => [s.id, s]),
) as Record<DemandSource['id'], DemandSource>;

/** 手立てひとつぶんの伸び（1つあたりの効きと上限を当てはめる） */
export function demandPartOf(sourceId: DemandSource['id'], count: number): number {
  const s = DEMAND_SOURCE_MAP[sourceId];
  if (!s) return 0;
  return Math.min(s.cap, Math.max(0, count) * s.per);
}

/** 数えたものから需要の伸び（倍率）を出す。1 = 町の市場だけ */
export function demandGrowthFrom(counts: Record<DemandSource['id'], number>): number {
  let growth = 1;
  for (const s of DEMAND_SOURCES) growth += demandPartOf(s.id, counts[s.id] ?? 0);
  return growth;
}
