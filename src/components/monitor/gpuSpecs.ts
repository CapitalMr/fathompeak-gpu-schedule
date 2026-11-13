/**
 * 智算卡公开规格锚点（mock 量纲依据，非随意数值）
 * - NVIDIA：H100 / A100 datasheet、nvidia-smi / DCGM 字段
 * - 华为昇腾 910B：公开资料约 64GB HBM、~400W、Cube FP16 ~320 TFLOPS、HCCS 互联
 * - 寒武纪 MLU370-X8：约 48GB、~250W、INT8/FP16 推理卡
 * - 壁仞 BR104：约 32GB HBM2e、~300W、自研互联
 */

export type SkuKind = 'h100' | 'a800' | 'a100' | 'ascend910b' | 'mlu370' | 'br104'

export type Vendor = 'nvidia' | 'huawei' | 'cambricon' | 'biren'

export interface GpuSkuSpec {
  kind: SkuKind
  vendor: Vendor
  title: string
  short: string
  memoryGb: number
  /** 典型 TDP（W） */
  tdpW: number
  idleW: [number, number]
  /** Memory / HBM 时钟（GHz，厂商工具常见读数） */
  memClockGhz: number
  /** 计算核 Boost 时钟（GHz） */
  smBoostGhz: number
  smBaseGhz: number
  /** 显存峰值带宽 GB/s */
  dramPeakGBs: number
  /** 卡间互联峰值 GB/s（NVLink / HCCS / MLU-Link / BR-Link） */
  nvlinkPeakGBs: number
  fabricName: string
  fp32Tflops: number
  fp16TensorTflops: number
  fp8TensorTflops: number
  /** 管理面驱动展示名 */
  driverLabel: string
}

export const GPU_SPECS: Record<SkuKind, GpuSkuSpec> = {
  h100: {
    kind: 'h100',
    vendor: 'nvidia',
    title: 'NVIDIA H100 80GB HBM3',
    short: 'H100 80GB HBM3',
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
  a800: {
    kind: 'a800',
    vendor: 'nvidia',
    title: 'NVIDIA A800-SXM4-80GB',
    short: 'A800-SXM4-80GB',
    memoryGb: 80,
    tdpW: 400,
    idleW: [55, 95],
    memClockGhz: 1.593,
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
  a100: {
    kind: 'a100',
    vendor: 'nvidia',
    title: 'NVIDIA A100-SXM4-80GB',
    short: 'A100-SXM4-80GB',
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
  ascend910b: {
    kind: 'ascend910b',
    vendor: 'huawei',
    title: '华为昇腾 Ascend 910B 64GB',
    short: 'Ascend 910B 64GB',
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
  mlu370: {
    kind: 'mlu370',
    vendor: 'cambricon',
    title: '寒武纪 MLU370-X8 48GB',
    short: 'MLU370-X8 48GB',
    memoryGb: 48,
    tdpW: 250,
    idleW: [45, 75],
    memClockGhz: 1.35,
    smBoostGhz: 1.5,
    smBaseGhz: 1.0,
    dramPeakGBs: 614,
    nvlinkPeakGBs: 200,
    fabricName: 'MLU-Link',
    fp32Tflops: 12,
    fp16TensorTflops: 96,
    fp8TensorTflops: 0,
    driverLabel: 'CNTToolKit 3.8',
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

export const SKU_KIND_ORDER: SkuKind[] = ['h100', 'a800', 'a100', 'ascend910b', 'mlu370', 'br104']

export function resolveSkuKind(gpuModel: string): SkuKind {
  const text = gpuModel.toLowerCase()
  if (text.includes('910b') || text.includes('ascend') || text.includes('昇腾')) return 'ascend910b'
  if (text.includes('mlu370') || text.includes('寒武纪') || text.includes('cambricon')) return 'mlu370'
  if (text.includes('br104') || text.includes('壁仞') || text.includes('biren')) return 'br104'
  if (text.includes('a800')) return 'a800'
  if (text.includes('a100')) return 'a100'
  if (text.includes('h100')) return 'h100'
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

/** 按利用率估算单卡功耗：空闲底噪 + util×(TDP−idle) */
export function estimateGpuPowerW(spec: GpuSkuSpec, utilization: number, jitter = 0) {
  const util = Math.max(0, Math.min(100, utilization)) / 100
  const idle = (spec.idleW[0] + spec.idleW[1]) / 2
  return Math.round(Math.min(spec.tdpW, idle + util * (spec.tdpW - idle) + jitter))
}

export const CHASSIS_BASE_W = 1100

export function estimateServerPowerW(gpuPowerSum: number, chassisJitter = 0) {
  return Math.round(gpuPowerSum + CHASSIS_BASE_W + chassisJitter)
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
