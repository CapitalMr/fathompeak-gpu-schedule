import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MonitorLevelBar } from '../components/monitor/MonitorLevelBar'
import { serversForStation, workloadsForStation } from '../components/monitor/scope'
import { QUEUE, TaskHardware } from '../components/monitor/TaskBoard'
import { formatDuration, strategyLabel, clusterTitle } from '../mock/engine'
import { useApp } from '../store/AppContext'
import type { Workload } from '../types'

export function MonitorTask() {
  const { workloadId } = useParams()
  const navigate = useNavigate()
  const { state } = useApp()
  const [filter, setFilter] = useState<'all' | 'Running' | 'Pending'>('all')
  const station = state.stations.find((item) => item.id === state.activeStationId) ?? state.stations[0]
  const activeTitle = station ? clusterTitle(station.name) : ''
  const scopedServers = useMemo(
    () => serversForStation(state.servers, state.pools, state.activeStationId),
    [state.servers, state.pools, state.activeStationId],
  )
  const scopedWorkloads = useMemo(
    () => workloadsForStation(state.workloads, scopedServers),
    [state.workloads, scopedServers],
  )
  const rows = useMemo(() => {
    return [...scopedWorkloads, ...QUEUE]
      .filter((workload) => workload.status === 'Running' || workload.status === 'Pending')
      .filter((workload) => (filter === 'all' ? true : workload.status === filter))
      .sort((a, b) => Number(b.status === 'Running') - Number(a.status === 'Running') || b.gpuCount - a.gpuCount)
  }, [scopedWorkloads, filter])
  const workload = rows.find((item) => item.id === workloadId) ?? null

  return (
    <div className="flex h-full flex-col bg-void text-text">
      <MonitorLevelBar />
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-border bg-panel">
          <div className="px-3 py-3">
            <div className="font-mono text-[10px] tracking-[0.16em] text-dim">任务级硬件流转</div>
            <div className="mt-1 text-[13px] text-text">{activeTitle}</div>
            <div className="mt-2 flex gap-1">
              {(
                [
                  ['all', '全部'],
                  ['Running', '运行'],
                  ['Pending', '排队'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-[8px] px-1.5 py-0.5 text-[11px] ${
                    filter === id ? 'bg-[rgba(47,99,184,0.12)] text-infer' : 'text-dim hover:text-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid">
            {rows.map((item) => (
              <TaskPick key={item.id} workload={item} active={item.id === workload?.id} onOpen={() => navigate(`/monitor/task/${item.id}`)} />
            ))}
          </div>
        </aside>
        <div className="min-h-0 overflow-y-auto p-3">
          {workload ? (
            <TaskHardware
              key={workload.id}
              workload={workload}
              servers={state.servers}
              onClose={() => navigate('/monitor/task')}
            />
          ) : (
            <div className="grid h-full min-h-[240px] place-items-center rounded-[14px] border border-dashed border-border bg-panel text-[13px] text-dim">
              从左侧选择一个任务，查看调度流程图和显卡资源曲线。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TaskPick({ workload, active, onOpen }: { workload: Workload; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`border-t border-border px-3 py-2 text-left ${
        active ? 'bg-[rgba(47,99,184,0.08)] shadow-[inset_2px_0_0_#2f63b8]' : 'hover:bg-void'
      }`}
    >
      <div className="truncate text-[12px] text-text">{workload.name}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted">
        {workload.status === 'Running' ? '运行中' : '排队中'} · {strategyLabel(workload.strategy)} · {workload.gpuCount} 卡
      </div>
      <div className="font-mono text-[10px] text-dim">{formatDuration(workload.durationSec)}</div>
    </button>
  )
}

