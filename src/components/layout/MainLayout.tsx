import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  Boxes,
  ChevronDown,
  Gauge,
  LayoutDashboard,
  Leaf,
  ListOrdered,
  LogOut,
  Monitor,
  Scale,
  ScrollText,
} from 'lucide-react'
import { ScheduleFlowOverlay } from '../flow/ScheduleFlowOverlay'
import { clusterTitle } from '../../mock/engine'
import { useApp } from '../../store/AppContext'

const NAV_GROUPS = [
  {
    title: '工作负载',
    items: [
      { to: '/workloads', label: '工作负载', icon: Boxes },
      { to: '/queues', label: '调度队列', icon: ListOrdered },
      { to: '/overview', label: '集群总览', icon: LayoutDashboard },
      { to: '/monitor', label: '监控大屏', icon: Monitor },
    ],
  },
  {
    title: '资源',
    items: [
      { to: '/clusters', label: '节点', icon: Gauge },
      { to: '/energy', label: '算电协同', icon: Leaf },
    ],
  },
  {
    title: '组织',
    items: [{ to: '/projects', label: '项目配额', icon: Scale }],
  },
  {
    title: '治理',
    items: [
      { to: '/policies', label: '调度策略', icon: ScrollText },
      { to: '/alerts', label: '告警中心', icon: Bell },
    ],
  },
]

export function MainLayout() {
  const { state, logout, setActiveStation, closeScheduleFlow } = useApp()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const station = state.stations.find((s) => s.id === state.activeStationId) ?? state.stations[0]
  const initial = state.user.slice(0, 1).toUpperCase()
  const flowWorkload = state.scheduleFlowWorkloadId
    ? state.workloads.find((workload) => workload.id === state.scheduleFlowWorkloadId)
    : null

  return (
    <div className="flex h-full bg-void text-text">
      <aside className="relative flex w-[248px] shrink-0 flex-col border-r border-border bg-[linear-gradient(180deg,#fbfbfd_0%,#f8f8f8_48%,#f3f1ea_100%)] px-3 pb-2 pt-4">
        <div className="pointer-events-none absolute inset-0 tech-grid opacity-30" />
        <div className="relative mb-3 flex items-center gap-2 px-1">
          <div className="relative">
            <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" className="h-8 w-auto" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-infer shadow-[0_0_0_3px_rgba(47,99,184,0.18)]" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">沐仞科技</div>
            <div className="font-mono text-[11px] tracking-wide text-dim">算电协同</div>
          </div>
        </div>

        <div className="relative mb-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-[14px] border border-border bg-white/90 px-2.5 py-2 text-left shadow-[0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur"
          >
            <span className="min-w-0 flex-1 leading-tight">
              <b className="block truncate text-sm font-medium">{station ? clusterTitle(station.name) : ''}</b>
              <small className="block truncate text-xs text-dim">{station?.type}</small>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-dim" />
          </button>
          {open && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 grid gap-1.5 rounded-[14px] border border-border bg-white p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
              <div className="px-1 text-xs text-dim">切换电站集群</div>
              {state.stations.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveStation(s.id)
                    setOpen(false)
                  }}
                  className={`grid gap-0.5 rounded-[10px] px-2.5 py-2 text-left ${
                    s.id === station?.id ? 'bg-[#eef3fb]' : 'hover:bg-[rgba(61,49,79,0.05)]'
                  }`}
                >
                  <b className="text-sm font-medium">{clusterTitle(s.name)}</b>
                  <span className="text-[12.5px] text-muted">{s.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="relative flex-1 space-y-3 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-3 pb-1 text-xs text-dim">{group.title}</div>
              <div className="grid gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-full px-3 py-2 text-[14px] transition ${
                        isActive ? 'nav-pill-active text-text' : 'text-dim hover:bg-white/60 hover:text-text'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-infer' : 'text-multi'}`} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative mt-2 border-t border-border pt-2">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <i className="grid h-8 w-8 place-items-center rounded-[10px] bg-[rgba(61,49,79,0.07)] text-sm not-italic font-medium">
              {initial}
            </i>
            <span className="min-w-0">
              <span className="block truncate text-sm">{state.user.split('@')[0]}</span>
              <small className="text-xs text-dim">{state.role}</small>
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-full px-3 py-1.5 text-sm text-dim hover:text-text"
          >
            <LogOut className="h-[18px] w-[18px]" />
            退出
          </button>
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] wash [mask-image:linear-gradient(180deg,#000_0,#000_58%,transparent_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          <div className="scanline" />
        </div>
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between px-8">
          <div className="text-[13px] text-dim">
            沐仞算电协同系统
            <span className="mx-2 text-border-bright">/</span>
            <span className="text-text">{station ? clusterTitle(station.name) : ''}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/monitor')}
              className="hidden items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1 text-[12px] text-muted backdrop-blur hover:text-infer sm:flex"
            >
              <Monitor className="h-3.5 w-3.5" />
              监控大屏
            </button>
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <i className="h-1.5 w-1.5 rounded-full bg-infer shadow-[0_0_0_3px_rgba(47,99,184,0.16)]" />
              调度器正常
            </div>
          </div>
        </header>
        <main className="relative z-10 min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      {flowWorkload && (
        <ScheduleFlowOverlay
          workload={flowWorkload}
          servers={state.servers}
          pools={state.pools}
          stations={state.stations}
          onClose={closeScheduleFlow}
        />
      )}
    </div>
  )
}
