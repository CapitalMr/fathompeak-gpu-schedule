/**
 * 智算卡公开规格锚点（量纲依据公开资料 / datasheet）
 * 覆盖 NVIDIA 数据中心卡、消费级混部卡，以及昇腾 / 寒武纪 / 海光等国产加速卡。
 */

export type SkuKind =
  | 'h100'
  | 'h200'
  | 'h20'
  | 'a800'
  | 'a100sxm'
  | 'a100pcie'
  | 'v100'
  | 'rtx5090'
  | 'rtx4060'
  | 'ascend910b'
  | 'ascend910c'
  | 'mlu590'
  | 'hygon'
  | 'br104'

export type Vendor = 'nvidia' | 'huawei' | 'cambricon' | 'hygon' | 'biren'

export interface GpuSkuSpec {
  kind: SkuKind
  vendor: Vendor
  title: string
  short: string
  memoryGb: number
  tdpW: number
  idleW: [number, number]
  memClockGhz: number
  smBoostGhz: number
  smBaseGhz: number
  dramPeakGBs: number
  nvlinkPeakGBs: number
  fabricName: string
  fp32Tflops: number
  fp16TensorTflops: number
  fp8TensorTflops: number
  driverLabel: string
}

export const GPU_SPECS: Record<SkuKind, GpuSkuSpec> = {
  h100: {
    kind: 'h100',
    vendor: 'nvidia',
    title: 'NVIDIA H100 80GB HBM3',
    short: 'H100 80GB',
    memoryGb: 80,
    tdpW: 700,
    idleW: [85, 125],
    memClockGhz: 2.619,
    smBoostGhz: 1.98,
    smBaseGhz: 1.41,
    dramPeakGBs: 3350,
    nvlinkPeakGBs: 900,
    fabricName: 'NVLink',
    fp32Tflops: 67,
    fp16TensorTflops: 989,
    fp8TensorTflops: 1979,
    driverLabel: '535.183.01',
  },
  h200: {
    kind: 'h200',
    vendor: 'nvidia',
    title: 'NVIDIA H200 141GB HBM3e',
    short: 'H200 141GB',
    memoryGb: 141,
    tdpW: 700,
    idleW: [90, 130],
    memClockGhz: 2.5,
    smBoostGhz: 1.98,
    smBaseGhz: 1.41,
    dramPeakGBs: 4800,
    nvlinkPeakGBs: 900,
    fabricName: 'NVLink',
    fp32Tflops: 67,
    fp16TensorTflops: 989,
    fp8TensorTflops: 1979,
    driverLabel: '550.90.07',
  },
  h20: {
    kind: 'h20',
    vendor: 'nvidia',
    title: 'NVIDIA H20 96GB HBM3',
    short: 'H20 96GB',
    memoryGb: 96,
    tdpW: 500,
    idleW: [70, 110],
    memClockGhz: 2.4,
    smBoostGhz: 1.8,
    smBaseGhz: 1.3,
    dramPeakGBs: 4000,
    nvlinkPeakGBs: 900,
    fabricName: 'NVLink',
    fp32Tflops: 44,
    fp16TensorTflops: 148,
    fp8TensorTflops: 296,
    driverLabel: '550.90.07',
  },
  a800: {
    kind: 'a800',
    vendor: 'nvidia',
    title: 'NVIDIA A800-SXM4-80GB',
    short: 'A800-SXM4 80GB',
    memoryGb: 80,
    tdpW: 400,
    idleW: [55, 95],
    memClockGhz: 1.593,
    smBoostGhz: 1.41,
    smBaseGhz: 1.09,
    dramPeakGBs: 2039,
    nvlinkPeakGBs: 400,
    fabricName: 'NVLink',
    fp32Tflops: 19.5,
    fp16TensorTflops: 312,
    fp8TensorTflops: 0,
    driverLabel: '535.183.01',
  },
  a100sxm: {
    kind: 'a100sxm',
    vendor: 'nvidia',
    title: 'NVIDIA A100-SXM4-80GB',
    short: 'A100-SXM4 80GB',
    memoryGb: 80,
    tdpW: 400,
    idleW: [55, 95],
    memClockGhz: 1.215,
    smBoostGhz: 1.41,
    smBaseGhz: 1.09,
    dramPeakGBs: 2039,
    nvlinkPeakGBs: 600,
    fabricName: 'NVLink',
    fp32Tflops: 19.5,
    fp16TensorTflops: 312,
    fp8TensorTflops: 0,
    driverLabel: '535.183.01',
  },
  a100pcie: {
    kind: 'a100pcie',
    vendor: 'nvidia',
    title: 'NVIDIA A100-PCIe-80GB',
    short: 'A100-PCIe 80GB',
    memoryGb: 80,
    tdpW: 300,
    idleW: [50, 85],
    memClockGhz: 1.215,
    smBoostGhz: 1.41,
    smBaseGhz: 1.09,
    dramPeakGBs: 1935,
    nvlinkPeakGBs: 0,
    fabricName: 'PCIe',
    fp32Tflops: 19.5,
    fp16TensorTflops: 312,
    fp8TensorTflops: 0,
    driverLabel: '535.183.01',
  },
  v100: {
    kind: 'v100',
    vendor: 'nvidia',
    title: 'NVIDIA V100-SXM2-32GB',
    short: 'V100 32GB',
    memoryGb: 32,
    tdpW: 300,
    idleW: [40, 70],
    memClockGhz: 0.877,
    smBoostGhz: 1.53,
    smBaseGhz: 1.245,
    dramPeakGBs: 900,
    nvlinkPeakGBs: 300,
    fabricName: 'NVLink',
    fp32Tflops: 15.7,
    fp16TensorTflops: 125,
    fp8TensorTflops: 0,
    driverLabel: '525.147.05',
  },
  rtx5090: {
    kind: 'rtx5090',
    vendor: 'nvidia',
    title: 'NVIDIA GeForce RTX 5090 32GB',
    short: 'RTX 5090 32GB',
    memoryGb: 32,
    tdpW: 575,
    idleW: [35, 65],
    memClockGhz: 1.75,
    smBoostGhz: 2.4,
    smBaseGhz: 2.0,
    dramPeakGBs: 1792,
    nvlinkPeakGBs: 0,
    fabricName: 'PCIe',
    fp32Tflops: 105,
    fp16TensorTflops: 210,
    fp8TensorTflops: 420,
    driverLabel: '570.86.16',
  },
  rtx4060: {
    kind: 'rtx4060',
    vendor: 'nvidia',
    title: 'NVIDIA GeForce RTX 4060 8GB',
    short: 'RTX 4060 8GB',
    memoryGb: 8,
    tdpW: 115,
    idleW: [12, 28],
    memClockGhz: 1.7,
    smBoostGhz: 2.46,
    smBaseGhz: 1.83,
    dramPeakGBs: 272,
    nvlinkPeakGBs: 0,
    fabricName: 'PCIe',
    fp32Tflops: 15,
    fp16TensorTflops: 30,
    fp8TensorTflops: 0,
    driverLabel: '550.90.07',
  },
  ascend910b: {
    kind: 'ascend910b',
    vendor: 'huawei',
    title: '华为昇腾 Ascend 910B 64GB',
    short: 'Ascend 910B',
    memoryGb: 64,
    tdpW: 400,
    idleW: [70, 110],
    memClockGhz: 1.6,
    smBoostGhz: 1.8,
    smBaseGhz: 1.2,
    dramPeakGBs: 1600,
    nvlinkPeakGBs: 392,
    fabricName: 'HCCS',
    fp32Tflops: 46,
    fp16TensorTflops: 320,
    fp8TensorTflops: 640,
    driverLabel: 'CANN 8.0.RC1',
  },
  ascend910c: {
    kind: 'ascend910c',
    vendor: 'huawei',
    title: '华为昇腾 Ascend 910C 64GB',
    short: 'Ascend 910C',
    memoryGb: 64,
    tdpW: 400,
    idleW: [75, 115],
    memClockGhz: 1.7,
    smBoostGhz: 1.9,
    smBaseGhz: 1.25,
    dramPeakGBs: 1800,
    nvlinkPeakGBs: 392,
    fabricName: 'HCCS',
    fp32Tflops: 55,
    fp16TensorTflops: 380,
    fp8TensorTflops: 760,
    driverLabel: 'CANN 8.0.RC2',
  },
  mlu590: {
    kind: 'mlu590',
    vendor: 'cambricon',
    title: '寒武纪思元 MLU590 48GB',
    short: '思元 590',
    memoryGb: 48,
    tdpW: 350,
    idleW: [50, 85],
    memClockGhz: 1.5,
    smBoostGhz: 1.6,
    smBaseGhz: 1.1,
    dramPeakGBs: 1200,
    nvlinkPeakGBs: 300,
    fabricName: 'MLU-Link',
    fp32Tflops: 30,
    fp16TensorTflops: 256,
    fp8TensorTflops: 512,
    driverLabel: 'CNTToolKit 4.0',
  },
  hygon: {
    kind: 'hygon',
    vendor: 'hygon',
    title: '海光深算二号 DCU 32GB',
    short: '深算二号',
    memoryGb: 32,
    tdpW: 300,
    idleW: [45, 75],
    memClockGhz: 1.2,
    smBoostGhz: 1.5,
    smBaseGhz: 1.0,
    dramPeakGBs: 800,
    nvlinkPeakGBs: 200,
    fabricName: 'xGMI',
    fp32Tflops: 18,
    fp16TensorTflops: 144,
    fp8TensorTflops: 0,
    driverLabel: 'DTK 24.04',
  },
  br104: {
    kind: 'br104',
    vendor: 'biren',
    title: '壁仞 BR104 32GB',
    short: 'BR104 32GB',
    memoryGb: 32,
    tdpW: 300,
    idleW: [50, 85],
    memClockGhz: 1.4,
    smBoostGhz: 1.55,
    smBaseGhz: 1.05,
    dramPeakGBs: 819,
    nvlinkPeakGBs: 256,
    fabricName: 'BR-Link',
    fp32Tflops: 16,
    fp16TensorTflops: 256,
    fp8TensorTflops: 512,
    driverLabel: 'BRdriver 1.6',
  },
}

