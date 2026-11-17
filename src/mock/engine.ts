import type {
  Allocation,
  AppState,
  AuditEvent,
  ClusterMetrics,
  GpuSlot,
  GpuState,
  NodePool,
  PowerStation,
  ProjectQuota,
  PolicyFlag,
  ScheduleStrategy,
  ServerNode,
  Workload,
  WorkloadEvent,
  WorkloadPod,
  WorkloadType,
} from '../types'
import {
  HOMOGENEOUS_LAYOUTS,
  MIXED_LAYOUTS,
  GPU_SPECS,
  estimateChassisBaseW,
  expandLayout,
  preferredSkusForModel,
  resolveSkuKind,
  summarizeCardModels,
  type ChassisLayout,
  type SkuKind,
} from '../components/monitor/gpuSpecs'
import { CLUSTERS, DEPARTMENTS, POOL_SOURCES, clusterOfServer } from '../platform/model'
import { seedQueuedWorkloads } from './queue'

const USER = 'wangxiaoliang@fathompeak.cn'

function gpuSpec(cardOrChassis: string) {
  const spec = GPU_SPECS[resolveSkuKind(cardOrChassis)]
  return {
    memoryGb: spec.memoryGb,
    tdpW: spec.tdpW,
    idleW: Math.round((spec.idleW[0] + spec.idleW[1]) / 2),
    vendor: spec.vendor,
    title: spec.title,
  }
}

function cardTitle(kind: SkuKind) {
  return GPU_SPECS[kind].title
}

/** 按卡型亲和度打分：优先匹配模型推荐 SKU */
function affinityScore(cardModel: string, preferred: SkuKind[]) {
  const kind = resolveSkuKind(cardModel)
  const idx = preferred.indexOf(kind)
  if (idx >= 0) return 100 - idx * 12
  return 0
}

/**
 * 电站容量为「园区绿电接入配额」（可专供本智算节点池），而非上游风电场/光伏场总装机。
 * 量级对齐约 150 机 / ~0.5–0.8 MW IT 负荷 + PUE 冗余，并保留日内调度空间。
 */
export const STATIONS: PowerStation[] = [
  {
    id: 'st-bjdx',
    name: '北京大兴园区分布式光伏',
    type: '分布式光伏',
    region: '北京大兴',
    capacityMw: 4.8,
    currentMw: 3.2,
    greenRatio: 0.91,
  },
  {
    id: 'st-hbsz',
    name: '河北深州园区集中式光伏',
    type: '集中式光伏',
    region: '河北深州',
    capacityMw: 8.5,
    currentMw: 6.1,
    greenRatio: 0.94,
  },
  {
    id: 'st-xj',
    name: '新疆哈密园区集中式光伏',
    type: '集中式光伏',
    region: '新疆哈密',
    capacityMw: 12.0,
    currentMw: 8.9,
    greenRatio: 0.96,
  },
  {
    id: 'st-tj',
    name: '天津滨海园区分布式光伏',
    type: '分布式光伏',
    region: '天津滨海',
    capacityMw: 3.6,
    currentMw: 2.3,
    greenRatio: 0.88,
  },
  {
    id: 'st-gd',
    name: '广东汕头园区海上风电接入',
    type: '海上风电',
    region: '广东汕头',
    capacityMw: 15.0,
    currentMw: 9.3,
    greenRatio: 0.97,
  },
  {
    id: 'st-jx',
    name: '江西赣州园区水电接入',
    type: '水电',
    region: '江西赣州',
    capacityMw: 10.0,
    currentMw: 7.9,
    greenRatio: 0.99,
  },
  {
    id: 'st-jsgp',
    name: '江苏高邮园区集中式光伏',
    type: '集中式光伏',
    region: '江苏高邮',
    capacityMw: 6.5,
    currentMw: 4.2,
    greenRatio: 0.92,
  },
]

export const POOLS: NodePool[] = [
  {
    id: 'pool-daxing',
    name: 'Pool-大兴',
    label: 'Pool-大兴 [22台]',
    serverCount: 22,
    region: '北京大兴',
    stationIds: ['st-bjdx'],
    x: 180,
    y: 200,
  },
  {
    id: 'pool-tianjin',
    name: 'Pool-滨海',
    label: 'Pool-滨海 [21台]',
    serverCount: 21,
    region: '天津滨海',
    stationIds: ['st-tj'],
    x: 320,
    y: 180,
  },
  {
    id: 'pool-shenzhou',
    name: 'Pool-深州',
    label: 'Pool-深州 [22台]',
    serverCount: 22,
    region: '河北深州',
    stationIds: ['st-hbsz'],
    x: 460,
    y: 220,
  },
  {
    id: 'pool-gaoyou',
    name: 'Pool-高邮',
    label: 'Pool-高邮 [21台]',
    serverCount: 21,
    region: '江苏高邮',
    stationIds: ['st-jsgp'],
    x: 620,
    y: 260,
  },
  {
    id: 'pool-hami',
    name: 'Pool-哈密',
    label: 'Pool-哈密 [22台]',
    serverCount: 22,
    region: '新疆哈密',
    stationIds: ['st-xj'],
    x: 200,
    y: 480,
  },
  {
    id: 'pool-shantou',
    name: 'Pool-汕头',
    label: 'Pool-汕头 [21台]',
    serverCount: 21,
    region: '广东汕头',
    stationIds: ['st-gd'],
    x: 520,
    y: 520,
  },
  {
    id: 'pool-ganzhou',
    name: 'Pool-赣州',
    label: 'Pool-赣州 [21台]',
    serverCount: 21,
    region: '江西赣州',
    stationIds: ['st-jx'],
    x: 700,
    y: 460,
  },
]

export const PROJECTS: ProjectQuota[] = [
  {
    id: 'proj-llm',
    name: 'LLM 预训练平台',
    department: '基础模型事业部',
    guaranteed: 192,
    overQuota: 256,
    used: 0,
    priority: 1,
    preemptible: false,
  },
  {
    id: 'proj-llm-align',
    name: 'LLM 对齐与评测',
    department: '基础模型事业部',
    guaranteed: 64,
    overQuota: 96,
    used: 0,
    priority: 2,
    preemptible: true,
  },
  {
    id: 'proj-mm',
    name: '多模态视觉训练',
    department: '感知智能事业部',
    guaranteed: 96,
    overQuota: 128,
    used: 0,
    priority: 2,
    preemptible: true,
  },
  {
    id: 'proj-mm-serve',
    name: '视觉推理服务',
    department: '感知智能事业部',
    guaranteed: 48,
    overQuota: 64,
    used: 0,
    priority: 2,
    preemptible: true,
  },
  {
    id: 'proj-agent',
    name: 'Agent Serving',
    department: '应用智能事业部',
    guaranteed: 64,
    overQuota: 96,
    used: 0,
    priority: 2,
    preemptible: true,
  },
  {
    id: 'proj-embed',
    name: 'Embedding 检索',
    department: '应用智能事业部',
    guaranteed: 32,
    overQuota: 48,
    used: 0,
    priority: 3,
    preemptible: true,
  },
  {
    id: 'proj-energy',
    name: '算电协同调度',
    department: '基础设施事业部',
    guaranteed: 48,
    overQuota: 64,
    used: 0,
    priority: 3,
    preemptible: true,
  },
  {
    id: 'proj-rd',
    name: '算法预研专项',
    department: '研究院',
    guaranteed: 32,
    overQuota: 48,
    used: 0,
    priority: 4,
    preemptible: true,
  },
  {
    id: 'proj-oss',
    name: '开源模型复现',
    department: '研究院',
    guaranteed: 16,
    overQuota: 32,
    used: 0,
    priority: 4,
    preemptible: true,
  },
]

