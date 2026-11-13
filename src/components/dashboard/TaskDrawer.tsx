import { Crosshair } from 'lucide-react'
import { formatDuration, strategyLabel } from '../../mock/engine'
import { useApp } from '../../store/AppContext'

const strategyColor: Record<string, string> = {
  single: 'text-infer border-infer/30 bg-infer/10',
  tp: 'text-multi border-multi/30 bg-multi/10',
  pp: 'text-gang border-gang/30 bg-gang/10',
}

export function TaskDrawer() {
  const { state, selectWorkload, openScheduleFlow } = useApp()
  const pool = state.pools.find((p) => p.stationIds.includes(state.activeStationId))
  const running = state.workloads.filter(
    (w) => w.status === 'Running' && (!pool || w.allocations.some((a) => a.poolId === pool.id)),
  )

  return (
    <aside className="sheet side-glow flex h-full w-[320px] shrink-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-infer opacity-35" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-infer" />
          </span>
          运行中的任务
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted">
          {running.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {running.map((wl) => {
          const active = state.selectedWorkloadId === wl.id
          return (
            <div
              key={wl.id}
              role="button"
              tabIndex={0}
              onClick={() => selectWorkload(active ? null : wl.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectWorkload(active ? null : wl.id)
                }
              }}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                active
                  ? 'border-infer/40 bg-[#eef3fb]'
                  : 'border-border bg-void/40 hover:border-border-bright'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-text">{wl.name}</div>
                  <div className="mt-0.5 truncate text-[10px] text-dim">{wl.model}</div>
                </div>
                <Crosshair className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-infer' : 'text-dim'}`} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${strategyColor[wl.strategy]}`}>
                  {strategyLabel(wl.strategy)}
                </span>
                <span className="text-[10px] text-dim">{wl.gpuCount} GPU</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted">
                <div>Latency {wl.latencyMs}ms</div>
                <div className="text-right">{wl.tokensPerSec ? `${wl.tokensPerSec} tok/s` : 'ASR'}</div>
                <div className="col-span-2 truncate text-dim">{wl.projectName}</div>
                <div className="col-span-2 font-mono text-dim">{formatDuration(wl.durationSec)}</div>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  openScheduleFlow(wl.id)
                }}
                className="mt-2 w-full rounded-md border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2 py-1 text-[10px] font-medium text-infer hover:bg-[#e3ecfa]"
              >
                查看调度拓扑
              </button>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
