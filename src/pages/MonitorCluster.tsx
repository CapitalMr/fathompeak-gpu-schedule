import { useEffect, useMemo, useRef, useState, startTransition } from 'react'
import { useNavigate } from 'react-router-dom'
import { GrafanaWall } from '../components/monitor/GrafanaWall'
import { MonitorLevelBar } from '../components/monitor/MonitorLevelBar'
import { serversForStation, workloadsForStation } from '../components/monitor/scope'
import { TaskBoard } from '../components/monitor/TaskBoard'
import { clusterTitle } from '../mock/engine'
import { useApp } from '../store/AppContext'

export function MonitorCluster() {
  const { state } = useApp()
  const navigate = useNavigate()
  const first = useRef(true)
  const [refreshing, setRefreshing] = useState(false)
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

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setRefreshing(true)
    const timer = window.setTimeout(() => setRefreshing(false), 900)
    return () => window.clearTimeout(timer)
  }, [state.activeStationId])

  return (
    <div className="h-full overflow-y-auto bg-void text-text">
      <MonitorLevelBar />
      <div className="relative px-4 py-4">
        {refreshing && <div className="fp-refresh-sweep" />}
        <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.16em] text-dim">
              {refreshing ? '正在同步集群指标' : '集群监测 · DCGM 25820 / 22424'}
            </div>
            <h2 className="mt-1 text-[22px] leading-none">{activeTitle}</h2>
          </div>
          <div className="font-mono text-[12px] text-infer">{station?.region} · {scopedServers.length} 台</div>
        </header>
        <div key={state.activeStationId} className="fp-board-in grid gap-3">
          <GrafanaWall servers={scopedServers} stationId={state.activeStationId} />
          <TaskBoard
            workloads={scopedWorkloads}
            onOpen={(id) => {
              startTransition(() => {
                navigate(`/monitor/task/${id}`)
              })
            }}
          />
        </div>
      </div>
    </div>
  )
}
