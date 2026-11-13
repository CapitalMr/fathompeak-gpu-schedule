import { NavLink } from 'react-router-dom'
import { clusterTitle } from '../../mock/engine'
import { useApp } from '../../store/AppContext'

const STEPS = [
  { n: 1, to: '/monitor', label: '全国拓扑', end: true },
  { n: 2, to: '/monitor/cluster', label: '集群监测', end: false },
  { n: 3, to: '/monitor/task', label: '任务调度', end: false },
] as const

export function MonitorLevelBar() {
  const { state } = useApp()
  const station = state.stations.find((item) => item.id === state.activeStationId) ?? state.stations[0]
  const title = station ? clusterTitle(station.name) : ''

  return (
    <nav className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-2">
      {STEPS.map((step, index) => (
        <div key={step.n} className="flex items-center gap-2">
          {index > 0 && <span className="font-mono text-[11px] text-dim">→</span>}
          <NavLink
            to={step.to}
            end={step.end}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-[10px] px-2.5 py-1 text-[12px] ${
                isActive
                  ? 'bg-[linear-gradient(90deg,rgba(47,99,184,0.12),rgba(61,49,79,0.06))] text-text shadow-[inset_2px_0_0_#2f63b8]'
                  : 'text-muted hover:text-text'
              }`
            }
          >
            <span className="font-mono text-[10px] text-infer">0{step.n}</span>
            <span>{step.label}</span>
            {step.n === 2 && title && <span className="text-dim">{title}</span>}
          </NavLink>
        </div>
      ))}
    </nav>
  )
}