const POOL_HOST_PREFIX: Record<string, string> = {
  'pool-daxing': 'bjdx',
  'pool-tianjin': 'tjbh',
  'pool-shenzhou': 'hbsz',
  'pool-gaoyou': 'jsgp',
  'pool-hami': 'xjhm',
  'pool-shantou': 'gdst',
  'pool-ganzhou': 'jxgz',
}

export const POLICIES: PolicyFlag[] = [
  {
    id: 'pol-binpack',
    name: 'Binpack 碎片整理优先',
    description: '优先将单卡任务装箱到已有碎片节点，降低空闲整机碎片率',
    enabled: true,
  },
  {
    id: 'pol-nvlink',
    name: '卡间互联亲和拓扑感知',
    description: '单机多卡任务优先调度至 NVLink / HCCS / MLU-Link 拓扑完整且同型号的节点',
    enabled: true,
  },
  {
    id: 'pol-gang',
    name: 'Gang Scheduling 多机成组防死锁',
    description: '跨节点任务需同时获取全部资源后才启动，避免部分占用以致死锁',
    enabled: true,
  },
  {
    id: 'pol-mig',
    name: 'GPU 显存切分隔离',
    description: '允许按卡型亲和与显存配额切分，保障多租户任务隔离',
    enabled: true,
  },
  {
    id: 'pol-green',
    name: '绿电优先算电协同',
    description: '在电站出力高峰时段优先调度至绿电供给充足的节点池',
    enabled: true,
  },
  {
    id: 'pol-preempt',
    name: '低优先级抢占',
    description: '高优先级保底配额不足时可抢占 Over-quota 低优任务',
    enabled: true,
  },
]

function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function layoutsOfSize(layouts: ChassisLayout[], size: number) {
  return layouts.filter((layout) => layout.reduce((n, part) => n + part.count, 0) === size)
}

function pickFrom(layouts: ChassisLayout[], seed: number) {
  if (!layouts.length) return HOMOGENEOUS_LAYOUTS[0]
  const idx = Math.floor(seeded(seed) * layouts.length)
  return layouts[Math.min(idx, layouts.length - 1)]
}

/**
 * 机箱布局权重贴近私有化智算机房：以 8 卡 HGX/Atlas 为主，
 * 少量 4 卡工作站与 16 卡大机柜，极少数 32 卡；混卡约 8%。
 * 目标全舰队约 1100–1300 GPU（150 机）。
 */
function pickChassisLayout(seed: number) {
  const roll = seeded(seed + 41)
  if (roll < 0.72) return pickFrom(layoutsOfSize(HOMOGENEOUS_LAYOUTS, 8), seed + 73)
  if (roll < 0.84) return pickFrom(layoutsOfSize(HOMOGENEOUS_LAYOUTS, 4), seed + 73)
  if (roll < 0.92) return pickFrom(layoutsOfSize(HOMOGENEOUS_LAYOUTS, 16), seed + 73)
  if (roll < 0.95) return pickFrom(layoutsOfSize(HOMOGENEOUS_LAYOUTS, 32), seed + 73)
  const mixed8 = MIXED_LAYOUTS.filter((layout) => layout.reduce((n, part) => n + part.count, 0) === 8)
  return pickFrom(mixed8.length ? mixed8 : MIXED_LAYOUTS, seed + 73)
}

function makeGpu(index: number, seed: number, cardModel: string): GpuSlot {
  const spec = gpuSpec(cardModel)
  const memCap = spec.memoryGb
  // 初始仅空闲/极少数故障；忙碌态一律由 seedInitialWorkloads / allocateGpus 写入，避免「幽灵占用」
  const fault = seeded(seed + index * 19) > 0.994
  const memoryUsedGb = fault ? 0 : Math.round(1.2 + seeded(seed + index) * 2.5)
  const utilization = fault ? 0 : Math.round(seeded(seed + index * 3) * 6)
  const idlePower = Math.max(8, spec.idleW - 12 + Math.round(seeded(seed + index) * 20))

  return {
    index,
    cardModel,
    state: fault ? 'fault' : 'idle',
    memoryUsedGb: Math.min(memoryUsedGb, memCap - 2),
    memoryTotalGb: memCap,
    utilization,
    temperature: fault ? 42 + Math.round(seeded(seed + index) * 8) : 36 + Math.round(seeded(seed + index) * 6),
    powerW: fault ? 0 : idlePower,
  }
}

export function buildServers(): ServerNode[] {
  const servers: ServerNode[] = []
  let globalIdx = 0

  POOLS.forEach((pool, poolIdx) => {
    for (let i = 0; i < pool.serverCount; i++) {
      const row = Math.floor(i / 10)
      const col = i % 10
      const id = `node-${String(globalIdx + 1).padStart(3, '0')}`
      const hostPrefix = POOL_HOST_PREFIX[pool.id] ?? `pool${poolIdx}`
      const hostname = `${hostPrefix}-gpu-n${String(i + 1).padStart(2, '0')}`
      // 业务平面 10.4x；行号映射机柜，列号映射 U 位
      const ip = `10.${40 + poolIdx}.${row + 1}.${col + 10}`
      const seed = globalIdx * 97 + poolIdx * 13
      const layout = pickChassisLayout(seed)
      const slotKinds = expandLayout(layout)
      const gpus = slotKinds.map((kind, gi) => makeGpu(gi, seed, cardTitle(kind)))
      const gpuModel = summarizeCardModels(gpus.map((g) => g.cardModel))
      const gpuPower = gpus.reduce((sum, gpu) => sum + gpu.powerW, 0)
      const chassisBaseW = estimateChassisBaseW(gpus.length, seeded(seed + 7))

      servers.push({
        id,
        hostname,
        ip,
        poolId: pool.id,
        rackRow: row,
        rackCol: col,
        gpuModel,
        gpus,
        nvlinkStatus:
          seeded(seed + 50) > 0.995 ? 'offline' : seeded(seed + 50) > 0.97 ? 'degraded' : 'healthy',
        rdmaGbps: seeded(seed + 61) > 0.35 ? 400 : 200,
        temperature: Math.round(gpus.reduce((sum, gpu) => sum + gpu.temperature, 0) / gpus.length),
        chassisBaseW,
        powerW: gpuPower + chassisBaseW,
        stationIds: pool.stationIds,
      })
      globalIdx++
    }
  })

  return servers
}

function applyGpuLoad(
  gpu: GpuSlot,
  _server: ServerNode,
  state: GpuState,
  model: string,
  workloadId: string,
  memoryUsedGb: number,
  utilization: number,
) {
  const spec = gpuSpec(gpu.cardModel)
  gpu.state = state
  gpu.modelName = model
  gpu.workloadId = workloadId
  gpu.memoryTotalGb = spec.memoryGb
  gpu.memoryUsedGb = Math.min(spec.memoryGb - 2, memoryUsedGb)
  gpu.utilization = utilization
  gpu.temperature = Math.round(36 + (utilization / 100) * 42 + Math.random() * 3)
  gpu.powerW = Math.min(
    spec.tdpW,
    Math.round(spec.idleW + (utilization / 100) * (spec.tdpW - spec.idleW) + Math.random() * 20),
  )
}

