import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, MonitorSmartphone } from 'lucide-react'
import { ClusterStatsPanel } from '../components/dashboard/ClusterStatsPanel'
import { MetricsBar } from '../components/dashboard/MetricsBar'
import { PowerStrip } from '../components/dashboard/PowerStrip'
import { clusterTitle } from '../mock/engine'
import { useApp } from '../store/AppContext'

export function Dashboard() {
  const { state } = useApp()
  const navigate = useNavigate()

  const summary = useMemo(() => {
    const station = state.stations.find((s) => s.id === state.activeStationId) ?? state.stations[0]
    const pool = state.pools.find((p) => p.stationIds.includes(station?.id ?? ''))
    const servers = pool ? state.servers.filter((s) => s.poolId === pool.id) : state.servers
    const gpus = servers.flatMap((s) => s.gpus)
    const running = state.workloads.filter(
      (w) => w.status === 'Running' && (!pool || w.allocations.some((a) => a.poolId === pool.id)),
    ).length
    const pending = state.workloads.filter((w) => w.status === 'Pending').length
    const fault = gpus.filter((g) => g.state === 'fault').length
    return { station, servers, gpus, running, pending, fault }
  }, [state])

  return (
    <div className="h-full overflow-auto px-8 pb-8 pt-1">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12.5px] text-dim">资源</p>
          <h2 className="text-[28px] leading-none">集群总览</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            {summary.station ? clusterTitle(summary.station.name) : ''} · {summary.servers.length} 机 /{' '}
            {summary.gpus.length} 卡 · 运行 {summary.running} · 排队 {summary.pending}
            {summary.fault > 0 ? ` · 故障卡 ${summary.fault}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/monitor')}
          className="group flex h-9 items-center gap-2 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-3.5 text-[13px] font-medium text-infer shadow-[0_2px_10px_rgba(47,99,184,0.12)] transition hover:bg-[#e3ecfa]"
        >
          <MonitorSmartphone className="h-4 w-4" />
          打开监控大屏
          <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      <div className="mb-3">
        <MetricsBar />
      </div>
      <div className="mb-3">
        <PowerStrip />
      </div>
      <ClusterStatsPanel />
    </div>
  )
}
