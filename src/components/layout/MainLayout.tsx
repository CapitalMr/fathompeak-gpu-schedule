import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ListOrdered, LogOut, Settings, Shield, UserRound } from 'lucide-react'
import { ScheduleFlowOverlay } from '../flow/ScheduleFlowOverlay'
import { NAV_GROUPS, type NavGate } from '../../nav/menuConfig'
import { useApp } from '../../store/AppContext'

export function MainLayout() {
  const { state, settings, logout, closeScheduleFlow } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const initial = state.user.slice(0, 1).toUpperCase()
  const flowWorkload = state.scheduleFlowWorkloadId
    ? state.workloads.find((workload) => workload.id === state.scheduleFlowWorkloadId)
    : null
  const ops = useMemo(() => {
    const pending = state.workloads.filter((workload) => workload.status === 'Pending').length
    const failed = state.workloads.filter((workload) => workload.status === 'Failed').length
    const fault = state.servers.flatMap((server) => server.gpus).filter((gpu) => gpu.state === 'fault').length
    return { pending, failed, fault }
  }, [state.servers, state.workloads])

  const allow = (gate?: NavGate) => {
    if (gate === 'policies') return settings.policies
    if (gate === 'dataVolumes') return settings.dataVolumes
    return true
  }

  useEffect(() => {
    const path = location.pathname
    if (!settings.policies && (path.startsWith('/policies') || path.startsWith('/scheduling'))) {
      navigate('/workloads', { replace: true })
    }
    if (!settings.dataVolumes && path.startsWith('/assets/datasources')) {
      navigate('/assets/templates', { replace: true })
    }
  }, [location.pathname, navigate, settings.dataVolumes, settings.policies])

  return (
    <div className="flex h-full bg-void text-text">
      <aside className="flex w-[228px] shrink-0 flex-col border-r border-border bg-white">
        <div className="flex items-center gap-2 px-3 pb-2 pt-3">
          <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="" className="h-7 w-auto" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-medium">沐仞科技</div>
            <div className="text-[11px] text-dim">算电协同·算力编排</div>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.filter((group) => allow(group.gate)).map((group) => {
            const items = group.items.filter((item) => allow(item.gate))
            if (!items.length) return null
            return (
              <div key={group.title}>
                <div className="px-2 pb-1 text-[10px] tracking-wide text-dim">{group.title}</div>
                <div className="grid gap-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${
                          isActive ? 'nav-pill-active text-text' : 'text-dim hover:bg-[#f6f5f2] hover:text-text'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="relative border-t border-border p-2">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#f6f5f2]"
          >
            <i className="grid h-7 w-7 place-items-center rounded-md bg-[rgba(61,49,79,0.07)] text-[12px] not-italic">
              {initial}
            </i>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px]">{state.user.split('@')[0]}</span>
              <small className="text-[10px] text-dim">{state.role}</small>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-dim" />
          </button>
          {menuOpen ? (
            <>
              <button type="button" aria-label="关闭菜单" className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-14 left-2 right-2 z-30 grid gap-0.5 rounded-lg border border-border bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/access/me')
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f6f5f2]"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  我的权限
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/access/rules')
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f6f5f2]"
                >
                  <Shield className="h-3.5 w-3.5" />
                  访问规则
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/settings')
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[#f6f5f2]"
                >
                  <Settings className="h-3.5 w-3.5" />
                  常规设置
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-dim hover:bg-[#f6f5f2] hover:text-text"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  退出
                </button>
              </div>
            </>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-white/80 px-6">
          <div className="truncate text-[13px] text-text">沐仞算电协同·算力编排</div>
          <div className="flex items-center gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => navigate('/queues')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-muted transition hover:border-[rgba(47,99,184,0.28)] hover:text-infer"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              排队 {ops.pending}
            </button>
            <button
              type="button"
              onClick={() => navigate('/alerts')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-muted transition hover:border-[rgba(47,99,184,0.28)] hover:text-infer"
            >
              <Bell className="h-3.5 w-3.5" />
              告警
              {ops.fault + ops.failed > 0 ? (
                <span className="rounded-full bg-[rgba(155,58,58,0.12)] px-1.5 font-mono text-[10px] text-alert">
                  {ops.fault + ops.failed}
                </span>
              ) : null}
            </button>
            <div className="ml-1 flex items-center gap-1.5 text-muted">
              <i className="h-1.5 w-1.5 rounded-full bg-infer" />
              调度器正常
            </div>
          </div>
        </header>
        {settings.systemNotice ? (
          <div className="border-b border-[rgba(47,99,184,0.18)] bg-[#eef3fb] px-6 py-2 text-[12px] text-infer">
            {settings.systemNotice}
          </div>
        ) : null}
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      {flowWorkload ? (
        <ScheduleFlowOverlay
          workload={flowWorkload}
          servers={state.servers}
          pools={state.pools}
          stations={state.stations}
          onClose={closeScheduleFlow}
        />
      ) : null}
    </div>
  )
}
