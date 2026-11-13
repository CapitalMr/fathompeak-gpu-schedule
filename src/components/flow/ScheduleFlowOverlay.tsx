import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { NodePool, PowerStation, ServerNode, Workload } from '../../types'
import {
  SCENE_COLOR,
  SCENE_TITLE,
  buildChassis,
  flowScene,
  strategyTag,
  type ChassisModel,
} from '../grafana/format'
import { CrossCenterFlyPanel } from './CrossCenterFlyPanel'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Tip {
  serverId: string
  index: number
  x: number
  y: number
  pinned: boolean
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.max(36, Math.abs(x2 - x1) * 0.42)
  const dir = x2 >= x1 ? 1 : -1
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx * dir).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx * dir).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

function overCurve(x1: number, y1: number, x2: number, y2: number, roof: number) {
  const apex = roof - 30
  const bend = x1 + (x2 - x1) * 0.42
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${bend.toFixed(1)} ${apex.toFixed(1)}, ${x2.toFixed(1)} ${apex.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

function FlowPath({
  d,
  color,
  width = 2.2,
  reverse = false,
}: {
  d: string
  color: string
  width?: number
  reverse?: boolean
}) {
  const flow = reverse ? 'fp-flow-rev' : 'fp-flow'
  const bead = reverse ? 'fp-bead-rev' : 'fp-bead'
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={width + 5} opacity={0.12} />
      <path d={d} fill="none" stroke={color} strokeWidth={width} opacity={0.9} />
      <path d={d} fill="none" stroke={color} strokeWidth={width} className={flow} />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.4} className={bead} />
    </g>
  )
}

function NodeCard({
  box,
  title,
  subtitle,
  accent,
  badge,
  lines,
}: {
  box: Box
  title: string
  subtitle: string
  accent: string
  badge?: string
  lines: Array<{ k: string; v: string }>
}) {
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={14}
        fill="#ffffff"
        stroke={accent}
        strokeWidth={1.6}
        className="gpu-breathe"
        style={{ filter: `drop-shadow(0 6px 16px rgba(33,32,33,0.08))` }}
      />
      <rect x={box.x + 14} y={box.y} width={box.w - 28} height={3} fill={accent} />
      <circle cx={box.x + 18} cy={box.y + 22} r={3.2} fill={accent} />
      <text x={box.x + 28} y={box.y + 26} fill="#212021" fontSize={13}>
        {title}
      </text>
      <text x={box.x + 16} y={box.y + 46} fill="rgba(33,32,33,0.55)" fontSize={10} fontFamily="DM Mono, ui-monospace">
        {subtitle}
      </text>
      {badge && (
        <g>
          <rect
            x={box.x + 14}
            y={box.y + 58}
            width={box.w - 28}
            height={22}
            rx={11}
            fill="rgba(47,99,184,0.08)"
            stroke={accent}
            strokeOpacity={0.85}
          />
          <text x={box.x + box.w / 2} y={box.y + 73} textAnchor="middle" fill={accent} fontSize={11}>
            {badge}
          </text>
        </g>
      )}
      {lines.map((line, index) => (
        <g key={line.k}>
          <text x={box.x + 16} y={box.y + (badge ? 102 : 78) + index * 28} fill="rgba(33,32,33,0.55)" fontSize={11}>
            {line.k}
          </text>
          <text
            x={box.x + box.w - 16}
            y={box.y + (badge ? 102 : 78) + index * 28}
            textAnchor="end"
            fill="#212021"
            fontSize={14}
            fontFamily="DM Mono, ui-monospace"
          >
            {line.v}
          </text>
        </g>
      ))}
    </g>
  )
}

