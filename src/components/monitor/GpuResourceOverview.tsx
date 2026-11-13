import { useEffect, useMemo, useRef, useState } from 'react'
import type { EChartsOption } from 'echarts'
import type { ServerNode } from '../../types'
import { clamp, displayHostname } from '../grafana/format'
import { clockLabel, useEChart } from '../grafana/useEChart'
import {
  DEMO_DEPTH,
  DEMO_TICK_MS,
  nextWalk,
  stationDemo,
  walkSeries,
  type SkuSeed,
} from './stationDemo'
import { GPU_SPECS, SKU_KIND_ORDER, resolveSkuKind, type SkuKind } from './gpuSpecs'

const PURPLE = '#7E22CE'
const USED = '#4D7C0F'

interface SkuState extends SkuSeed {
  kind: SkuKind
  requestHist: number[]
  usedHist: number[]
}

interface Gauges {
  temp: number
  power: number
  totalUtil: number
  usedUtil: number
}

function toneColors(kind: SkuKind): Pick<SkuSeed, 'requestColor' | 'fillFrom' | 'fillTo'> {
  const map: Record<SkuKind, Pick<SkuSeed, 'requestColor' | 'fillFrom' | 'fillTo'>> = {
    h100: { requestColor: '#C2410C', fillFrom: 'rgba(194,65,12,0.5)', fillTo: 'rgba(194,65,12,0.08)' },
    a800: { requestColor: '#A16207', fillFrom: 'rgba(161,98,7,0.48)', fillTo: 'rgba(161,98,7,0.08)' },
    a100: { requestColor: '#0369A1', fillFrom: 'rgba(3,105,161,0.48)', fillTo: 'rgba(3,105,161,0.08)' },
    ascend910b: { requestColor: '#BE123C', fillFrom: 'rgba(190,18,60,0.48)', fillTo: 'rgba(190,18,60,0.08)' },
    mlu370: { requestColor: '#0F766E', fillFrom: 'rgba(15,118,110,0.48)', fillTo: 'rgba(15,118,110,0.08)' },
    br104: { requestColor: '#6D28D9', fillFrom: 'rgba(109,40,217,0.48)', fillTo: 'rgba(109,40,217,0.08)' },
  }
  return map[kind]
}

/** 以节点真实卡型盘点 SKU；无节点时回退 profile 模板 */
function inventorySkus(servers: ServerNode[], stationId: string): SkuState[] {
  const profile = stationDemo(stationId)
  if (!servers.length) {
    return profile.skus.map((item, index) => ({
      ...item,
      kind: resolveSkuKind(item.title),
      requestHist: walkSeries(item.request, item.requestMax, item.total, DEMO_DEPTH, index * 5),
      usedHist: walkSeries(item.used, item.usedMax, item.total, DEMO_DEPTH, index * 5 + 2),
    }))
  }

  const buckets = Object.fromEntries(SKU_KIND_ORDER.map((kind) => [kind, { total: 0, request: 0, used: 0 }])) as Record<
    SkuKind,
    { total: number; request: number; used: number }
  >
  for (const server of servers) {
    const kind = resolveSkuKind(server.gpuModel)
    for (const gpu of server.gpus) {
      if (gpu.state === 'fault') continue
      buckets[kind].total += 1
      if (gpu.state !== 'idle') {
        buckets[kind].request += 1
        // “已使用”：真正在跑且有显存占用（申请未跑完 / 冷启动不算 used）
        if (gpu.utilization >= 20 || gpu.memoryUsedGb >= 8) buckets[kind].used += 1
      }
    }
  }

  return SKU_KIND_ORDER.filter((kind) => buckets[kind].total > 0 || profile.skus.some((item) => resolveSkuKind(item.title) === kind)).map(
    (kind, index) => {
      const live = buckets[kind]
      const fallback = profile.skus.find((item) => resolveSkuKind(item.title) === kind)
      const total = live.total || fallback?.total || 0
      const request = Math.min(total, live.total ? live.request : fallback?.request ?? 0)
      const used = Math.min(request, live.total ? live.used : fallback?.used ?? 0)
      return {
        id: kind,
        title: GPU_SPECS[kind].title,
        kind,
        total,
        request,
        used,
        requestMax: Math.max(request, fallback?.requestMax ?? request),
        usedMax: Math.max(used, fallback?.usedMax ?? used),
        ...toneColors(kind),
        requestHist: walkSeries(request, Math.max(request, fallback?.requestMax ?? request), total, DEMO_DEPTH, index * 5),
        usedHist: walkSeries(used, Math.max(used, fallback?.usedMax ?? used), total, DEMO_DEPTH, index * 5 + 2),
      }
    },
  )
}

