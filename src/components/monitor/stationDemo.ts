import { clamp } from '../grafana/format'

/** 遥测采样：1 秒一点，保留 45 点 ≈ 45s 历史；可见窗口约 30s */
export const DEMO_TICK_MS = 1000
export const DEMO_DEPTH = 45
export const DEMO_SCROLL_MS = 30_000

export interface SkuSeed {
  id: string
  title: string
  total: number
  request: number
  used: number
  requestMax: number
  usedMax: number
  requestColor: string
  fillFrom: string
  fillTo: string
}

export interface StationDemoProfile {
  id: string
  label: string
  /** 负载画像：拉开集群差异 */
  mood: 'idle' | 'warm' | 'busy' | 'hot'
  gauges: { temp: number; power: number; totalUtil: number; usedUtil: number }
  skus: SkuSeed[]
  /** 叠到 DCGM 细指标上的偏置 */
  smBias: number
  tensorBias: number
  dramBias: number
  powerMul: number
  nvlinkMul: number
  rdmaMul: number
  tempBias: number
}

const H100 = 'NVIDIA H100 80GB HBM3'
const A800 = 'NVIDIA A800-SXM4-80GB'
const A100 = 'NVIDIA A100-SXM4-80GB'
const ASCEND = '华为昇腾 Ascend 910B 64GB'
const MLU = '寒武纪 MLU370-X8 48GB'
const BR104 = '壁仞 BR104 32GB'

const COLORS = {
  h100: { requestColor: '#C2410C', fillFrom: 'rgba(194,65,12,0.5)', fillTo: 'rgba(194,65,12,0.08)' },
  a800: { requestColor: '#A16207', fillFrom: 'rgba(161,98,7,0.48)', fillTo: 'rgba(161,98,7,0.08)' },
  a100: { requestColor: '#0369A1', fillFrom: 'rgba(3,105,161,0.48)', fillTo: 'rgba(3,105,161,0.08)' },
  ascend910b: { requestColor: '#BE123C', fillFrom: 'rgba(190,18,60,0.48)', fillTo: 'rgba(190,18,60,0.08)' },
  mlu370: { requestColor: '#0F766E', fillFrom: 'rgba(15,118,110,0.48)', fillTo: 'rgba(15,118,110,0.08)' },
  br104: { requestColor: '#6D28D9', fillFrom: 'rgba(109,40,217,0.48)', fillTo: 'rgba(109,40,217,0.08)' },
}

function sku(
  id: string,
  title: string,
  total: number,
  request: number,
  used: number,
  requestMax: number,
  usedMax: number,
  tone: keyof typeof COLORS,
): SkuSeed {
  return { id, title, total, request, used, requestMax, usedMax, ...COLORS[tone] }
}

/**
 * 各站 profile：SKU 比例 + 园区负载 mood。
 * 温度/功耗/利用率在概览页优先由真实节点采样推导；此处为无节点时的兜底，
 * 量纲对齐公开 TDP/显存；国产与 NVIDIA 混部。
 */
