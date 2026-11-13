import { useMemo } from 'react'
import { CHART_TOOLTIP, areaFill, categoryAxis, clockLabel, useEChart, valueAxis } from './useEChart'
import type { TelemetrySample } from './useClusterTelemetry'

function series(name: string, color: string, data: number[], fill: string) {
  return {
    name,
    type: 'line' as const,
    smooth: true,
    showSymbol: false,
    data,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    areaStyle: areaFill(fill),
  }
}

export function EngineWaveChart({ history }: { history: TelemetrySample[] }) {
  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      animationDurationUpdate: 400,
      tooltip: CHART_TOOLTIP,
      legend: {
        bottom: 0,
        left: 'center',
        textStyle: { color: '#9aa0a6', fontSize: 11 },
        icon: 'roundRect',
        itemWidth: 14,
        itemHeight: 4,
      },
      grid: { left: 46, right: 16, top: 28, bottom: 46 },
      xAxis: categoryAxis(history.map((item) => clockLabel(item.t))),
      yAxis: { ...valueAxis('%', 100), name: '' },
      series: [
        series(
          'SM Active (%)',
          '#06B6D4',
          history.map((item) => item.sm),
          'rgba(6,182,212,0.38)',
        ),
        series(
          'Tensor Core Active (%)',
          '#8B5CF6',
          history.map((item) => item.tensor),
          'rgba(139,92,246,0.34)',
        ),
        series(
          'DRAM Bandwidth (%)',
          '#F59E0B',
          history.map((item) => item.dram),
          'rgba(245,158,11,0.30)',
        ),
      ],
    }),
    [history],
  )
  const ref = useEChart(option)

  return (
    <section className="border border-[#2c3235] bg-[#111217]">
      <header className="flex items-center justify-between px-3 pt-2">
        <h3 className="font-sans text-[12px] font-medium text-[#d8d9da]">计算与访存引擎</h3>
        <span className="font-mono text-[10px] text-[#6e7781]">SM · Tensor Core · DRAM · 30 × 2s</span>
      </header>
      <div ref={ref} className="h-[280px] w-full" />
    </section>
  )
}
