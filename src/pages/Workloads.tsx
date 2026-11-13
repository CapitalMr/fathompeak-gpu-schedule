import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { formatDuration } from '../mock/engine'
import { useApp } from '../store/AppContext'
import type { Workload, WorkloadType } from '../types'
import { NewWorkloadWizard } from '../components/workloads/NewWorkloadWizard'
import { WorkloadDetailPanel } from '../components/workloads/WorkloadDetailPanel'

const TYPE_TABS: Array<{ id: 'All' | WorkloadType; label: string }> = [
  { id: 'All', label: '全部' },
  { id: 'Inference', label: '推理' },
  { id: 'Training', label: '训练' },
  { id: 'Workspace', label: '工作空间' },
]

const TYPE_LABEL: Record<WorkloadType, string> = {
  Inference: '推理',
  Training: '训练',
  Workspace: '工作空间',
}

const STATUS_LABEL: Record<Workload['status'], string> = {
  Running: '运行中',
  Pending: '排队中',
  Succeeded: '已完成',
  Failed: '失败',
  Stopping: '停止中',
}

export function Workloads() {
  const { state, selectWorkload, openScheduleFlow } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<'All' | WorkloadType>('All')
  const [projectFilter, setProjectFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(state.selectedWorkloadId)
  const [pendingSelectLatest, setPendingSelectLatest] = useState(false)

  useEffect(() => {
    const st = location.state as { openWizard?: boolean } | null
    if (st?.openWizard) {
      setWizardOpen(true)
      navigate('/workloads', { replace: true, state: null })
    }
  }, [location.state, navigate])

  const activePool = state.pools.find((p) => p.stationIds.includes(state.activeStationId))
  const rows = useMemo(() => {
    return [...state.workloads]
      .filter((w) =>
        activePool ? w.allocations.some((a) => a.poolId === activePool.id) || w.allocations.length === 0 : true,
      )
      .filter((w) => (typeFilter === 'All' ? true : w.type === typeFilter))
      .filter((w) => (projectFilter === 'all' ? true : w.projectId === projectFilter))
      .filter((w) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return (
          w.name.toLowerCase().includes(q) ||
          w.model.toLowerCase().includes(q) ||
          w.projectName.toLowerCase().includes(q) ||
          w.createdBy.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => Number(b.status === 'Running') - Number(a.status === 'Running') || b.startedAt - a.startedAt)
  }, [state.workloads, typeFilter, projectFilter, query, activePool])

  const detail = detailId ? state.workloads.find((w) => w.id === detailId) : null

  const kpi = useMemo(() => {
    const running = rows.filter((w) => w.status === 'Running').length
    const pending = rows.filter((w) => w.status === 'Pending').length
    const failed = rows.filter((w) => w.status === 'Failed').length
    const gpus = rows.filter((w) => w.status === 'Running').reduce((n, w) => n + w.gpuCount, 0)
    return { running, pending, failed, gpus }
  }, [rows])

  useEffect(() => {
    if (!pendingSelectLatest) return
    const latest = state.workloads[0]
    if (latest) {
      setDetailId(latest.id)
      selectWorkload(latest.id)
      setPendingSelectLatest(false)
    }
  }, [pendingSelectLatest, state.workloads, selectWorkload])

  const openDetail = (wl: Workload) => {
    setDetailId(wl.id)
    selectWorkload(wl.id)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3 px-8 pb-2 pt-1">
          <div>
            <div className="mb-1 text-[12.5px] text-dim">工作负载</div>
            <h2 className="text-[28px] leading-none">工作负载</h2>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="group relative flex h-10 items-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[#2f63b8] to-[#4a7cc9] px-4 pl-3.5 text-[13px] font-medium text-white shadow-[0_4px_14px_rgba(47,99,184,0.28)] transition hover:from-[#254f94] hover:to-[#2f63b8] hover:shadow-[0_6px_18px_rgba(47,99,184,0.36)] active:scale-[0.98]"
            >
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.22)_50%,transparent_70%)] opacity-0 transition group-hover:animate-[cta-sheen_1.1s_ease]" />
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Plus className="h-3.5 w-3.5" />
              </span>
              新建工作负载
              <ChevronDown className={`h-3.5 w-3.5 opacity-80 transition ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-white/95 p-1.5 shadow-[0_12px_32px_rgba(47,99,184,0.14)] backdrop-blur">
                {(['Inference', 'Training', 'Workspace'] as WorkloadType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setWizardOpen(true)
                      setTypeFilter(t)
                    }}
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-[12px] text-muted transition hover:bg-[#eef3fb] hover:text-infer"
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setWizardOpen(true)
                  }}
                  className="mt-0.5 block w-full rounded-xl border-t border-border/60 px-3 py-2.5 text-left text-[12px] text-dim transition hover:bg-[rgba(61,49,79,0.04)] hover:text-text"
                >
                  从头创建…
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="sheet mx-8 mb-1 grid grid-cols-2 overflow-hidden sm:grid-cols-4">
          {[
            { label: '运行中', value: String(kpi.running), unit: '活跃任务' },
            { label: '排队中', value: String(kpi.pending), unit: '等待调度' },
            { label: '占用 GPU', value: String(kpi.gpus), unit: '运行卡数' },
            { label: '失败', value: String(kpi.failed), unit: '需关注' },
          ].map((item, i) => (
            <div key={item.label} className={`grid gap-0.5 px-3 py-2.5 ${i > 0 ? 'border-l border-border' : ''}`}>
              <span className="text-[11px] text-dim">{item.label}</span>
              <b className="metric-num text-[22px] font-normal leading-none">{item.value}</b>
              <small className="text-[11px] text-dim">{item.unit}</small>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-8 py-3">
          <div className="flex rounded-full bg-[rgba(61,49,79,0.06)] p-1">
            {TYPE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`h-8 rounded-full px-3.5 text-[13px] ${
                  typeFilter === t.id ? 'bg-panel text-text shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : 'text-dim hover:text-muted'
                }`}
              >
                {t.label}
                <span className="ml-1 font-mono text-[10px] opacity-70">
                  {t.id === 'All'
                    ? state.workloads.filter((w) =>
                        activePool ? w.allocations.some((a) => a.poolId === activePool.id) : true,
                      ).length
                    : state.workloads.filter(
                        (w) =>
                          w.type === t.id &&
                          (activePool ? w.allocations.some((a) => a.poolId === activePool.id) : true),
                      ).length}
                </span>
              </button>
            ))}
          </div>

          <div className="relative w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索任务、模型、项目或创建人"
              className="h-8 w-full rounded-full border border-border bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[rgba(47,99,184,0.45)]"
            />
          </div>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-full border border-border bg-white px-3 text-xs outline-none focus:border-[rgba(47,99,184,0.45)]"
          >
            <option value="all">全部项目</option>
            {state.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="sheet side-glow mx-8 mb-6 min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[rgba(248,248,248,0.92)] text-dim backdrop-blur">
              <tr>
                {[
                  '任务',
                  '类型',
                  '状态',
                  '项目',
                  '创建人',
                  '容器',
                  'GPU',
                  '显存',
                  '创建时间',
                  '调度',
                ].map((h) => (
                  <th key={h} className="border-b border-border px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((wl) => {
                const active = detailId === wl.id
                return (
                  <tr
                    key={wl.id}
                    onClick={() => openDetail(wl)}
                    className={`cursor-pointer border-b border-border/60 transition ${
                      active
                        ? 'bg-[#eef3fb] shadow-[inset_2px_0_0_0_#2f63b8]'
                        : 'hover:bg-[rgba(61,49,79,0.04)]'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-text">{wl.name}</div>
                      <div className="text-[10px] text-dim">{wl.model}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <TypeBadge type={wl.type} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={wl.status} />
                      <div className="mt-0.5 font-mono text-[10px] text-dim">
                        {formatDuration(wl.durationSec)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{wl.projectName}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted">{wl.createdBy}</td>
                    <td className="px-3 py-2.5 font-mono text-muted">
                      {wl.podsRunning}/{wl.podsRequested}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted">{wl.gpuCount}</td>
                    <td className="px-3 py-2.5 font-mono text-muted">{wl.memoryGb} GB</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-dim">
                      {new Date(wl.startedAt).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openScheduleFlow(wl.id)
                        }}
                        className="whitespace-nowrap rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2.5 py-1 text-[10px] font-medium text-infer hover:bg-[#e3ecfa]"
                      >
                        调度流程
                      </button>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-dim">
                    当前电站集群下没有匹配的工作负载。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <WorkloadDetailPanel
          workload={detail}
          onClose={() => {
            setDetailId(null)
            selectWorkload(null)
          }}
        />
      )}

      {wizardOpen && (
        <NewWorkloadWizard
          onClose={() => setWizardOpen(false)}
          onSubmitted={() => {
            setWizardOpen(false)
            setPendingSelectLatest(true)
          }}
        />
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: WorkloadType }) {
  const cls =
    type === 'Inference'
      ? 'border-[rgba(47,99,184,0.28)] bg-[#eef3fb] text-infer'
      : type === 'Training'
        ? 'border-[rgba(78,63,102,0.28)] bg-[rgba(78,63,102,0.08)] text-multi'
        : 'border-[rgba(138,98,50,0.28)] bg-[rgba(138,98,50,0.08)] text-gang'
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] ${cls}`}>{TYPE_LABEL[type]}</span>
}

function StatusBadge({ status }: { status: Workload['status'] }) {
  const color =
    status === 'Running'
      ? 'text-infer'
      : status === 'Pending'
        ? 'text-gang'
        : status === 'Failed'
          ? 'text-alert'
          : 'text-dim'
  const dot =
    status === 'Running'
      ? 'bg-infer'
      : status === 'Pending'
        ? 'bg-gang'
        : status === 'Failed'
          ? 'bg-alert'
          : 'bg-idle'
  return (
    <span className={`inline-flex items-center gap-1.5 ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${status === 'Running' ? 'animate-pulse-dot' : ''}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}
