import type { StationHealth, StationMapStat } from './NationalFlyMap'
import type { NodePool, ServerNode, Workload } from '../../types'

export function serversForStation(servers: ServerNode[], pools: NodePool[], stationId: string) {
  const pool = pools.find((item) => item.stationIds.includes(stationId))
  if (!pool) return servers
  const owned = servers.filter((server) => server.poolId === pool.id)
  const index = Math.max(0, pool.stationIds.indexOf(stationId))
  const parts = pool.stationIds.length || 1
  return owned.filter((_, serverIndex) => serverIndex % parts === index)
}

export function workloadsForStation(workloads: Workload[], servers: ServerNode[]) {
  const ids = new Set(servers.map((server) => server.id))
  return workloads.filter(
    (workload) => workload.status !== 'Running' || workload.allocations.some((allocation) => ids.has(allocation.serverId)),
  )
}

export function stationStat(stationId: string, servers: ServerNode[], pools: NodePool[], workloads: Workload[]): StationMapStat {
  const scoped = serversForStation(servers, pools, stationId)
  const ids = new Set(scoped.map((server) => server.id))
  const gpus = scoped.flatMap((server) => server.gpus)
  const idle = gpus.filter((gpu) => gpu.state === 'idle').length
  const faults = gpus.filter((gpu) => gpu.state === 'fault').length
  const offline = scoped.some((server) => server.nvlinkStatus === 'offline')
  const ratio = gpus.length ? idle / gpus.length : 1
  let health: StationHealth = 'healthy'
  if (offline || faults >= 2) health = 'fault'
  else if (ratio < 0.2) health = 'tight'
  return {
    id: stationId,
    tasks: workloads.filter(
      (workload) => workload.status === 'Running' && workload.allocations.some((allocation) => ids.has(allocation.serverId)),
    ).length,
    idle,
    total: gpus.length,
    health,
  }
}