function refreshServerPower(server: ServerNode) {
  const chassis =
    server.chassisBaseW || estimateChassisBaseW(server.gpus.length, 0.45)
  server.chassisBaseW = chassis
  server.powerW = server.gpus.reduce((sum, gpu) => sum + gpu.powerW, 0) + chassis
  server.temperature = Math.round(
    server.gpus.reduce((sum, gpu) => sum + gpu.temperature, 0) / Math.max(1, server.gpus.length),
  )
}

function allocateGpus(
  servers: ServerNode[],
  workloadId: string,
  model: string,
  strategy: ScheduleStrategy,
  count: number,
  preferredPool?: string,
): Allocation[] {
  const allocations: Allocation[] = []
  const preferred = preferredSkusForModel(model)
  const poolOrder = preferredPool
    ? [preferredPool, ...POOLS.map((p) => p.id).filter((id) => id !== preferredPool)]
    : POOLS.map((p) => p.id)

  const sortByAffinity = (a: ServerNode, b: ServerNode) => {
    const score = (s: ServerNode) =>
      s.gpus
        .filter((g) => g.state === 'idle')
        .reduce((n, g) => n + affinityScore(g.cardModel, preferred), 0)
    const aBusy = a.gpus.filter((g) => g.state !== 'idle').length
    const bBusy = b.gpus.filter((g) => g.state !== 'idle').length
    return score(b) - score(a) || bBusy - aBusy || a.id.localeCompare(b.id)
  }

  if (strategy === 'single') {
    for (const poolId of poolOrder) {
      const candidates = servers.filter((s) => s.poolId === poolId).sort(sortByAffinity)
      for (const server of candidates) {
        const free = [...server.gpus]
          .filter((g) => g.state === 'idle')
          .sort((a, b) => affinityScore(b.cardModel, preferred) - affinityScore(a.cardModel, preferred))[0]
        if (!free) continue
        const util = 60 + Math.round(Math.random() * 30)
        const cap = gpuSpec(free.cardModel).memoryGb
        applyGpuLoad(free, server, 'infer', model, workloadId, Math.round(cap * (0.25 + Math.random() * 0.35)), util)
        refreshServerPower(server)
        allocations.push({
          poolId,
          serverId: server.id,
          hostname: server.hostname,
          gpuIndices: [free.index],
        })
        return allocations
      }
    }
  }

  if (strategy === 'tp') {
    for (const poolId of poolOrder) {
      const candidates = servers.filter((s) => s.poolId === poolId).sort(sortByAffinity)
      for (const server of candidates) {
        // TP 必须同型号：禁止混卡异构 fallback
        const byKind = new Map<SkuKind, number[]>()
        server.gpus
          .filter((g) => g.state === 'idle')
          .forEach((g) => {
            const kind = resolveSkuKind(g.cardModel)
            const list = byKind.get(kind) ?? []
            list.push(g.index)
            byKind.set(kind, list)
          })
        let chosen: number[] | null = null
        for (const kind of preferred) {
          const list = byKind.get(kind)
          if (list && list.length >= count) {
            chosen = list.slice(0, count)
            break
          }
        }
        if (!chosen) {
          // 同机其它同型号也可（仍禁止跨型号拼 TP）
          for (const kind of preferred.length ? preferred : [...byKind.keys()]) {
            const list = byKind.get(kind)
            if (list && list.length >= count) {
              chosen = list.slice(0, count)
              break
            }
          }
        }
        if (!chosen) {
          for (const list of byKind.values()) {
            if (list.length >= count) {
              chosen = list.slice(0, count)
              break
            }
          }
        }
        if (!chosen) continue
        chosen.forEach((gi) => {
          const gpu = server.gpus[gi]
          const util = 75 + Math.round(Math.random() * 20)
          const cap = gpuSpec(gpu.cardModel).memoryGb
          applyGpuLoad(gpu, server, 'multi', model, workloadId, Math.round(cap * (0.55 + Math.random() * 0.35)), util)
        })
        refreshServerPower(server)
        allocations.push({
          poolId,
          serverId: server.id,
          hostname: server.hostname,
          gpuIndices: chosen,
        })
        return allocations
      }
    }
  }

  // Gang / PP：同厂商 + 同互联域整机装箱；不够则放弃（不静默抢占清盘）
  const nodeScore = (s: ServerNode) =>
    s.gpus.reduce((n, g) => n + affinityScore(g.cardModel, preferred), 0) / Math.max(1, s.gpus.length)
  const nodeVendor = (s: ServerNode) => GPU_SPECS[resolveSkuKind(s.gpus[0]?.cardModel ?? 'h100')].vendor
  const nodeFabric = (s: ServerNode) => GPU_SPECS[resolveSkuKind(s.gpus[0]?.cardModel ?? 'h100')].fabricName
  const preferredVendors = new Set(preferred.map((k) => GPU_SPECS[k].vendor))

  const idleCandidates = poolOrder.flatMap((poolId) =>
    servers.filter(
      (s) =>
        s.poolId === poolId &&
        s.gpus.every((g) => g.state === 'idle') &&
        (preferredVendors.size === 0 || preferredVendors.has(nodeVendor(s))),
    ),
  )

  const seed = [...idleCandidates].sort(
    (a, b) =>
      poolOrder.indexOf(a.poolId) - poolOrder.indexOf(b.poolId) ||
      nodeScore(b) - nodeScore(a) ||
      a.gpus.length - b.gpus.length,
  )[0]
  if (!seed) return allocations

  const vendor = nodeVendor(seed)
  const fabric = nodeFabric(seed)
  // 先尽量在首选池内成组，再允许邻近池溢出，避免「全国乱跳」
  const sameFabric = idleCandidates.filter((s) => nodeVendor(s) === vendor && nodeFabric(s) === fabric)
  const homePool = sameFabric.filter((s) => s.poolId === seed.poolId)
  const spillPools = sameFabric.filter((s) => s.poolId !== seed.poolId)
  const pool = [...homePool, ...spillPools]
  const picked: ServerNode[] = []
  let allocatedSlots = 0
  const used = new Set<string>()

  while (allocatedSlots < count) {
    const remaining = count - allocatedSlots
    const next = pool
      .filter((s) => !used.has(s.id))
      .sort((a, b) => {
        const homeRank = (s: ServerNode) => (s.poolId === seed.poolId ? 0 : 1)
        if (homeRank(a) !== homeRank(b)) return homeRank(a) - homeRank(b)
        const aOver = a.gpus.length > remaining ? 1 : 0
        const bOver = b.gpus.length > remaining ? 1 : 0
        if (aOver !== bOver) return aOver - bOver
        // 优先 8 卡标准机，体现跨机 PP/Gang；避免整舱 32 卡「假跨机」
        const sizePref = (s: ServerNode) => (s.gpus.length === 8 ? 0 : s.gpus.length === 16 ? 1 : 2)
        if (sizePref(a) !== sizePref(b)) return sizePref(a) - sizePref(b)
        if (!aOver && !bOver) {
          return nodeScore(b) - nodeScore(a) || a.id.localeCompare(b.id)
        }
        return a.gpus.length - b.gpus.length || nodeScore(b) - nodeScore(a)
      })[0]
    if (!next) break
    used.add(next.id)
    picked.push(next)
    allocatedSlots += Math.min(remaining, next.gpus.length)
  }

  if (allocatedSlots < count) return allocations

  let need = count
  picked.forEach((server) => {
    const take = Math.min(need, server.gpus.length)
    const indices = server.gpus.slice(0, take).map((g) => g.index)
    indices.forEach((gi) => {
      const g = server.gpus[gi]
      const util = 82 + Math.round(Math.random() * 14)
      const cap = gpuSpec(g.cardModel).memoryGb
      applyGpuLoad(g, server, 'gang', model, workloadId, Math.round(cap * (0.7 + Math.random() * 0.22)), util)
    })
    refreshServerPower(server)
    allocations.push({
      poolId: server.poolId,
      serverId: server.id,
      hostname: server.hostname,
      gpuIndices: indices,
    })
    need -= take
  })

  return allocations
}

