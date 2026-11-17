import { useMemo, useState } from 'react'
import { DataTable, FilterSelect, PageFrame, QuotaBar, StatusPill } from '../components/console/ui'
import { useApp } from '../store/AppContext'

type WindowKey = '24h' | '7d' | '30d'

const WINDOW_HOURS: Record<WindowKey, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
}

export function UsagePage() {
  const { state } = useApp()
  const [windowKey, setWindowKey] = useState<WindowKey>('7d')
  const hours = WINDOW_HOURS[windowKey]

  const projectRows = useMemo(() => {
    // metrics.greenRatio 量纲 0–1；基准 ¥1.8/GPU·h，绿电最高折扣 40%
    const green = Math.min(1, Math.max(0, state.metrics.greenRatio || 0.65))
    const rate = Math.round(1.8 * (1 - 0.4 * green) * 100) / 100
    return state.projects
      .map((project) => {
        const running = state.workloads.filter((w) => w.projectId === project.id && w.status === 'Running')
        const pending = state.workloads.filter((w) => w.projectId === project.id && w.status === 'Pending')
        const activeGpus = running.reduce((n, w) => n + w.gpuCount, 0)
        const gpuHours = Math.round(activeGpus * hours * 10) / 10
        const cost = Math.round(gpuHours * rate * 10) / 10
        const util = project.guaranteed > 0 ? Math.round((project.used / project.guaranteed) * 100) : 0
        return {
          id: project.id,
          name: project.name,
          department: project.department,
          used: project.used,
          guaranteed: project.guaranteed,
          overQuota: project.overQuota,
          activeGpus,
          pending: pending.length,
          gpuHours,
          cost,
          util,
          priority: project.priority,
        }
      })
      .sort((a, b) => b.gpuHours - a.gpuHours)
  }, [hours, state.metrics.greenRatio, state.projects, state.workloads])

  const deptRows = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; used: number; guaranteed: number; gpuHours: number; cost: number; projects: number }
    >()
    for (const row of projectRows) {
      const current = map.get(row.department) ?? {
        id: row.department,
        name: row.department,
        used: 0,
        guaranteed: 0,
        gpuHours: 0,
        cost: 0,
        projects: 0,
      }
      current.used += row.used
      current.guaranteed += row.guaranteed
      current.gpuHours += row.gpuHours
      current.cost += row.cost
      current.projects += 1
      map.set(row.department, current)
    }
    return [...map.values()]
      .map((row) => ({
        ...row,
        gpuHours: Math.round(row.gpuHours * 10) / 10,
        cost: Math.round(row.cost * 10) / 10,
      }))
      .sort((a, b) => b.gpuHours - a.gpuHours)
  }, [projectRows])

  const totals = useMemo(() => {
    const gpuHours = Math.round(projectRows.reduce((n, row) => n + row.gpuHours, 0) * 10) / 10
    const cost = Math.round(projectRows.reduce((n, row) => n + row.cost, 0) * 10) / 10
    const used = projectRows.reduce((n, row) => n + row.used, 0)
    const pending = projectRows.reduce((n, row) => n + row.pending, 0)
    return { gpuHours, cost, used, pending, green: Math.round(state.metrics.greenRatio * 100) }
  }, [projectRows, state.metrics.greenRatio])

  return (
    <PageFrame
      kicker="分析"
      title="用量计量"
      description="按部门与项目汇总 GPU·h 与绿电折算成本，支撑配额复盘、超分治理和内部结算。"
      actions={
        <FilterSelect
          label="窗口"
          value={windowKey}
          onChange={(value) => setWindowKey(value as WindowKey)}
          options={[
            { value: '24h', label: '近 24 小时' },
            { value: '7d', label: '近 7 天' },
            { value: '30d', label: '近 30 天' },
          ]}
        />
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: '占用 GPU', value: String(totals.used), unit: '张' },
          { label: 'GPU·h', value: String(totals.gpuHours), unit: windowKey },
          { label: '折算成本', value: `¥${totals.cost}`, unit: '绿电加权' },
          { label: '排队任务', value: String(totals.pending), unit: '个' },
          { label: '绿电占比', value: `${totals.green}%`, unit: '全国加权' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-white px-3 py-3">
            <div className="text-[11px] text-dim">{item.label}</div>
            <div className="metric-num mt-1 text-[22px] leading-none">{item.value}</div>
            <div className="mt-1 text-[11px] text-dim">{item.unit}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <h3 className="mb-2 text-[14px] font-medium text-text">部门汇总</h3>
        <DataTable
          rows={deptRows}
          columns={[
            { key: 'name', header: '部门', render: (row) => <span className="font-medium text-text">{row.name}</span> },
            { key: 'projects', header: '项目数', render: (row) => row.projects },
            {
              key: 'quota',
              header: '配额占用',
              render: (row) => <QuotaBar used={row.used} quota={row.guaranteed} />,
            },
            { key: 'gpuHours', header: 'GPU·h', render: (row) => <span className="font-mono">{row.gpuHours}</span> },
            { key: 'cost', header: '成本', render: (row) => <span className="font-mono">¥{row.cost}</span> },
          ]}
        />
      </div>

      <div>
        <h3 className="mb-2 text-[14px] font-medium text-text">项目明细</h3>
        <DataTable
          rows={projectRows}
          columns={[
            { key: 'name', header: '项目', render: (row) => <span className="font-medium text-text">{row.name}</span> },
            { key: 'department', header: '部门', render: (row) => row.department },
            {
              key: 'quota',
              header: '保底占用',
              render: (row) => <QuotaBar used={row.used} quota={row.guaranteed} />,
            },
            {
              key: 'util',
              header: '利用率',
              render: (row) => (
                <StatusPill tone={row.util >= 90 ? 'warn' : row.util >= 60 ? 'ok' : 'neutral'}>{row.util}%</StatusPill>
              ),
            },
            { key: 'active', header: '运行 GPU', render: (row) => <span className="font-mono">{row.activeGpus}</span> },
            { key: 'gpuHours', header: 'GPU·h', render: (row) => <span className="font-mono">{row.gpuHours}</span> },
            { key: 'cost', header: '成本', render: (row) => <span className="font-mono">¥{row.cost}</span> },
            {
              key: 'priority',
              header: '优先级',
              render: (row) => <span className="font-mono">P{row.priority}</span>,
            },
          ]}
        />
      </div>
    </PageFrame>
  )
}
