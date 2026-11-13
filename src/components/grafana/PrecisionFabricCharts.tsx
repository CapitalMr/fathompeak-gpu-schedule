import { useMemo, type ReactNode } from 'react'
import { CHART_TOOLTIP, areaFill, categoryAxis, clockLabel, useEChart, valueAxis } from './useEChart'
import type { TelemetrySample } from './useClusterTelemetry'

function Panel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="border border-[#2c3235] bg-[#111217]">
      <header className="flex items-center justify-between px-3 pt-2">
        <h3 className="font-sans text-[12px] font-medium text-[#d8d9da]">{title}</h3>
        <span className="font-mono text-[10px] text-[#6e7781]">{hint}</span>
      </header>
      {children}
    </section>
  )
}

export function PrecisionChart({ history }: { history: TelemetrySample[] }) {
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
      yAxis: { ...valueAxis('%', 100), max: 100 },
      series: [
        {
          name: 'BF16 / FP16',
          type: 'line' as const,
          stack: 'prec',
          smooth: true,
          showSymbol: false,
          data: history.map((item) => item.bf16),
          lineStyle: { width: 1.4, color: '#06B6D4' },
          itemStyle: { color: '#06B6D4' },
          areaStyle: areaFill('rgba(6,182,212,0.55)'),
        },
        {
          name: 'FP8 / INT8',
          type: 'line' as const,
          stack: 'prec',
          smooth: true,
          showSymbol: false,
          data: history.map((item) => item.fp8),
          lineStyle: { width: 1.4, color: '#8B5CF6' },
          itemStyle: { color: '#8B5CF6' },
          areaStyle: areaFill('rgba(139,92,246,0.5)'),
        },
        {
          name: 'FP32',
          type: 'line' as const,
          stack: 'prec',
          smooth: true,
          showSymbol: false,
          data: history.map((item) => item.fp32),
          lineStyle: { width: 1.4, color: '#F59E0B' },
          itemStyle: { color: '#F59E0B' },
          areaStyle: areaFill('rgba(245,158,11,0.45)'),
        },
      ],
    }),
    [history],
  )
  const ref = useEChart(option)
  return (
    <Panel title="算力精度分布" hint="BF16 / FP16 · FP8 / INT8 · FP32">
      <div ref={ref} className="h-[260px] w-full" />
    </Panel>
  )
}

export function FabricChart({ history }: { history: TelemetrySample[] }) {
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
      grid: { left: 52, right: 56, top: 28, bottom: 46 },
      xAxis: categoryAxis(history.map((item) => clockLabel(item.t))),
      yAxis: [
        {
          ...valueAxis('GB/s'),
          nameTextStyle: { color: '#8B5CF6', fontSize: 10 },
          axisLabel: { color: '#8B5CF6', fontSize: 10, fontFamily: 'DM Mono, ui-monospace' },
        },
        {
          ...valueAxis('Gbps'),
          nameTextStyle: { color: '#F59E0B', fontSize: 10 },
          axisLabel: { color: '#F59E0B', fontSize: 10, fontFamily: 'DM Mono, ui-monospace' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: 'NVLink (GB/s)',
          type: 'line' as const,
          smooth: true,
          showSymbol: false,
          yAxisIndex: 0,
          data: history.map((item) => item.nvlink),
          lineStyle: { width: 2, color: '#8B5CF6' },
          itemStyle: { color: '#8B5CF6' },
          areaStyle: areaFill('rgba(139,92,246,0.28)'),
        },
        {
          name: 'RDMA / RoCE (Gbps)',
          type: 'line' as const,
          smooth: true,
          showSymbol: false,
          yAxisIndex: 1,
          data: history.map((item) => item.rdma),
          lineStyle: { width: 2, color: '#F59E0B' },
          itemStyle: { color: '#F59E0B' },
          areaStyle: areaFill('rgba(245,158,11,0.22)'),
        },
      ],
    }),
    [history],
  )
  const ref = useEChart(option)
  return (
    <Panel title="NVLink vs RDMA 互联吞吐" hint="卡间 GB/s · 跨机 Gbps">
      <div ref={ref} className="h-[260px] w-full" />
    </Panel>
  )
}