function syncWorkloadLinks(servers: ServerNode[], workloads: Workload[]) {
  const map = new Map<string, Workload>()
  workloads.forEach((w) => map.set(w.id, w))
  servers.forEach((s) => {
    s.gpus.forEach((g) => {
      if (g.workloadId && !map.has(g.workloadId)) {
        g.workloadId = undefined
        if (g.state !== 'fault') {
          g.state = 'idle'
          g.modelName = undefined
          g.memoryUsedGb = 2
          g.utilization = 4
        }
      }
    })
  })
}

function modelImage(model: string) {
  const tag = model.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `registry.fathompeak.cn/inference/${tag}:v1.2.0`
}

function buildPods(
  name: string,
  strategy: ScheduleStrategy,
  allocations: Allocation[],
  servers: ServerNode[],
  image: string,
): WorkloadPod[] {
  const roles =
    strategy === 'pp'
      ? ['pp-stage-0', 'pp-stage-1', 'pp-stage-2', 'pp-stage-3']
      : strategy === 'tp'
        ? ['tp-worker']
        : ['inference']

  return allocations.map((a, i) => {
    const pool = POOLS.find((p) => p.id === a.poolId)
    const server = servers.find((s) => s.id === a.serverId)
    const role = strategy === 'pp' ? roles[i % roles.length] : roles[0]
    return {
      name: `${name}-${role}-${i}`.slice(0, 48),
      role,
      status: 'Running' as const,
      nodeName: a.hostname,
      nodePool: pool?.name ?? a.poolId,
      gpuIndices: a.gpuIndices,
      gpuRequest: a.gpuIndices.length,
      memoryGb: a.gpuIndices.reduce((n, gi) => n + (server?.gpus[gi].memoryUsedGb ?? 0), 0),
      image,
    }
  })
}

function buildEvents(name: string, strategy: ScheduleStrategy, startedAt: number): WorkloadEvent[] {
  const base = [
    { offset: 0, phase: 'Submitted', message: `Workload ${name} submitted to scheduler` },
    { offset: 2, phase: 'Pending', message: 'Waiting for GPU quota and node affinity' },
    {
      offset: 8,
      phase: 'Scheduled',
      message:
        strategy === 'pp'
          ? 'Gang Scheduling locked all worker groups'
          : strategy === 'tp'
            ? 'NVLink topology affinity matched'
            : 'Binpack placed on fragmented node',
    },
    { offset: 14, phase: 'Initializing', message: 'Pulling container image and mounting model weights' },
    { offset: 28, phase: 'Running', message: 'All requested pods are Ready' },
  ]
  return base.map((e) => ({
    ts: startedAt + e.offset * 1000,
    phase: e.phase,
    message: e.message,
  }))
}

function composeWorkload(params: {
  id: string
  name: string
  model: string
  type: WorkloadType
  projectId: string
  projectName: string
  strategy: ScheduleStrategy
  status: Workload['status']
  createdBy: string
  allocations: Allocation[]
  servers: ServerNode[]
  latencyMs: number
  tokensPerSec: number
  startedAt: number
  durationSec: number
}): Workload {
  const image = modelImage(params.model)
  const pods = buildPods(params.name, params.strategy, params.allocations, params.servers, image)
  const gpuCount = params.allocations.reduce((n, a) => n + a.gpuIndices.length, 0)
  // 请求规格按独占整卡显存汇总，而非瞬时 used（与资产「计算规格」口径一致）
  const memoryGb = params.allocations.reduce((n, a) => {
    const server = params.servers.find((s) => s.id === a.serverId)
    if (!server) return n
    return n + a.gpuIndices.reduce((m, gi) => m + (server.gpus[gi]?.memoryTotalGb ?? 0), 0)
  }, 0)
  const primaryServer = params.servers.find((s) => s.id === params.allocations[0]?.serverId)
  const clusterName = primaryServer ? clusterOfServer(primaryServer)?.name ?? 'cls-pending' : 'pending'

  return {
    id: params.id,
    name: params.name,
    model: params.model,
    type: params.type,
    projectId: params.projectId,
    projectName: params.projectName,
    strategy: params.strategy,
    status: params.status,
    createdBy: params.createdBy,
    image,
    clusterName,
    architecture: params.strategy === 'single' ? 'Standard' : 'Distributed',
    gpuCount,
    memoryGb,
    podsRequested: Math.max(1, pods.length),
    podsRunning: params.status === 'Running' ? pods.length : 0,
    latencyMs: params.latencyMs,
    tokensPerSec: params.tokensPerSec,
    startedAt: params.startedAt,
    durationSec: params.durationSec,
    allocations: params.allocations,
    pods,
    events: buildEvents(params.name, params.strategy, params.startedAt),
    endpoint:
      params.type === 'Inference'
        ? `https://infer.fathompeak.cn/${params.name}`
        : undefined,
  }
}

