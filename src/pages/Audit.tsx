import { useMemo, useState } from 'react'
import { DataTable, FilterSelect, PageFrame, StatusPill, TextInput } from '../components/console/ui'
import { useApp } from '../store/AppContext'
import type { AuditEvent } from '../types'

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function toneOf(level: AuditEvent['level']): 'ok' | 'warn' | 'neutral' {
  if (level === 'success') return 'ok'
  if (level === 'warn') return 'warn'
  return 'neutral'
}

function levelLabel(level: AuditEvent['level']) {
  if (level === 'success') return '成功'
  if (level === 'warn') return '告警'
  return '信息'
}

export function AuditPage() {
  const { state } = useApp()
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<'all' | AuditEvent['level']>('all')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.audits.filter((item) => {
      if (level !== 'all' && item.level !== level) return false
      if (!q) return true
      return (
        item.actor.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q) ||
        item.target.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q)
      )
    })
  }, [level, query, state.audits])

  const counts = useMemo(() => {
    const warn = state.audits.filter((item) => item.level === 'warn').length
    const success = state.audits.filter((item) => item.level === 'success').length
    return { total: state.audits.length, warn, success }
  }, [state.audits])

  return (
    <PageFrame
      kicker="治理"
      title="审计日志"
      description="记录登录、配额变更、策略启停与调度器关键决策，满足私有化智算中心的操作可追溯要求。"
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '全部事件', value: String(counts.total) },
          { label: '成功', value: String(counts.success) },
          { label: '告警级', value: String(counts.warn) },
          { label: '调度器动作', value: String(state.audits.filter((a) => a.actor === 'scheduler').length) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-white px-3 py-3">
            <div className="text-[11px] text-dim">{item.label}</div>
            <div className="metric-num mt-1 text-[22px] leading-none">{item.value}</div>
          </div>
        ))}
      </div>

      <DataTable
        rows={rows}
        toolbar={
          <>
            <TextInput value={query} onChange={setQuery} placeholder="搜索操作者、动作或对象" className="w-64" />
            <FilterSelect
              label="级别"
              value={level}
              onChange={(value) => setLevel(value as typeof level)}
              options={[
                { value: 'all', label: '全部' },
                { value: 'info', label: '信息' },
                { value: 'success', label: '成功' },
                { value: 'warn', label: '告警' },
              ]}
            />
          </>
        }
        columns={[
          {
            key: 'ts',
            header: '时间',
            render: (row) => <span className="font-mono text-[12px]">{formatTime(row.ts)}</span>,
          },
          { key: 'actor', header: '操作者', render: (row) => <span className="font-mono text-[12px]">{row.actor}</span> },
          { key: 'action', header: '动作', render: (row) => <span className="font-medium text-text">{row.action}</span> },
          { key: 'target', header: '对象', render: (row) => row.target },
          { key: 'detail', header: '详情', render: (row) => row.detail },
          {
            key: 'level',
            header: '级别',
            render: (row) => <StatusPill tone={toneOf(row.level)}>{levelLabel(row.level)}</StatusPill>,
          },
        ]}
      />
    </PageFrame>
  )
}
