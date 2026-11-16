import type { TelemetrySample } from './useClusterTelemetry'

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const width = 160
  const height = 36
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const line = data
    .map((value, index) => {
      const x = (index / Math.max(1, data.length - 1)) * width
      const y = height - ((value - min) / span) * (height - 4) - 2
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-x-2 bottom-1 h-9 w-[calc(100%-16px)]" aria-hidden>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={color} opacity={0.16} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  )
}

function StatCard({
  label,
  value,
  hint,
  color,
  series,
  delta,
  valueClass,
}: {
  label: string
  value: string
  hint?: string
  color: string
  series: number[]
  delta?: number
  valueClass?: string
}) {
  const deltaText =
    delta === undefined ? null : `${delta > 0 ? '+' : ''}${Math.abs(delta) >= 10 ? delta.toFixed(0) : delta.toFixed(1)}`
  return (
    <article className="relative h-[108px] overflow-hidden border border-[#2c3235] bg-[#111217]">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      <div className="flex items-start justify-between px-3 pt-2">
        <div className="text-[11px] font-medium tracking-wide text-[#9aa0a6]">{label}</div>
        {deltaText && delta !== undefined && delta !== 0 && (
          <div className={`font-mono text-[10px] ${delta < 0 ? 'text-[#F2495C]' : 'text-[#73BF69]'}`}>
            {deltaText}
          </div>
        )}
      </div>
      <div className={`px-3 font-mono tracking-tight text-[#f3f4f6] ${valueClass ?? 'text-[26px] leading-none'}`}>{value}</div>
      {hint && <div className="px-3 pt-1 font-mono text-[10px] text-[#6e7781]">{hint}</div>}
      <Sparkline data={series} color={color} />
    </article>
  )
}

export function FleetStatusBar({ history }: { history: TelemetrySample[] }) {
  const latest = history[history.length - 1]
  const prev = history[history.length - 2] ?? latest
  const xidHealthy = latest.xid === 0

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-6">
      <StatCard
        label="Total GPUs"
        value={String(latest.totalGpus)}
        hint="多卡型混部集群"
        color="#8e8ea0"
        series={history.map((item) => item.totalGpus)}
      />
      <StatCard
        label="Active GPUs"
        value={String(latest.activeGpus)}
        hint="推理卡在线"
        color="#73BF69"
        series={history.map((item) => item.activeGpus)}
        delta={latest.activeGpus - prev.activeGpus}
      />
      <StatCard
        label="Avg SM Active"
        value={`${latest.sm.toFixed(1)}%`}
        hint="流式多处理器"
        color="#06B6D4"
        series={history.map((item) => item.sm)}
        delta={latest.sm - prev.sm}
      />
      <StatCard
        label="Total VRAM Used"
        value={`${latest.vramUsedTb.toFixed(2)} / ${latest.vramTotalTb.toFixed(2)} TB`}
        hint="显存总水位"
        color="#8B5CF6"
        series={history.map((item) => item.vramUsedTb)}
        delta={latest.vramUsedTb - prev.vramUsedTb}
        valueClass="pt-1 text-[15px] leading-tight"
      />
      <StatCard
        label="Cluster Power"
        value={`${latest.powerKw.toFixed(1)} kW`}
        hint="机柜实时功耗"
        color="#F59E0B"
        series={history.map((item) => item.powerKw)}
        delta={latest.powerKw - prev.powerKw}
      />
      <StatCard
        label="Xid Critical Errors"
        value={xidHealthy ? '0 Healthy' : String(latest.xid)}
        hint={xidHealthy ? '底层硬件正常' : '存在关键错误'}
        color={xidHealthy ? '#73BF69' : '#F2495C'}
        series={history.map((item) => item.xid)}
        valueClass={xidHealthy ? 'text-[22px] leading-none text-[#73BF69]' : 'text-[26px] leading-none text-[#F2495C]'}
      />
    </div>
  )
}