export function seedInitialWorkloads(servers: ServerNode[]): Workload[] {
  const now = Date.now()
  const defs: Array<{
    name: string
    model: string
    type: WorkloadType
    projectId: string
    strategy: ScheduleStrategy
    gpuCount: number
    latencyMs: number
    tokensPerSec: number
    durationSec: number
    preferredPool?: string
    createdBy?: string
  }> = [
    // —— 华北生产推理（策略优先大兴/滨海）——
    {
      name: 'inf-deepseek-v3-awq',
      model: 'DeepSeek-V3-671B-AWQ',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'pp',
      gpuCount: 64,
      latencyMs: 142,
      tokensPerSec: 36,
      durationSec: 28600,
      preferredPool: 'pool-daxing',
    },
    {
      name: 'inf-deepseek-r1-prod',
      model: 'DeepSeek-R1',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'pp',
      gpuCount: 32,
      latencyMs: 168,
      tokensPerSec: 24,
      durationSec: 22400,
      preferredPool: 'pool-tianjin',
    },
    {
      name: 'inf-qwen25-72b-a',
      model: 'Qwen2.5-72B',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 96,
      tokensPerSec: 42,
      durationSec: 18800,
      preferredPool: 'pool-daxing',
    },
    {
      name: 'inf-qwen25-72b-b',
      model: 'Qwen2.5-72B',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 102,
      tokensPerSec: 40,
      durationSec: 16200,
      preferredPool: 'pool-tianjin',
    },
    {
      name: 'inf-llama31-70b-a',
      model: 'Llama-3.1-70B-Instruct',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 88,
      tokensPerSec: 46,
      durationSec: 20100,
      preferredPool: 'pool-daxing',
    },
    {
      name: 'inf-llama31-70b-b',
      model: 'Llama-3.1-70B-Instruct',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 91,
      tokensPerSec: 44,
      durationSec: 15400,
      preferredPool: 'pool-tianjin',
    },
    // —— 区域溢出推理 ——
    {
      name: 'inf-qwen25-32b-sz',
      model: 'Qwen2.5-32B',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 72,
      tokensPerSec: 58,
      durationSec: 12400,
      preferredPool: 'pool-shenzhou',
    },
    {
      name: 'inf-qwen25-32b-gy',
      model: 'Qwen2.5-32B',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 74,
      tokensPerSec: 56,
      durationSec: 9800,
      preferredPool: 'pool-gaoyou',
    },
    {
      name: 'inf-qwen25-14b-hm',
      model: 'Qwen2.5-14B',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 48,
      tokensPerSec: 86,
      durationSec: 11200,
      preferredPool: 'pool-hami',
    },
    {
      name: 'inf-qwen25-14b-gz',
      model: 'Qwen2.5-14B',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 46,
      tokensPerSec: 90,
      durationSec: 8600,
      preferredPool: 'pool-ganzhou',
    },
    {
      name: 'inf-qwen25-7b-api',
      model: 'Qwen2.5-7B',
      type: 'Inference',
      projectId: 'proj-agent',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 32,
      tokensPerSec: 126,
      durationSec: 24200,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'inf-qwen25-7b-chat',
      model: 'Qwen2.5-7B',
      type: 'Inference',
      projectId: 'proj-agent',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 28,
      tokensPerSec: 132,
      durationSec: 19600,
      preferredPool: 'pool-daxing',
    },
    {
      name: 'inf-glm4-9b-a',
      model: 'GLM-4-9B-Chat',
      type: 'Inference',
      projectId: 'proj-agent',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 40,
      tokensPerSec: 92,
      durationSec: 14100,
      preferredPool: 'pool-daxing',
    },
    {
      name: 'inf-glm4-9b-b',
      model: 'GLM-4-9B-Chat',
      type: 'Inference',
      projectId: 'proj-agent',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 38,
      tokensPerSec: 96,
      durationSec: 10200,
      preferredPool: 'pool-tianjin',
    },
    // —— 多模态 ——
    {
      name: 'inf-qwen2-vl-72b',
      model: 'Qwen2-VL-72B',
      type: 'Inference',
      projectId: 'proj-mm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 118,
      tokensPerSec: 34,
      durationSec: 16700,
      preferredPool: 'pool-tianjin',
    },
    {
      name: 'inf-internvl2-40b-a',
      model: 'InternVL2-40B',
      type: 'Inference',
      projectId: 'proj-mm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 112,
      tokensPerSec: 36,
      durationSec: 15400,
      preferredPool: 'pool-shenzhou',
    },
    {
      name: 'inf-internvl2-40b-b',
      model: 'InternVL2-40B',
      type: 'Inference',
      projectId: 'proj-mm-serve',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 108,
      tokensPerSec: 38,
      durationSec: 12100,
      preferredPool: 'pool-gaoyou',
    },
    {
      name: 'inf-internvl2-26b',
      model: 'InternVL2-26B',
      type: 'Inference',
      projectId: 'proj-mm-serve',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 98,
      tokensPerSec: 44,
      durationSec: 9600,
      preferredPool: 'pool-gaoyou',
    },
    {
      name: 'inf-whisper-large-v3',
      model: 'Whisper-Large-V3',
      type: 'Inference',
      projectId: 'proj-mm-serve',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 180,
      tokensPerSec: 0,
      durationSec: 8200,
      preferredPool: 'pool-hami',
    },
    {
      name: 'inf-bge-m3-a',
      model: 'BGE-M3',
      type: 'Inference',
      projectId: 'proj-embed',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 14,
      tokensPerSec: 0,
      durationSec: 26800,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'inf-bge-m3-b',
      model: 'BGE-M3',
      type: 'Inference',
      projectId: 'proj-embed',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 12,
      tokensPerSec: 0,
      durationSec: 21400,
      preferredPool: 'pool-ganzhou',
    },
    {
      name: 'inf-bge-rerank',
      model: 'BGE-M3-Rerank',
      type: 'Inference',
      projectId: 'proj-embed',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 18,
      tokensPerSec: 0,
      durationSec: 17600,
      preferredPool: 'pool-daxing',
    },
    // —— 训练 / SFT ——
    {
      name: 'train-deepseek-v3-sft',
      model: 'DeepSeek-V3-SFT',
      type: 'Training',
      projectId: 'proj-llm',
      strategy: 'pp',
      gpuCount: 64,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 42000,
      preferredPool: 'pool-hami',
      createdBy: 'chenli@fathompeak.cn',
    },
    {
      name: 'train-qwen25-14b-sft',
      model: 'Qwen2.5-14B-SFT',
      type: 'Training',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 28600,
      preferredPool: 'pool-ganzhou',
      createdBy: 'chenli@fathompeak.cn',
    },
    {
      name: 'train-llama70b-lora',
      model: 'Llama-3-70B-LoRA',
      type: 'Training',
      projectId: 'proj-rd',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 18200,
      preferredPool: 'pool-shenzhou',
      createdBy: 'liwei@fathompeak.cn',
    },
    {
      name: 'train-qwen14b-lora',
      model: 'Qwen2.5-14B-LoRA',
      type: 'Training',
      projectId: 'proj-oss',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 12400,
      preferredPool: 'pool-gaoyou',
      createdBy: 'liwei@fathompeak.cn',
    },
    // —— 算电可迁移批处理 ——
    {
      name: 'job-green-batch-a',
      model: 'Qwen2.5-7B',
      type: 'Inference',
      projectId: 'proj-energy',
      strategy: 'single',
      gpuCount: 1,
      latencyMs: 36,
      tokensPerSec: 110,
      durationSec: 6400,
      preferredPool: 'pool-hami',
    },
    {
      name: 'job-green-batch-b',
      model: 'Qwen2.5-7B',
      type: 'Inference',
      projectId: 'proj-energy',
      strategy: 'single',
      gpuCount: 1,
      latencyMs: 34,
      tokensPerSec: 118,
      durationSec: 5100,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'job-green-batch-c',
      model: 'Qwen2.5-14B',
      type: 'Inference',
      projectId: 'proj-energy',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 52,
      tokensPerSec: 78,
      durationSec: 7200,
      preferredPool: 'pool-ganzhou',
    },
    // —— 工作空间 ——
    {
      name: 'ws-llama31-8b-dev',
      model: 'Llama-3.1-8B',
      type: 'Workspace',
      projectId: 'proj-rd',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 5400,
      preferredPool: 'pool-shenzhou',
      createdBy: 'liwei@fathompeak.cn',
    },
    {
      name: 'ws-vscode-multigpu',
      model: 'VSCode-MultiGPU',
      type: 'Workspace',
      projectId: 'proj-oss',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 3600,
      preferredPool: 'pool-gaoyou',
      createdBy: 'liwei@fathompeak.cn',
    },
    // —— 额外副本，把舰队利用率抬到约 40% ——
    {
      name: 'inf-qwen25-72b-c',
      model: 'Qwen2.5-72B',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 99,
      tokensPerSec: 41,
      durationSec: 13200,
      preferredPool: 'pool-shenzhou',
    },
    {
      name: 'inf-qwen25-72b-d',
      model: 'Qwen2.5-72B',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 97,
      tokensPerSec: 43,
      durationSec: 11800,
      preferredPool: 'pool-gaoyou',
    },
    {
      name: 'inf-llama31-70b-c',
      model: 'Llama-3.1-70B-Instruct',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 90,
      tokensPerSec: 45,
      durationSec: 14500,
      preferredPool: 'pool-hami',
    },
    {
      name: 'inf-llama31-70b-d',
      model: 'Llama-3.1-70B-Instruct',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 92,
      tokensPerSec: 44,
      durationSec: 10900,
      preferredPool: 'pool-ganzhou',
    },
    {
      name: 'inf-qwen2-vl-72b-b',
      model: 'Qwen2-VL-72B',
      type: 'Inference',
      projectId: 'proj-mm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 120,
      tokensPerSec: 33,
      durationSec: 13800,
      preferredPool: 'pool-daxing',
    },
    {
      name: 'inf-internvl2-40b-c',
      model: 'InternVL2-40B',
      type: 'Inference',
      projectId: 'proj-mm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 115,
      tokensPerSec: 35,
      durationSec: 10100,
      preferredPool: 'pool-tianjin',
    },
    {
      name: 'inf-deepseek-r1-eval',
      model: 'DeepSeek-R1',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'pp',
      gpuCount: 16,
      latencyMs: 170,
      tokensPerSec: 20,
      durationSec: 8800,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'train-internvl-ft',
      model: 'InternVL2-26B',
      type: 'Training',
      projectId: 'proj-mm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 24600,
      preferredPool: 'pool-hami',
      createdBy: 'chenli@fathompeak.cn',
    },
    {
      name: 'inf-qwen25-32b-st',
      model: 'Qwen2.5-32B',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 70,
      tokensPerSec: 60,
      durationSec: 9200,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'inf-qwen25-32b-hm',
      model: 'Qwen2.5-32B',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 71,
      tokensPerSec: 59,
      durationSec: 8700,
      preferredPool: 'pool-hami',
    },
    {
      name: 'inf-llama31-70b-e',
      model: 'Llama-3.1-70B-Instruct',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 89,
      tokensPerSec: 47,
      durationSec: 11300,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'inf-qwen25-72b-e',
      model: 'Qwen2.5-72B',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 95,
      tokensPerSec: 42,
      durationSec: 10500,
      preferredPool: 'pool-ganzhou',
    },
    {
      name: 'inf-internvl2-40b-d',
      model: 'InternVL2-40B',
      type: 'Inference',
      projectId: 'proj-mm-serve',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 110,
      tokensPerSec: 37,
      durationSec: 9400,
      preferredPool: 'pool-hami',
    },
    {
      name: 'inf-qwen2-vl-72b-c',
      model: 'Qwen2-VL-72B',
      type: 'Inference',
      projectId: 'proj-mm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 116,
      tokensPerSec: 35,
      durationSec: 8900,
      preferredPool: 'pool-shenzhou',
    },
    {
      name: 'inf-glm4-9b-c',
      model: 'GLM-4-9B-Chat',
      type: 'Inference',
      projectId: 'proj-agent',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 39,
      tokensPerSec: 94,
      durationSec: 7800,
      preferredPool: 'pool-gaoyou',
    },
    {
      name: 'inf-glm4-9b-d',
      model: 'GLM-4-9B-Chat',
      type: 'Inference',
      projectId: 'proj-agent',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 41,
      tokensPerSec: 90,
      durationSec: 7200,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'train-qwen72b-lora',
      model: 'Qwen2.5-72B',
      type: 'Training',
      projectId: 'proj-rd',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 16800,
      preferredPool: 'pool-tianjin',
      createdBy: 'liwei@fathompeak.cn',
    },
    {
      name: 'job-green-batch-d',
      model: 'Qwen2.5-14B',
      type: 'Inference',
      projectId: 'proj-energy',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 50,
      tokensPerSec: 80,
      durationSec: 5600,
      preferredPool: 'pool-hami',
    },
    {
      name: 'inf-qwen25-14b-st',
      model: 'Qwen2.5-14B',
      type: 'Inference',
      projectId: 'proj-llm-align',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 47,
      tokensPerSec: 88,
      durationSec: 6900,
      preferredPool: 'pool-shantou',
    },
    {
      name: 'inf-bge-m3-c',
      model: 'BGE-M3',
      type: 'Inference',
      projectId: 'proj-embed',
      strategy: 'tp',
      gpuCount: 2,
      latencyMs: 13,
      tokensPerSec: 0,
      durationSec: 15200,
      preferredPool: 'pool-tianjin',
    },
  ]

  return defs.map((d, i) => {
    const id = `wl-${String(i + 1).padStart(3, '0')}`
    const project = PROJECTS.find((p) => p.id === d.projectId)!
    const allocations = allocateGpus(servers, id, d.model, d.strategy, d.gpuCount, d.preferredPool)
    return composeWorkload({
      id,
      name: d.name,
      model: d.model,
      type: d.type,
      projectId: d.projectId,
      projectName: project.name,
      strategy: d.strategy,
      status: 'Running',
      createdBy: d.createdBy ?? USER,
      allocations,
      servers,
      latencyMs: d.latencyMs,
      tokensPerSec: d.tokensPerSec,
      startedAt: now - d.durationSec * 1000,
      durationSec: d.durationSec,
    })
  })
}

