import { useMemo } from 'react'
import { useApp } from '../../store/AppContext'

export function MetricsBar() {
  const { state } = useApp()

  const items = useMemo(() => {
    const station = state.stations.find((s) => s.id === state.activeStationId) ?? state.stations[0]
    const pool = state.pools.find((p) => p.stationIds.includes(station?.id ?? ''))
    const servers = pool ? state.servers.filter((s) => s.poolId === pool.id) : state.servers
    const gpus = servers.flatMap((s) => s.gpus)
    const busy = gpus.filter((g) => g.state !== 'idle' && g.state !== 'fault').length
    const idle = gpus.filter((g) => g.state === 'idle').length
    const fault = gpus.filter((g) => g.state === 'fault').length
    const util = gpus.length ? Math.round((busy / gpus.length) * 1000) / 10 : 0
    const healthy = servers.filter(
      (s) => s.nvlinkStatus === 'healthy' && !s.gpus.some((g) => g.state === 'fault'),
    ).length
    const running = state.workloads.filter(
      (w) => w.status === 'Running' && (!pool || w.allocations.some((a) => a.poolId === pool.id)),
    ).length
    const pending = state.workloads.filter((w) => w.status === 'Pending').length
    const powerKw = Math.round(servers.reduce((n, s) => n + s.powerW, 0) / 100) / 10

    return [
      { label: '机器', value: String(servers.length), unit: `健康 ${healthy}` },
      { label: 'GPU 卡', value: String(gpus.length), unit: `空闲 ${idle} · 故障 ${fault}` },
      { label: '利用率', value: `${util.toFixed(1)}%`, unit: `已分配 ${busy}` },
      { label: '运行任务', value: String(running), unit: `排队 ${pending}` },
      { label: '机柜功耗', value: String(powerKw), unit: 'kW' },
      {
        label: '本站出力',
        value: station ? station.currentMw.toFixed(1) : '—',
        unit: station ? `${station.capacityMw} MW 装机` : '',
      },
      {
        label: '绿电占比',
        value: station ? `${Math.round(station.greenRatio * 100)}%` : '—',
        unit: station?.type ?? '',
      },
      {
        label: '节点池',
        value: String(state.pools.length),
        unit: `全国 ${state.servers.length} 机`,
      },
    ]
  }, [state])

  return (
    <div className="sheet grid grid-cols-2 overflow-hidden sm:grid-cols-4 xl:grid-cols-8">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`grid gap-0.5 px-3 py-3 ${i > 0 ? 'border-l border-border' : ''} ${
            i >= 2 ? 'border-t border-border sm:border-t-0' : ''
          } ${i >= 4 ? 'sm:border-t xl:border-t-0' : ''}`}
        >
          <span className="text-[11px] text-dim">{item.label}</span>
          <b className="metric-num text-[26px] font-normal leading-none text-text">{item.value}</b>
          <small className="truncate text-[11px] text-dim">{item.unit}</small>
        </div>
      ))}
    </div>
  )
}
