import { useEffect, useMemo, useRef, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { formatDuration, strategyLabel } from '../../mock/engine'
import { QUEUE } from '../../mock/queue'
import { useApp } from '../../store/AppContext'
import type { ServerNode, Workload } from '../../types'
import { ScheduleFlowOverlay } from '../flow/ScheduleFlowOverlay'
import { clamp, displayHostname } from '../grafana/format'
import { categoryAxis, clockLabel, useEChart, valueAxis } from '../grafana/useEChart'

export { QUEUE }

const COLORS = ['#73BF69', '#F2CC0C', '#FF9830', '#8AB8FF', '#B877D9', '#5794F2', '#FADE2A', '#FF780A']

interface GpuSample {
  key: string
  sm: number
  mem: number
  power: number
  temp: number
}

interface HistoryPoint {
  t: number
  gpus: GpuSample[]
}

function readGpus(workload: Workload, servers: ServerNode[], tick: number): GpuSample[] {
  const rows: GpuSample[] = []
  workload.allocations.forEach((allocation) => {
    const server = servers.find((item) => item.id === allocation.serverId)
    allocation.gpuIndices.forEach((index) => {
      if (rows.length >= 8) return
      const gpu = server?.gpus[index]
      const wobble = Math.sin(tick * 0.7 + index)
      rows.push({
        key: `${displayHostname(allocation.hostname)} GPU ${index}`,
        sm: clamp((gpu?.utilization ?? 72) + wobble * 3, 1, 99),
        mem: clamp((gpu?.memoryUsedGb ?? 48) + wobble * 0.5, 0.4, (gpu?.memoryTotalGb ?? 80) - 0.2),
        power: clamp((gpu?.powerW ?? 460) + wobble * 14, 40, Math.max(250, (gpu?.powerW ?? 460) + 80)),
        temp: clamp((gpu?.temperature ?? 68) + wobble * 0.8, 32, 94),
      })
    })
  })
  return rows
}

function useGpuHistory(workload: Workload | null, servers: ServerNode[]) {
  const workloadRef = useRef(workload)
  const serversRef = useRef(servers)
  workloadRef.current = workload
  serversRef.current = servers
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const key = `${workload?.id ?? ''}:${workload?.allocations.length ?? 0}`

  useEffect(() => {
    const current = workloadRef.current
    const nodes = serversRef.current
    if (!current || current.allocations.length === 0) {
      setHistory([])
      return
    }
    const now = Date.now()
    setHistory(
      Array.from({ length: 45 }, (_, index) => ({
        t: now - (44 - index) * 1000,
        gpus: readGpus(current, nodes, index),
      })),
    )
    const timer = window.setInterval(() => {
      const live = workloadRef.current
      if (!live) return
      setHistory((prev) => {
        const next = { t: Date.now(), gpus: readGpus(live, serversRef.current, prev.length) }
        const base = prev.length >= 45 ? prev.slice(1) : prev
        return [...base, next]
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [key])

  return history
}

function Curve({ title, option }: { title: string; option: EChartsOption }) {
  const ref = useEChart(option)
  return (
    <section className="min-w-0 rounded-[12px] border border-border-bright bg-[#fbfaf7]">
      <h3 className="border-b border-border px-2.5 py-1.5 font-sans text-[12px] font-medium text-text">{title}</h3>
      <div ref={ref} className="h-[180px] bg-white" />
    </section>
  )
}

function buildCurve(history: HistoryPoint[], pick: (gpu: GpuSample) => number, unit: string): EChartsOption {
  const names = history[0]?.gpus.map((gpu) => gpu.key) ?? []
  return {
    backgroundColor: 'transparent',
    animationDurationUpdate: 0,
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: 'rgba(61,49,79,0.18)',
      textStyle: { color: '#212021', fontSize: 11 },
    },
    legend: { bottom: 0, left: 'center', type: 'scroll', textStyle: { color: 'rgba(33,32,33,0.55)', fontSize: 10 } },
    grid: { left: 46, right: 12, top: 16, bottom: 42 },
    xAxis: categoryAxis(history.map((point) => clockLabel(point.t))),
    yAxis: valueAxis(unit),
    series: names.map((name, index) => ({
      name,
      type: 'line' as const,
      smooth: 0.25,
      showSymbol: false,
      data: history.map((point) => {
        const found = point.gpus.find((gpu) => gpu.key === name)
        return found ? Math.round(pick(found) * 10) / 10 : 0
      }),
      lineStyle: { width: 2.2, color: COLORS[index % COLORS.length] },
      itemStyle: { color: COLORS[index % COLORS.length] },
    })),
  }
}

export function TaskHardware({
  workload,
  servers,
  onClose,
}: {
  workload: Workload
  servers: ServerNode[]
  onClose: () => void
}) {
  const { state } = useApp()
  const history = useGpuHistory(workload, servers)
  const smOption = useMemo(() => buildCurve(history, (gpu) => gpu.sm, '%'), [history])
  const memOption = useMemo(() => buildCurve(history, (gpu) => gpu.mem, 'GB'), [history])
  const powerOption = useMemo(() => buildCurve(history, (gpu) => gpu.power, 'W'), [history])
  const tempOption = useMemo(() => buildCurve(history, (gpu) => gpu.temp, '°C'), [history])

  return (
    <div className="grid gap-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
      <ScheduleFlowOverlay
        embedded
        workload={workload}
        servers={servers}
        pools={state.pools}
        stations={state.stations}
        onClose={onClose}
      />
      <div className="grid min-w-0 content-start gap-2">
        <div className="px-1 text-[12px] text-muted">
          {workload.name} · 绑定显卡资源曲线
          {workload.allocations.length === 0 ? ' · 排队中，尚未绑定 GPU' : ''}
        </div>
        {history.length > 0 ? (
          <>
            <Curve title="SM Active (%)" option={smOption} />
            <Curve title="FB Memory (GB)" option={memOption} />
            <Curve title="Power (W)" option={powerOption} />
            <Curve title="Core Temp (°C)" option={tempOption} />
          </>
        ) : (
          <div className="grid h-[180px] place-items-center rounded-[12px] border border-dashed border-border bg-panel text-[12px] text-dim">
            任务仍在排队，调度完成后这里显示各卡 SM、显存、功耗和温度曲线。
          </div>
        )}
      </div>
    </div>
  )
}

export function TaskBoard({
  workloads,
  selectedId,
  onOpen,
}: {
  workloads: Workload[]
  selectedId?: string | null
  onOpen: (id: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'Running' | 'Pending'>('all')
  const rows = useMemo(() => {
    const merged = [...workloads, ...QUEUE]
    return merged
      .filter((workload) => workload.status === 'Running' || workload.status === 'Pending')
      .filter((workload) => (filter === 'all' ? true : workload.status === filter))
      .sort((a, b) => Number(b.status === 'Running') - Number(a.status === 'Running') || b.gpuCount - a.gpuCount)
  }, [workloads, filter])

  return (
    <section className="rounded-[14px] border border-border bg-panel shadow-[0_2px_10px_rgba(33,32,33,0.04)]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 className="font-sans text-[13px] font-medium text-text">正在执行 / 排队任务</h3>
        <div className="flex gap-1">
          {(
            [
              ['all', '全部'],
              ['Running', '运行中'],
              ['Pending', '排队中'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-[8px] px-2 py-1 text-[11px] ${
                filter === id ? 'bg-[rgba(47,99,184,0.12)] text-infer' : 'text-dim hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="overflow-auto">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead className="text-dim">
            <tr>
              {['任务', '模型', '状态', '策略', 'GPU', '项目', '时延', '运行'].map((head) => (
                <th key={head} className="border-b border-border px-3 py-2 font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((workload) => {
              const active = workload.id === selectedId
              return (
                <tr
                  key={workload.id}
                  onClick={() => onOpen(workload.id)}
                  className={`cursor-pointer border-b border-border ${
                    active ? 'bg-[rgba(47,99,184,0.08)]' : 'hover:bg-void'
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-text">{workload.name}</td>
                  <td className="px-3 py-2 text-muted">{workload.model}</td>
                  <td className="px-3 py-2">
                    <span className={workload.status === 'Running' ? 'text-[#2f9e44]' : 'text-[#b8860b]'}>
                      {workload.status === 'Running' ? '运行中' : '排队中'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">{strategyLabel(workload.strategy)}</td>
                  <td className="px-3 py-2 font-mono text-text">{workload.gpuCount}</td>
                  <td className="px-3 py-2 text-dim">{workload.projectName}</td>
                  <td className="px-3 py-2 font-mono text-text">
                    {workload.status === 'Running' && workload.latencyMs ? `${workload.latencyMs} ms` : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-dim">{formatDuration(workload.durationSec)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