export function computeMetrics(servers: ServerNode[], workloads: Workload[], stations: PowerStation[]): ClusterMetrics {
  const busy = servers.reduce((n, s) => n + s.gpus.filter((g) => g.state !== 'idle' && g.state !== 'fault').length, 0)
  const total = servers.reduce((n, s) => n + s.gpus.length, 0) || 1
  const greenPowerMw = stations.reduce((n, s) => n + s.currentMw, 0)
  // greenRatio：出力加权绿电占比，量纲 0–1（与电站 greenRatio 一致）
  const greenWeighted =
    stations.reduce((n, s) => n + s.currentMw * s.greenRatio, 0) / Math.max(greenPowerMw, 0.001)
  return {
    poolCount: POOLS.length,
    serverCount: servers.length,
    gpuCount: total,
    utilization: Math.round((busy / total) * 1000) / 10,
    runningTasks: workloads.filter((w) => w.status === 'Running').length,
    greenPowerMw: Math.round(greenPowerMw * 10) / 10,
    greenRatio: Math.round(greenWeighted * 1000) / 1000,
  }
}

function injectDemoAnomalies(servers: ServerNode[]) {
  const loaded = servers
    .filter((s) => s.gpus.some((g) => g.state !== 'idle' && g.state !== 'fault'))
    .sort((a, b) => b.powerW - a.powerW)
  loaded.slice(0, 3).forEach((server, index) => {
    server.gpus.forEach((gpu) => {
      if (gpu.state === 'idle' || gpu.state === 'fault') return
      gpu.temperature = Math.min(92, 83 + index + Math.round(seeded(index * 17 + gpu.index) * 4))
      gpu.powerW = Math.min(gpuSpec(gpu.cardModel).tdpW, Math.round(gpu.powerW * 1.08))
    })
    refreshServerPower(server)
    // 机箱平均温度抬到告警阈值以上，便于演示高温路径
    server.temperature = Math.max(server.temperature, 83 + index)
  })
}

