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

const USER = 'wangxiaoliang@fathompeak.cn'

// 延迟引用规格，避免 mock ↔ monitor 循环依赖在打包期膨胀；数值与 gpuSpecs 对齐
function gpuSpec(gpuModel: string) {
  const text = gpuModel.toLowerCase()
  if (text.includes('910b') || text.includes('ascend') || text.includes('昇腾')) {
    return { memoryGb: 64, tdpW: 400, idleW: 90, vendor: 'huawei' as const }
  }
  if (text.includes('mlu370') || text.includes('寒武纪')) {
    return { memoryGb: 48, tdpW: 250, idleW: 60, vendor: 'cambricon' as const }
  }
  if (text.includes('br104') || text.includes('壁仞')) {
    return { memoryGb: 32, tdpW: 300, idleW: 65, vendor: 'biren' as const }
  }
  if (text.includes('a800') || text.includes('a100')) {
    return { memoryGb: 80, tdpW: 400, idleW: 70, vendor: 'nvidia' as const }
  }
  return { memoryGb: 80, tdpW: 700, idleW: 100, vendor: 'nvidia' as const }
}

export const STATIONS: PowerStation[] = [
  {
    id: 'st-bjdx',
    name: '北京大兴区分布式光伏电站',
    type: '分布式光伏',
    region: '北京大兴',
    capacityMw: 48.5,
    currentMw: 31.2,
    greenRatio: 0.94,
  },
  {
    id: 'st-hbsz',
    name: '河北深州集中式光伏电站',
    type: '集中式光伏',
    region: '河北深州',
    capacityMw: 120,
    currentMw: 86.4,
    greenRatio: 0.97,
  },
  {
    id: 'st-xj',
    name: '新疆集中式光伏电站',
    type: '集中式光伏',
    region: '新疆哈密',
    capacityMw: 200,
    currentMw: 148.6,
    greenRatio: 0.98,
  },
  {
    id: 'st-tj',
    name: '天津分布式光伏电站',
    type: '分布式光伏',
    region: '天津滨海',
    capacityMw: 36,
    currentMw: 22.8,
    greenRatio: 0.93,
  },
  {
    id: 'st-gd',
    name: '广东汕头海上风电电站',
    type: '海上风电',
    region: '广东汕头',
    capacityMw: 300,
    currentMw: 186.5,
    greenRatio: 0.99,
  },
  {
    id: 'st-jx',
    name: '江西水电电站',
    type: '水电',
    region: '江西赣州',
    capacityMw: 180,
    currentMw: 142.0,
    greenRatio: 1.0,
  },
  {
    id: 'st-jsgp',
    name: '江苏高邮集中式光伏电站',
    type: '集中式光伏',
    region: '江苏高邮',
    capacityMw: 95,
    currentMw: 61.7,
    greenRatio: 0.96,
  },
]

export const POOLS: NodePool[] = [
  {
    id: 'pool-east-01',
    name: 'Pool-East-01',
    label: 'Pool-East-01 [50台]',
    serverCount: 50,
    region: '华北智算中心 · 大兴园区',
    stationIds: ['st-bjdx', 'st-tj'],
    x: 220,
    y: 260,
  },
  {
    id: 'pool-east-02',
    name: 'Pool-East-02',
    label: 'Pool-East-02 [50台]',
    serverCount: 50,
    region: '华北智算中心 · 深州园区',
    stationIds: ['st-hbsz', 'st-jsgp'],
    x: 720,
    y: 260,
  },
  {
    id: 'pool-core-03',
    name: 'Pool-Core-03',
    label: 'Pool-Core-03 [50台]',
    serverCount: 50,
    region: '西部核心智算中心 · 哈密/赣州联动',
    stationIds: ['st-xj', 'st-gd', 'st-jx'],
    x: 470,
    y: 580,
  },
]