function gaugesFromServers(servers: ServerNode[], stationId: string): Gauges {
  const profile = stationDemo(stationId)
  const gpus = servers.flatMap((server) => server.gpus).filter((gpu) => gpu.state !== 'fault')
  if (!gpus.length) return { ...profile.gauges }
  const busy = gpus.filter((gpu) => gpu.state !== 'idle')
  const avg = (rows: typeof gpus) => (rows.length ? rows.reduce((sum, gpu) => sum + gpu.utilization, 0) / rows.length : 0)
  const temp = gpus.reduce((sum, gpu) => sum + gpu.temperature, 0) / gpus.length
  const powerKw = servers.reduce((sum, server) => sum + server.powerW, 0) / 1000
  return {
    temp: Math.round(temp * 10) / 10,
    power: Math.round(powerKw * 10) / 10,
    totalUtil: Math.round(avg(gpus) * 10) / 10,
    usedUtil: Math.round(avg(busy.length ? busy : gpus) * 10) / 10,
  }
}

interface FleetDigest {
  fbUsedTb: number
  fbTotalTb: number
  fbOccPct: number
  avgGpuPowerW: number
  tdpUtilPct: number
  idle: number
  infer: number
  multi: number
  gang: number
  fault: number
  hot: number
  requestPct: number
  usedPct: number
  vendors: Array<{ name: string; value: number; color: string }>
}

function fleetDigest(servers: ServerNode[], requested: number, used: number, total: number): FleetDigest {
  const all = servers.flatMap((server) => server.gpus)
  const live = all.filter((gpu) => gpu.state !== 'fault')
  const fbUsedGb = all.reduce((sum, gpu) => sum + gpu.memoryUsedGb, 0)
  const fbTotalGb = all.reduce((sum, gpu) => sum + gpu.memoryTotalGb, 0)
  const gpuPowerW = all.reduce((sum, gpu) => sum + gpu.powerW, 0)
  const tdpCap = servers.reduce((sum, server) => {
    const kind = resolveSkuKind(server.gpuModel)
    return sum + GPU_SPECS[kind].tdpW * server.gpus.length
  }, 0)
  const vendorMap: Record<string, { name: string; color: string; value: number }> = {
    nvidia: { name: 'NVIDIA', color: '#0369A1', value: 0 },
    huawei: { name: '昇腾', color: '#BE123C', value: 0 },
    cambricon: { name: '寒武纪', color: '#0F766E', value: 0 },
    biren: { name: '壁仞', color: '#6D28D9', value: 0 },
  }
  for (const server of servers) {
    const kind = resolveSkuKind(server.gpuModel)
    const vendor = GPU_SPECS[kind].vendor
    vendorMap[vendor].value += server.gpus.filter((gpu) => gpu.state !== 'fault').length
  }
  return {
    fbUsedTb: Math.round((fbUsedGb / 1024) * 100) / 100,
    fbTotalTb: Math.round((fbTotalGb / 1024) * 100) / 100,
    fbOccPct: fbTotalGb ? Math.round((fbUsedGb / fbTotalGb) * 1000) / 10 : 0,
    avgGpuPowerW: live.length ? Math.round(gpuPowerW / live.length) : 0,
    tdpUtilPct: tdpCap ? Math.round((gpuPowerW / tdpCap) * 1000) / 10 : 0,
    idle: all.filter((gpu) => gpu.state === 'idle').length,
    infer: all.filter((gpu) => gpu.state === 'infer').length,
    multi: all.filter((gpu) => gpu.state === 'multi').length,
    gang: all.filter((gpu) => gpu.state === 'gang').length,
    fault: all.filter((gpu) => gpu.state === 'fault').length,
    hot: live.filter((gpu) => gpu.temperature >= 78).length,
    requestPct: total ? Math.round((requested / total) * 1000) / 10 : 0,
    usedPct: total ? Math.round((used / total) * 1000) / 10 : 0,
    vendors: Object.values(vendorMap).filter((item) => item.value > 0),
  }
}

