import { useMemo } from 'react'
import type { NodePool, PowerStation, Workload } from '../../types'
import {
  FLY_HUB,
  FLY_MARKS,
  hubFlyPath,
  markById,
  peerFlyPath,
  stablePeerLinksForStations,
  stableStationsForTask,
} from '../monitor/flyMapData'

function candidateStations(workload: Workload, pools: NodePool[]): string[] {
  const poolIds = new Set(workload.allocations.map((a) => a.poolId))
  if (poolIds.size === 0) return []
  const ids = new Set<string>()
  pools.forEach((pool) => {
    if (poolIds.has(pool.id)) pool.stationIds.forEach((id) => ids.add(id))
  })
  return [...ids]
}

export function CrossCenterFlyPanel({
  workload,
  pools,
  stations,
  accent,
}: {
  workload: Workload
  pools: NodePool[]
  stations: PowerStation[]
  accent: string
}) {
  // 运行中任务：按分配结果固定 1～3 个地区；同一任务不再切换飞线
  const multiCard = workload.gpuCount > 1 || workload.allocations.length > 1
  const assigned = useMemo(() => {
    const candidates = candidateStations(workload, pools)
    const max = multiCard ? 3 : 1
    return stableStationsForTask(workload.id, candidates, max)
  }, [workload, pools, multiCard])

  const peers = useMemo(
    () => (multiCard ? stablePeerLinksForStations(workload.id, assigned) : []),
    [workload.id, assigned, multiCard],
  )

  const assignedSet = useMemo(() => new Set(assigned), [assigned])
  const peerIds = useMemo(() => {
    const set = new Set<string>()
    peers.forEach((p) => {
      set.add(p.from)
      set.add(p.to)
    })
    return set
  }, [peers])

  const mw = new Map(stations.map((s) => [s.id, s.currentMw]))
  const poolNames = pools
    .filter((p) => workload.allocations.some((a) => a.poolId === p.id))
    .map((p) => p.name)
  const centers = FLY_MARKS.filter((m) => assignedSet.has(m.id)).map((m) => m.center)
  const uniqueCenters = [...new Set(centers)]

  return (
    <div className="border-b border-border bg-[linear-gradient(180deg,#fbfaf7_0%,#ffffff_100%)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.14em] text-dim">跨中心协同拓扑</div>
          <div className="mt-0.5 text-[12px] text-muted">
            调度网关直连已分配区域
            {uniqueCenters.length > 0 ? ` · ${uniqueCenters.join(' / ')}` : ''}
            {poolNames.length > 0 ? ` · ${poolNames.join(' / ')}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-border bg-void/80 px-2.5 py-0.5 text-[10px] text-dim">
            已分配 {assigned.length} 区
          </span>
          {peers.map((p) => (
            <span
              key={p.id}
              className="rounded-full border border-[rgba(138,98,50,0.3)] bg-[rgba(138,98,50,0.08)] px-2.5 py-0.5 text-[10px] text-gang"
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 1280 220" className="block h-[168px] w-full" role="img" aria-label="跨中心任务协同拓扑">
        <defs>
          <radialGradient id="flowMapGlow" cx="58%" cy="40%" r="55%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1280" height="220" fill="url(#flowMapGlow)" />

        <g transform="translate(0,-120) scale(1,0.85)">
          {/* 网关 → 已分配区域：固定直连；其余区域仅弱参考 */}
          {FLY_MARKS.map((mark) => {
            const primary = assignedSet.has(mark.id)
            const d = hubFlyPath(mark.x, mark.y, mark.bend)
            return (
              <g key={`hub-${mark.id}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={accent}
                  strokeWidth={primary ? 2 : 1}
                  strokeOpacity={primary ? 0.88 : 0.18}
                  className={primary ? 'fp-flow' : undefined}
                />
                {primary && <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.1} className="fp-bead" />}
              </g>
            )
          })}

          {/* 多卡任务：已分配地区之间的固定协同边 */}
          {peers.map((link) => {
            const from = markById(link.from)
            const to = markById(link.to)
            if (!from || !to) return null
            const d = peerFlyPath(from, to, link.bend)
            return (
              <g key={link.id}>
                <path d={d} fill="none" stroke="#8a6232" strokeWidth={3.2} strokeOpacity={0.14} />
                <path d={d} fill="none" stroke="#8a6232" strokeWidth={2} className="fp-flow" />
                <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.3} className="fp-bead" />
              </g>
            )
          })}

          <circle cx={FLY_HUB.x} cy={FLY_HUB.y} r={14} fill="none" stroke={accent} strokeWidth="1.3" className="fp-ring" />
          <circle cx={FLY_HUB.x} cy={FLY_HUB.y} r={6} fill={accent} className="fp-core" />
          <text x={FLY_HUB.x} y={FLY_HUB.y + 28} textAnchor="middle" fill="#212021" fontSize="11">
            调度网关
          </text>

          {FLY_MARKS.map((mark) => {
            const primary = assignedSet.has(mark.id)
            const linked = peerIds.has(mark.id)
            const hot = primary || linked
            return (
              <g key={mark.id} opacity={hot ? 1 : 0.28}>
                {primary && (
                  <circle cx={mark.x} cy={mark.y} r={9} fill="none" stroke={accent} strokeWidth="1.2" className="fp-ring" />
                )}
                <circle
                  cx={mark.x}
                  cy={mark.y}
                  r={primary ? 5 : linked ? 4.2 : 3}
                  fill={primary ? accent : linked ? '#8a6232' : mark.color}
                />
                <text
                  x={mark.x}
                  y={mark.y + (mark.y > 400 ? -14 : 18)}
                  textAnchor="middle"
                  fill={primary ? '#212021' : 'rgba(33,32,33,0.4)'}
                  fontSize={primary ? 12 : 10}
                  fontWeight={primary ? 600 : 400}
                >
                  {mark.short}
                </text>
                {primary && (
                  <text
                    x={mark.x}
                    y={mark.y + (mark.y > 400 ? -28 : 32)}
                    textAnchor="middle"
                    fill="rgba(33,32,33,0.5)"
                    fontSize="9"
                    fontFamily="DM Mono, ui-monospace"
                  >
                    {(mw.get(mark.id) ?? 0).toFixed(0)} MW
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