function buildSeedAudits(workloads: Workload[]): AuditEvent[] {
  const now = Date.now()
  const pp = workloads.find((w) => w.strategy === 'pp' && w.allocations.length > 1)
  const single = workloads.find((w) => w.strategy === 'single' || (w.strategy === 'tp' && w.gpuCount <= 2))
  const tp = workloads.find((w) => w.strategy === 'tp' && w.gpuCount >= 4)
  const audits: AuditEvent[] = [
    {
      id: 'aud-001',
      ts: now - 3600_000,
      actor: USER,
      action: '登录系统',
      target: 'Auth Gateway',
      detail: '集群超级管理员会话建立',
      level: 'success',
    },
  ]
  if (pp) {
    const pools = [...new Set(pp.allocations.map((a) => POOLS.find((p) => p.id === a.poolId)?.name ?? a.poolId))]
    audits.push({
      id: 'aud-002',
      ts: now - 3200_000,
      actor: 'scheduler',
      action: 'Gang 调度锁定',
      target: pp.name,
      detail: `跨 ${pools.join(' / ')} 锁定 ${pp.allocations.length} 台整机 · ${pp.gpuCount} GPU`,
      level: 'info',
    })
  }
  if (single) {
    const alloc = single.allocations[0]
    audits.push({
      id: 'aud-003',
      ts: now - 2800_000,
      actor: 'scheduler',
      action: 'Binpack 装箱',
      target: single.name,
      detail: `碎片节点 ${alloc?.hostname ?? '—'} GPU${alloc?.gpuIndices.join(',') ?? '0'} 承接`,
      level: 'info',
    })
  }
  audits.push({
    id: 'aud-004',
    ts: now - 2100_000,
    actor: USER,
    action: '启用策略',
    target: '绿电优先算电协同',
    detail: '电站出力高峰时段优先调度绿电节点池',
    level: 'success',
  })
  if (tp) {
    const alloc = tp.allocations[0]
    audits.push({
      id: 'aud-005',
      ts: now - 1500_000,
      actor: 'scheduler',
      action: '卡间互联亲和调度',
      target: tp.name,
      detail: `${alloc?.hostname ?? '—'} 同型号 GPU${alloc?.gpuIndices.join('-') ?? ''} 拓扑匹配成功`,
      level: 'info',
    })
  }
  audits.push(
    {
      id: 'aud-006',
      ts: now - 900_000,
      actor: USER,
      action: '调整配额',
      target: 'LLM 预训练平台',
      detail: 'Guaranteed Quota 调整为 192 GPU',
      level: 'warn',
    },
    {
      id: 'aud-007',
      ts: now - 400_000,
      actor: 'scheduler',
      action: '绿电迁移建议',
      target: 'Pool-哈密',
      detail: '哈密光伏 + 汕头风电出力上升，建议迁移可抢占 Over-quota 任务',
      level: 'info',
    },
  )
  return audits
}

export function createInitialState(): AppState {
  const servers = buildServers()
  const running = seedInitialWorkloads(servers)
  const queued = seedQueuedWorkloads()
  const workloads = [...running, ...queued]
  syncWorkloadLinks(servers, workloads)
  injectDemoAnomalies(servers)
  const audits = buildSeedAudits(workloads)

  return {
    authenticated: false,
    user: USER,
    role: '集群超级管理员',
    clusters: CLUSTERS.map((cluster) => ({
      ...cluster,
      endpoint: `https://api.${cluster.name}.fathompeak.cn`,
      createdAt: Date.now() - 90 * 24 * 3600_000,
    })),
    departments: DEPARTMENTS.map((department) => ({ ...department })),
    poolBindings: Object.fromEntries(Object.entries(POOL_SOURCES).map(([poolId, ids]) => [poolId, [...ids]])),
    pools: POOLS.map((pool) => ({
      ...pool,
      status: 'Ready' as const,
      clusterId: POOL_SOURCES[pool.id]?.[0],
    })),
    servers: servers.map((server) => ({ ...server, cordoned: false, draining: false })),
    workloads,
    projects: PROJECTS.map((p) => ({
      ...p,
      used: Math.min(
        p.overQuota,
        workloads.filter((w) => w.projectId === p.id && w.status === 'Running').reduce((n, w) => n + w.gpuCount, 0),
      ),
    })),
    policies: POLICIES.map((p) => ({ ...p })),
    audits,
    stations: STATIONS.map((s) => ({ ...s })),
    metrics: computeMetrics(servers, workloads, STATIONS),
    selectedWorkloadId: null,
    activeStationId: 'st-hbsz',
    focusServerId: null,
    focusPoolId: null,
    zoomPreset: 'macro',
    canvasRequest: null,
    scheduleFlowWorkloadId: null,
  }
}

let wlSeq = 100

export function spawnWorkload(
  state: AppState,
  kind: 'single' | 'tp4' | 'gang',
  custom?: {
    name?: string
    model?: string
    projectId?: string
    gpuCount?: number
    type?: WorkloadType
  },
): { state: AppState; workload: Workload } {
  const servers = state.servers.map((s) => ({
    ...s,
    gpus: s.gpus.map((g) => ({ ...g })),
  }))

  const id = `wl-${String(++wlSeq).padStart(3, '0')}`
  const type = custom?.type ?? 'Inference'
  const presets = {
    single: {
      name: custom?.name ?? `${type === 'Workspace' ? 'ws' : type === 'Training' ? 'train' : 'inf'}-qwen25-7b-${wlSeq}`,
      model: custom?.model ?? 'Qwen2.5-7B',
      strategy: 'single' as ScheduleStrategy,
      gpuCount: custom?.gpuCount ?? 1,
      projectId: custom?.projectId ?? 'proj-agent',
      latencyMs: type === 'Inference' ? 36 + Math.round(Math.random() * 18) : 0,
      tokensPerSec: type === 'Inference' ? 78 + Math.round(Math.random() * 20) : 0,
    },
    tp4: {
      name:
        custom?.name ??
        `${type === 'Training' ? 'train' : 'inf'}-${(custom?.model ?? 'Qwen2.5-72B').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tp-${wlSeq}`,
      model: custom?.model ?? 'Qwen2.5-72B',
      strategy: 'tp' as ScheduleStrategy,
      gpuCount: custom?.gpuCount ?? 8,
      projectId: custom?.projectId ?? 'proj-llm',
      latencyMs: type === 'Inference' ? 88 + Math.round(Math.random() * 24) : 0,
      tokensPerSec: type === 'Inference' ? 38 + Math.round(Math.random() * 12) : 0,
    },
    gang: {
      name: custom?.name ?? `inf-deepseek-v3-gang-${wlSeq}`,
      model: custom?.model ?? 'DeepSeek-V3-671B',
      strategy: 'pp' as ScheduleStrategy,
      gpuCount: custom?.gpuCount ?? 32,
      projectId: custom?.projectId ?? 'proj-llm',
      latencyMs: 170 + Math.round(Math.random() * 40),
      tokensPerSec: 24 + Math.round(Math.random() * 10),
    },
  }[kind]

  const project = state.projects.find((p) => p.id === presets.projectId) ?? state.projects[0]
  const allocations = allocateGpus(servers, id, presets.model, presets.strategy, presets.gpuCount)
  const workload = composeWorkload({
    id,
    name: presets.name,
    model: presets.model,
    type,
    projectId: project.id,
    projectName: project.name,
    strategy: presets.strategy,
    status: 'Running',
    createdBy: state.user,
    allocations,
    servers,
    latencyMs: presets.latencyMs,
    tokensPerSec: presets.tokensPerSec,
    startedAt: Date.now(),
    durationSec: 0,
  })

  const workloads = [workload, ...state.workloads]
  const projects = state.projects.map((p) =>
    p.id === project.id ? { ...p, used: Math.min(p.overQuota, p.used + workload.gpuCount) } : p,
  )
  const audits: AuditEvent[] = [
    {
      id: `aud-${Date.now()}`,
      ts: Date.now(),
      actor: state.user,
      action: 'CREATE WORKLOAD',
      target: workload.name,
      detail: `${workload.type} · ${workload.architecture} · ${workload.gpuCount} GPU · ${workload.model}`,
      level: 'success',
    },
    {
      id: `aud-${Date.now() + 1}`,
      ts: Date.now() + 1,
      actor: 'scheduler',
      action: kind === 'single' ? 'Binpack 装箱' : kind === 'tp4' ? '同型号互联亲和调度' : 'Gang 调度锁定',
      target: workload.name,
      detail: allocations.map((a) => `${a.hostname}[${a.gpuIndices.join(',')}]`).join(' · '),
      level: 'info',
    },
    ...state.audits,
  ]

  return {
    workload,
    state: {
      ...state,
      servers,
      workloads,
      projects,
      audits,
      metrics: computeMetrics(servers, workloads, state.stations),
      selectedWorkloadId: workload.id,
      canvasRequest: {
        id: Date.now(),
        type: 'spawn-animation',
        payload: { workloadId: workload.id, kind },
      },
    },
  }
}

