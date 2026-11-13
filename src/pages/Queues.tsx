import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock3, ListOrdered } from 'lucide-react'
import { formatDuration, strategyLabel } from '../mock/engine'
import { QUEUE, type QueuedWorkload } from '../mock/queue'
import { useApp } from '../store/AppContext'

const TYPE_LABEL = {
  Inference: '推理',
  Training: '训练',
  Workspace: '工作空间',
} as const

function priorityTone(priority: number) {
  if (priority <= 1) return 'border-[rgba(47,99,184,0.3)] bg-[#eef3fb] text-infer'
  if (priority <= 3) return 'border-[rgba(78,63,102,0.28)] bg-[rgba(78,63,102,0.08)] text-multi'
  return 'border-[rgba(138,98,50,0.28)] bg-[rgba(138,98,50,0.08)] text-gang'
}

function laneBarColor(id: 'high' | 'normal' | 'low') {
  if (id === 'high') return 'bg-infer'
  if (id === 'normal') return 'bg-multi'
  return 'bg-gang'
}

export function Queues() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [lane, setLane] = useState<'all' | 'high' | 'normal' | 'low'>('all')

  const running = useMemo(
    () => state.workloads.filter((w) => w.status === 'Running'),
    [state.workloads],
  )

  const pending = useMemo(() => {
    const fromState: QueuedWorkload[] = state.workloads
      .filter((w) => w.status === 'Pending')
      .map((w) => ({
        ...w,
        queuePriority: state.projects.find((p) => p.id === w.projectId)?.priority ?? 3,
        waitReason: w.events[0]?.message ?? '等待可用资源',
      }))
    const merged = [...QUEUE, ...fromState]
    const seen = new Set<string>()
    return merged.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [state.workloads, state.projects])

  const lanes = useMemo(() => {
    const high = pending.filter((w) => (w.queuePriority ?? 3) <= 1)
    const normal = pending.filter((w) => {
      const p = w.queuePriority ?? 3
      return p >= 2 && p <= 3
    })
    const low = pending.filter((w) => (w.queuePriority ?? 3) >= 4)
    return { high, normal, low }
  }, [pending])

  const rows = useMemo(() => {
    if (lane === 'high') return lanes.high
    if (lane === 'normal') return lanes.normal
    if (lane === 'low') return lanes.low
    return [...pending].sort(
      (a, b) => (a.queuePriority ?? 99) - (b.queuePriority ?? 99) || b.durationSec - a.durationSec,
    )
  }, [lane, lanes, pending])

  const waitingGpus = pending.reduce((n, w) => n + w.gpuCount, 0)
  const avgWait = pending.length
    ? Math.round(pending.reduce((n, w) => n + w.durationSec, 0) / pending.length)
    : 0
  const maxLane = Math.max(lanes.high.length, lanes.normal.length, lanes.low.length, 1)

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto px-8 pb-8 pt-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12.5px] text-dim">工作负载</p>
          <h2 className="text-[28px] leading-none">调度队列</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            按优先级通道排队 · 配额 / 拓扑 / Gang 成组阻塞可视化
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/workloads')}
          className="flex h-9 items-center gap-1.5 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-3.5 text-[13px] font-medium text-infer hover:bg-[#e3ecfa]"
        >
          前往工作负载
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="sheet grid grid-cols-2 overflow-hidden sm:grid-cols-4">
        {[
          { label: '排队任务', value: String(pending.length), unit: '等待调度' },
          { label: '等待 GPU', value: String(waitingGpus), unit: '张卡需求' },
          { label: '平均等待', value: formatDuration(avgWait), unit: '队列时延' },
          { label: '运行中', value: String(running.length), unit: '已占资源' },
        ].map((item, i) => (
          <div key={item.label} className={`grid gap-0.5 px-3 py-3 ${i > 0 ? 'border-l border-border' : ''}`}>
            <span className="text-[11px] text-dim">{item.label}</span>
            <b className="metric-num text-[24px] font-normal leading-none">{item.value}</b>
            <small className="text-[11px] text-dim">{item.unit}</small>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {(
          [
            { id: 'high' as const, title: '高优通道 P1', desc: '保底配额 / 不可抢占', items: lanes.high, tone: 'text-infer' },
            { id: 'normal' as const, title: '标准通道 P2-P3', desc: '可超分 / 绿电加权', items: lanes.normal, tone: 'text-multi' },
            { id: 'low' as const, title: '低优通道 P4+', desc: '可抢占 / 闲时填充', items: lanes.low, tone: 'text-gang' },
          ] as const
        ).map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setLane(card.id)}
            className={`sheet relative overflow-hidden p-3.5 text-left transition ${
              lane === card.id
                ? 'ring-2 ring-[rgba(47,99,184,0.28)]'
                : 'hover:shadow-[0_0_0_1px_rgba(47,99,184,0.16)]'
            }`}
          >
            <div className={`absolute inset-y-0 left-0 w-[3px] ${laneBarColor(card.id)}`} />
            <div className="flex items-center justify-between pl-1">
              <div className="flex items-center gap-2">
                <ListOrdered className={`h-3.5 w-3.5 ${card.tone}`} />
                <span className="text-[13px] font-medium">{card.title}</span>
              </div>
              <span className="metric-num text-[22px] leading-none">{card.items.length}</span>
            </div>
            <p className="mt-1 pl-1 text-[11px] text-dim">{card.desc}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
              <div
                className={`h-full rounded-full ${laneBarColor(card.id)}`}
                style={{ width: `${(card.items.length / maxLane) * 100}%` }}
              />
            </div>
            <div className="mt-3 space-y-1.5">
              {card.items.slice(0, 3).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg bg-[rgba(61,49,79,0.035)] px-2 py-1.5 text-[11px]"
                >
                  <span className="truncate text-muted">{w.name}</span>
                  <span className="shrink-0 font-mono text-dim">{w.gpuCount} GPU</span>
                </div>
              ))}
              {card.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-dim">
                  通道空闲
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="sheet overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Clock3 className="h-3.5 w-3.5 text-dim" />
            排队明细
          </div>
          <div className="flex gap-1.5">
            {(
              [
                ['all', '全部'],
                ['high', '高优'],
                ['normal', '标准'],
                ['low', '低优'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setLane(id)}
                className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                  lane === id
                    ? 'bg-[rgba(47,99,184,0.12)] text-infer'
                    : 'text-dim hover:bg-[rgba(61,49,79,0.05)] hover:text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-[rgba(248,248,248,0.92)] text-[11px] text-dim backdrop-blur">
              <tr className="border-b border-border">
                <th className="px-3.5 py-2.5 font-medium">优先级</th>
                <th className="px-3 py-2.5 font-medium">任务</th>
                <th className="px-3 py-2.5 font-medium">项目</th>
                <th className="px-3 py-2.5 font-medium">类型</th>
                <th className="px-3 py-2.5 font-medium">策略</th>
                <th className="px-3 py-2.5 font-medium">GPU</th>
                <th className="px-3 py-2.5 font-medium">已等待</th>
                <th className="px-3.5 py-2.5 font-medium">阻塞原因</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const priority = w.queuePriority ?? 3
                const bar =
                  priority <= 1 ? 'bg-infer' : priority <= 3 ? 'bg-multi' : 'bg-gang'
                return (
                  <tr
                    key={w.id}
                    className="border-b border-border/70 last:border-0 hover:bg-[rgba(47,99,184,0.03)]"
                  >
                    <td className="relative px-3.5 py-2.5">
                      <span className={`absolute inset-y-2 left-0 w-[3px] rounded-r ${bar}`} />
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${priorityTone(priority)}`}>
                        P{priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-text">{w.name}</div>
                      <div className="font-mono text-[11px] text-dim">{w.model}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{w.projectName}</td>
                    <td className="px-3 py-2.5 text-muted">{TYPE_LABEL[w.type]}</td>
                    <td className="px-3 py-2.5 text-muted">{strategyLabel(w.strategy)}</td>
                    <td className="px-3 py-2.5 font-mono">{w.gpuCount}</td>
                    <td className="px-3 py-2.5 font-mono text-muted">{formatDuration(w.durationSec)}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <i className={`h-1.5 w-1.5 rounded-full ${bar}`} />
                        {w.waitReason ?? w.events[0]?.message ?? '等待可用资源'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3.5 py-12 text-center">
                    <div className="mx-auto max-w-sm rounded-xl border border-dashed border-border px-4 py-8 text-dim">
                      当前通道无排队任务
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