export const PROJECTS: ProjectQuota[] = [
  {
    id: 'proj-llm',
    name: '大语言模型研发部',
    department: '基础模型事业部',
    guaranteed: 256,
    overQuota: 384,
    used: 198,
    priority: 1,
    preemptible: false,
  },
  {
    id: 'proj-mm',
    name: '多模态视觉组',
    department: '感知智能事业部',
    guaranteed: 128,
    overQuota: 192,
    used: 96,
    priority: 2,
    preemptible: true,
  },
  {
    id: 'proj-agent',
    name: '智能体推理平台组',
    department: '应用智能事业部',
    guaranteed: 96,
    overQuota: 160,
    used: 72,
    priority: 2,
    preemptible: true,
  },
  {
    id: 'proj-energy',
    name: '算电协同调度组',
    department: '基础设施事业部',
    guaranteed: 64,
    overQuota: 96,
    used: 41,
    priority: 3,
    preemptible: true,
  },
  {
    id: 'proj-rd',
    name: '算法预研专项',
    department: '研究院',
    guaranteed: 48,
    overQuota: 80,
    used: 28,
    priority: 4,
    preemptible: true,
  },
]

export const POLICIES: PolicyFlag[] = [
  {
    id: 'pol-binpack',
    name: 'Binpack 碎片整理优先',
    description: '优先将单卡任务装箱到已有碎片节点，降低空闲整机碎片率',
    enabled: true,
  },
  {
    id: 'pol-nvlink',
    name: 'NVLink 亲和性拓扑感知',
    description: '单机多卡任务优先调度至 NVLink 全互联拓扑完整的节点',
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
    description: '允许在 H100 上按 MIG / 显存配额切分，保障多租户任务隔离',
    enabled: false,
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

function pickGpuModel(seed: number): string {
  // 混部：NVIDIA ~55%，国产昇腾/寒武纪/壁仞 ~45%
  const r = seeded(seed + 41)
  if (r < 0.28) return 'NVIDIA H100 80GB HBM3'
  if (r < 0.42) return 'NVIDIA A800-SXM4-80GB'
  if (r < 0.55) return 'NVIDIA A100-SXM4-80GB'
  if (r < 0.78) return '华为昇腾 Ascend 910B 64GB'
  if (r < 0.9) return '寒武纪 MLU370-X8 48GB'
  return '壁仞 BR104 32GB'
}

function makeGpu(index: number, seed: number, gpuModel: string): GpuSlot {
  const spec = gpuSpec(gpuModel)
  const memCap = spec.memoryGb
  const r = seeded(seed + index * 17)
  let state: GpuState = 'idle'
  let memoryUsedGb = Math.round(1.2 + seeded(seed + index) * 3)
  let utilization = Math.round(seeded(seed + index * 3) * 8)
  let modelName: string | undefined
  let workloadId: string | undefined

  if (r > 0.72) {
    state = 'infer'
    // 单卡推理显存按卡容量缩放（32/48/64/80GB）
    memoryUsedGb = Math.round(memCap * (0.22 + seeded(seed + index * 5) * 0.35))
    utilization = 55 + Math.round(seeded(seed + index * 7) * 35)
    modelName = ['Qwen-7B-Chat', 'Qwen2.5-14B', 'BGE-M3', 'Whisper-Large-V3'][Math.floor(seeded(seed + index * 9) * 4)]
  } else if (r > 0.88) {
    state = 'multi'
    memoryUsedGb = Math.round(memCap * (0.55 + seeded(seed + index * 11) * 0.35))
    utilization = 70 + Math.round(seeded(seed + index * 13) * 25)
    modelName = 'Llama-3-70B-Instruct'
  }

  if (seeded(seed + index * 19) > 0.992) {
    state = 'fault'
    memoryUsedGb = 0
    utilization = 0
    modelName = undefined
  }

  const idle = spec.idleW - 15 + Math.round(seeded(seed + index) * 30)
  const powerW =
    state === 'idle' || state === 'fault'
      ? idle
      : Math.min(spec.tdpW, Math.round(idle + (utilization / 100) * (spec.tdpW - idle) + seeded(seed + index * 23) * 20))
  const temperature =
    state === 'idle' || state === 'fault'
      ? 36 + Math.round(seeded(seed + index) * 6)
      : Math.round(36 + (utilization / 100) * 42 + seeded(seed + index) * 4)

  return {
    index,
    state,
    memoryUsedGb: Math.min(memoryUsedGb, memCap - 2),
    memoryTotalGb: memCap,
    utilization,
    temperature,
    powerW,
    modelName,
    workloadId,
  }
}

export function buildServers(): ServerNode[] {
  const servers: ServerNode[] = []
  let globalIdx = 0

  POOLS.forEach((pool, poolIdx) => {
    for (let i = 0; i < 50; i++) {
      const row = Math.floor(i / 10)
      const col = i % 10
      const id = `node-${String(globalIdx + 1).padStart(3, '0')}`
      const hostname = `${pool.name.toLowerCase().replace(/_/g, '-')}-n${String(i + 1).padStart(2, '0')}`
      const ip = `10.${40 + poolIdx}.${row + 1}.${col + 10}`
      const seed = globalIdx * 97 + poolIdx * 13
      const gpuModel = pickGpuModel(seed)
      const gpus = Array.from({ length: 8 }, (_, gi) => makeGpu(gi, seed, gpuModel))
      const gpuPower = gpus.reduce((sum, gpu) => sum + gpu.powerW, 0)
      // HGX/DGX 机箱：GPU 功耗 + CPU/内存/网卡/PSU（约 0.9–1.3 kW）
      const chassisW = 950 + Math.round(seeded(seed + 7) * 350)

      servers.push({
        id,
        hostname,
        ip,
        poolId: pool.id,
        rackRow: row,
        rackCol: col,
        gpuModel,
        gpus,
        nvlinkStatus: seeded(seed + 50) > 0.97 ? 'degraded' : 'healthy',
        // IB HDR 200Gb/s 或 NDR 400Gb/s 常见；此处按 HDR 标称
        rdmaGbps: seeded(seed + 61) > 0.35 ? 400 : 200,
        temperature: Math.round(gpus.reduce((sum, gpu) => sum + gpu.temperature, 0) / gpus.length),
        powerW: gpuPower + chassisW,
        stationIds: pool.stationIds,
      })
      globalIdx++
    }
  })

  return servers
}

function applyGpuLoad(
  gpu: GpuSlot,
  server: ServerNode,
  state: GpuState,
  model: string,
  workloadId: string,
  memoryUsedGb: number,
  utilization: number,
) {
  const spec = gpuSpec(server.gpuModel)
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
  const chassis = Math.max(900, server.powerW - server.gpus.reduce((sum, gpu) => sum + gpu.powerW, 0))
  server.powerW = server.gpus.reduce((sum, gpu) => sum + gpu.powerW, 0) + Math.min(1400, Math.max(900, chassis))
  server.temperature = Math.round(server.gpus.reduce((sum, gpu) => sum + gpu.temperature, 0) / server.gpus.length)
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
  const poolOrder = preferredPool
    ? [preferredPool, ...POOLS.map((p) => p.id).filter((id) => id !== preferredPool)]
    : POOLS.map((p) => p.id)

  if (strategy === 'single') {
    for (const poolId of poolOrder) {
      const candidates = servers.filter((s) => s.poolId === poolId)
      candidates.sort((a, b) => {
        const aBusy = a.gpus.filter((g) => g.state !== 'idle').length
        const bBusy = b.gpus.filter((g) => g.state !== 'idle').length
        return bBusy - aBusy || a.id.localeCompare(b.id)
      })
      for (const server of candidates) {
        const free = server.gpus.find((g) => g.state === 'idle')
        if (!free) continue
        const util = 60 + Math.round(Math.random() * 30)
        const cap = gpuSpec(server.gpuModel).memoryGb
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
      const candidates = servers.filter((s) => s.poolId === poolId)
      for (const server of candidates) {
        const freeIndices = server.gpus.filter((g) => g.state === 'idle').map((g) => g.index)
        if (freeIndices.length < count) continue
        const chosen = freeIndices.slice(0, count)
        const cap = gpuSpec(server.gpuModel).memoryGb
        chosen.forEach((gi) => {
          const util = 75 + Math.round(Math.random() * 20)
          applyGpuLoad(server.gpus[gi], server, 'multi', model, workloadId, Math.round(cap * (0.55 + Math.random() * 0.35)), util)
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

  // Gang / PP: lock whole 8-GPU nodes across pools
  const needed = Math.max(1, Math.ceil(count / 8))
  const picked: ServerNode[] = []
  for (const poolId of poolOrder) {
    for (const server of servers.filter((s) => s.poolId === poolId)) {
      if (server.gpus.every((g) => g.state === 'idle')) {
        picked.push(server)
        if (picked.length >= needed) break
      }
    }
    if (picked.length >= needed) break
  }

  // If not enough fully idle, force-clear remaining from least-busy
  if (picked.length < needed) {
    const rest = servers
      .filter((s) => !picked.includes(s))
      .sort((a, b) => a.gpus.filter((g) => g.state !== 'idle').length - b.gpus.filter((g) => g.state !== 'idle').length)
    while (picked.length < needed && rest.length) {
      const s = rest.shift()!
      s.gpus.forEach((g) => {
        g.state = 'idle'
        g.workloadId = undefined
        g.modelName = undefined
        g.memoryUsedGb = 2
        g.utilization = 3
      })
      picked.push(s)
    }
  }

  picked.slice(0, needed).forEach((server) => {
    const cap = gpuSpec(server.gpuModel).memoryGb
    server.gpus.forEach((g) => {
      const util = 82 + Math.round(Math.random() * 14)
      applyGpuLoad(g, server, 'gang', model, workloadId, Math.round(cap * (0.7 + Math.random() * 0.22)), util)
    })
    refreshServerPower(server)
    allocations.push({
      poolId: server.poolId,
      serverId: server.id,
      hostname: server.hostname,
      gpuIndices: [0, 1, 2, 3, 4, 5, 6, 7],
    })
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
  const memoryGb = params.allocations.reduce((n, a) => {
    const server = params.servers.find((s) => s.id === a.serverId)!
    return n + a.gpuIndices.reduce((m, gi) => m + server.gpus[gi].memoryUsedGb, 0)
  }, 0)

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
    clusterName: 'fp-ai-factory-01',
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
    {
      name: 'inf-qwen7b-chat-prod',
      model: 'Qwen-7B-Chat',
      type: 'Inference',
      projectId: 'proj-agent',
      strategy: 'single',
      gpuCount: 1,
      latencyMs: 38,
      tokensPerSec: 86,
      durationSec: 12640,
      preferredPool: 'pool-east-01',
    },
    {
      name: 'inf-qwen25-14b-api',
      model: 'Qwen2.5-14B',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'single',
      gpuCount: 1,
      latencyMs: 52,
      tokensPerSec: 64,
      durationSec: 8420,
      preferredPool: 'pool-east-02',
    },
    {
      name: 'inf-llama3-70b-tp4',
      model: 'Llama-3-70B-Instruct',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 96,
      tokensPerSec: 42,
      durationSec: 15300,
      preferredPool: 'pool-east-01',
    },
    {
      name: 'inf-deepseek-v3-pp',
      model: 'DeepSeek-V3-671B',
      type: 'Inference',
      projectId: 'proj-llm',
      strategy: 'pp',
      gpuCount: 32,
      latencyMs: 186,
      tokensPerSec: 28,
      durationSec: 7200,
    },
    {
      name: 'train-qwen25-sft',
      model: 'Qwen2.5-14B-SFT',
      type: 'Training',
      projectId: 'proj-llm',
      strategy: 'tp',
      gpuCount: 8,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 18600,
      preferredPool: 'pool-core-03',
      createdBy: 'chenli@fathompeak.cn',
    },
    {
      name: 'ws-jupyter-mm-dev',
      model: 'InternVL2-Dev',
      type: 'Workspace',
      projectId: 'proj-mm',
      strategy: 'single',
      gpuCount: 1,
      latencyMs: 0,
      tokensPerSec: 0,
      durationSec: 5400,
      preferredPool: 'pool-east-02',
      createdBy: 'liwei@fathompeak.cn',
    },
    {
      name: 'inf-whisper-asr',
      model: 'Whisper-Large-V3',
      type: 'Inference',
      projectId: 'proj-mm',
      strategy: 'single',
      gpuCount: 1,
      latencyMs: 210,
      tokensPerSec: 0,
      durationSec: 4100,
      preferredPool: 'pool-core-03',
    },
    {
      name: 'inf-internvl-mm',
      model: 'InternVL2-40B',
      type: 'Inference',
      projectId: 'proj-mm',
      strategy: 'tp',
      gpuCount: 4,
      latencyMs: 124,
      tokensPerSec: 31,
      durationSec: 9800,
      preferredPool: 'pool-east-02',
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
  const total = servers.length * 8
  const greenPowerMw = stations.reduce((n, s) => n + s.currentMw, 0)
  const capacity = stations.reduce((n, s) => n + s.capacityMw, 0)
  return {
    poolCount: POOLS.length,
    serverCount: servers.length,
    gpuCount: total,
    utilization: Math.round((busy / total) * 1000) / 10,
    runningTasks: workloads.filter((w) => w.status === 'Running').length,
    greenPowerMw: Math.round(greenPowerMw * 10) / 10,
    greenRatio: Math.round((greenPowerMw / capacity) * 1000) / 10,
  }
}

export function createInitialState(): AppState {
  const servers = buildServers()
  const workloads = seedInitialWorkloads(servers)
  syncWorkloadLinks(servers, workloads)
  const audits: AuditEvent[] = [
    {
      id: 'aud-001',
      ts: Date.now() - 3600_000,
      actor: USER,
      action: '登录系统',
      target: 'Auth Gateway',
      detail: '集群超级管理员会话建立',
      level: 'success',
    },
    {
      id: 'aud-002',
      ts: Date.now() - 3200_000,
      actor: 'scheduler',
      action: 'Gang 调度锁定',
      target: 'inf-deepseek-v3-pp',
      detail: '跨 Pool-East-01 / Pool-Core-03 锁定 4×8 卡整机',
      level: 'info',
    },
    {
      id: 'aud-003',
      ts: Date.now() - 2800_000,
      actor: 'scheduler',
      action: 'Binpack 装箱',
      target: 'inf-qwen7b-chat-prod',
      detail: '碎片节点 Node-003 GPU0 承接单卡推理',
      level: 'info',
    },
    {
      id: 'aud-004',
      ts: Date.now() - 2100_000,
      actor: USER,
      action: '启用策略',
      target: '绿电优先算电协同',
      detail: '电站出力高峰时段优先调度绿电节点池',
      level: 'success',
    },
    {
      id: 'aud-005',
      ts: Date.now() - 1500_000,
      actor: 'scheduler',
      action: 'NVLink 亲和调度',
      target: 'inf-llama3-70b-tp4',
      detail: '同一机箱 GPU0-3 NVLink 直连拓扑匹配成功',
      level: 'info',
    },
    {
      id: 'aud-006',
      ts: Date.now() - 900_000,
      actor: USER,
      action: '调整配额',
      target: '大语言模型研发部',
      detail: 'Guaranteed Quota 调整为 256 GPU',
      level: 'warn',
    },
    {
      id: 'aud-007',
      ts: Date.now() - 400_000,
      actor: 'scheduler',
      action: '绿电迁移建议',
      target: 'Pool-Core-03',
      detail: '新疆光伏 + 汕头风电出力上升，建议迁移可抢占任务',
      level: 'info',
    },
  ]

  return {
    authenticated: false,
    user: USER,
    role: '集群超级管理员',
    pools: POOLS,
    servers,
    workloads,
    projects: PROJECTS.map((p) => ({ ...p })),
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
      name: custom?.name ?? `${type === 'Workspace' ? 'ws' : type === 'Training' ? 'train' : 'inf'}-qwen7b-${wlSeq}`,
      model: custom?.model ?? 'Qwen-7B-Chat',
      strategy: 'single' as ScheduleStrategy,
      gpuCount: custom?.gpuCount ?? 1,
      projectId: custom?.projectId ?? 'proj-agent',
      latencyMs: type === 'Inference' ? 36 + Math.round(Math.random() * 18) : 0,
      tokensPerSec: type === 'Inference' ? 78 + Math.round(Math.random() * 20) : 0,
    },
    tp4: {
      name: custom?.name ?? `${type === 'Training' ? 'train' : 'inf'}-llama70b-tp-${wlSeq}`,
      model: custom?.model ?? 'Llama-3-70B-Instruct',
      strategy: 'tp' as ScheduleStrategy,
      gpuCount: custom?.gpuCount ?? 4,
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
      action: kind === 'single' ? 'Binpack 装箱' : kind === 'tp4' ? 'NVLink 亲和调度' : 'Gang 调度锁定',
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
        powerW: gpuSpec(s.gpuModel).idleW - 10 + Math.round(Math.random() * 25),
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

export function tickLiveMetrics(state: AppState): AppState {
  const utilizationJitter = (Math.random() - 0.5) * 0.6
  const stations = state.stations.map((s) => {
    const delta = (Math.random() - 0.5) * s.capacityMw * 0.012
    const currentMw = Math.max(s.capacityMw * 0.35, Math.min(s.capacityMw * 0.98, s.currentMw + delta))
    return { ...s, currentMw: Math.round(currentMw * 10) / 10 }
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
    .replace(/区/g, '')
    .replace(/分布式光伏$/, '分布式')
    .replace(/集中式光伏$/, '集中式')
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
