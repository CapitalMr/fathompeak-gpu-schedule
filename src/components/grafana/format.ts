import type { ServerNode, Workload } from '../../types'

export type FlowScene = 'A' | 'B' | 'C'

export const SCENE_COLOR: Record<FlowScene, string> = {
  A: '#06B6D4',
  B: '#8B5CF6',
  C: '#F59E0B',
}

export const SCENE_TITLE: Record<FlowScene, string> = {
  A: '单卡推理调度',
  B: '单机 NVLink 协同',
  C: '跨中心多机 RDMA',
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function displayHostname(hostname: string) {
  const matched = hostname.match(/^pool-(east|core)-(\d+)-n(\d+)$/i)
  if (!matched) return hostname
  const region = matched[1].toLowerCase() === 'core' ? 'xj' : matched[2] === '02' ? 'js' : 'bj'
  return `fp-cluster-${region}-node${matched[3]}`
}

export function gpuUuid(serverId: string, index: number) {
  let h = 2166136261
  const source = `${serverId}:${index}:fathompeak`
  for (let i = 0; i < source.length; i++) h = Math.imul(h ^ source.charCodeAt(i), 16777619)
  const bytes = Array.from({ length: 16 }, (_, i) => {
    h = Math.imul(h ^ (i + 1), 16777619)
    return (h >>> 0) & 0xff
  })
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `GPU-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function flowScene(workload: Workload): FlowScene {
  if (workload.allocations.length > 1 || workload.gpuCount > 8) return 'C'
  if (workload.gpuCount >= 2 || workload.strategy === 'tp') return 'B'
  return 'A'
}

export function strategyTag(workload: Workload) {
  if (workload.strategy === 'pp' || workload.allocations.length > 1 || workload.gpuCount > 8) return 'Gang 成组调度'
  if (workload.strategy === 'tp' || workload.gpuCount > 1) return 'NVLink 亲和性'
  return 'Binpack 装箱'
}

export function wave(seed: number, tick: number) {
  return Math.sin(seed * 1.7 + tick * 0.73)
}

export interface ChassisModel {
  id: string
  hostname: string
  displayHost: string
  boardLabel: string
  fabricLabel: string
  fabricPeakGBs: number
  active: number[]
  slots: Array<{
    index: number
    active: boolean
    mem: number
    temp: number
    sm: number
    bandwidth: number
    tokens: number
    uuid: string
  }>
}

function boardMeta(gpuModel?: string) {
  const text = (gpuModel ?? '').toLowerCase()
  if (text.includes('910b') || text.includes('ascend') || text.includes('昇腾')) {
    return { boardLabel: '昇腾 910B · 8× 64GB', fabricLabel: 'HCCS', fabricPeakGBs: 392, memCap: 64 }
  }
  if (text.includes('mlu370') || text.includes('寒武纪')) {
    return { boardLabel: 'MLU370-X8 · 8× 48GB', fabricLabel: 'MLU-Link', fabricPeakGBs: 200, memCap: 48 }
  }
  if (text.includes('br104') || text.includes('壁仞')) {
    return { boardLabel: 'BR104 · 8× 32GB', fabricLabel: 'BR-Link', fabricPeakGBs: 256, memCap: 32 }
  }
  if (text.includes('a800')) {
    return { boardLabel: 'HGX A800 · 8× 80GB', fabricLabel: 'NVLink', fabricPeakGBs: 600, memCap: 80 }
  }
  if (text.includes('a100')) {
    return { boardLabel: 'HGX A100 · 8× 80GB', fabricLabel: 'NVLink', fabricPeakGBs: 600, memCap: 80 }
  }
  return { boardLabel: 'HGX H100 · 8× HBM3', fabricLabel: 'NVLink', fabricPeakGBs: 900, memCap: 80 }
}

export function buildChassis(workload: Workload, servers: ServerNode[], tick: number): ChassisModel[] {
  const scene = flowScene(workload)
  const perGpu =
    workload.tokensPerSec > 0 ? workload.tokensPerSec / Math.max(1, workload.gpuCount) : 0

  const specs =
    workload.allocations.length > 0
      ? workload.allocations.slice(0, 4).map((allocation) => ({
          id: allocation.serverId,
          hostname: allocation.hostname,
          indices:
            scene === 'C'
              ? [0, 1, 2, 3, 4, 5, 6, 7]
              : allocation.gpuIndices.length > 0
                ? allocation.gpuIndices
                : [2],
        }))
      : [
          {
            id: 'virtual-node',
            hostname: 'fp-cluster-js-node08',
            indices: scene === 'A' ? [2] : scene === 'B' ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7],
          },
        ]

  if (scene === 'C' && specs.length === 1 && workload.gpuCount > 8) {
    const extra = Math.min(4, Math.ceil(workload.gpuCount / 8)) - 1
    for (let i = 0; i < extra; i++) {
      specs.push({
        id: `virtual-node-${i + 2}`,
        hostname: `fp-cluster-js-node${String(i + 9).padStart(2, '0')}`,
        indices: [0, 1, 2, 3, 4, 5, 6, 7],
      })
    }
  }

  return specs.map((spec) => {
    const server = servers.find((item) => item.id === spec.id)
    const meta = boardMeta(server?.gpuModel)
    const active = new Set(spec.indices)
    return {
      id: spec.id,
      hostname: spec.hostname,
      displayHost: displayHostname(spec.hostname),
      boardLabel: meta.boardLabel,
      fabricLabel: meta.fabricLabel,
      fabricPeakGBs: meta.fabricPeakGBs,
      active: spec.indices,
      slots: Array.from({ length: 8 }, (_, index) => {
        const gpu = server?.gpus[index]
        const on = active.has(index)
        const wobble = wave(index + spec.id.length, tick)
        const memCap = gpu?.memoryTotalGb ?? meta.memCap
        const memBase = gpu?.memoryUsedGb ?? (on ? memCap * 0.72 : 1.6)
        const tempBase = gpu?.temperature ?? (on ? 72 : 38)
        const utilBase = gpu?.utilization ?? (on ? 80 : 3)
        const mem = clamp(memBase + wobble * 0.45, 0.4, memCap - 0.2)
        const temp = clamp(tempBase + wobble * 0.8, 31, 93)
        const sm = on ? clamp(utilBase + wobble * 2.4, 12, 99) : clamp(2 + Math.abs(wobble) * 3, 0, 9)
        const peakBw = meta.fabricPeakGBs
        const bandwidth = on
          ? clamp(peakBw * (0.35 + sm / 200) + wobble * (peakBw * 0.08), peakBw * 0.2, peakBw * 0.95)
          : clamp(8 + Math.abs(wobble) * 12, 4, 40)
        const tokens = on ? Math.max(0, perGpu + wobble * 1.2) : 0
        return {
          index,
          active: on,
          mem,
          temp,
          sm,
          bandwidth,
          tokens,
          uuid: gpuUuid(spec.id, index),
        }
      }),
    }
  })
}