function createTimes() {
  const now = Date.now()
  return Array.from({ length: DEMO_DEPTH }, (_, index) => now - (DEMO_DEPTH - 1 - index) * DEMO_TICK_MS)
}

function useSmooth(target: number) {
  const [value, setValue] = useState(target)
  const valueRef = useRef(target)
  useEffect(() => {
    const from = valueRef.current
    if (Math.abs(from - target) < 0.001) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700)
      const eased = 1 - (1 - t) ** 3
      const next = from + (target - from) * eased
      valueRef.current = next
      setValue(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])
  return value
}

function tone(kind: 'temp' | 'power' | 'util', value: number) {
  if (kind === 'temp') return value < 60 ? '#4D7C0F' : value < 78 ? '#A16207' : '#B91C1C'
  if (kind === 'power') return value < 40 ? '#4D7C0F' : value < 90 ? '#A16207' : '#B91C1C'
  return value < 70 ? '#4D7C0F' : value < 85 ? '#A16207' : '#B91C1C'
}

function fill(from: string, to: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  }
}

export function GpuResourceOverview({ servers, stationId }: { servers: ServerNode[]; stationId: string }) {
  const [open, setOpen] = useState(true)
  const [skus, setSkus] = useState<SkuState[]>(() => inventorySkus(servers, stationId))
  const [times, setTimes] = useState(createTimes)
  const profile = stationDemo(stationId)
  const [gauges, setGauges] = useState<Gauges>(() => gaugesFromServers(servers, stationId))
  const [unusedOffset, setUnusedOffset] = useState(0)
  const gaugeBase = useRef(gaugesFromServers(servers, stationId))
  const serversRef = useRef(servers)
  serversRef.current = servers

  useEffect(() => {
    const liveServers = serversRef.current
    const nextGauges = gaugesFromServers(liveServers, stationId)
    gaugeBase.current = nextGauges
    setSkus(inventorySkus(liveServers, stationId))
    setTimes(createTimes())
    setGauges(nextGauges)
    setUnusedOffset(0)
  }, [stationId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      const live = gaugesFromServers(serversRef.current, stationId)
      setTimes((prev) => [...prev.slice(1), now])
      setSkus((list) => {
        const fresh = inventorySkus(serversRef.current, stationId)
        return list.map((sku) => {
          const hit = fresh.find((item) => item.kind === sku.kind) ?? sku
          // 在真实盘点附近做 ±1 卡抖动，避免阶梯图完全静止
          const request = nextWalk(hit.request, hit.total, hit.total)
          const used = Math.min(request, nextWalk(hit.used, request, request))
          return {
            ...sku,
            ...hit,
            request,
            used,
            requestMax: Math.max(sku.requestMax, hit.requestMax, request),
            usedMax: Math.max(sku.usedMax, hit.usedMax, used),
            requestHist: [...sku.requestHist.slice(1), request],
            usedHist: [...sku.usedHist.slice(1), used],
          }
        })
      })
      const next = {
        temp: clamp(live.temp + (Math.random() - 0.5) * 0.35 + Math.sin(now / 12000) * 0.15, 28, 92),
        power: clamp(live.power + (Math.random() - 0.5) * 0.45 + Math.sin(now / 15000) * 0.2, 4, 160),
        totalUtil: clamp(live.totalUtil + (Math.random() - 0.5) * 0.4 + Math.sin(now / 10000) * 0.25, 2, 98),
        usedUtil: clamp(live.usedUtil + (Math.random() - 0.5) * 0.35 + Math.cos(now / 11000) * 0.2, 8, 99),
      }
      gaugeBase.current = next
      setGauges(next)
      setUnusedOffset((value) => {
        if (Math.random() < 0.8) return value === 0 ? 0 : Math.trunc(value * 0.5)
        return clamp(value + (Math.random() < 0.5 ? -1 : 1), -2, 2)
      })
    }, DEMO_TICK_MS)
    return () => window.clearInterval(timer)
  }, [stationId])

  const total = skus.reduce((sum, sku) => sum + sku.total, 0)
  const requested = skus.reduce((sum, sku) => sum + sku.request, 0)
  const used = skus.reduce((sum, sku) => sum + sku.used, 0)
  const unused = Math.max(0, requested - used + unusedOffset)
  const shownTotal = Math.round(useSmooth(total))
  const shownRequested = Math.round(useSmooth(requested))
  const shownUsed = Math.round(useSmooth(used))
  const shownUnused = Math.round(useSmooth(unused))
  const digest = useMemo(() => fleetDigest(servers, requested, used, total), [servers, requested, used, total])

  return (
    <section className="rounded-[14px] border border-border-bright bg-panel shadow-[0_2px_12px_rgba(33,32,33,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className={`inline-block w-3 font-mono text-[13px] text-infer transition ${open ? '' : '-rotate-90'}`}>v</span>
        <span className="font-sans text-[13px] font-medium text-text">GPU资源监控概览</span>
      </button>
      {open && (
        <div className="grid gap-2 border-t border-border bg-[#f7f6f2] px-2 pb-2 pt-2">
          <div className="grid items-stretch gap-2 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,2.1fr)]">
            <div className="flex min-w-0 flex-col gap-2 rounded-[12px] border border-border-bright bg-[#fbfaf7] p-2">
              <div className="font-sans text-[12px] font-medium text-text">GPU卡使用情况</div>
              <div className="grid grid-cols-2 gap-1.5">
                <StatCard label="总GPU卡" value={shownTotal} from="#3B82F6" to="#1D4ED8" fg="#ffffff" />
                <StatCard label="已申请GPU卡" value={shownRequested} from="#60A5FA" to="#3B82F6" fg="#ffffff" />
                <StatCard label="已使用GPU卡" value={shownUsed} from="#EAB308" to="#CA8A04" fg="#1c1404" />
                <StatCard label="未使用GPU卡" value={shownUnused} from="#F87171" to="#EF4444" fg="#ffffff" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <Gauge label="GPU 平均温度" value={gauges.temp} unit="°C" max={100} color={tone('temp', gauges.temp)} />
                <Gauge label="机柜总功率" value={gauges.power} unit=" kW" max={Math.max(80, Math.ceil(gauges.power / 10) * 10 + 20)} color={tone('power', gauges.power)} />
                <Gauge label="总GPU利用率" value={gauges.totalUtil} unit="%" max={100} color={tone('util', gauges.totalUtil)} />
                <Gauge label="已使用GPU利用率" value={gauges.usedUtil} unit="%" max={100} color={tone('util', gauges.usedUtil)} />
              </div>
              <FleetExtras digest={digest} />
            </div>
            <div className="grid grid-cols-2 content-start gap-2 lg:grid-cols-3">
              {skus.map((sku) => (
                <SkuPanel
                  key={`${stationId}-${sku.id}`}
                  sku={sku}
                  times={times}
                  server={servers.find((item) => resolveSkuKind(item.gpuModel) === sku.kind) ?? servers[0]}
                  tempBias={profile.tempBias}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function FleetExtras({ digest }: { digest: FleetDigest }) {
  const vendorOption = useMemo<EChartsOption>(
    () => ({
      animationDurationUpdate: 0,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#ffffff',
        borderColor: 'rgba(61,49,79,0.18)',
        textStyle: { color: '#212021', fontSize: 11 },
        formatter: '{b}: {c} 卡 ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '72%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
          label: { color: 'rgba(33,32,33,0.78)', fontSize: 10, formatter: '{b}\n{d}%' },
          labelLine: { length: 6, length2: 4 },
          data: digest.vendors.map((item) => ({ name: item.name, value: item.value, itemStyle: { color: item.color } })),
        },
      ],
    }),
    [digest.vendors],
  )
  const vendorRef = useEChart(vendorOption)
  const stateRows = [
    { label: '空闲', value: digest.idle, color: '#94A3B8' },
    { label: '单卡推理', value: digest.infer, color: '#2563EB' },
    { label: '单机多卡', value: digest.multi, color: '#C2410C' },
    { label: '跨机 Gang', value: digest.gang, color: '#7E22CE' },
    { label: '故障', value: digest.fault, color: '#DC2626' },
  ]
  const stateTotal = Math.max(1, stateRows.reduce((sum, row) => sum + row.value, 0))
  const ratios = [
    { label: '申请率', value: digest.requestPct, hint: '已申请 / 总卡', color: '#3B82F6' },
    { label: '实跑率', value: digest.usedPct, hint: '已使用 / 总卡', color: '#CA8A04' },
    { label: '显存占用', value: digest.fbOccPct, hint: `${digest.fbUsedTb} / ${digest.fbTotalTb} TB`, color: '#0369A1' },
    { label: 'TDP 利用率', value: digest.tdpUtilPct, hint: `均功耗 ${digest.avgGpuPowerW} W`, color: '#C2410C' },
  ]

  return (
    <div className="mt-1 flex min-h-0 flex-1 flex-col gap-2 border-t border-border pt-2">
      <div className="grid grid-cols-2 gap-1.5">
        <MiniStat label="显存占用" value={`${digest.fbUsedTb}`} unit={`/ ${digest.fbTotalTb} TB`} />
        <MiniStat label="单卡均功耗" value={`${digest.avgGpuPowerW}`} unit="W" />
        <MiniStat label="高温卡 ≥78°C" value={`${digest.hot}`} unit="张" alert={digest.hot > 0} />
        <MiniStat label="故障卡" value={`${digest.fault}`} unit="张" alert={digest.fault > 0} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-[10px] border border-border bg-white px-2 py-1.5">
          <div className="mb-1 text-[11px] font-medium text-text">厂商构成</div>
          <div ref={vendorRef} className="h-[132px]" />
        </div>
        <div className="rounded-[10px] border border-border bg-white px-2 py-1.5">
          <div className="mb-1.5 text-[11px] font-medium text-text">GPU 状态分布</div>
          <div className="mb-2 flex h-2.5 overflow-hidden rounded-sm bg-[rgba(61,49,79,0.1)]">
            {stateRows.map((row) =>
              row.value ? (
                <div key={row.label} style={{ width: `${(row.value / stateTotal) * 100}%`, background: row.color }} title={`${row.label} ${row.value}`} />
              ) : null,
            )}
          </div>
          <div className="grid gap-1">
            {stateRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: row.color }} />
                  {row.label}
                </span>
                <span className="font-mono text-text">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-1.5 rounded-[10px] border border-border bg-white px-2 py-1.5">
        <div className="text-[11px] font-medium text-text">资源效率</div>
        {ratios.map((row) => (
          <div key={row.label}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-muted">{row.label}</span>
              <span className="font-mono text-text">
                {row.value.toFixed(1)}%
                <span className="ml-1 text-[10px] text-dim">{row.hint}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-sm bg-[rgba(61,49,79,0.12)]">
              <div className="h-full rounded-sm" style={{ width: `${Math.min(100, row.value)}%`, background: row.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniStat({ label, value, unit, alert }: { label: string; value: string; unit: string; alert?: boolean }) {
  return (
    <div className="rounded-[10px] border border-border bg-white px-2 py-1.5">
      <div className="text-[10px] text-dim">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`font-mono text-[18px] leading-none ${alert ? 'text-alert' : 'text-text'}`}>{value}</span>
        <span className="text-[10px] text-muted">{unit}</span>
      </div>
    </div>
  )
}

function StatCard({ label, value, from, to, fg }: { label: string; value: number; from: string; to: string; fg: string }) {
  return (
    <div className="flex min-h-[76px] flex-col justify-between px-2 py-2" style={{ background: `linear-gradient(165deg, ${from}, ${to})`, color: fg }}>
      <div className="text-[11px] leading-tight">{label}</div>
      <div className="font-mono text-[32px] leading-none tabular-nums">{value}</div>
    </div>
  )
}

function Gauge({ label, value, unit, max, color }: { label: string; value: number; unit: string; max: number; color: string }) {
  const option = useMemo<EChartsOption>(
    () => ({
      animationDurationUpdate: 700,
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max,
          radius: '128%',
          center: ['50%', '78%'],
          pointer: { show: true, length: '58%', width: 3, itemStyle: { color } },
          anchor: { show: true, showAbove: true, size: 6, itemStyle: { color } },
          progress: { show: false },
          axisLine: {
            lineStyle: {
              width: 10,
              color: [
                [0.6, '#65A30D'],
                [0.8, '#CA8A04'],
                [1, '#DC2626'],
              ],
            },
          },
          axisTick: { show: true, distance: -10, length: 4, lineStyle: { color: '#ffffff', width: 1.5 } },
          splitLine: { show: true, distance: -10, length: 9, lineStyle: { color: '#212021', width: 1.2 } },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, '0%'],
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'DM Mono, ui-monospace, monospace',
            color,
            formatter: (current: number) => `${current.toFixed(1)}${unit}`,
          },
          data: [{ value }],
        },
      ],
    }),
    [color, max, unit, value],
  )
  const ref = useEChart(option)
  return (
    <div className="min-w-0 rounded-[10px] border border-border bg-white px-1 pb-1">
      <div ref={ref} className="h-[86px]" />
      <div className="truncate text-center text-[11px] font-medium text-text">{label}</div>
    </div>
  )
}

interface NodeSample {
  t: number
  temp: number
  mem: number
  cpu: number
}

function sampleNode(server: ServerNode, t: number, tempBias = 0): NodeSample {
  const gpus = server.gpus
  const temp = gpus.length ? gpus.reduce((sum, gpu) => sum + gpu.temperature, 0) / gpus.length : server.temperature
  const mem = gpus.length ? (gpus.reduce((sum, gpu) => sum + gpu.memoryUsedGb, 0) / (gpus.length * 80)) * 100 : 0
  const util = gpus.length ? gpus.reduce((sum, gpu) => sum + gpu.utilization, 0) / gpus.length : 0
  const wave = Math.sin(t / 4500 + server.rackCol * 0.7) * 2.4 + Math.sin(t / 11000) * 1.2
  return {
    t,
    temp: Math.round(clamp(temp + tempBias + wave * 0.55, 18, 95) * 10) / 10,
    mem: Math.round(clamp(mem * (0.7 + Math.abs(tempBias) / 40) + wave * 1.4, 0, 100) * 10) / 10,
    cpu: Math.round(clamp(14 + (server.temperature % 9) * 3.4 + util * 0.32 + tempBias * 0.6 + wave * 2.1, 3, 96) * 10) / 10,
  }
}

function useNodeHistory(server: ServerNode | undefined, tempBias: number) {
  const serverId = server?.id ?? ''
  const ref = useRef(server)
  ref.current = server
  const biasRef = useRef(tempBias)
  biasRef.current = tempBias
  const [rows, setRows] = useState<NodeSample[]>(() => {
    if (!server) return []
    const now = Date.now()
    return Array.from({ length: DEMO_DEPTH }, (_, index) =>
      sampleNode(server, now - (DEMO_DEPTH - 1 - index) * DEMO_TICK_MS, tempBias),
    )
  })
  useEffect(() => {
    const current = ref.current
    if (!current) return
    const now = Date.now()
    setRows(
      Array.from({ length: DEMO_DEPTH }, (_, index) =>
        sampleNode(current, now - (DEMO_DEPTH - 1 - index) * DEMO_TICK_MS, biasRef.current),
      ),
    )
    const timer = window.setInterval(() => {
      const live = ref.current
      if (!live) return
      setRows((prev) => [
        ...(prev.length >= DEMO_DEPTH ? prev.slice(1) : prev),
        sampleNode(live, Date.now(), biasRef.current),
      ])
    }, DEMO_TICK_MS)
    return () => window.clearInterval(timer)
  }, [serverId, tempBias])
  return rows
}

function NodeMetrics({ server, tempBias }: { server: ServerNode | undefined; tempBias: number }) {
  const rows = useNodeHistory(server, tempBias)
  const option = useMemo<EChartsOption>(() => {
    const labels = rows.map((row) => clockLabel(row.t))
    const span = (data: number[], pad: number, floor: number, ceil: number) => {
      if (!data.length) return { min: floor, max: ceil }
      const lo = Math.max(floor, Math.floor(Math.min(...data) - pad))
      const hi = Math.min(ceil, Math.ceil(Math.max(...data) + pad))
      return { min: lo, max: hi <= lo ? lo + pad * 2 : hi }
    }
    const temp = rows.map((row) => row.temp)
    const mem = rows.map((row) => row.mem)
    const cpu = rows.map((row) => row.cpu)
    const latest = rows[rows.length - 1]
    const bands = [
      { name: 'GPU温度', value: latest ? `${latest.temp.toFixed(1)}°C` : '', color: '#C2410C', fillFrom: 'rgba(194,65,12,0.42)', data: temp, ...span(temp, 2, 20, 95) },
      { name: '内存', value: latest ? `${latest.mem.toFixed(0)}%` : '', color: '#0369A1', fillFrom: 'rgba(3,105,161,0.38)', data: mem, ...span(mem, 4, 0, 100) },
      { name: 'CPU', value: latest ? `${latest.cpu.toFixed(0)}%` : '', color: '#4D7C0F', fillFrom: 'rgba(77,124,15,0.38)', data: cpu, ...span(cpu, 4, 0, 100) },
    ]
    return {
      animationDurationUpdate: 500,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: 'rgba(61,49,79,0.18)',
        textStyle: { color: '#212021', fontSize: 11 },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      title: bands.flatMap((band, index) => [
        {
          text: band.name,
          left: 2,
          top: `${index * 33 + 1}%`,
          textStyle: { color: band.color, fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' },
        },
        {
          text: band.value,
          right: 2,
          top: `${index * 33 + 1}%`,
          textStyle: { color: '#212021', fontSize: 10, fontWeight: 600, fontFamily: 'DM Mono, ui-monospace, monospace' },
        },
      ]),
      grid: bands.map((_, index) => ({
        left: 4,
        right: 4,
        top: `${index * 33 + 12}%`,
        height: '18%',
      })),
      xAxis: bands.map((_, index) => ({
        type: 'category' as const,
        gridIndex: index,
        data: labels,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: index === bands.length - 1, color: 'rgba(33,32,33,0.65)', fontSize: 8, interval: 6, hideOverlap: true },
        splitLine: { show: false },
      })),
      yAxis: bands.map((band, index) => ({
        type: 'value' as const,
        gridIndex: index,
        min: band.min,
        max: band.max,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: index < 2, lineStyle: { color: 'rgba(61,49,79,0.1)' } },
      })),
      series: bands.map((band, index) => ({
        name: band.name,
        type: 'line' as const,
        xAxisIndex: index,
        yAxisIndex: index,
        showSymbol: false,
        smooth: 0.25,
        data: band.data,
        lineStyle: { width: 2, color: band.color },
        itemStyle: { color: band.color },
        areaStyle: { color: fill(band.fillFrom, 'rgba(248,248,248,0.04)') },
      })),
    }
  }, [rows])
  const ref = useEChart(option)
  return (
    <div className="flex min-h-[124px] flex-1 flex-col border-t border-border bg-white">
      <div className="flex items-center justify-between gap-2 px-2 pt-1">
        <span className="truncate font-mono text-[10px] font-medium text-infer">{server ? displayHostname(server.hostname) : '暂无节点'}</span>
        <span className="shrink-0 text-[10px] font-medium text-muted">单节点</span>
      </div>
      <div ref={ref} className="min-h-0 w-full flex-1" />
    </div>
  )
}

function SkuPanel({
  sku,
  times,
  server,
  tempBias,
}: {
  sku: SkuState
  times: number[]
  server?: ServerNode
  tempBias: number
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      animationDurationUpdate: 650,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: 'rgba(61,49,79,0.18)',
        textStyle: { color: '#212021', fontSize: 11 },
      },
      grid: { left: 32, right: 10, top: 12, bottom: 22 },
      xAxis: {
        type: 'category',
        data: times.map((time) => clockLabel(time)),
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(61,49,79,0.28)' } },
        axisTick: { show: false },
        axisLabel: { color: 'rgba(33,32,33,0.72)', fontSize: 9, interval: 4, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: sku.total + 2,
        axisLabel: { color: 'rgba(33,32,33,0.72)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(61,49,79,0.14)' } },
      },
      series: [
        {
          name: 'used',
          type: 'line',
          step: 'end',
          showSymbol: false,
          data: sku.usedHist,
          lineStyle: { width: 2.2, color: USED },
          itemStyle: { color: USED },
          areaStyle: { color: fill('rgba(77,124,15,0.55)', 'rgba(77,124,15,0.08)') },
        },
        {
          name: 'request',
          type: 'line',
          step: 'end',
          showSymbol: false,
          data: sku.requestHist,
          lineStyle: { width: 2.4, color: sku.requestColor },
          itemStyle: { color: sku.requestColor },
          areaStyle: { color: fill(sku.fillFrom, sku.fillTo) },
        },
        {
          name: 'total',
          type: 'line',
          step: 'end',
          showSymbol: false,
          data: sku.requestHist.map(() => sku.total),
          lineStyle: { width: 2.4, type: 'dashed', color: PURPLE },
          itemStyle: { color: PURPLE },
        },
      ],
    }),
    [sku, times],
  )
  const ref = useEChart(option)
  const rows = [
    { name: 'total', color: PURPLE, last: sku.total, max: sku.total },
    { name: 'request', color: sku.requestColor, last: sku.request, max: sku.requestMax },
    { name: 'used', color: USED, last: sku.used, max: sku.usedMax },
  ]
  return (
    <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-[12px] border border-border-bright bg-[#fbfaf7]">
      <h3 className="border-b border-border bg-[#fbfaf7] px-2 pt-1.5 pb-1 font-sans text-[12px] font-medium leading-snug text-text">{sku.title}</h3>
      <div ref={ref} className="h-[168px] bg-white" />
      <table className="w-full border-t border-border bg-white text-left text-[11px]">
        <thead className="text-muted">
          <tr>
            <th className="px-2 py-1 font-medium">Name</th>
            <th className="px-2 py-1 text-right font-medium">Last</th>
            <th className="px-2 py-1 text-right font-medium">Max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-border">
              <td className="px-2 py-1">
                <span className="mr-1.5 inline-block h-[4px] w-3.5 align-middle" style={{ background: row.color }} />
                <span className="font-medium" style={{ color: row.color }}>{row.name}</span>
              </td>
              <td className="px-2 py-1 text-right font-mono font-medium text-text">{row.last}</td>
              <td className="px-2 py-1 text-right font-mono font-medium text-text">{row.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <NodeMetrics server={server} tempBias={tempBias} />
    </section>
  )
}
