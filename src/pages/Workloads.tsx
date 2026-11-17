import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ListOrdered, Plus, Search } from 'lucide-react'
import { formatDuration } from '../mock/engine'
import { useApp } from '../store/AppContext'
import type { Workload, WorkloadType } from '../types'
import { FilterSelect } from '../components/console/ui'
import { NewWorkloadWizard } from '../components/workloads/NewWorkloadWizard'
import { WorkloadDetailPanel } from '../components/workloads/WorkloadDetailPanel'
import { usePlatformScope } from '../platform/useScope'

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
  const { state, selectWorkload, openScheduleFlow, bulkStop } = useApp()
  const { workloads: scopedWorkloads, projects: scopedProjects, pools } = usePlatformScope()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [typeFilter, setTypeFilter] = useState<'All' | WorkloadType>('All')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(state.selectedWorkloadId)
  const [pendingSelectLatest, setPendingSelectLatest] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const st = location.state as { openWizard?: boolean } | null
    if (st?.openWizard) {
      setWizardOpen(true)
      navigate('/workloads', { replace: true, state: null })
    }
  }, [location.state, navigate])

  useEffect(() => {
    const status = searchParams.get('status')
    setStatusFilter(status ?? 'all')

    const id = searchParams.get('id')
    if (id) {
      setDetailId(id)
      selectWorkload(id)
    }
  }, [searchParams, selectWorkload])

  const rows = useMemo(() => {
    return [...scopedWorkloads]
      .filter((w) => (statusFilter === 'all' ? true : w.status === statusFilter))
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
  }, [scopedWorkloads, statusFilter, typeFilter, projectFilter, query])

  const detail = detailId ? state.workloads.find((w) => w.id === detailId) : null

  const kpi = useMemo(() => {
    const running = scopedWorkloads.filter((w) => w.status === 'Running').length
    const pending = scopedWorkloads.filter((w) => w.status === 'Pending').length
    const failed = scopedWorkloads.filter((w) => w.status === 'Failed').length
    const gpus = scopedWorkloads.filter((w) => w.status === 'Running').reduce((n, w) => n + w.gpuCount, 0)
    return { running, pending, failed, gpus }
  }, [scopedWorkloads])

  const setStatus = (next: string) => {
    setStatusFilter(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('status')
    else params.set('status', next)
    navigate({ pathname: '/workloads', search: params.toString() ? `?${params}` : '' }, { replace: true })
  }

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

  const selectable = rows.filter((row) => row.status === 'Running' || row.status === 'Pending')
  const allSelected = selectable.length > 0 && selectable.every((row) => selectedIds.has(row.id))

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(selectable.map((row) => row.id)))
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-end justify-between gap-3 px-8 pb-2 pt-1">
          <div>
            <div className="mb-1 text-[12.5px] text-dim">工作负载</div>
            <h2 className="text-[28px] leading-none">工作负载</h2>
            <p className="mt-1.5 text-[13px] text-muted">提交、观察与干预任务 · 排队请走调度队列</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/queues')}
              className="flex h-10 items-center gap-1.5 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-3.5 text-[13px] font-medium text-infer hover:bg-[#e3ecfa]"
            >
              <ListOrdered className="h-3.5 w-3.5" />
              调度队列
              {kpi.pending > 0 ? (
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 font-mono text-[11px] text-infer">{kpi.pending}</span>
              ) : null}
            </button>
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
        </div>

        <div className="sheet mx-8 mb-1 grid grid-cols-2 overflow-hidden sm:grid-cols-4">
          {(
            [
              { key: 'Running', label: '运行中', value: String(kpi.running), unit: '活跃任务', filter: 'Running' },
              { key: 'Pending', label: '排队中', value: String(kpi.pending), unit: '等待调度', filter: 'Pending' },
              { key: 'gpus', label: '占用 GPU', value: String(kpi.gpus), unit: '运行卡数', filter: 'Running' },
              { key: 'Failed', label: '失败', value: String(kpi.failed), unit: '需关注', filter: 'Failed' },
            ] as const
          ).map((item, i) => {
            const active = statusFilter === item.filter
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatus(active ? 'all' : item.filter)}
                className={`grid gap-0.5 px-3 py-2.5 text-left transition ${i > 0 ? 'border-l border-border' : ''} ${
                  active ? 'bg-[#eef3fb]' : 'hover:bg-[rgba(61,49,79,0.03)]'
                }`}
              >
                <span className="text-[11px] text-dim">{item.label}</span>
                <b className="metric-num text-[22px] font-normal leading-none">{item.value}</b>
                <small className="text-[11px] text-dim">{active ? '点击清除筛选' : item.unit}</small>
              </button>
            )
          })}
        </div>

        {selectedIds.size > 0 ? (
          <div className="mx-8 mb-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgba(47,99,184,0.22)] bg-[#eef3fb] px-3.5 py-2.5">
            <div className="text-[12px] text-infer">已选择 {selectedIds.size} 个可管控任务</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-alert/30 bg-white px-3 py-1.5 text-[11px] font-medium text-alert"
                onClick={() => {
                  bulkStop([...selectedIds])
                  setSelectedIds(new Set())
                  setDetailId(null)
                }}
              >
                批量停止 / 取消排队
              </button>
              <button
                type="button"
                className="rounded-full border border-border bg-white px-3 py-1.5 text-[11px] text-muted"
                onClick={() => setSelectedIds(new Set())}
              >
                清除选择
              </button>
            </div>
          </div>
        ) : null}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-8 py-3">
          <FilterSelect
            label="类型"
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as 'All' | WorkloadType)}
            options={TYPE_TABS.map((tab) => ({
              value: tab.id,
              label: `${tab.label} (${tab.id === 'All' ? scopedWorkloads.length : scopedWorkloads.filter((w) => w.type === tab.id).length})`,
            }))}
          />

          <div className="relative w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索任务、模型、项目或创建人"
              className="h-8 w-full rounded-lg border border-border bg-white py-1.5 pl-8 pr-3 text-xs shadow-[0_1px_2px_rgba(33,32,33,0.04)] outline-none focus:border-[rgba(47,99,184,0.45)]"
            />
          </div>

          <FilterSelect
            label="状态"
            value={statusFilter}
            onChange={setStatus}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'Running', label: '运行中' },
              { value: 'Pending', label: '排队中' },
              { value: 'Succeeded', label: '已完成' },
              { value: 'Failed', label: '失败' },
              { value: 'Stopping', label: '停止中' },
            ]}
          />

          <FilterSelect
            label="项目"
            value={projectFilter}
            onChange={setProjectFilter}
            className="min-w-0"
            options={[
              { value: 'all', label: '全部项目' },
              ...scopedProjects.map((project) => ({ value: project.id, label: project.name })),
            ]}
          />
        </div>

        {/* Table */}
        <div className="sheet side-glow mx-8 mb-6 min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[rgba(248,248,248,0.92)] text-dim backdrop-blur">
              <tr>
                {['选', '任务', '类型', '状态', '优先级', '项目', '节点池', '阻塞/说明', 'GPU', '创建时间', '调度'].map((h) => (
                  <th key={h} className="border-b border-border px-3 py-2.5 font-medium">
                    {h === '选' ? (
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="全选可管控任务" />
                    ) : (
                      h
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((wl) => {
                const active = detailId === wl.id
                const priority = scopedProjects.find((project) => project.id === wl.projectId)?.priority
                const canSelect = wl.status === 'Running' || wl.status === 'Pending'
                const note =
                  wl.status === 'Pending'
                    ? wl.events.find((event) => event.phase === 'Pending')?.message ??
                      wl.events[0]?.message ??
                      '等待可用资源'
                    : wl.status === 'Failed'
                      ? wl.events[wl.events.length - 1]?.message ?? '执行失败'
                      : `${wl.podsRunning}/${wl.podsRequested} 容器`
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
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        disabled={!canSelect}
                        checked={selectedIds.has(wl.id)}
                        onChange={() => toggleOne(wl.id)}
                        aria-label={`选择 ${wl.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-text">{wl.name}</div>
                      <div className="text-[10px] text-dim">{wl.model}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <TypeBadge type={wl.type} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={wl.status} />
                      <div className="mt-0.5 font-mono text-[10px] text-dim">{formatDuration(wl.durationSec)}</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted">{priority != null ? `P${priority}` : '—'}</td>
                    <td className="px-3 py-2.5 text-muted">{wl.projectName}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {[
                        ...new Set(
                          wl.allocations.map(
                            (allocation) => pools.find((pool) => pool.id === allocation.poolId)?.name ?? allocation.poolId,
                          ),
                        ),
                      ].join('、') || '待调度'}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-[11px] text-muted" title={note}>
                      {note}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted">{wl.gpuCount}</td>
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
                  <td colSpan={11} className="px-3 py-10 text-center text-dim">
                    没有匹配的工作负载
                    {statusFilter !== 'all' ? '，试试清除状态筛选' : ''}。
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
