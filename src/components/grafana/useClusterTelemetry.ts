import { useEffect, useRef, useState } from 'react'
import type { ServerNode } from '../../types'
import { DEMO_DEPTH, DEMO_TICK_MS, stationDemo } from '../monitor/stationDemo'
import { fleetWeightedSpec, resolveSkuKind, supportsFp8 } from '../monitor/gpuSpecs'
import { clamp, wave } from './format'

export interface TelemetrySample {
  t: number
  totalGpus: number
  activeGpus: number
  /** 集群平均 GPU Util / SM Active（含空闲卡，贴近 DCGM 集群均值） */
  sm: number
  /** Tensor Active：推理/训练 Tensor Core 活跃度，通常 ≤ SM */
  tensor: number
  /** DRAM Active：HBM 活跃占比 */
  dram: number
  vramUsedTb: number
  vramTotalTb: number
  /** GPU+机箱功耗合计 kW */
  powerKw: number
  avgTempC: number
  hotspotC: number
  xid: number
  /** Pipe 精度占比，合计约 100 */
  bf16: number
  fp8: number
  fp32: number
  /** 活跃多卡节点上的卡间互联平均吞吐 GB/s（NVLink/HCCS/MLU-Link 等） */
  nvlink: number
  fabricName: string
  /** 跨机 RDMA 平均吞吐 GB/s */
  rdma: number
  /** 加权规格，供图表换算 TFLOPS / 带宽 */
  peakDramGBs: number
  peakNvlinkGBs: number
  peakFp32: number
  peakFp16: number
  peakFp8: number
  smBoostGhz: number
  smBaseGhz: number
  memClockGhz: number
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function measureServers(servers: ServerNode[], tick: number, stationId = 'st-hbsz'): Omit<TelemetrySample, 't'> {
  const profile = stationDemo(stationId)
  const models = servers.flatMap((server) => server.gpus.map((gpu) => gpu.cardModel || server.gpuModel))
  const spec = fleetWeightedSpec(models)
  const gpus = servers.flatMap((server) => server.gpus)
  const totalGpus = gpus.length
  const live = gpus.filter((gpu) => gpu.state !== 'fault')
  const busy = live.filter((gpu) => gpu.state !== 'idle')
  const activeGpus = busy.length

  const avg = (values: number[], fallback = 0) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback

  // 集群均值含空闲卡；再叠站点 mood 偏置（±），体现园区负载差异
  const utilFleet = avg(
    live.map((gpu) => gpu.utilization),
    4,
  )
  const utilBusy = avg(
    busy.map((gpu) => gpu.utilization),
    utilFleet,
  )
  const drift = Math.sin(tick / 9.5) * 2.2 + Math.sin(tick / 17) * 1.1
  const sm = clamp(utilFleet + profile.smBias * 0.35 + drift + wave(3, tick) * 1.6, 1, 98)

  // LLM/多模态推理：Tensor Active 通常接近 SM；纯 CUDA 核会更低
  const tensorShare = busy.some((gpu) => gpu.state === 'multi' || gpu.state === 'gang') ? 0.92 : 0.78
  const tensor = clamp(sm * tensorShare + profile.tensorBias * 0.25 + wave(4, tick) * 2.4, 1, 99)

  // HBM Active：显存占用高且 util 高时升高（DCGM DRAM Active）
  const memOcc = avg(
    live.map((gpu) => (gpu.memoryUsedGb / Math.max(1, gpu.memoryTotalGb)) * 100),
    8,
  )
  const dram = clamp(memOcc * 0.55 + sm * 0.35 + profile.dramBias * 0.2 + wave(5, tick) * 2.8, 3, 98)

  const usedGb = gpus.reduce((sum, gpu) => sum + gpu.memoryUsedGb, 0)
  const totalGb = gpus.reduce((sum, gpu) => sum + gpu.memoryTotalGb, 0)
  const vramUsedTb = usedGb / 1024
  const vramTotalTb = Math.max(0.1, totalGb / 1024)

  // 机柜功率 = 各节点 server.powerW（已含 GPU TDP 路径 + 机箱底噪）
  const powerKw = Math.max(
    0,
    (servers.reduce((sum, server) => sum + server.powerW, 0) / 1000) * profile.powerMul + wave(7, tick) * 0.35,
  )

  const temps = live.map((gpu) => gpu.temperature)
  const avgTempC = clamp(avg(temps, 40) + profile.tempBias * 0.15 + wave(12, tick) * 0.6, 28, 92)
  const hotspotC = clamp(avgTempC + 7 + (utilBusy / 100) * 5 + Math.abs(wave(13, tick)) * 1.2, avgTempC + 3, 96)

  // 精度 Pipe：LLM 推理以 BF16/FP8 为主；H100 / 昇腾 910B / BR104 有 FP8 路径
  const fp8Capable = models.some((model) => supportsFp8(resolveSkuKind(model)))
  let fp8 = fp8Capable
    ? clamp(22 + (utilBusy / 100) * 28 + profile.tensorBias * 0.15 + wave(8, tick) * 3, 8, 58)
    : clamp(4 + wave(8, tick), 2, 12)
  let bf16 = clamp(34 + (utilBusy / 100) * 18 + wave(9, tick) * 3, 18, 62)
  let fp32 = 100 - fp8 - bf16
  if (fp32 < 8) {
    const scale = (100 - 8) / (fp8 + bf16)
    fp8 *= scale
    bf16 *= scale
    fp32 = 8
  }

  // NVLink：仅 multi/gang（TP/PP 单机段）有显著流量；峰值按加权规格
  const nvlinkGpus = gpus.filter((gpu) => gpu.state === 'multi' || gpu.state === 'gang')
  const nvlinkUtil = nvlinkGpus.length
    ? avg(nvlinkGpus.map((gpu) => gpu.utilization), 40) / 100
    : 0
  const nvlink = clamp(
    nvlinkGpus.length
      ? spec.nvlinkPeakGBs * (0.12 + nvlinkUtil * 0.48) * profile.nvlinkMul + wave(10, tick) * 18
      : 4 + wave(10, tick) * 2,
    0,
    spec.nvlinkPeakGBs * 0.85,
  )

  // RDMA：跨机 gang / PP；节点标称 rdmaGbps→GB/s = /8
  const gangServers = servers.filter((server) => server.gpus.some((gpu) => gpu.state === 'gang'))
  const nicGBs = avg(
    servers.map((server) => server.rdmaGbps / 8),
    25,
  )
  const rdma = clamp(
    gangServers.length
      ? nicGBs * (0.35 + (utilBusy / 100) * 0.45) * gangServers.length * 0.55 * profile.rdmaMul + wave(11, tick) * 4
      : nicGBs * 0.05 + wave(11, tick),
    0.5,
    nicGBs * Math.max(1, gangServers.length) * 0.9,
  )

  return {
    totalGpus,
    activeGpus,
    sm: round1(sm),
    tensor: round1(tensor),
    dram: round1(dram),
    vramUsedTb: round2(Math.min(vramUsedTb, vramTotalTb * 0.98)),
    vramTotalTb: round2(vramTotalTb),
    powerKw: round1(powerKw * profile.powerMul),
    avgTempC: round1(avgTempC),
    hotspotC: round1(hotspotC),
    xid: 0,
    bf16: round1(bf16),
    fp8: round1(fp8),
    fp32: round1(fp32),
    nvlink: round1(nvlink),
    rdma: round1(rdma),
    fabricName: spec.fabricName,
    peakDramGBs: Math.round(spec.dramPeakGBs),
    peakNvlinkGBs: Math.round(spec.nvlinkPeakGBs),
    peakFp32: round1(spec.fp32Tflops),
    peakFp16: round1(spec.fp16TensorTflops),
    peakFp8: round1(spec.fp8TensorTflops),
    smBoostGhz: round2(spec.smBoostGhz),
    smBaseGhz: round2(spec.smBaseGhz),
    memClockGhz: round2(spec.memClockGhz),
  }
}

function seed(servers: ServerNode[], stationId: string, now: number): TelemetrySample[] {
  return Array.from({ length: DEMO_DEPTH }, (_, index) => ({
    ...measureServers(servers, index, stationId),
    t: now - (DEMO_DEPTH - 1 - index) * DEMO_TICK_MS,
  }))
}

export function useClusterTelemetry(servers: ServerNode[], stationId = 'st-hbsz') {
  const serversRef = useRef(servers)
  serversRef.current = servers
  const stationRef = useRef(stationId)
  stationRef.current = stationId
  const tickRef = useRef(DEMO_DEPTH)
  const [history, setHistory] = useState<TelemetrySample[]>(() => seed(servers, stationId, Date.now()))

  useEffect(() => {
    tickRef.current = DEMO_DEPTH
    setHistory(seed(serversRef.current, stationId, Date.now()))
    const timer = window.setInterval(() => {
      tickRef.current += 1
      setHistory((prev) => {
        const sample: TelemetrySample = {
          ...measureServers(serversRef.current, tickRef.current, stationRef.current),
          t: Date.now(),
        }
        const base = prev.length >= DEMO_DEPTH ? prev.slice(prev.length - DEMO_DEPTH + 1) : prev
        return [...base, sample]
      })
    }, DEMO_TICK_MS)
    return () => window.clearInterval(timer)
  }, [stationId])

  return history
}
