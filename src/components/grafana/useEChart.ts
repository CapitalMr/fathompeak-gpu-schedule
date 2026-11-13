import { useEffect, useRef, useState } from 'react'
import { init, type ECharts, type EChartsOption } from 'echarts'

const disposeQueue: ECharts[] = []
let disposeScheduled = false

function enqueueDispose(inst: ECharts) {
  disposeQueue.push(inst)
  if (disposeScheduled) return
  disposeScheduled = true
  const flush = () => {
    const batch = disposeQueue.splice(0, 4)
    for (const chart of batch) {
      try {
        chart.dispose()
      } catch {
        /* ignore */
      }
    }
    if (disposeQueue.length) {
      window.setTimeout(flush, 0)
    } else {
      disposeScheduled = false
    }
  }
  window.setTimeout(flush, 0)
}

export function useEChart(option: EChartsOption, enabled = true) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<ECharts | null>(null)
  const [visible, setVisible] = useState(false)
  const active = enabled && visible

  useEffect(() => {
    const el = host.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true)
      },
      { root: null, rootMargin: '120px 0px', threshold: 0.01 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = host.current
    if (!el || !active) return
    const inst = init(el, undefined, { renderer: 'canvas' })
    chart.current = inst
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => inst.resize())
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.current = null
      enqueueDispose(inst)
    }
  }, [active])

  useEffect(() => {
    const inst = chart.current
    if (!inst || !active) return
    const frame = window.requestAnimationFrame(() => {
      inst.setOption(option, { notMerge: false, lazyUpdate: true, silent: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [option, active])

  return host
}

export const CHART_TOOLTIP = {
  trigger: 'axis' as const,
  backgroundColor: '#ffffff',
  borderColor: 'rgba(61,49,79,0.18)',
  textStyle: { color: '#212021', fontSize: 11 },
  axisPointer: { lineStyle: { color: 'rgba(47,99,184,0.35)' } },
}

export function categoryAxis(labels: string[]) {
  return {
    type: 'category' as const,
    data: labels,
    boundaryGap: false,
    axisLine: { lineStyle: { color: 'rgba(61,49,79,0.28)' } },
    axisTick: { show: false },
    axisLabel: {
      color: 'rgba(33,32,33,0.82)',
      fontSize: 11,
      fontFamily: 'DM Mono, ui-monospace',
      interval: 4,
    },
  }
}

export function valueAxis(name?: string, max?: number) {
  return {
    type: 'value' as const,
    name,
    max,
    min: 0,
    nameTextStyle: { color: 'rgba(33,32,33,0.82)', fontSize: 11, fontFamily: 'DM Mono, ui-monospace' },
    axisLine: { show: false },
    axisLabel: { color: 'rgba(33,32,33,0.82)', fontSize: 11, fontFamily: 'DM Mono, ui-monospace' },
    splitLine: { lineStyle: { color: 'rgba(61,49,79,0.2)', type: 'dashed' as const } },
  }
}

export function areaFill(color: string) {
  return {
    color: {
      type: 'linear' as const,
      x: 0,
      y: 0,
      x2: 0,
      y2: 1,
      colorStops: [
        { offset: 0, color },
        { offset: 1, color: 'rgba(11,15,25,0.02)' },
      ],
    },
  }
}

export function clockLabel(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
}
