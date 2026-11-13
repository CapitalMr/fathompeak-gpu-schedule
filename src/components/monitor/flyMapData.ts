/** 全国拓扑节点与跨中心联动边 */

export interface RegionMark {
  id: string
  pill: string
  short: string
  x: number
  y: number
  color: string
  region?: { text: string; x: number; y: number; size?: number }
  bend: number
  center: string
}

export interface PeerLink {
  id: string
  from: string
  to: string
  bend: number
  label: string
}

export const FLY_HUB = { x: 748, y: 286 }

export const FLY_MARKS: RegionMark[] = [
  {
    id: 'st-xj',
    pill: '新疆集中式光伏',
    short: '新疆',
    x: 118,
    y: 248,
    color: '#2f63b8',
    region: { text: '新疆', x: 150, y: 188, size: 28 },
    bend: -48,
    center: '西部核心智算',
  },
  {
    id: 'st-bjdx',
    pill: '北京大兴分布式光伏',
    short: '大兴',
    x: 548,
    y: 132,
    color: '#4e3f66',
    region: { text: '京津冀', x: 620, y: 72, size: 22 },
    bend: 42,
    center: '华北智算 · 大兴',
  },
  {
    id: 'st-tj',
    pill: '天津分布式光伏',
    short: '天津',
    x: 760,
    y: 156,
    color: '#2f63b8',
    bend: -36,
    center: '华北智算 · 滨海',
  },
  {
    id: 'st-hbsz',
    pill: '河北深州集中式光伏',
    short: '深州',
    x: 470,
    y: 268,
    color: '#4e3f66',
    bend: 46,
    center: '华北智算 · 深州',
  },
  {
    id: 'st-jsgp',
    pill: '江苏高邮集中式光伏',
    short: '高邮',
    x: 1028,
    y: 318,
    color: '#2f63b8',
    region: { text: '江苏', x: 1148, y: 286, size: 28 },
    bend: -40,
    center: '华东智算',
  },
  {
    id: 'st-jx',
    pill: '江西水电',
    short: '赣州',
    x: 508,
    y: 448,
    color: '#2f9e44',
    region: { text: '江西', x: 430, y: 400, size: 28 },
    bend: 28,
    center: '华中联动',
  },
  {
    id: 'st-gd',
    pill: '广东汕头海上风电',
    short: '汕头',
    x: 820,
    y: 512,
    color: '#8a6232',
    region: { text: '粤东海域', x: 980, y: 548, size: 22 },
    bend: -34,
    center: '华南智算',
  },
]

/** 跨中心协同边：按需点亮 1～2 条 */
export const PEER_LINKS: PeerLink[] = [
  { id: 'xj-hbsz', from: 'st-xj', to: 'st-hbsz', bend: 56, label: '西电东算 · 配额迁移' },
  { id: 'bjdx-tj', from: 'st-bjdx', to: 'st-tj', bend: -28, label: '京津冀 · 同城容灾' },
  { id: 'hbsz-jsgp', from: 'st-hbsz', to: 'st-jsgp', bend: -42, label: '华北→华东 · 绿电窗口' },
  { id: 'jsgp-gd', from: 'st-jsgp', to: 'st-gd', bend: 48, label: '苏粤 · 推理副本联动' },
  { id: 'jx-gd', from: 'st-jx', to: 'st-gd', bend: -36, label: '赣粤 · 水电高峰协同' },
  { id: 'xj-jx', from: 'st-xj', to: 'st-jx', bend: 40, label: '西核 · 跨域成组' },
]

export function hubFlyPath(x: number, y: number, bend: number) {
  const mx = (FLY_HUB.x + x) / 2
  const my = (FLY_HUB.y + y) / 2
  const dx = x - FLY_HUB.x
  const dy = y - FLY_HUB.y
  const len = Math.hypot(dx, dy) || 1
  const cx = mx + (-dy / len) * bend
  const cy = my + (dx / len) * bend
  return `M ${FLY_HUB.x} ${FLY_HUB.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x} ${y}`
}

export function peerFlyPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bend: number,
) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const cx = mx + (-dy / len) * bend
  const cy = my + (dx / len) * bend
  return `M ${a.x} ${a.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`
}

function hashSeed(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619)
  return h >>> 0
}

function seededShuffle<T>(items: T[], seed: number) {
  const arr = [...items]
  let s = seed || 1
  for (let i = arr.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 13), 0x5bd1e995)
    const j = (s >>> 0) % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 全国总览：区域间按需点亮 1～2 条（可定时刷新） */
export function randomPeerLinks(pool: PeerLink[] = PEER_LINKS): PeerLink[] {
  if (pool.length === 0) return []
  const shuffled = seededShuffle(pool, Date.now() % 1_000_000)
  const count = Math.random() < 0.45 ? 1 : 2
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

/**
 * 任务拓扑：按 workloadId 稳定抽取 1～3 个地区（同一任务不变）
 */
export function stableStationsForTask(seedKey: string, candidates: string[], max = 3): string[] {
  if (candidates.length === 0) {
    const all = FLY_MARKS.map((m) => m.id)
    const count = 1 + (hashSeed(seedKey) % Math.min(3, all.length))
    return seededShuffle(all, hashSeed(seedKey)).slice(0, count)
  }
  const unique = [...new Set(candidates)]
  if (unique.length <= max) return unique
  return seededShuffle(unique, hashSeed(`${seedKey}:stations`)).slice(0, max)
}

/** 任务拓扑：在已分配地区之间生成固定协同边（不闪烁） */
export function stablePeerLinksForStations(seedKey: string, stationIds: string[]): PeerLink[] {
  if (stationIds.length < 2) return []
  const set = new Set(stationIds)
  const matched = PEER_LINKS.filter((link) => set.has(link.from) && set.has(link.to))
  if (matched.length > 0) {
    return seededShuffle(matched, hashSeed(`${seedKey}:peers`)).slice(0, Math.min(2, matched.length))
  }
  // 无现成边时，按稳定顺序串接已分配站
  const ordered = seededShuffle(stationIds, hashSeed(`${seedKey}:chain`))
  const links: PeerLink[] = []
  for (let i = 0; i < ordered.length - 1 && links.length < 2; i++) {
    const from = ordered[i]
    const to = ordered[i + 1]
    const a = markById(from)
    const b = markById(to)
    if (!a || !b) continue
    links.push({
      id: `task-${from}-${to}`,
      from,
      to,
      bend: i % 2 === 0 ? 40 : -36,
      label: `${a.short}↔${b.short} · 跨域调度`,
    })
  }
  return links
}

export function markById(id: string) {
  return FLY_MARKS.find((m) => m.id === id)
}