function ChassisSvg({
  panel,
  model,
  accent,
  compact,
  nvlink,
  showBus,
  onEnter,
  onLeave,
  onPick,
}: {
  panel: Box
  model: ChassisModel
  accent: string
  compact: boolean
  nvlink: number
  showBus: boolean
  onEnter: (index: number, event: MouseEvent<SVGGElement>) => void
  onLeave: () => void
  onPick: (index: number, event: MouseEvent<SVGGElement>) => void
}) {
  const header = compact ? 40 : 64
  const slotH = compact ? 82 : 172
  const gap = compact ? 6 : 8
  const padX = compact ? 12 : 16
  const inner = panel.w - padX * 2
  const slotW = (inner - gap * 7) / 8
  const busY = panel.y + panel.h - (compact ? 24 : 34)
  const slots = model.slots.map((slot) => {
    const x = panel.x + padX + slot.index * (slotW + gap)
    return { ...slot, x, y: panel.y + header, w: slotW, h: slotH, cx: x + slotW / 2 }
  })
  const activeSlots = slots.filter((slot) => slot.active)
  const busX1 = activeSlots[0]?.cx ?? panel.x + padX
  const busX2 = activeSlots[activeSlots.length - 1]?.cx ?? panel.x + panel.w - padX
  const shell = showBus ? accent : 'rgba(61,49,79,0.28)'

  return (
    <g>
      <path
        d={`M ${panel.x + 18} ${panel.y} L ${panel.x + panel.w - 8} ${panel.y - 16} L ${panel.x + panel.w + 14} ${panel.y - 2} L ${panel.x + panel.w} ${panel.y + 16} Z`}
        fill="#f3f1ea"
        stroke={shell}
        strokeOpacity={0.85}
      />
      <path
        d={`M ${panel.x + panel.w} ${panel.y + 16} L ${panel.x + panel.w + 14} ${panel.y - 2} L ${panel.x + panel.w + 14} ${panel.y + panel.h - 18} L ${panel.x + panel.w} ${panel.y + panel.h} Z`}
        fill="#ebe7de"
        stroke="rgba(61,49,79,0.22)"
      />
      <rect
        x={panel.x}
        y={panel.y}
        width={panel.w}
        height={panel.h}
        rx={10}
        fill="#ffffff"
        stroke={shell}
        strokeWidth={1.4}
        style={{ filter: 'drop-shadow(0 8px 18px rgba(33,32,33,0.06))' }}
      />
      <circle cx={panel.x + 14} cy={panel.y + 16} r={2.2} fill="rgba(61,49,79,0.35)" />
      <circle cx={panel.x + panel.w - 14} cy={panel.y + 16} r={2.2} fill="rgba(61,49,79,0.35)" />
      <text x={panel.x + 24} y={panel.y + 20} fill="#212021" fontSize={compact ? 11 : 13}>
        {model.displayHost}
      </text>
      <text
        x={panel.x + panel.w - 14}
        y={panel.y + 20}
        textAnchor="end"
        fill={showBus ? accent : 'rgba(33,32,33,0.45)'}
        fontSize={10}
        fontFamily="DM Mono, ui-monospace"
      >
        {showBus ? `${model.fabricLabel} ${nvlink} GB/s` : 'STANDBY'}
      </text>
      {!compact && (
        <text x={panel.x + 24} y={panel.y + 40} fill="rgba(33,32,33,0.55)" fontSize={10} fontFamily="DM Mono, ui-monospace">
          {model.boardLabel}
        </text>
      )}

      {slots.map((slot) => (
        <g
          key={slot.index}
          style={{ cursor: 'pointer' }}
          onMouseEnter={(event) => onEnter(slot.index, event)}
          onMouseLeave={onLeave}
          onClick={(event) => onPick(slot.index, event)}
        >
          <rect
            x={slot.x}
            y={slot.y}
            width={slot.w}
            height={slot.h}
            rx={6}
            fill={slot.active ? 'rgba(47,99,184,0.08)' : '#f7f6f2'}
            stroke={slot.active ? accent : 'rgba(61,49,79,0.2)'}
            strokeWidth={slot.active ? 1.7 : 1}
            className={slot.active ? 'gpu-breathe' : undefined}
            style={slot.active ? { filter: `drop-shadow(0 0 8px ${accent}33)` } : undefined}
          />
          <text
            x={slot.x + slot.w / 2}
            y={slot.y + (compact ? 16 : 24)}
            textAnchor="middle"
            fill={slot.active ? '#212021' : 'rgba(33,32,33,0.45)'}
            fontSize={compact ? 9 : 11}
            fontFamily="DM Mono, ui-monospace"
          >
            GPU {slot.index}
          </text>
          <text
            x={slot.x + slot.w / 2}
            y={slot.y + slot.h - (compact ? 22 : 30)}
            textAnchor="middle"
            fill={slot.active ? accent : 'rgba(33,32,33,0.4)'}
            fontSize={compact ? 9 : 12}
            fontFamily="DM Mono, ui-monospace"
          >
            {slot.temp.toFixed(0)}°C
          </text>
          <rect
            x={slot.x + 6}
            y={slot.y + slot.h - (compact ? 12 : 16)}
            width={Math.max(8, slot.w - 12)}
            height={4}
            rx={2}
            fill="rgba(61,49,79,0.12)"
          />
          <rect
            x={slot.x + 6}
            y={slot.y + slot.h - (compact ? 12 : 16)}
            width={Math.max(2, (slot.w - 12) * (slot.mem / 80))}
            height={4}
            rx={2}
            fill={slot.active ? accent : 'rgba(61,49,79,0.35)'}
          />
        </g>
      ))}

      <rect
        x={panel.x + padX}
        y={busY}
        width={panel.w - padX * 2}
        height={8}
        rx={4}
        fill="#f3f1ea"
        stroke={showBus ? accent : 'rgba(61,49,79,0.28)'}
        strokeOpacity={0.9}
      />
      {showBus && activeSlots.length > 1 && (
        <g>
          <FlowPath d={`M ${busX1} ${busY + 4} H ${busX2}`} color={accent} width={2.4} />
          <FlowPath d={`M ${busX1} ${busY + 4} H ${busX2}`} color={accent} width={2.4} reverse />
          {activeSlots.map((slot) => {
            const d = `M ${slot.cx} ${slot.y + slot.h} V ${busY + 4}`
            return (
              <g key={`bus-${slot.index}`}>
                <FlowPath d={d} color={accent} width={1.6} />
                <FlowPath d={d} color={accent} width={1.6} reverse />
              </g>
            )
          })}
        </g>
      )}
      <text x={panel.x + padX} y={panel.y + panel.h - 6} fill="rgba(33,32,33,0.55)" fontSize={compact ? 8 : 10}>
        NVLink High-Speed Bus
      </text>
    </g>
  )
}