/** 盘点与调度主推 SKU：国产仅保留昇腾 / 思元等主流、开源模型可适配型号 */
export const SKU_KIND_ORDER: SkuKind[] = [
  'h100',
  'h200',
  'h20',
  'a800',
  'a100sxm',
  'a100pcie',
  'v100',
  'rtx5090',
  'rtx4060',
  'ascend910b',
  'ascend910c',
  'mlu590',
]

/** 机箱布局：4 / 8 / 16 / 32 槽；同型号或同节点合理混卡 */
export type ChassisLayout = { kind: SkuKind; count: number }[]

/**
 * 同卡满配：单一 SKU / 单一软件栈 / 单一互联域
 */
export const HOMOGENEOUS_LAYOUTS: ChassisLayout[] = [
  // 4 槽 · PCIe 工作站 / 入门推理箱
  [{ kind: 'rtx5090', count: 4 }],
  [{ kind: 'rtx4060', count: 4 }],
  [{ kind: 'a100pcie', count: 4 }],
  [{ kind: 'v100', count: 4 }],
  // 8 槽 · 数据中心整机
  [{ kind: 'h100', count: 8 }],
  [{ kind: 'h200', count: 8 }],
  [{ kind: 'h20', count: 8 }],
  [{ kind: 'a800', count: 8 }],
  [{ kind: 'a100sxm', count: 8 }],
  [{ kind: 'ascend910b', count: 8 }],
  [{ kind: 'ascend910c', count: 8 }],
  [{ kind: 'mlu590', count: 8 }],
  // 16 / 32 槽 · 大机柜
  [{ kind: 'h100', count: 16 }],
  [{ kind: 'h200', count: 16 }],
  [{ kind: 'ascend910c', count: 16 }],
  [{ kind: 'mlu590', count: 16 }],
  [{ kind: 'h100', count: 32 }],
  [{ kind: 'ascend910b', count: 32 }],
  [{ kind: 'ascend910c', count: 32 }],
]

