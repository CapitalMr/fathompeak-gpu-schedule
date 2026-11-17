import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MonitorLevelBar } from '../components/monitor/MonitorLevelBar'
import { NationalFlyMap } from '../components/monitor/NationalFlyMap'
import { stationStat } from '../components/monitor/scope'
import { clusterTitle } from '../mock/engine'
import { useApp } from '../store/AppContext'

export function Monitor() {
  const { state, setActiveStation } = useApp()
  const navigate = useNavigate()
  const station = state.stations.find((item) => item.id === state.activeStationId) ?? state.stations[0]
  const activeTitle = station ? clusterTitle(station.name) : ''
  const mapStats = useMemo(
    () => state.stations.map((item) => stationStat(item.id, state.servers, state.pools, state.workloads)),
    [state.stations, state.servers, state.pools, state.workloads],
  )
  const queued = state.workloads.filter((workload) => workload.status === 'Pending').length

  return (
    <div className="flex h-full flex-col bg-void text-text">
      <MonitorLevelBar />
      <div className="min-h-0 flex-1">
        <NationalFlyMap
          stations={state.stations}
          stats={mapStats}
          queued={queued}
          activeId={state.activeStationId}
          activeTitle={activeTitle}
          onSelect={(id) => {
            setActiveStation(id)
            navigate('/monitor/cluster')
          }}
        />
      </div>
    </div>
  )
}
