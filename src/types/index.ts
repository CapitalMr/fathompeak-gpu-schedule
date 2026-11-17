export type GpuState = 'idle' | 'infer' | 'multi' | 'gang' | 'fault'
export type ScheduleStrategy = 'single' | 'tp' | 'pp'
export type WorkloadStatus = 'Running' | 'Pending' | 'Succeeded' | 'Failed' | 'Stopping'
export type WorkloadType = 'Inference' | 'Training' | 'Workspace'
export type ZoomPreset = 'macro' | 'meso' | 'micro'

export interface WorkloadEvent {
  ts: number
  phase: string
  message: string
}

export interface WorkloadPod {
  name: string
  role: string
  status: 'Running' | 'Pending' | 'Succeeded' | 'Failed'
  nodeName: string
  nodePool: string
  gpuIndices: number[]
  gpuRequest: number
  memoryGb: number
  image: string
}

export interface PowerStation {
  id: string
  name: string
  type: '分布式光伏' | '集中式光伏' | '海上风电' | '水电'
  region: string
  capacityMw: number
  currentMw: number
  greenRatio: number
}

export interface GpuSlot {
  index: number
  /** 物理卡型号，如 NVIDIA H100 / RTX 5090 / Ascend 910B */
  cardModel: string
  state: GpuState
  memoryUsedGb: number
  memoryTotalGb: number
  utilization: number
  temperature: number
  powerW: number
  /** 当前推理/训练任务绑定的模型名 */
  modelName?: string
  workloadId?: string
}

export interface ServerNode {
  id: string
  hostname: string
  ip: string
  poolId: string
  rackRow: number
  rackCol: number
  /** 机箱卡型摘要（同卡或混卡），如「H100×4 + H200×4」 */
  gpuModel: string
  gpus: GpuSlot[]
  /** 节点健康状态（字段名历史兼容；展示层用「状态」） */
  nvlinkStatus: 'healthy' | 'degraded' | 'offline'
  rdmaGbps: number
  temperature: number
  /** 机箱底板功耗（CPU/内存/网卡/PSU），随槽位规模变化 */
  chassisBaseW: number
  powerW: number
  stationIds: string[]
}

export interface NodePool {
  id: string
  name: string
  label: string
  serverCount: number
  region: string
  stationIds: string[]
  x: number
  y: number
}

export interface Workload {
  id: string
  name: string
  model: string
  type: WorkloadType
  projectId: string
  projectName: string
  strategy: ScheduleStrategy
  status: WorkloadStatus
  createdBy: string
  image: string
  clusterName: string
  architecture: 'Standard' | 'Distributed'
  gpuCount: number
  memoryGb: number
  podsRequested: number
  podsRunning: number
  latencyMs: number
  tokensPerSec: number
  startedAt: number
  durationSec: number
  allocations: Allocation[]
  pods: WorkloadPod[]
  events: WorkloadEvent[]
  endpoint?: string
}

export interface Allocation {
  poolId: string
  serverId: string
  hostname: string
  gpuIndices: number[]
}

export interface ProjectQuota {
  id: string
  name: string
  department: string
  guaranteed: number
  overQuota: number
  used: number
  priority: number
  preemptible: boolean
}

export interface PolicyFlag {
  id: string
  name: string
  description: string
  enabled: boolean
}

export interface AuditEvent {
  id: string
  ts: number
  actor: string
  action: string
  target: string
  detail: string
  level: 'info' | 'warn' | 'success'
}

export interface ClusterMetrics {
  poolCount: number
  serverCount: number
  gpuCount: number
  utilization: number
  runningTasks: number
  greenPowerMw: number
  greenRatio: number
}

export interface AppState {
  authenticated: boolean
  user: string
  role: string
  pools: NodePool[]
  servers: ServerNode[]
  workloads: Workload[]
  projects: ProjectQuota[]
  policies: PolicyFlag[]
  audits: AuditEvent[]
  stations: PowerStation[]
  metrics: ClusterMetrics
  selectedWorkloadId: string | null
  activeStationId: string
  focusServerId: string | null
  focusPoolId: string | null
  zoomPreset: ZoomPreset
  canvasRequest: CanvasRequest | null
  scheduleFlowWorkloadId: string | null
}

export interface CanvasRequest {
  id: number
  type: 'focus-workload' | 'focus-server' | 'zoom-preset' | 'spawn-animation'
  payload?: Record<string, unknown>
}