/**
 * 同节点混卡：仅保留现场常见、可共板共栈的组合
 * - 同厂商、同驱动/框架栈
 * - 同形态（GeForce PCIe / 昇腾 HCCS / Hopper HGX）
 * - 用途分层（大模型主力卡 + 小模型/Embedding 辅卡）或同代演进（910B→910C、H100→H200）
 * 禁止：NVIDIA↔昇腾/思元跨栈、SXM↔PCIe 硬拼、跨代 NVLink 域混插
 */
export const MIXED_LAYOUTS: ChassisLayout[] = [
  // GeForce PCIe 工作站：主力推理 + 轻量辅卡（功耗/供电同域）
  [
    { kind: 'rtx5090', count: 4 },
    { kind: 'rtx4060', count: 4 },
  ],
  [
    { kind: 'rtx5090', count: 2 },
    { kind: 'rtx4060', count: 2 },
  ],
  [
    { kind: 'rtx5090', count: 6 },
    { kind: 'rtx4060', count: 2 },
  ],
  // Hopper HGX 同代演进：显存升级半柜刷新（同 NVLink 域）
  [
    { kind: 'h100', count: 4 },
    { kind: 'h200', count: 4 },
  ],
  [
    { kind: 'h100', count: 8 },
    { kind: 'h200', count: 8 },
  ],
  // 中国市场 Hopper：H20 推理主力 + 少量 H100 训推共用（同 HGX 形态）
  [
    { kind: 'h20', count: 6 },
    { kind: 'h100', count: 2 },
  ],
  // Ampere SXM：A800（合规款）与 A100-SXM 同框过渡
  [
    { kind: 'a800', count: 4 },
    { kind: 'a100sxm', count: 4 },
  ],
  // 昇腾同家族演进：910B → 910C 滚动升级（同 HCCS / CANN）
  [
    { kind: 'ascend910b', count: 4 },
    { kind: 'ascend910c', count: 4 },
  ],
  [
    { kind: 'ascend910b', count: 8 },
    { kind: 'ascend910c', count: 8 },
  ],
  [
    { kind: 'ascend910b', count: 2 },
    { kind: 'ascend910c', count: 6 },
  ],
]