export function stopWorkload(state: AppState, workloadId: string): AppState {
  const servers = state.servers.map((s) => ({
    ...s,
    gpus: s.gpus.map((g) => {
      if (g.workloadId !== workloadId) return { ...g }
      return {
        ...g,
        state: 'idle' as GpuState,
        workloadId: undefined,
        modelName: undefined,
        memoryUsedGb: 2,
        utilization: 3,
        temperature: 36 + Math.round(Math.random() * 6),
        powerW: gpuSpec(g.cardModel).idleW - 10 + Math.round(Math.random() * 25),
      }
    }),
  }))
  const target = state.workloads.find((w) => w.id === workloadId)
  const workloads = state.workloads.map((w) =>
    w.id === workloadId
      ? {
          ...w,
          status: 'Succeeded' as const,
          podsRunning: 0,
          pods: w.pods.map((p) => ({ ...p, status: 'Succeeded' as const })),
          events: [
            ...w.events,
            { ts: Date.now(), phase: 'Succeeded', message: 'Workload stopped and resources released' },
          ],
        }
      : w,
  )
  const projects = state.projects.map((p) =>
    target && p.id === target.projectId
      ? { ...p, used: Math.max(0, p.used - target.gpuCount) }
      : p,
  )
  const audits: AuditEvent[] = [
    {
      id: `aud-${Date.now()}`,
      ts: Date.now(),
      actor: state.user,
      action: '停止任务',
      target: target?.name ?? workloadId,
      detail: '释放 GPU 资源并回收配额',
      level: 'warn',
    },
    ...state.audits,
  ]
  return {
    ...state,
    servers,
    workloads,
    projects,
    audits,
    selectedWorkloadId: state.selectedWorkloadId === workloadId ? null : state.selectedWorkloadId,
    metrics: computeMetrics(servers, workloads, state.stations),
  }
}

/** 管理员取消排队中的任务 */
export function cancelQueuedWorkload(state: AppState, workloadId: string): AppState {
  const target = state.workloads.find((w) => w.id === workloadId)
  if (!target || target.status !== 'Pending') return state
  const workloads = state.workloads.map((w) =>
    w.id === workloadId
      ? {
          ...w,
          status: 'Succeeded' as const,
          podsRunning: 0,
          events: [
            ...w.events,
            { ts: Date.now(), phase: 'Cancelled', message: '管理员取消排队，任务已退出调度队列' },
          ],
        }
      : w,
  )
  const audits: AuditEvent[] = [
    {
      id: `aud-cancel-${Date.now()}`,
      ts: Date.now(),
      actor: state.user,
      action: '取消排队',
      target: target.name,
      detail: '从调度队列移除 Pending 任务',
      level: 'warn',
    },
    ...state.audits,
  ]
  return {
    ...state,
    workloads,
    audits,
    selectedWorkloadId: state.selectedWorkloadId === workloadId ? null : state.selectedWorkloadId,
    metrics: computeMetrics(state.servers, workloads, state.stations),
  }
}

/** 失败任务重新进入队列 */
export function retryFailedWorkload(state: AppState, workloadId: string): AppState {
  const target = state.workloads.find((w) => w.id === workloadId)
  if (!target || target.status !== 'Failed') return state
  const workloads = state.workloads.map((w) =>
    w.id === workloadId
      ? {
          ...w,
          status: 'Pending' as const,
          podsRunning: 0,
          allocations: [],
          pods: w.pods.map((p) => ({ ...p, status: 'Pending' as const })),
          events: [
            ...w.events,
            { ts: Date.now(), phase: 'Pending', message: '管理员触发失败重试，重新进入调度队列' },
          ],
        }
      : w,
  )
  const audits: AuditEvent[] = [
    {
      id: `aud-retry-${Date.now()}`,
      ts: Date.now(),
      actor: state.user,
      action: '重试任务',
      target: target.name,
      detail: '失败工作负载重新排队',
      level: 'info',
    },
    ...state.audits,
  ]
  return {
    ...state,
    workloads,
    audits,
    metrics: computeMetrics(state.servers, workloads, state.stations),
  }
}

export function tickLiveMetrics(state: AppState): AppState {
  const utilizationJitter = (Math.random() - 0.5) * 0.6
  const hour = new Date().getHours() + new Date().getMinutes() / 60
  const stations = state.stations.map((s) => {
    // 按能源类型模拟日内出力：光伏午高夜低，风电起伏，水电平稳
    let floor = 0.35
    let ceiling = 0.98
    let green = s.greenRatio
    if (s.type.includes('光伏')) {
      const solarCurve = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
      floor = 0.05
      ceiling = 0.15 + solarCurve * 0.8
      green = Math.min(0.99, 0.55 + solarCurve * 0.42)
    } else if (s.type.includes('风')) {
      floor = 0.28
      ceiling = 0.92
      green = 0.94 + (Math.random() - 0.5) * 0.04
    } else {
      floor = 0.55
      ceiling = 0.95
      green = 0.98 + (Math.random() - 0.5) * 0.02
    }
    const delta = (Math.random() - 0.5) * s.capacityMw * 0.02
    const currentMw = Math.max(s.capacityMw * floor, Math.min(s.capacityMw * ceiling, s.currentMw + delta))
    return {
      ...s,
      currentMw: Math.round(currentMw * 10) / 10,
      greenRatio: Math.round(Math.min(1, Math.max(0.4, green)) * 1000) / 1000,
    }
  })
  const workloads = state.workloads.map((w) =>
    w.status === 'Running'
      ? {
          ...w,
          durationSec: Math.floor((Date.now() - w.startedAt) / 1000),
          latencyMs: Math.max(20, Math.round(w.latencyMs + (Math.random() - 0.5) * 4)),
          tokensPerSec:
            w.tokensPerSec > 0
              ? Math.max(8, Math.round(w.tokensPerSec + (Math.random() - 0.5) * 3))
              : 0,
        }
      : w,
  )
  const base = computeMetrics(state.servers, workloads, stations)
  return {
    ...state,
    stations,
    workloads,
    metrics: {
      ...base,
      utilization: Math.max(8, Math.min(92, Math.round((base.utilization + utilizationJitter) * 10) / 10)),
    },
  }
}

export function clusterTitle(name: string) {
  const base = name
    .replace(/电站$/, '')
    .replace(/园区/g, '')
    .replace(/区/g, '')
    .replace(/分布式光伏$/, '分布式')
    .replace(/集中式光伏$/, '集中式')
    .replace(/海上风电接入$/, '海上风电')
    .replace(/水电接入$/, '水电')
  return `${base}集群`
}

export function strategyLabel(s: ScheduleStrategy) {
  if (s === 'single') return '单卡推理'
  if (s === 'tp') return '单机多卡 TP'
  return '跨机联动 PP'
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatAlloc(a: Allocation) {
  return `${a.hostname} [GPU ${a.gpuIndices.join(',')}]`
}
