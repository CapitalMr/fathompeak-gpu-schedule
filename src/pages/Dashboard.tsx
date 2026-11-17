import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Bell, ListOrdered, MonitorSmartphone, Server } from 'lucide-react'
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
    const pendingList = state.workloads.filter((w) => w.status === 'Pending')
    const pending = pendingList.length
    const failed = state.workloads.filter((w) => w.status === 'Failed').length
    const fault = gpus.filter((g) => g.state === 'fault').length
    const overQuota = state.projects.filter((p) => p.used > p.guaranteed).length
    const highBlocked = pendingList.filter((w) => (state.projects.find((p) => p.id === w.projectId)?.priority ?? 3) <= 1)
      .length
    return { station, servers, gpus, running, pending, failed, fault, overQuota, highBlocked }
  }, [state])

  const actions = [
    {
      id: 'queue',
      title: '排队积压',
      value: summary.pending,
      hint: summary.highBlocked > 0 ? `${summary.highBlocked} 个高优阻塞` : '查看通道与阻塞原因',
      tone: summary.pending > 0 ? 'text-gang' : 'text-muted',
      to: '/queues',
      icon: ListOrdered,
    },
    {
      id: 'fail',
      title: '失败任务',
      value: summary.failed,
      hint: summary.failed > 0 ? '可在详情中重试' : '暂无失败',
      tone: summary.failed > 0 ? 'text-alert' : 'text-muted',
      to: '/workloads?status=Failed',
      icon: Bell,
    },
    {
      id: 'fault',
      title: '故障卡',
      value: summary.fault,
      hint: summary.fault > 0 ? '建议隔离并巡检' : '硬件正常',
      tone: summary.fault > 0 ? 'text-alert' : 'text-muted',
      to: '/nodes',
      icon: Server,
    },
    {
      id: 'quota',
      title: '超配额项目',
      value: summary.overQuota,
      hint: summary.overQuota > 0 ? '检查超分与抢占' : '配额健康',
      tone: summary.overQuota > 0 ? 'text-multi' : 'text-muted',
      to: '/projects',
      icon: ArrowUpRight,
    },
  ]

  return (
    <div className="h-full overflow-auto px-8 pb-8 pt-1">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12.5px] text-dim">分析</p>
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

      <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.to)}
            className="sheet flex items-start gap-3 px-3.5 py-3 text-left transition hover:shadow-[0_0_0_1px_rgba(47,99,184,0.16)]"
          >
            <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-[rgba(47,99,184,0.08)] text-infer">
              <item.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-dim">{item.title}</span>
                <span className={`metric-num text-[22px] leading-none ${item.tone}`}>{item.value}</span>
              </span>
              <span className="mt-1 block truncate text-[11px] text-muted">{item.hint}</span>
            </span>
          </button>
        ))}
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