/** 全部机箱布局（同卡 + 合理混卡） */
export const CHASSIS_LAYOUTS: ChassisLayout[] = [...HOMOGENEOUS_LAYOUTS, ...MIXED_LAYOUTS]

export function isMixedLayout(layout: ChassisLayout) {
  return layout.length > 1
}

/** 模型 → 优先卡型（调度亲和，均选取可跑对应开源/商用权重的主流卡） */
export const MODEL_GPU_AFFINITY: Record<string, SkuKind[]> = {
  'MiniMax-H3': ['rtx5090', 'h20', 'h100'],
  'MiniMax-M2': ['rtx5090', 'rtx4060', 'h20'],
  'Qwen-7B-Chat': ['v100', 'rtx4060', 'a100pcie'],
  'Qwen2.5-14B': ['v100', 'a100pcie', 'a800'],
  'Qwen2.5-32B': ['a100sxm', 'a800', 'h20'],
  'Qwen2.5-72B': ['h100', 'h200', 'h20'],
  'Qwen2.5-14B-SFT': ['a800', 'a100sxm', 'h20'],
  'Llama-3-70B-Instruct': ['h100', 'h200', 'a100sxm'],
  'DeepSeek-V4': ['ascend910c', 'ascend910b', 'mlu590'],
  'DeepSeek-V3-671B': ['ascend910c', 'ascend910b', 'h200', 'h100'],
  'InternVL2-40B': ['mlu590', 'ascend910b', 'a800'],
  'InternVL2-Dev': ['rtx4060', 'rtx5090', 'v100'],
  'Whisper-Large-V3': ['rtx4060', 'v100', 'a100pcie'],
  'BGE-M3': ['rtx4060', 'v100', 'a100pcie'],
  'GLM-4-9B': ['rtx5090', 'h20', 'a100pcie'],
}

export function resolveSkuKind(gpuModel: string): SkuKind {
  const text = gpuModel.toLowerCase()
  if (text.includes('910c')) return 'ascend910c'
  if (text.includes('910b') || text.includes('ascend') || text.includes('昇腾')) return 'ascend910b'
  if (text.includes('mlu590') || text.includes('思元 590') || text.includes('思元590')) return 'mlu590'
  if (text.includes('mlu370') || text.includes('寒武纪') || text.includes('cambricon') || text.includes('思元'))
    return 'mlu590'
  // 非主推国产卡归并到思元 590，避免盘点出现非开源适配型号
  if (text.includes('深算') || text.includes('hygon') || text.includes('dcu') || text.includes('海光')) return 'mlu590'
  if (text.includes('br104') || text.includes('壁仞') || text.includes('biren')) return 'mlu590'
  if (text.includes('5090')) return 'rtx5090'
  if (text.includes('4060')) return 'rtx4060'
  if (text.includes('h200')) return 'h200'
  if (text.includes('h20')) return 'h20'
  if (text.includes('h100')) return 'h100'
  if (text.includes('a800')) return 'a800'
  if (text.includes('a100') && text.includes('pcie')) return 'a100pcie'
  if (text.includes('a100')) return 'a100sxm'
  if (text.includes('v100')) return 'v100'
  return 'h100'
}

export function specForModel(gpuModel: string): GpuSkuSpec {
  return GPU_SPECS[resolveSkuKind(gpuModel)]
}

export function isDomesticSku(kind: SkuKind) {
  return GPU_SPECS[kind].vendor !== 'nvidia'
}

