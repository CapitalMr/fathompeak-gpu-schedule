import type {
  AppState,
  AuditEvent,
  ManagedCluster,
  ManagedDepartment,
  NodePool,
  ProjectQuota,
} from '../types'
import { stopWorkload } from './engine'

function audit(
  state: AppState,
  action: string,
  target: string,
  detail: string,
  level: AuditEvent['level'] = 'warn',
): AuditEvent[] {
  return [
    {
      id: `aud-inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(),
      actor: state.user,
      action,
      target,
      detail,
      level,
    },
    ...state.audits,
  ]
}

export function createCluster(
  state: AppState,
  input: { name: string; region: string; kubernetes: string; endpoint: string; stationId: string },
): AppState {
  const id = `cls-${input.name.replace(/^cls-/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-') || Date.now()}`
  if (state.clusters.some((cluster) => cluster.id === id || cluster.name === input.name)) return state
  const cluster: ManagedCluster = {
    id,
    name: input.name.startsWith('cls-') ? input.name : `cls-${input.name}`,
    region: input.region,
    kubernetes: input.kubernetes || 'v1.29.6',
    status: 'Connecting',
    stationId: input.stationId || state.activeStationId,
    endpoint: input.endpoint || `https://api.${id}.fathompeak.cn`,
    createdAt: Date.now(),
  }
  return {
    ...state,
    clusters: [cluster, ...state.clusters],
    audits: audit(state, '纳管集群', cluster.name, `连接 ${cluster.endpoint} · ${cluster.region}`, 'success'),
  }
}

export function setClusterStatus(state: AppState, clusterId: string, status: ManagedCluster['status']): AppState {
  const current = state.clusters.find((cluster) => cluster.id === clusterId)
  if (!current) return state
  return {
    ...state,
    clusters: state.clusters.map((cluster) => (cluster.id === clusterId ? { ...cluster, status } : cluster)),
    audits: audit(
      state,
      status === 'Connected' ? '连接集群' : status === 'Offline' ? '下线集群' : '更新集群状态',
      current.name,
      `状态 → ${status}`,
      status === 'Offline' ? 'warn' : 'success',
    ),
  }
}

export function deleteCluster(state: AppState, clusterId: string): AppState {
  const current = state.clusters.find((cluster) => cluster.id === clusterId)
  if (!current) return state
  const boundPools = Object.entries(state.poolBindings)
    .filter(([, ids]) => ids.includes(clusterId))
    .map(([poolId]) => poolId)
  if (boundPools.length) {
    return {
      ...state,
      audits: audit(state, '删除集群失败', current.name, `仍绑定节点池：${boundPools.join(', ')}`, 'warn'),
    }
  }
  return {
    ...state,
    clusters: state.clusters.filter((cluster) => cluster.id !== clusterId),
    audits: audit(state, '删除集群', current.name, '已从控制面移除', 'warn'),
  }
}

export function createNodePool(
  state: AppState,
  input: { name: string; region: string; clusterId: string; stationId?: string },
): AppState {
  const id = `pool-${input.name.toLowerCase().replace(/^pool-/, '').replace(/[^a-z0-9-]+/g, '-') || Date.now()}`
  if (state.pools.some((pool) => pool.id === id)) return state
  const display = input.name.startsWith('Pool-') ? input.name : `Pool-${input.name}`
  const pool: NodePool = {
    id,
    name: display,
    label: `${display} [0台]`,
    serverCount: 0,
    region: input.region,
    stationIds: input.stationId ? [input.stationId] : [],
    x: 400 + Math.round(Math.random() * 80),
    y: 300 + Math.round(Math.random() * 80),
    status: 'Ready',
    clusterId: input.clusterId,
  }
  return {
    ...state,
    pools: [pool, ...state.pools],
    poolBindings: { ...state.poolBindings, [id]: input.clusterId ? [input.clusterId] : [] },
    audits: audit(state, '创建节点池', pool.name, `绑定集群 ${input.clusterId || '未指定'}`, 'success'),
  }
}

export function setPoolStatus(state: AppState, poolId: string, status: NonNullable<NodePool['status']>): AppState {
  const current = state.pools.find((pool) => pool.id === poolId)
  if (!current) return state
  return {
    ...state,
    pools: state.pools.map((pool) => (pool.id === poolId ? { ...pool, status } : pool)),
    audits: audit(
      state,
      status === 'Disabled' ? '停用节点池' : status === 'Draining' ? '排空节点池' : '启用节点池',
      current.name,
      `生命周期 → ${status}`,
      status === 'Ready' ? 'success' : 'warn',
    ),
  }
}

export function deleteNodePool(state: AppState, poolId: string): AppState {
  const current = state.pools.find((pool) => pool.id === poolId)
  if (!current) return state
  if (state.servers.some((server) => server.poolId === poolId)) {
    return {
      ...state,
      audits: audit(state, '删除节点池失败', current.name, '池内仍有节点，请先迁移或下线', 'warn'),
    }
  }
  const { [poolId]: _removed, ...rest } = state.poolBindings
  return {
    ...state,
    pools: state.pools.filter((pool) => pool.id !== poolId),
    poolBindings: rest,
    audits: audit(state, '删除节点池', current.name, '已从调度域移除', 'warn'),
  }
}

export function setServerCordon(state: AppState, serverId: string, cordoned: boolean): AppState {
  const server = state.servers.find((item) => item.id === serverId)
  if (!server) return state
  return {
    ...state,
    servers: state.servers.map((item) =>
      item.id === serverId ? { ...item, cordoned, draining: cordoned ? item.draining : false } : item,
    ),
    audits: audit(state, cordoned ? 'Cordon 节点' : 'Uncordon 节点', server.hostname, cordoned ? '禁止新调度' : '恢复可调度', 'warn'),
  }
}

export function setServerDrain(state: AppState, serverId: string, draining: boolean): AppState {
  const server = state.servers.find((item) => item.id === serverId)
  if (!server) return state
  let next = {
    ...state,
    servers: state.servers.map((item) =>
      item.id === serverId
        ? {
            ...item,
            draining,
            cordoned: draining ? true : item.cordoned,
            nvlinkStatus: draining ? item.nvlinkStatus : item.nvlinkStatus,
          }
        : item,
    ),
    audits: audit(state, draining ? 'Drain 节点' : '取消 Drain', server.hostname, draining ? '驱逐工作负载中' : '结束驱逐', 'warn'),
  }
  if (draining) {
    const victims = state.workloads.filter(
      (workload) =>
        workload.status === 'Running' && workload.allocations.some((allocation) => allocation.serverId === serverId),
    )
    for (const workload of victims) {
      next = stopWorkload(next, workload.id)
    }
    next = {
      ...next,
      servers: next.servers.map((item) =>
        item.id === serverId
          ? {
              ...item,
              draining: false,
              cordoned: true,
              gpus: item.gpus.map((gpu) =>
                gpu.state === 'fault'
                  ? gpu
                  : { ...gpu, state: 'idle' as const, workloadId: undefined, modelName: undefined, utilization: 2 },
              ),
            }
          : item,
      ),
    }
  }
  return next
}

export function setServerOffline(state: AppState, serverId: string, offline: boolean): AppState {
  const server = state.servers.find((item) => item.id === serverId)
  if (!server) return state
  let next = state
  if (offline) {
    const victims = state.workloads.filter(
      (workload) =>
        workload.status === 'Running' && workload.allocations.some((allocation) => allocation.serverId === serverId),
    )
    for (const workload of victims) next = stopWorkload(next, workload.id)
  }
  return {
    ...next,
    servers: next.servers.map((item) =>
      item.id === serverId
        ? {
            ...item,
            nvlinkStatus: offline ? 'offline' : 'healthy',
            cordoned: offline ? true : false,
            draining: false,
            gpus: offline
              ? item.gpus.map((gpu) => ({
                  ...gpu,
                  state: gpu.state === 'fault' ? gpu.state : ('idle' as const),
                  workloadId: undefined,
                  modelName: undefined,
                  utilization: 0,
                }))
              : item.gpus,
          }
        : item,
    ),
    audits: audit(next, offline ? '下线节点' : '上线节点', server.hostname, offline ? '节点退出调度域' : '节点重新加入', 'warn'),
  }
}

export function markGpuFault(state: AppState, serverId: string, gpuIndex: number, fault: boolean): AppState {
  const server = state.servers.find((item) => item.id === serverId)
  if (!server) return state
  return {
    ...state,
    servers: state.servers.map((item) =>
      item.id === serverId
        ? {
            ...item,
            gpus: item.gpus.map((gpu) =>
              gpu.index === gpuIndex
                ? {
                    ...gpu,
                    state: fault ? ('fault' as const) : ('idle' as const),
                    workloadId: fault ? undefined : gpu.workloadId,
                    modelName: fault ? undefined : gpu.modelName,
                    utilization: fault ? 0 : gpu.utilization,
                  }
                : gpu,
            ),
          }
        : item,
    ),
    audits: audit(
      state,
      fault ? '标记故障卡' : '恢复故障卡',
      `${server.hostname}/GPU${gpuIndex}`,
      fault ? '已从调度池摘除' : '重新可调度',
      'warn',
    ),
  }
}

export function createDepartment(state: AppState, input: { name: string; gpuQuota: number }): AppState {
  if (!input.name.trim()) return state
  const department: ManagedDepartment = {
    id: `dept-${Date.now()}`,
    name: input.name.trim(),
    gpuQuota: Math.max(0, input.gpuQuota),
  }
  return {
    ...state,
    departments: [department, ...state.departments],
    audits: audit(state, '创建部门', department.name, `配额 ${department.gpuQuota} GPU`, 'success'),
  }
}

export function updateDepartment(state: AppState, id: string, patch: Partial<ManagedDepartment>): AppState {
  const current = state.departments.find((department) => department.id === id)
  if (!current) return state
  return {
    ...state,
    departments: state.departments.map((department) => (department.id === id ? { ...department, ...patch } : department)),
    audits: audit(state, '更新部门', patch.name ?? current.name, '调整部门配额或名称', 'warn'),
  }
}

export function deleteDepartment(state: AppState, id: string): AppState {
  const current = state.departments.find((department) => department.id === id)
  if (!current) return state
  if (state.projects.some((project) => project.department === current.name)) {
    return {
      ...state,
      audits: audit(state, '删除部门失败', current.name, '仍有项目归属该部门', 'warn'),
    }
  }
  return {
    ...state,
    departments: state.departments.filter((department) => department.id !== id),
    audits: audit(state, '删除部门', current.name, '已移除组织单元', 'warn'),
  }
}

export function createProject(
  state: AppState,
  input: {
    name: string
    department: string
    guaranteed: number
    overQuota: number
    priority: number
    preemptible: boolean
  },
): AppState {
  if (!input.name.trim()) return state
  const project: ProjectQuota = {
    id: `proj-${Date.now()}`,
    name: input.name.trim(),
    department: input.department,
    guaranteed: input.guaranteed,
    overQuota: Math.max(input.guaranteed, input.overQuota),
    used: 0,
    priority: input.priority,
    preemptible: input.preemptible,
  }
  return {
    ...state,
    projects: [project, ...state.projects],
    audits: audit(state, '创建项目', project.name, `${project.department} · 保底 ${project.guaranteed}`, 'success'),
  }
}

export function deleteProject(state: AppState, projectId: string): AppState {
  const current = state.projects.find((project) => project.id === projectId)
  if (!current) return state
  if (state.workloads.some((workload) => workload.projectId === projectId && (workload.status === 'Running' || workload.status === 'Pending'))) {
    return {
      ...state,
      audits: audit(state, '删除项目失败', current.name, '仍有运行中或排队任务', 'warn'),
    }
  }
  return {
    ...state,
    projects: state.projects.filter((project) => project.id !== projectId),
    audits: audit(state, '归档项目', current.name, '项目已从配额表移除', 'warn'),
  }
}

export function bulkStopWorkloads(state: AppState, ids: string[]): AppState {
  let next = state
  for (const id of ids) {
    const workload = next.workloads.find((item) => item.id === id)
    if (!workload) continue
    if (workload.status === 'Running') next = stopWorkload(next, id)
    else if (workload.status === 'Pending') {
      next = {
        ...next,
        workloads: next.workloads.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'Succeeded' as const,
                events: [...item.events, { ts: Date.now(), phase: 'Cancelled', message: '批量取消排队' }],
              }
            : item,
        ),
      }
    }
  }
  return {
    ...next,
    audits: audit(state, '批量停止/取消', `${ids.length} 个工作负载`, '管理员批量管控', 'warn'),
  }
}
