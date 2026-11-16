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
const H200 = 'NVIDIA H200 141GB HBM3e'
const H20 = 'NVIDIA H20 96GB HBM3'
const A800 = 'NVIDIA A800-SXM4-80GB'
const A100SXM = 'NVIDIA A100-SXM4-80GB'
const A100PCIE = 'NVIDIA A100-PCIe-80GB'
const V100 = 'NVIDIA V100-SXM2-32GB'
const RTX5090 = 'NVIDIA GeForce RTX 5090 32GB'
const RTX4060 = 'NVIDIA GeForce RTX 4060 8GB'
const ASCEND_B = '华为昇腾 Ascend 910B 64GB'
const ASCEND_C = '华为昇腾 Ascend 910C 64GB'
const MLU590 = '寒武纪思元 MLU590 48GB'

const COLORS = {
  h100: { requestColor: '#C2410C', fillFrom: 'rgba(194,65,12,0.5)', fillTo: 'rgba(194,65,12,0.08)' },
  h200: { requestColor: '#EA580C', fillFrom: 'rgba(234,88,12,0.48)', fillTo: 'rgba(234,88,12,0.08)' },
  h20: { requestColor: '#F97316', fillFrom: 'rgba(249,115,22,0.45)', fillTo: 'rgba(249,115,22,0.08)' },
  a800: { requestColor: '#A16207', fillFrom: 'rgba(161,98,7,0.48)', fillTo: 'rgba(161,98,7,0.08)' },
  a100sxm: { requestColor: '#0369A1', fillFrom: 'rgba(3,105,161,0.48)', fillTo: 'rgba(3,105,161,0.08)' },
  a100pcie: { requestColor: '#0284C7', fillFrom: 'rgba(2,132,199,0.45)', fillTo: 'rgba(2,132,199,0.08)' },
  v100: { requestColor: '#0E7490', fillFrom: 'rgba(14,116,144,0.45)', fillTo: 'rgba(14,116,144,0.08)' },
  rtx5090: { requestColor: '#7C3AED', fillFrom: 'rgba(124,58,237,0.45)', fillTo: 'rgba(124,58,237,0.08)' },
  rtx4060: { requestColor: '#8B5CF6', fillFrom: 'rgba(139,92,246,0.42)', fillTo: 'rgba(139,92,246,0.08)' },
  ascend910b: { requestColor: '#BE123C', fillFrom: 'rgba(190,18,60,0.48)', fillTo: 'rgba(190,18,60,0.08)' },
  ascend910c: { requestColor: '#E11D48', fillFrom: 'rgba(225,29,72,0.45)', fillTo: 'rgba(225,29,72,0.08)' },
  mlu590: { requestColor: '#0F766E', fillFrom: 'rgba(15,118,110,0.48)', fillTo: 'rgba(15,118,110,0.08)' },
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
 * 温度/功耗/利用率在概览页优先由真实节点采样推导；此处为无节点时的兜底。
 */
const PROFILES: Record<string, StationDemoProfile> = {
  'st-hbsz': {
    id: 'st-hbsz',
    label: '河北深州',
    mood: 'busy',
    gauges: { temp: 68.4, power: 52.6, totalUtil: 58.2, usedUtil: 84.6 },
    skus: [
      sku('h100', H100, 48, 42, 30, 46, 36, 'h100'),
      sku('h200', H200, 24, 20, 14, 22, 16, 'h200'),
      sku('rtx5090', RTX5090, 32, 28, 20, 30, 24, 'rtx5090'),
      sku('rtx4060', RTX4060, 32, 24, 14, 28, 18, 'rtx4060'),
      sku('ascend910b', ASCEND_B, 40, 34, 24, 38, 28, 'ascend910b'),
      sku('mlu590', MLU590, 24, 18, 12, 20, 14, 'mlu590'),
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
      sku('h100', H100, 56, 54, 48, 55, 50, 'h100'),
      sku('h20', H20, 32, 30, 26, 31, 28, 'h20'),
      sku('a800', A800, 24, 22, 18, 23, 20, 'a800'),
      sku('a100sxm', A100SXM, 24, 22, 18, 23, 20, 'a100sxm'),
      sku('ascend910c', ASCEND_C, 48, 46, 40, 47, 42, 'ascend910c'),
      sku('mlu590', MLU590, 24, 22, 18, 23, 20, 'mlu590'),
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
      sku('ascend910b', ASCEND_B, 48, 12, 4, 18, 8, 'ascend910b'),
      sku('ascend910c', ASCEND_C, 32, 8, 2, 14, 6, 'ascend910c'),
      sku('mlu590', MLU590, 40, 8, 3, 14, 6, 'mlu590'),
      sku('v100', V100, 24, 4, 1, 8, 3, 'v100'),
      sku('h100', H100, 16, 3, 1, 6, 2, 'h100'),
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
      sku('h200', H200, 32, 30, 26, 31, 28, 'h200'),
      sku('ascend910c', ASCEND_C, 56, 54, 48, 55, 50, 'ascend910c'),
      sku('mlu590', MLU590, 48, 46, 40, 47, 42, 'mlu590'),
      sku('h100', H100, 32, 30, 26, 31, 28, 'h100'),
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
      sku('rtx5090', RTX5090, 40, 28, 16, 34, 22, 'rtx5090'),
      sku('rtx4060', RTX4060, 40, 24, 12, 30, 18, 'rtx4060'),
      sku('v100', V100, 32, 18, 10, 24, 14, 'v100'),
      sku('a100pcie', A100PCIE, 24, 14, 8, 18, 12, 'a100pcie'),
      sku('h100', H100, 24, 14, 8, 18, 12, 'h100'),
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
      sku('a100sxm', A100SXM, 32, 18, 10, 24, 14, 'a100sxm'),
      sku('a800', A800, 24, 14, 8, 18, 12, 'a800'),
      sku('v100', V100, 32, 16, 8, 22, 12, 'v100'),
      sku('ascend910b', ASCEND_B, 32, 16, 8, 22, 12, 'ascend910b'),
      sku('h20', H20, 24, 12, 6, 16, 10, 'h20'),
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
      sku('ascend910b', ASCEND_B, 40, 6, 2, 12, 5, 'ascend910b'),
      sku('mlu590', MLU590, 32, 4, 1, 8, 3, 'mlu590'),
      sku('ascend910c', ASCEND_C, 24, 3, 1, 6, 2, 'ascend910c'),
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
  out[out.length - 1] = base
  return out
}

export function nextWalk(current: number, total: number, ceiling: number) {
  const delta =
    Math.random() < 0.22
      ? Math.random() < 0.55
        ? 1
        : -1
      : Math.random() < 0.35
        ? Math.random() < 0.5
          ? 1
          : -1
        : 0
  return clamp(current + delta, 0, Math.min(total, ceiling))
}