export function supportsFp8(kind: SkuKind) {
  return GPU_SPECS[kind].fp8TensorTflops > 0
}

export function preferredSkusForModel(model: string): SkuKind[] {
  if (MODEL_GPU_AFFINITY[model]) return MODEL_GPU_AFFINITY[model]
  const lower = model.toLowerCase()
  if (lower.includes('minimax') || lower.includes('glm')) return ['rtx5090', 'h20', 'h100']
  if (lower.includes('deepseek') || lower.includes('昇腾')) return ['ascend910c', 'ascend910b', 'mlu590']
  if (lower.includes('qwen') || lower.includes('千问')) return ['v100', 'a100pcie', 'a800']
  if (lower.includes('llama')) return ['h100', 'h200', 'a100sxm']
  return ['h100', 'a800', 'a100sxm']
}

export function expandLayout(layout: ChassisLayout): SkuKind[] {
  const slots: SkuKind[] = []
  layout.forEach((part) => {
    for (let i = 0; i < part.count; i++) slots.push(part.kind)
  })
  return slots
}

/**
 * 机箱底板功耗（CPU / 内存 / 网卡 / PSU 损耗），随槽位规模贴近真实机柜：
 * 4 卡工作站 ~0.3–0.5 kW；8 卡 HGX ~0.9–1.3 kW；16 卡 ~1.9–2.5 kW；32 卡 ~3.6–4.5 kW
 */
export function estimateChassisBaseW(slotCount: number, jitter01 = 0.5): number {
  const j = Math.max(0, Math.min(1, jitter01))
  if (slotCount <= 4) return Math.round(320 + j * 160)
  if (slotCount <= 8) return Math.round(950 + j * 380)
  if (slotCount <= 16) return Math.round(1900 + j * 600)
  return Math.round(3600 + j * 900)
}

export function summarizeCardModels(cardModels: string[]): string {
  const counts = new Map<string, number>()
  cardModels.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1))
  const parts = [...counts.entries()].map(([name, n]) => {
    const short = GPU_SPECS[resolveSkuKind(name)]?.short ?? name
    return n > 1 ? `${short}×${n}` : short
  })
  return parts.join(' + ')
}

export function estimateGpuPowerW(spec: GpuSkuSpec, utilization: number, jitter = 0) {
  const util = Math.max(0, Math.min(100, utilization)) / 100
  const idle = (spec.idleW[0] + spec.idleW[1]) / 2
  return Math.round(Math.min(spec.tdpW, idle + util * (spec.tdpW - idle) + jitter))
}

export const CHASSIS_BASE_W = 1100

export function estimateServerPowerW(gpuPowerSum: number, slotCount = 8, chassisJitter01 = 0.5) {
  return Math.round(gpuPowerSum + estimateChassisBaseW(slotCount, chassisJitter01))
}

export function estimateGpuTempC(utilization: number, bias = 0, jitter = 0) {
  const util = Math.max(0, Math.min(100, utilization)) / 100
  return Math.round((36 + util * 42 + bias + jitter) * 10) / 10
}

export function fleetWeightedSpec(models: string[]): GpuSkuSpec {
  if (!models.length) return GPU_SPECS.h100
  const counts = Object.fromEntries(SKU_KIND_ORDER.map((kind) => [kind, 0])) as Record<SkuKind, number>
  for (const model of models) counts[resolveSkuKind(model)] += 1
  const total = models.length
  const blend = (pick: (spec: GpuSkuSpec) => number) =>
    SKU_KIND_ORDER.reduce((sum, kind) => sum + counts[kind] * pick(GPU_SPECS[kind]), 0) / total
  const primary = SKU_KIND_ORDER.reduce((best, kind) => (counts[kind] > counts[best] ? kind : best), 'h100' as SkuKind)
  return {
    ...GPU_SPECS[primary],
    tdpW: blend((s) => s.tdpW),
    memClockGhz: blend((s) => s.memClockGhz),
    smBoostGhz: blend((s) => s.smBoostGhz),
    smBaseGhz: blend((s) => s.smBaseGhz),
    dramPeakGBs: blend((s) => s.dramPeakGBs),
    nvlinkPeakGBs: blend((s) => s.nvlinkPeakGBs),
    fp32Tflops: blend((s) => s.fp32Tflops),
    fp16TensorTflops: blend((s) => s.fp16TensorTflops),
    fp8TensorTflops: blend((s) => s.fp8TensorTflops),
  }
}