const PROFILES: Record<string, StationDemoProfile> = {
  'st-hbsz': {
    id: 'st-hbsz',
    label: '河北深州',
    mood: 'busy',
    gauges: { temp: 68.4, power: 52.6, totalUtil: 58.2, usedUtil: 84.6 },
    skus: [
      sku('h100', H100, 64, 58, 42, 60, 48, 'h100'),
      sku('a800', A800, 40, 36, 26, 38, 30, 'a800'),
      sku('ascend910b', ASCEND, 56, 48, 34, 52, 40, 'ascend910b'),
      sku('mlu370', MLU, 24, 18, 12, 20, 14, 'mlu370'),
      sku('br104', BR104, 16, 12, 8, 14, 10, 'br104'),
    ],
    smBias: 6,
    tensorBias: 4,
    dramBias: 5,
    powerMul: 1,
    nvlinkMul: 1.05,
    rdmaMul: 1,
    tempBias: 2,
  },
  'st-jsgp': {
    id: 'st-jsgp',
    label: '江苏高邮',
    mood: 'hot',
    gauges: { temp: 76.8, power: 78.4, totalUtil: 81.2, usedUtil: 93.5 },
    skus: [
      sku('h100', H100, 80, 78, 70, 79, 74, 'h100'),
      sku('a800', A800, 32, 30, 26, 31, 28, 'a800'),
      sku('a100', A100, 16, 15, 12, 16, 14, 'a100'),
      sku('ascend910b', ASCEND, 48, 46, 40, 47, 42, 'ascend910b'),
      sku('mlu370', MLU, 24, 22, 18, 23, 20, 'mlu370'),
    ],
    smBias: 12,
    tensorBias: 10,
    dramBias: 12,
    powerMul: 1.12,
    nvlinkMul: 1.2,
    rdmaMul: 1.25,
    tempBias: 8,
  },
  'st-xj': {
    id: 'st-xj',
    label: '新疆哈密',
    mood: 'idle',
    gauges: { temp: 41.2, power: 18.6, totalUtil: 16.4, usedUtil: 48.2 },
    skus: [
      sku('ascend910b', ASCEND, 64, 16, 6, 24, 12, 'ascend910b'),
      sku('mlu370', MLU, 40, 8, 3, 14, 6, 'mlu370'),
      sku('br104', BR104, 24, 4, 1, 8, 3, 'br104'),
      sku('h100', H100, 24, 6, 2, 10, 4, 'h100'),
    ],
    smBias: -10,
    tensorBias: -8,
    dramBias: -10,
    powerMul: 0.92,
    nvlinkMul: 0.7,
    rdmaMul: 0.65,
    tempBias: -4,
  },
  'st-gd': {
    id: 'st-gd',
    label: '广东汕头',
    mood: 'hot',
    gauges: { temp: 78.6, power: 86.2, totalUtil: 84.8, usedUtil: 95.2 },
    skus: [
      sku('h100', H100, 40, 38, 34, 39, 36, 'h100'),
      sku('ascend910b', ASCEND, 72, 70, 64, 71, 66, 'ascend910b'),
      sku('mlu370', MLU, 40, 38, 34, 39, 36, 'mlu370'),
      sku('br104', BR104, 24, 22, 18, 23, 20, 'br104'),
    ],
    smBias: 14,
    tensorBias: 12,
    dramBias: 14,
    powerMul: 1.15,
    nvlinkMul: 1.25,
    rdmaMul: 1.3,
    tempBias: 10,
  },
  'st-bjdx': {
    id: 'st-bjdx',
    label: '北京大兴',
    mood: 'warm',
    gauges: { temp: 62.4, power: 36.8, totalUtil: 44.6, usedUtil: 72.8 },
    skus: [
      sku('h100', H100, 48, 30, 18, 36, 24, 'h100'),
      sku('a800', A800, 40, 26, 16, 32, 20, 'a800'),
      sku('ascend910b', ASCEND, 56, 34, 20, 42, 28, 'ascend910b'),
      sku('mlu370', MLU, 32, 18, 10, 24, 14, 'mlu370'),
      sku('a100', A100, 24, 14, 8, 18, 12, 'a100'),
    ],
    smBias: -2,
    tensorBias: -1,
    dramBias: 0,
    powerMul: 0.98,
    nvlinkMul: 0.9,
    rdmaMul: 0.85,
    tempBias: 1,
  },
  'st-tj': {
    id: 'st-tj',
    label: '天津滨海',
    mood: 'warm',
    gauges: { temp: 58.6, power: 28.4, totalUtil: 36.2, usedUtil: 66.4 },
    skus: [
      sku('a100', A100, 48, 26, 14, 32, 20, 'a100'),
      sku('ascend910b', ASCEND, 48, 24, 12, 30, 18, 'ascend910b'),
      sku('mlu370', MLU, 32, 16, 8, 22, 12, 'mlu370'),
      sku('br104', BR104, 24, 10, 5, 14, 8, 'br104'),
      sku('h100', H100, 24, 12, 6, 16, 10, 'h100'),
    ],
    smBias: -4,
    tensorBias: -3,
    dramBias: -2,
    powerMul: 0.96,
    nvlinkMul: 0.85,
    rdmaMul: 0.8,
    tempBias: 0,
  },
  'st-jx': {
    id: 'st-jx',
    label: '江西赣州',
    mood: 'idle',
    gauges: { temp: 38.8, power: 14.2, totalUtil: 11.6, usedUtil: 39.4 },
    skus: [
      sku('ascend910b', ASCEND, 40, 6, 2, 12, 5, 'ascend910b'),
      sku('mlu370', MLU, 32, 4, 1, 8, 3, 'mlu370'),
      sku('br104', BR104, 24, 3, 1, 6, 2, 'br104'),
      sku('a800', A800, 16, 2, 1, 5, 2, 'a800'),
    ],
    smBias: -12,
    tensorBias: -10,
    dramBias: -12,
    powerMul: 0.9,
    nvlinkMul: 0.55,
    rdmaMul: 0.5,
    tempBias: -5,
  },
}

const FALLBACK = PROFILES['st-hbsz']!

export function stationDemo(stationId: string): StationDemoProfile {
  return PROFILES[stationId] ?? FALLBACK
}

/** 生成一段阶梯水位历史：有缓升缓降，避免整段平线 */
export function walkSeries(base: number, max: number, total: number, depth = DEMO_DEPTH, phase = 0) {
  let value = base
  const out: number[] = []
  for (let index = 0; index < depth; index++) {
    const wave = Math.sin((index + phase) / 5.5) * 1.4 + Math.sin((index + phase) / 11) * 0.8
    const step = index % 7 === 0 ? (Math.random() < 0.55 ? 1 : -1) : 0
    value = clamp(Math.round(base + wave + step + (Math.random() - 0.5) * 0.6), 0, Math.min(total, max + 2))
    out.push(value)
  }
  // 末点贴近当前基准，方便 Last 与表一致
  out[out.length - 1] = base
  return out
}

export function nextWalk(current: number, total: number, ceiling: number) {
  const delta = Math.random() < 0.22 ? (Math.random() < 0.55 ? 1 : -1) : Math.random() < 0.35 ? (Math.random() < 0.5 ? 1 : -1) : 0
  return clamp(current + delta, 0, Math.min(total, ceiling))
}
