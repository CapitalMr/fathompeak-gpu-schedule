import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { ServerNode } from '../../types'
import { clamp, displayHostname } from '../grafana/format'
import { useClusterTelemetry } from '../grafana/useClusterTelemetry'
import { categoryAxis, clockLabel, useEChart, valueAxis } from '../grafana/useEChart'
import { CollapsibleSection } from './CollapsibleSection'
import { GpuResourceOverview } from './GpuResourceOverview'
import { DEMO_SCROLL_MS } from './stationDemo'
import { specForModel } from './gpuSpecs'

const RACKS = ['机柜 A', '机柜 B', '机柜 C']
const SCROLL_WINDOW = DEMO_SCROLL_MS

function ChartBox({ title, option, height = 168 }: { title: string; option: EChartsOption; height?: number }) {
  const chartOption = useMemo<EChartsOption>(
    () => ({ animation: false, animationDurationUpdate: 0, ...option }),
    [option],
  )
  const ref = useEChart(chartOption)
  return (
    <section className="min-w-0 rounded-[12px] border border-border-bright bg-[#fbfaf7] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <h3 className="truncate border-b border-border px-2.5 py-1.5 font-sans text-[12px] font-medium text-text">{title}</h3>
      <div ref={ref} className="bg-white" style={{ height }} />
    </section>
  )
}

function line(name: string, color: string, data: number[], stack?: string) {
  return {
    name,
    type: 'line' as const,
    smooth: 0.25,
    showSymbol: false,
    data,
    lineStyle: { width: 2.4, color },
    itemStyle: { color },
    ...(stack ? { stack, areaStyle: { color, opacity: 0.7 } } : {}),
  }
}

function area(name: string, color: string, data: number[]) {
  return {
    name,
    type: 'line' as const,
    smooth: 0.2,
    showSymbol: false,
    data,
    lineStyle: { width: 2.2, color },
    itemStyle: { color },
    areaStyle: { color, opacity: 0.5 },
  }
}

function tightAxis(labels: string[], boundary = false) {
  const base = categoryAxis(labels)
  return {
    ...base,
    boundaryGap: boundary,
    axisLabel: { ...base.axisLabel, interval: 8, hideOverlap: true },
  }
}

const legend = {
  bottom: 0,
  left: 'center' as const,
  textStyle: { color: 'rgba(33,32,33,0.78)', fontSize: 11, fontWeight: 500 },
  icon: 'roundRect' as const,
  itemWidth: 14,
  itemHeight: 4,
}

const tooltip = {
  trigger: 'axis' as const,
  backgroundColor: '#ffffff',
  borderColor: 'rgba(61,49,79,0.28)',
  textStyle: { color: '#212021', fontSize: 12 },
  extraCssText: 'box-shadow:0 8px 24px rgba(33,32,33,0.12);',
}

function useScrollNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 180)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function StatStrip({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 xl:grid-cols-8">
      {items.map((item) => (
        <div key={item.label} className="rounded-[10px] border border-border bg-panel px-2 py-1.5">
          <div className="truncate text-[10px] text-dim">{item.label}</div>
          <div className="mt-0.5 font-mono text-[16px] leading-none" style={{ color: item.color ?? '#212021' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function RackTrendCharts({ history }: { history: ReturnType<typeof useClusterTelemetry> }) {
  const now = useScrollNow()
  const barOptions = useMemo<EChartsOption[]>(
    () =>
      [0, 1, 2].map((part) => ({
        backgroundColor: 'transparent',
        animationDurationUpdate: 180,
        animationEasingUpdate: 'linear',
        tooltip,
        grid: { left: 40, right: 12, top: 16, bottom: 28 },
        xAxis: {
          type: 'time',
          min: now - SCROLL_WINDOW,
          max: now,
          axisLine: { lineStyle: { color: 'rgba(61,49,79,0.28)' } },
          axisTick: { show: false },
          axisLabel: {
            color: 'rgba(33,32,33,0.72)',
            fontSize: 10,
            fontFamily: 'DM Mono, ui-monospace',
            hideOverlap: true,
            formatter: (value: number) =>
              new Date(value).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          min: (extent: { min: number }) => Math.max(0, Math.floor(extent.min - 4)),
          max: (extent: { max: number }) => Math.min(100, Math.ceil(extent.max + 4)),
          axisLine: { show: false },
          axisLabel: { color: 'rgba(33,32,33,0.72)', fontSize: 10, fontFamily: 'DM Mono, ui-monospace', formatter: '{value}%' },
          splitLine: { lineStyle: { color: 'rgba(61,49,79,0.14)' } },
        },
        series: [
          {
            name: '使用率',
            type: 'line',
            showSymbol: true,
            symbol: 'circle',
            symbolSize: 6,
            smooth: 0.15,
            data: history.map((item) => [
              item.t,
              Math.round(clamp(item.sm * 0.72 + 18 + part * 2.4 + Math.sin(item.t / 3500 + part) * 3.2, 8, 96) * 10) / 10,
            ]),
            lineStyle: { width: 2.4, color: '#E8790A' },
            itemStyle: { color: '#C2410C', borderColor: '#ffffff', borderWidth: 1 },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(232, 121, 10, 0.55)' },
                  { offset: 0.5, color: 'rgba(194, 65, 12, 0.28)' },
                  { offset: 1, color: 'rgba(248, 248, 248, 0.02)' },
                ],
              },
            },
          },
        ],
      })),
    [history, now],
  )

  return (
    <div className="grid gap-2 lg:grid-cols-3">
      {RACKS.map((name, index) => (
        <ChartBox key={`bar-${name}`} title={`${name} GPU 使用率趋势`} option={barOptions[index] ?? {}} height={200} />
      ))}
    </div>
  )
}

export function GrafanaWall({ servers, stationId }: { servers: ServerNode[]; stationId: string }) {
  const history = useClusterTelemetry(servers, stationId)
  const labels = history.map((item) => clockLabel(item.t))
  const last = history[history.length - 1]

  const utilOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 36, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('%', 100),
      series: [
        line('GPU Util', '#73BF69', history.map((item) => Math.round(item.sm * 0.92 * 10) / 10)),
        line('SM Active', '#F2CC0C', history.map((item) => item.sm)),
        line('Tensor Active', '#FF9830', history.map((item) => item.tensor)),
        line('GR-Engine Active', '#B877D9', history.map((item, index) => Math.round((item.sm * 0.58 + Math.sin(index / 2.2) * 8) * 10) / 10)),
      ],
    }),
    [history, labels],
  )

  const engineOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 36, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('%', 100),
      series: [
        line('Graphics Engine', '#73BF69', history.map((item, index) => clamp(item.sm * 0.62 + Math.sin(index / 1.8) * 7, 0, 100))),
        line('Copy Engine', '#5794F2', history.map((item, index) => clamp(item.dram * 0.48 + Math.cos(index / 2.1) * 6, 0, 100))),
        line('NVDEC', '#F2CC0C', history.map((item, index) => clamp(item.sm * 0.18 + Math.sin(index / 2.6) * 4, 0, 40))),
        line('NVENC', '#FF9830', history.map((item, index) => clamp(item.sm * 0.12 + Math.cos(index / 2.3) * 3, 0, 35))),
      ],
    }),
    [history, labels],
  )

  const occOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 36, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('%', 100),
      series: [
        area('SM Occupancy', '#73BF69', history.map((item, index) => clamp(item.sm * 0.84 + Math.sin(index / 1.7) * 6, 0, 100))),
        line('Pipe Occupancy', '#B877D9', history.map((item, index) => clamp(item.tensor * 0.78 + Math.cos(index / 2) * 5, 0, 100))),
      ],
    }),
    [history, labels],
  )

  const dramOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 36, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('%', 100),
      series: [
        area('DRAM Active', '#73BF69', history.map((item, index) => clamp(item.dram + (index > history.length - 4 ? 18 : Math.sin(index) * 4), 0, 100))),
        line('FB Used', '#FF9830', history.map((item) => clamp((item.vramUsedTb / Math.max(0.01, item.vramTotalTb)) * 100, 0, 100))),
      ],
    }),
    [history, labels],
  )

  const clockOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 42, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('GHz'),
      series: [
        // SM：随负载在 base→boost 间爬升（H100 boost 1.98 / A100 1.41）
        line(
          'SM Clock',
          '#73BF69',
          history.map((item, index) => {
            const boost = item.smBoostGhz || 1.98
            const base = item.smBaseGhz || 1.41
            return Math.round((base + (boost - base) * (item.sm / 100) + Math.sin(index / 3) * 0.015) * 1000) / 1000
          }),
        ),
        // Memory Clock：nvidia-smi 对 H100 常见 2.619 GHz，随负载微抖
        line(
          'Memory Clock',
          '#5794F2',
          history.map((item, index) => Math.round(((item.memClockGhz || 2.619) + Math.cos(index / 3.2) * 0.008) * 1000) / 1000),
        ),
        line(
          'Application Clock',
          '#F2CC0C',
          history.map((item, index) => {
            const boost = item.smBoostGhz || 1.98
            const base = item.smBaseGhz || 1.41
            return Math.round((base + (boost - base) * (item.tensor / 100) * 0.92 + Math.sin(index / 2.4) * 0.01) * 1000) / 1000
          }),
        ),
      ],
    }),
    [history, labels],
  )

  const precisionOption = useMemo<EChartsOption>(() => {
    // DCGM Pipe 指标彼此独立，不做堆叠（堆叠会虚假超过 100%）
    const series = [
      ['FP32', '#8AB8FF', (item: (typeof history)[number]) => item.fp32],
      ['FP16/BF16', '#73BF69', (item: (typeof history)[number]) => item.bf16],
      ['FP8', '#B877D9', (item: (typeof history)[number]) => item.fp8],
      ['Tensor', '#FF9830', (item: (typeof history)[number]) => item.tensor * 0.55],
    ] as const
    const tip = history[history.length - 1]
    return {
      backgroundColor: 'transparent',
      tooltip,
      legend: {
        ...legend,
        formatter: (name: string) => {
          const found = series.find((item) => item[0] === name)
          const value = tip && found ? found[2](tip) : 0
          return `${name}  ${value.toFixed(1)}%`
        },
      },
      grid: { left: 36, right: 8, top: 8, bottom: 56 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('%', 100),
      series: series.map(([name, color, pick]) => line(name, color, history.map((item) => Math.round(pick(item) * 10) / 10))),
    }
  }, [history, labels])

  const pipeOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 36, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('%', 100),
      series: [
        line('Pipe Tensor', '#FF9830', history.map((item) => item.tensor)),
        // LLM 推理负载下 FP64 Pipe 通常很低（H100 非双精度为主）
        line('Pipe FP64', '#8AB8FF', history.map((item, index) => clamp(1.2 + item.fp32 * 0.06 + Math.sin(index / 2.8) * 0.8, 0, 12))),
        line('Pipe FP32', '#73BF69', history.map((item) => item.fp32)),
        line('Pipe FP16', '#B877D9', history.map((item) => item.bf16)),
      ],
    }),
    [history, labels],
  )

  const tflopsOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 42, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('TFLOPS'),
      series: [
        // 单卡平均达成算力 ≈ 峰值 × 对应 Pipe 活跃度（H100 FP16 Tensor 989 TFLOPS）
        area(
          'FP32 TFLOPS',
          '#73BF69',
          history.map((item) => Math.round(((item.peakFp32 || 67) * (item.fp32 / 100) * (item.sm / 100)) * 10) / 10),
        ),
        line(
          'FP16 TFLOPS',
          '#F2CC0C',
          history.map((item) => Math.round(((item.peakFp16 || 989) * (item.bf16 / 100) * (item.tensor / 100)) * 10) / 10),
        ),
        line(
          'FP8 TFLOPS',
          '#B877D9',
          history.map((item) => Math.round(((item.peakFp8 || 1979) * (item.fp8 / 100) * (item.tensor / 100)) * 10) / 10),
        ),
      ],
    }),
    [history, labels],
  )

  const bwOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 42, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('GB/s'),
      series: [
        // HBM 达成带宽 ≈ DRAM Active% × 峰值（H100 3350 GB/s）
        area(
          'DRAM Bandwidth',
          '#73BF69',
          history.map((item) => Math.round(((item.peakDramGBs || 3350) * (item.dram / 100)) * 10) / 10),
        ),
        line('卡间互联 Avg', '#B877D9', history.map((item) => Math.round(item.nvlink * 10) / 10)),
        // PCIe Gen5 x16 单向约 32 GB/s，主机↔GPU 常见 8–28
        line('PCIe Bandwidth', '#5794F2', history.map((item, index) => Math.round(clamp(8 + item.sm * 0.16 + Math.sin(index / 2) * 2.4, 4, 32) * 10) / 10)),
      ],
    }),
    [history, labels],
  )

  const fabricOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 42, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('GB/s'),
      series: [
        line('Fabric TX', '#B877D9', history.map((item) => Math.round(item.nvlink * 0.52 * 10) / 10)),
        line('Fabric RX', '#8AB8FF', history.map((item) => Math.round(item.nvlink * 0.48 * 10) / 10)),
        line('RDMA TX', '#73BF69', history.map((item) => Math.round(item.rdma * 0.53 * 10) / 10)),
        line('RDMA RX', '#F2CC0C', history.map((item) => Math.round(item.rdma * 0.47 * 10) / 10)),
      ],
    }),
    [history, labels],
  )

  const pcieOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 42, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('GB/s'),
      series: [
        area('PCIe TX', '#73BF69', history.map((item, index) => Math.round(clamp(6 + item.dram * 0.12 + Math.sin(index / 1.9) * 2.2, 2, 30) * 10) / 10)),
        line('PCIe RX', '#FF9830', history.map((item, index) => Math.round(clamp(5 + item.sm * 0.1 + Math.cos(index / 2.2) * 1.8, 2, 28) * 10) / 10)),
        line('Replay Overhead', '#F2495C', history.map((_, index) => Math.round(clamp(0.05 + Math.abs(Math.sin(index / 5)) * 0.35, 0, 1.2) * 100) / 100)),
      ],
    }),
    [history, labels],
  )

  const powerOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 42, right: 42, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: [
        { ...valueAxis('kW'), position: 'left' as const },
        {
          type: 'value' as const,
          name: '°C',
          min: 25,
          max: 95,
          position: 'right' as const,
          nameTextStyle: { color: 'rgba(33,32,33,0.72)', fontSize: 10 },
          axisLabel: { color: 'rgba(33,32,33,0.72)', fontSize: 10 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          ...area('Power Draw', '#E8790A', history.map((item) => item.powerKw)),
          yAxisIndex: 0,
        },
        {
          ...line('Avg Temp', '#2F9E44', history.map((item) => item.avgTempC ?? Math.round((48 + item.sm * 0.32) * 10) / 10)),
          yAxisIndex: 1,
        },
        {
          ...line('Hotspot', '#9B3A3A', history.map((item) => item.hotspotC ?? Math.round((56 + item.sm * 0.36) * 10) / 10)),
          yAxisIndex: 1,
        },
      ],
    }),
    [history, labels],
  )

  const fbOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 42, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('TB'),
      series: [
        area('FB Used', '#5794F2', history.map((item) => item.vramUsedTb)),
        line('FB Total', '#B877D9', history.map((item) => item.vramTotalTb)),
        line('FB Free', '#73BF69', history.map((item) => Math.max(0, Math.round((item.vramTotalTb - item.vramUsedTb) * 100) / 100))),
      ],
    }),
    [history, labels],
  )

  const scatter = (pick: (index: number, base: number) => number[], color: string): EChartsOption => ({
    backgroundColor: 'transparent',
    tooltip: { ...tooltip, trigger: 'item' },
    grid: { left: 36, right: 10, top: 16, bottom: 28 },
    xAxis: tightAxis(labels),
    yAxis: valueAxis('%', 100),
    series: [
      {
        type: 'scatter',
        symbolSize: 9,
        itemStyle: { color, borderColor: '#ffffff', borderWidth: 1, opacity: 0.92 },
        data: history.flatMap((item, index) => pick(index, item.sm).map((value) => [index, Math.round(clamp(value, 0, 100))])),
      },
    ],
  })

  const utilDist = useMemo<EChartsOption>(
    () => scatter((index, base) => [base, base - 18, base * 0.45, 8 + (index % 5) * 6], '#F2495C'),
    [history, labels],
  )

  const tensorDist = useMemo<EChartsOption>(
    () => scatter((index, base) => [base * 0.9, base * 0.35, 4 + (index % 4) * 3], '#FF9830'),
    [history, labels],
  )

  const tempDist = useMemo<EChartsOption>(
    () =>
      scatter(
        (index, base) => [38 + base * 0.18, 42 + base * 0.22, 35 + (index % 6) * 2.2, 50 + Math.sin(index) * 4],
        '#73BF69',
      ),
    [history, labels],
  )

  const codecOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 36, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: valueAxis('%', 100),
      series: [
        line('Mem Copy', '#73BF69', history.map((item) => Math.round(item.dram * 0.42 * 10) / 10)),
        line('Encoder', '#F2CC0C', history.map((item, index) => Math.round(clamp(item.sm * 0.28 + Math.sin(index / 2) * 6, 0, 100) * 10) / 10)),
        line('Decoder', '#5794F2', history.map((item, index) => Math.round(clamp(item.sm * 0.16 + Math.cos(index / 2.4) * 5, 0, 100) * 10) / 10)),
      ],
    }),
    [history, labels],
  )

  const xidOption = useMemo<EChartsOption>(
    () => ({
      backgroundColor: 'transparent',
      tooltip,
      legend,
      grid: { left: 36, right: 10, top: 12, bottom: 42 },
      xAxis: tightAxis(labels),
      yAxis: { ...valueAxis('count'), max: 4 },
      series: [
        line('XID Errors', '#F2495C', history.map(() => 0)),
        line('Retired Pages', '#FF9830', history.map((_, index) => (index % 17 === 0 ? 1 : 0))),
        line('Throttle Events', '#F2CC0C', history.map((item, index) => (item.sm > 92 && index % 5 === 0 ? 1 : 0))),
      ],
    }),
    [history, labels],
  )

  const hostStep = Math.max(1, Math.ceil(servers.length / 6))
  const hosts = servers.filter((_, index) => index % hostStep === 0).slice(0, 6)
  const strip = [
    { label: 'SM Active', value: `${last?.sm.toFixed(1) ?? '—'}%`, color: '#F2CC0C' },
    { label: 'Tensor Active', value: `${last?.tensor.toFixed(1) ?? '—'}%`, color: '#FF9830' },
    { label: 'DRAM Active', value: `${last?.dram.toFixed(1) ?? '—'}%`, color: '#73BF69' },
    { label: 'Power', value: `${last?.powerKw.toFixed(1) ?? '—'} kW`, color: '#FF9830' },
    { label: 'FB Used', value: `${last?.vramUsedTb.toFixed(2) ?? '—'} TB`, color: '#5794F2' },
    { label: last?.fabricName ?? '卡间互联', value: `${last ? Math.round(last.nvlink) : '—'} GB/s`, color: '#B877D9' },
    { label: 'RDMA', value: `${last ? Math.round(last.rdma) : '—'} GB/s`, color: '#8AB8FF' },
    { label: 'XID', value: `${last?.xid ?? 0}`, color: '#F2495C' },
  ]

  return (
    <div className="grid gap-3">
      <GpuResourceOverview servers={servers} stationId={stationId} />

      <CollapsibleSection title="主机健康与机柜趋势" badge="HOST / RACK" defaultOpen>
        <section className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-panel">
          <h3 className="px-2 py-1.5 font-sans text-[12px] font-medium text-text">GPU 算力卡健康状态</h3>
          <div className="overflow-auto">
            <table className="w-full min-w-[1080px] text-left text-[11px]">
              <thead className="text-dim">
                <tr>
                  {['主机名', '主机IP', '驱动版本', '芯片类型', 'GPU卡状态', '显存时钟', 'SM时钟', 'Kernel', '操作系统', 'CPU', '内存'].map((head) => (
                    <th key={head} className="border-b border-border px-2 py-1.5 font-medium">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hosts.map((server, index) => {
                  const fault = server.gpus.some((gpu) => gpu.state === 'fault')
                  const spec = specForModel(server.gpuModel)
                  const util =
                    server.gpus.reduce((sum, gpu) => sum + gpu.utilization, 0) / Math.max(1, server.gpus.length)
                  // 主机 CPU：推理服务常见与 GPU util 相关，约 18–55%
                  const cpu = Math.round(clamp(16 + util * 0.38 + (server.rackCol % 3) * 2.2, 8, 78) * 10) / 10
                  const mem = Math.round(
                    (server.gpus.reduce((sum, gpu) => sum + gpu.memoryUsedGb, 0) /
                      (server.gpus.length * spec.memoryGb)) *
                      100,
                  )
                  const smClock = (spec.smBaseGhz + (spec.smBoostGhz - spec.smBaseGhz) * (util / 100)).toFixed(2)
                  return (
                    <tr key={server.id} className={`border-b border-border ${index % 2 ? 'bg-[#f7f6f2]' : 'bg-white'}`}>
                      <td className="px-2 py-1.5 font-mono text-infer">{displayHostname(server.hostname)}</td>
                      <td className="px-2 py-1.5 font-mono">{server.ip}</td>
                      <td className="px-2 py-1.5 font-mono">{spec.driverLabel}</td>
                      <td className="px-2 py-1.5">{spec.short}</td>
                      <td className={`px-2 py-1.5 text-center text-white ${fault ? 'bg-alert' : 'bg-[#2f9e44]'}`}>
                        {fault ? '异常' : '正常'}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{spec.memClockGhz.toFixed(3)} GHz</td>
                      <td className="px-2 py-1.5 font-mono">{smClock} GHz</td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-dim">5.14.0-362.{index + 1}.el9</td>
                      <td className="px-2 py-1.5 text-muted">Rocky Linux 9.2</td>
                      <td className="px-2 py-1.5"><Meter value={cpu} /></td>
                      <td className="px-2 py-1.5"><Meter value={mem} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        <RackTrendCharts history={history} />
      </CollapsibleSection>

      <CollapsibleSection title="DCGM Engine · Occupancy · Clocks" badge="25820 / ENGINE" defaultOpen={false}>
        <StatStrip items={strip} />
        <div className="grid gap-2 lg:grid-cols-3">
          <ChartBox title="GPU Util vs SM / Tensor / GR-Engine Active" option={utilOption} />
          <ChartBox title="Graphics / Copy / NVDEC / NVENC Engine" option={engineOption} />
          <ChartBox title="SM Occupancy / Pipe Occupancy" option={occOption} />
          <ChartBox title="DRAM Active / Framebuffer Used %" option={dramOption} />
          <ChartBox title="SM / Memory / Application Clocks" option={clockOption} />
          <ChartBox title="Pipe Tensor / FP64 / FP32 / FP16" option={pipeOption} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Precision · Throughput · Fabric" badge="25820 / FABRIC" defaultOpen={false}>
        <div className="grid gap-2 lg:grid-cols-3">
          <ChartBox title="Precision mix (FP32 / FP16 / FP8 / INT / Tensor)" option={precisionOption} height={196} />
          <ChartBox title="Achieved TFLOPS (FP32 / FP16 / FP8)" option={tflopsOption} />
          <ChartBox title="DRAM Bandwidth / 卡间互联 / PCIe" option={bwOption} />
          <ChartBox title="Fabric TX·RX / RDMA TX·RX" option={fabricOption} />
          <ChartBox title="PCIe TX / RX / Replay Overhead" option={pcieOption} />
          <ChartBox title="Framebuffer Used / Total / Free" option={fbOption} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Power · Thermal · Codec · Distribution" badge="25820 / HEALTH" defaultOpen={false}>
        <div className="grid gap-2 lg:grid-cols-3">
          <ChartBox title="Power Draw / Avg Temp / Hotspot" option={powerOption} />
          <ChartBox title="Mem Copy / Encoder / Decoder Util" option={codecOption} />
          <ChartBox title="XID / Retired Pages / Throttle" option={xidOption} />
          <ChartBox title="Utilization distribution" option={utilDist} />
          <ChartBox title="Tensor-Active distribution" option={tensorDist} />
          <ChartBox title="Temperature distribution" option={tempDist} />
        </div>
      </CollapsibleSection>
    </div>
  )
}

function Meter({ value }: { value: number }) {
  const color = value >= 80 ? '#9b3a3a' : value >= 60 ? '#b8860b' : '#2f9e44'
  return (
    <div className="w-[72px]">
      <div className="mb-0.5 font-mono text-[10px] text-text">{value.toFixed(1)}%</div>
      <div className="h-2 rounded-sm bg-[rgba(61,49,79,0.16)]">
        <div className="h-full rounded-sm" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
    </div>
  )
}
