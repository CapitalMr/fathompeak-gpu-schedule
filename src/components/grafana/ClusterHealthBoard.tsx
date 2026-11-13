import { useMemo } from 'react'
import { clusterTitle } from '../../mock/engine'
import { useApp } from '../../store/AppContext'
import { EngineWaveChart } from './EngineWaveChart'
import { FleetStatusBar } from './FleetStatusBar'
import { FabricChart, PrecisionChart } from './PrecisionFabricCharts'
import { WorstFirstTable } from './WorstFirstTable'
import { useClusterTelemetry } from './useClusterTelemetry'

export function ClusterHealthBoard() {
  const { state } = useApp()
  const station = state.stations.find((item) => item.id === state.activeStationId) ?? state.stations[0]
  const pool = state.pools.find((item) => item.stationIds.includes(station?.id ?? ''))
  const servers = useMemo(
    () => (pool ? state.servers.filter((server) => server.poolId === pool.id) : state.servers),
    [pool, state.servers],
  )
  const history = useClusterTelemetry(servers)
  const latest = history[history.length - 1]

  return (
    <section className="min-w-0 rounded-2xl border border-[#1b2128] bg-[#0b0f19] p-3 text-[#d8d9da] shadow-[0_18px_50px_rgba(8,12,20,0.18)]">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="font-mono text-[10px] tracking-[0.16em] text-[#6e7781]">
            NVIDIA DCGM · 25820 / 22424
          </div>
          <h3 className="mt-1 font-sans text-[22px] font-medium tracking-tight text-[#f4f6f8]">区域集群健康监测</h3>
          <p className="mt-1 text-[12px] text-[#8e8ea0]">
            {station ? clusterTitle(station.name) : ''} · {pool?.label ?? '全部节点池'} · 遥测指标实时刷新
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-[#73BF69]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#73BF69] opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#73BF69]" />
          </span>
          {latest ? new Date(latest.t).toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--'}
        </div>
      </header>

      <div className="grid gap-2">
        <FleetStatusBar history={history} />
        <EngineWaveChart history={history} />
        <div className="grid gap-2 xl:grid-cols-2">
          <PrecisionChart history={history} />
          <FabricChart history={history} />
        </div>
        <WorstFirstTable servers={servers} workloads={state.workloads} tick={latest?.t ?? Date.now()} />
      </div>
    </section>
  )
}
