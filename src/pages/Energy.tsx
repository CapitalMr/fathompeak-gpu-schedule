import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Leaf, SunMedium, Wind, Zap } from 'lucide-react'
import { clusterTitle } from '../mock/engine'
import { useApp } from '../store/AppContext'

function typeIcon(type: string) {
  if (type.includes('风')) return Wind
  if (type.includes('水')) return Zap
  return SunMedium
}

export function Energy() {
  const { state, setActiveStation } = useApp()
  const navigate = useNavigate()

  const summary = useMemo(() => {
    const capacity = state.stations.reduce((n, s) => n + s.capacityMw, 0)
    const current = state.stations.reduce((n, s) => n + s.currentMw, 0)
    const greenWeighted =
      state.stations.reduce((n, s) => n + s.currentMw * s.greenRatio, 0) / Math.max(current, 1)
    const active = state.stations.find((s) => s.id === state.activeStationId) ?? state.stations[0]
    const pool = state.pools.find((p) => p.stationIds.includes(active?.id ?? ''))
    const servers = pool ? state.servers.filter((s) => s.poolId === pool.id) : state.servers
    const gpus = servers.flatMap((s) => s.gpus)
    const busy = gpus.filter((g) => g.state !== 'idle' && g.state !== 'fault').length
    const powerKw = Math.round(servers.reduce((n, s) => n + s.powerW, 0) / 100) / 10
    // 1 GPU·h 基准费率按绿电占比折算后的小时成本
    const gpuHourCost = 1.8
    const estimatedHourly = Math.round(busy * gpuHourCost * (1.15 - greenWeighted) * 10) / 10

    const suggestions = state.stations
      .map((station) => {
        const load = station.currentMw / station.capacityMw
        const linkedPools = state.pools.filter((p) => p.stationIds.includes(station.id))
        return { station, load, linkedPools }
      })
      .sort((a, b) => b.load - a.load)

    return {
      capacity,
      current,
      greenWeighted,
      active,
      pool,
      servers,
      gpus,
      busy,
      powerKw,
      estimatedHourly,
      suggestions,
      util: gpus.length ? Math.round((busy / gpus.length) * 1000) / 10 : 0,
    }
  }, [state])

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto px-8 pb-8 pt-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12.5px] text-dim">资源</p>
          <h2 className="text-[28px] leading-none">算电协同</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            电站出力驱动节点池权重 · 绿电高峰优先调度可迁移任务
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/monitor')}
          className="flex h-9 items-center gap-1.5 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-3.5 text-[13px] font-medium text-infer hover:bg-[#e3ecfa]"
        >
          打开监控大屏
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="sheet grid grid-cols-2 overflow-hidden lg:grid-cols-5">
        {[
          {
            label: '全国出力',
            value: summary.current.toFixed(0),
            unit: `/ ${summary.capacity.toFixed(0)} MW`,
          },
          {
            label: '绿电占比',
            value: `${Math.round(summary.greenWeighted * 100)}%`,
            unit: '加权实时',
          },
          {
            label: '本站集群',
            value: String(summary.servers.length),
            unit: `${summary.gpus.length} 卡`,
          },
          {
            label: '算力占用',
            value: `${summary.util}%`,
            unit: `${summary.busy} 卡运行`,
          },
          {
            label: '估算成本',
            value: `¥${summary.estimatedHourly}`,
            unit: '/ 小时 · 含绿电折扣',
          },
        ].map((item, i) => (
          <div
            key={item.label}
            className={`grid gap-0.5 px-3 py-3 ${i > 0 ? 'border-l border-border' : ''} ${
              i >= 2 ? 'border-t border-border lg:border-t-0' : ''
            }`}
          >
            <span className="text-[11px] text-dim">{item.label}</span>
            <b className="metric-num text-[24px] font-normal leading-none">{item.value}</b>
            <small className="text-[11px] text-dim">{item.unit}</small>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <section className="sheet xl:col-span-7 p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <Leaf className="h-3.5 w-3.5 text-infer" />
            <h3 className="text-[13px] font-medium">电站出力矩阵</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.suggestions.map(({ station, load, linkedPools }) => {
              const Icon = typeIcon(station.type)
              const active = station.id === state.activeStationId
              const pct = Math.round(load * 100)
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => setActiveStation(station.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? 'border-[rgba(47,99,184,0.4)] bg-[#eef3fb]'
                      : 'border-border bg-white/70 hover:border-[rgba(47,99,184,0.28)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-infer" />
                        <span className="truncate text-[13px] font-medium">
                          {clusterTitle(station.name)}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-dim">
                        {station.type} · {station.region}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="metric-num text-[20px] leading-none">{station.currentMw.toFixed(1)}</div>
                      <div className="mt-0.5 text-[10px] text-dim">MW · {pct}%</div>
                    </div>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
                    <div
                      className={`h-full rounded-full ${
                        station.greenRatio >= 0.85
                          ? 'bg-gradient-to-r from-[#2f63b8] to-[#5a8fd4]'
                          : station.greenRatio >= 0.6
                            ? 'bg-gradient-to-r from-[#4e3f66] to-[#7a6b94]'
                            : 'bg-gradient-to-r from-[#8a6232] to-[#b88955]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {linkedPools.map((pool) => (
                      <span
                        key={pool.id}
                        className="rounded border border-border bg-white/80 px-1.5 py-0.5 text-[10px] text-muted"
                      >
                        {pool.name}
                      </span>
                    ))}
                    {linkedPools.length === 0 && (
                      <span className="text-[10px] text-dim">未绑定节点池</span>
                    )}
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-muted">
                    <span>绿电 {Math.round(station.greenRatio * 100)}%</span>
                    <span>装机 {station.capacityMw} MW</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="sheet xl:col-span-5 p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-dim" />
            <h3 className="text-[13px] font-medium">协同调度建议</h3>
          </div>

          <div className="side-glow mb-3 rounded-xl border border-[rgba(47,99,184,0.28)] bg-[rgba(238,243,251,0.7)] px-3 py-3">
            <div className="text-[12px] text-dim">当前激活电站</div>
            <div className="mt-1 text-[15px] font-medium">
              {summary.active ? clusterTitle(summary.active.name) : '—'}
            </div>
            <div className="mt-1 text-[12px] text-muted">
              关联 {summary.pool?.name ?? '—'} · 机柜功耗 {summary.powerKw} kW
            </div>
          </div>

          <div className="space-y-2">
            {summary.suggestions.slice(0, 4).map(({ station, load }, index) => {
              const pct = Math.round(load * 100)
              const bar = pct >= 75 ? 'bg-infer' : pct >= 50 ? 'bg-multi' : 'bg-gang'
              const advice =
                pct >= 75
                  ? '建议提升该站关联池的调度权重，承接可迁移推理任务。'
                  : pct >= 50
                    ? '出力中等，维持现有保底配额，观察绿电窗口。'
                    : '出力偏低，优先把可抢占任务迁出该站关联池。'
              return (
                <div key={station.id} className="relative overflow-hidden rounded-xl border border-border px-3 py-2.5">
                  <div className={`absolute inset-y-0 left-0 w-[3px] ${bar}`} />
                  <div className="flex items-center justify-between gap-2 pl-1.5 text-[12px]">
                    <span className="font-medium text-text">
                      #{index + 1} {clusterTitle(station.name)}
                    </span>
                    <span className="metric-num text-[16px] leading-none text-muted">{pct}%</span>
                  </div>
                  <p className="mt-1 pl-1.5 text-[11px] leading-relaxed text-muted">{advice}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            策略说明：启用「绿电优先算电协同」后，调度器在电站出力上升时段提高对应节点池权重；Over-quota
            与低优训练任务可被主动迁移，保底推理不受影响。
          </div>
        </section>
      </div>
    </div>
  )
}