export function ScheduleFlowOverlay({
  workload,
  servers,
  pools = [],
  stations = [],
  onClose,
  embedded = false,
}: {
  workload: Workload
  servers: ServerNode[]
  pools?: NodePool[]
  stations?: PowerStation[]
  onClose: () => void
  embedded?: boolean
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [tick, setTick] = useState(0)
  const [tip, setTip] = useState<Tip | null>(null)
  const scene = flowScene(workload)
  const accent = SCENE_COLOR[scene]
  const chassis = buildChassis(workload, servers, tick)
  const tag = strategyTag(workload)
  const qps = Math.max(8, Math.round((scene === 'A' ? 248 : scene === 'B' ? 112 : 46) + Math.sin(tick * 0.9) * 14))
  const ttft = workload.latencyMs > 0 ? Math.max(12, Math.round(workload.latencyMs + Math.sin(tick * 1.1) * 3)) : 0
  const rdma = Math.round(628 + Math.sin(tick * 0.7) * 34)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 2000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const place = (serverId: string, index: number, event: MouseEvent<SVGGElement>, pinned: boolean) => {
    const host = gridRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    let x = event.clientX - rect.left + host.scrollLeft + 16
    let y = event.clientY - rect.top + host.scrollTop + 14
    if (x > host.scrollLeft + host.clientWidth - 240) x = Math.max(8, x - 250)
    if (y > host.scrollTop + host.clientHeight - 180) y = Math.max(8, y - 196)
    setTip((current) => {
      if (pinned && current?.pinned && current.serverId === serverId && current.index === index) return null
      if (!pinned && current?.pinned) return current
      return { serverId, index, x, y, pinned }
    })
  }

  const panels =
    scene === 'C'
      ? chassis.map((_, index) => ({
          x: 780,
          y: 36 + index * 196,
          w: 460,
          h: 176,
        }))
      : [{ x: 640, y: 86, w: 530, h: 340 }]

  const stackBottom = panels[panels.length - 1].y + panels[panels.length - 1].h
  const midY = scene === 'C' ? (panels[0].y + stackBottom) / 2 : panels[0].y + panels[0].h / 2
  const gateway: Box = scene === 'C' ? { x: 20, y: midY - 78, w: 200, h: 156 } : { x: 28, y: midY - 82, w: 214, h: 164 }
  const scheduler: Box = scene === 'C' ? { x: 252, y: midY - 78, w: 214, h: 156 } : { x: 312, y: midY - 82, w: 230, h: 164 }
  const fabric: Box = { x: 504, y: midY - 82, w: 188, h: 164 }
  const viewW = scene === 'C' ? 1480 : 1200
  const viewH = Math.max(460, stackBottom + 36)

  const gatewayOut = { x: gateway.x + gateway.w, y: gateway.y + gateway.h / 2 }
  const schedulerIn = { x: scheduler.x, y: scheduler.y + scheduler.h / 2 }
  const schedulerOut = { x: scheduler.x + scheduler.w, y: scheduler.y + scheduler.h / 2 }
  const fork = { x: panels[0].x - 40, y: panels[0].y - 30 }

  const slotAnchor = (panel: Box, index: number, compact: boolean) => {
    const header = compact ? 40 : 64
    const gap = compact ? 6 : 8
    const padX = compact ? 12 : 16
    const slotW = (panel.w - padX * 2 - gap * 7) / 8
    const x = panel.x + padX + index * (slotW + gap) + slotW / 2
    const y = panel.y + header
    return { x, y }
  }

  const flows: string[] = [curve(gatewayOut.x, gatewayOut.y, schedulerIn.x, schedulerIn.y)]
  if (scene === 'C') {
    const switchIn = { x: fabric.x, y: fabric.y + fabric.h / 2 }
    const switchOut = { x: fabric.x + fabric.w, y: fabric.y + fabric.h / 2 }
    flows.push(curve(schedulerOut.x, schedulerOut.y, switchIn.x, switchIn.y))
    panels.forEach((panel) => {
      flows.push(curve(switchOut.x, switchOut.y, panel.x, panel.y + panel.h / 2))
    })
  } else if (scene === 'B') {
    flows.push(overCurve(schedulerOut.x, schedulerOut.y, fork.x, fork.y, panels[0].y))
    chassis[0]?.active.forEach((index) => {
      const point = slotAnchor(panels[0], index, false)
      flows.push(overCurve(fork.x, fork.y, point.x, point.y, panels[0].y))
    })
  } else {
    const index = chassis[0]?.active[0] ?? 2
    const point = slotAnchor(panels[0], index, false)
    flows.push(overCurve(schedulerOut.x, schedulerOut.y, point.x, point.y, panels[0].y))
  }

  const trunkX = 1396
  const tipSlot = tip
    ? chassis
        .flatMap((item) => item.slots.map((slot) => ({ ...slot, serverId: item.id, host: item.displayHost })))
        .find((slot) => slot.serverId === tip.serverId && slot.index === tip.index)
    : null

  return (
    <div
      className={
        embedded
          ? 'flex h-[620px] min-h-0 w-full flex-col overflow-hidden rounded-[14px] border border-border-bright bg-panel shadow-[0_2px_12px_rgba(33,32,33,0.06)]'
          : 'fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(33,32,33,0.28)] p-3 backdrop-blur-[2px]'
      }
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={
          embedded
            ? 'flex h-full min-h-0 w-full flex-col overflow-hidden'
            : 'flex max-h-[94vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl border border-border-bright bg-panel shadow-[0_24px_60px_rgba(33,32,33,0.18)]'
        }
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal={embedded ? undefined : true}
        aria-label="调度拓扑图"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-[0.14em] text-dim">跨中心调度拓扑</div>
            <div className="mt-1 truncate text-base text-text">{workload.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-muted">{workload.model}</span>
              <span className="rounded-full border px-2 py-0.5" style={{ borderColor: accent, color: accent }}>
                {SCENE_TITLE[scene]}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-muted">{tag}</span>
              <span className="rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2 py-0.5 text-infer">
                跨区域协同
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1.5 text-[12px] text-muted hover:bg-void hover:text-text"
          >
            {embedded ? '收起' : '关闭'}
          </button>
        </header>

        {(pools.length > 0 || stations.length > 0) && (
          <CrossCenterFlyPanel workload={workload} pools={pools} stations={stations} accent={accent} />
        )}

        <div ref={gridRef} className="fp-grid relative min-h-0 flex-1 overflow-auto" onClick={() => setTip(null)}>
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="block h-auto w-full max-w-full"
            style={{ fontFamily: 'var(--font-sans)' }}
            role="img"
            aria-label={`${workload.name} 算力调度流程图`}
          >
            {chassis.map((model, index) => {
              const panel = panels[index]
              if (!panel) return null
              return (
                <ChassisSvg
                  key={model.id}
                  panel={panel}
                  model={model}
                  accent={accent}
                  compact={scene === 'C'}
                  nvlink={Math.round(model.fabricPeakGBs * (0.55 + Math.sin(tick * 0.8 + index) * 0.08))}
                  showBus={scene !== 'A' && model.active.length > 1}
                  onEnter={(slot, event) => place(model.id, slot, event, false)}
                  onLeave={() => setTip((current) => (current?.pinned ? current : null))}
                  onPick={(slot, event) => {
                    event.stopPropagation()
                    place(model.id, slot, event, true)
                  }}
                />
              )
            })}

            <g pointerEvents="none">
            {flows.map((d) => (
              <FlowPath key={d} d={d} color={accent} />
            ))}
            {scene === 'B' && <circle cx={fork.x} cy={fork.y} r={4.5} fill={accent} />}

            {scene === 'C' && panels.length > 1 && (
              <g>
                <FlowPath
                  d={`M ${trunkX} ${panels[0].y + panels[0].h / 2} V ${panels[panels.length - 1].y + panels[panels.length - 1].h / 2}`}
                  color={accent}
                  width={4.2}
                />
                {panels.map((panel) => (
                  <FlowPath
                    key={`trunk-${panel.y}`}
                    d={`M ${panel.x + panel.w + 16} ${panel.y + panel.h / 2} H ${trunkX}`}
                    color={accent}
                    width={3.2}
                  />
                ))}
                <text
                  x={trunkX}
                  y={panels[0].y + panels[0].h / 2 - 16}
                  textAnchor="end"
                  fill={accent}
                  fontSize={11}
                  fontFamily="DM Mono, ui-monospace"
                >
                  RDMA {rdma} Gbps
                </text>
              </g>
            )}
            </g>

            <NodeCard
              box={gateway}
              title="沐仞中央推理网关"
              subtitle="Cross-Region Ingress"
              accent={accent}
              lines={[
                { k: 'QPS', v: String(qps) },
                { k: 'TTFT', v: ttft ? `${ttft}ms` : '—' },
              ]}
            />
            <NodeCard
              box={scheduler}
              title="分布式拓扑调度器"
              subtitle="Geo Scheduler"
              accent={accent}
              badge={tag}
              lines={[
                {
                  k: '策略',
                  v:
                    scene === 'A'
                      ? '单卡'
                      : scene === 'B'
                        ? `${chassis[0]?.active.length ?? 0} 卡`
                        : `跨中心 ${chassis.length} 机`,
                },
              ]}
            />
            {scene === 'C' && (
              <NodeCard
                box={fabric}
                title="跨中心 RDMA Fabric"
                subtitle="区域互联无阻塞"
                accent={accent}
                lines={[
                  { k: '带宽', v: `${rdma} Gbps` },
                  { k: '整机', v: `${chassis.length} × 8` },
                ]}
              />
            )}

          </svg>

          {tip && tipSlot && (
            <div
              className="pointer-events-none absolute z-20 w-[228px] rounded-xl border border-border-bright bg-panel/95 p-3 shadow-[0_12px_28px_rgba(33,32,33,0.12)] backdrop-blur"
              style={{ left: tip.x, top: tip.y }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] text-text">
                  GPU {tipSlot.index}
                  <span className="ml-1 text-[10px] text-dim">{tipSlot.host}</span>
                </div>
                {tip.pinned && <span className="text-[10px] text-infer">已固定</span>}
              </div>
              <div className="mt-1 break-all font-mono text-[10px] leading-snug text-dim">{tipSlot.uuid}</div>
              <dl className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">SM 活跃度</dt>
                  <dd className="font-mono text-infer">{tipSlot.sm.toFixed(1)}%</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">显存读写带宽</dt>
                  <dd className="font-mono text-[#b8860b]">{tipSlot.bandwidth.toFixed(0)} GB/s</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Tokens/s</dt>
                  <dd className="font-mono text-multi">{tipSlot.tokens.toFixed(1)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">显存 / 温度</dt>
                  <dd className="font-mono text-text">
                    {tipSlot.mem.toFixed(1)} GB · {tipSlot.temp.toFixed(0)}°C
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
