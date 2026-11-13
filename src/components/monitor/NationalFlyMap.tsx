import { useEffect, useMemo, useState } from 'react'
import type { PowerStation } from '../../types'
import { CHINA_OUTLINE_PATH, CHINA_VIEW } from './chinaOutline'
import {
  FLY_HUB,
  FLY_MARKS,
  randomPeerLinks,
  hubFlyPath,
  markById,
  peerFlyPath,
  type RegionMark,
} from './flyMapData'
import type { PeerLink } from './flyMapData'

export type StationHealth = 'healthy' | 'tight' | 'fault'

export interface StationMapStat {
  id: string
  tasks: number
  idle: number
  total: number
  health: StationHealth
}

const HEALTH_COLOR: Record<StationHealth, string> = {
  healthy: '#2f9e44',
  tight: '#b8860b',
  fault: '#9b3a3a',
}

const HEALTH_LABEL: Record<StationHealth, string> = {
  healthy: '健康',
  tight: '紧张',
  fault: '异常',
}

/** 信息卡宽度：右侧状态词单独占位，避免与任务行挤在一起溢出 */
function cardWidth(pill: string, active: boolean, linked: boolean) {
  const title = Math.min(pill.length, 10) * 12 + (active || linked ? 44 : 28)
  const status = 14 + 96 + 10 + 36 + 12 // 左边距 + 任务行 + 间隙 + 「健康」+ 右边距
  return Math.min(232, Math.max(180, title, status))
}

function clampCardX(centerX: number, width: number, dx: number) {
  const raw = centerX - width / 2 + dx
  return Math.max(10, Math.min(CHINA_VIEW.w - width - 10, raw))
}

function clampCardY(nodeY: number, height: number, dy: number) {
  const raw = nodeY + dy
  return Math.max(36, Math.min(CHINA_VIEW.h - height - 56, raw))
}

export function NationalFlyMap({
  stations,
  stats,
  queued,
  activeId,
  activeTitle,
  onSelect,
}: {
  stations: PowerStation[]
  stats: StationMapStat[]
  queued: number
  activeId: string
  activeTitle: string
  onSelect: (id: string) => void
}) {
  const [peers, setPeers] = useState<PeerLink[]>(() => randomPeerLinks())
  useEffect(() => {
    let cancelled = false
    let timer = 0
    const tick = () => {
      if (cancelled) return
      setPeers(randomPeerLinks())
      // 非均匀刷新：2.6s～5.8s 抖动，模拟按需调度窗口
      const next = 2600 + Math.floor(Math.random() * 3200)
      timer = window.setTimeout(tick, next)
    }
    timer = window.setTimeout(tick, 3200 + Math.floor(Math.random() * 1800))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const mw = new Map(stations.map((station) => [station.id, station.currentMw]))
  const byId = new Map(stats.map((item) => [item.id, item]))
  const running = stats.reduce((sum, item) => sum + item.tasks, 0)

  const peerIds = useMemo(() => {
    const set = new Set<string>()
    peers.forEach((link) => {
      set.add(link.from)
      set.add(link.to)
    })
    return set
  }, [peers])

  const hubCardW = 168
  const hubCardX = clampCardX(FLY_HUB.x, hubCardW, 0)
  const hubCardY = clampCardY(FLY_HUB.y, 58, 18)

  return (
    <section className="relative h-full overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-40" />
      <svg
        viewBox={`0 0 ${CHINA_VIEW.w} ${CHINA_VIEW.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="relative h-full w-full"
        role="img"
        aria-label="全国电站集群算力拓扑"
      >
        <defs>
          <radialGradient id="mapGlow" cx="52%" cy="42%" r="52%">
            <stop offset="0%" stopColor="#2f63b8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#f8f8f8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mapLand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8eef8" />
            <stop offset="55%" stopColor="#dfe8f4" />
            <stop offset="100%" stopColor="#d4e0f0" />
          </linearGradient>
          <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="mapSoft" x="-2%" y="-2%" width="104%" height="104%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        <rect width={CHINA_VIEW.w} height={CHINA_VIEW.h} fill="url(#mapGlow)" />

        {/* 中国地图轮廓 */}
        <g pointerEvents="none">
          <path
            d={CHINA_OUTLINE_PATH}
            fill="url(#mapLand)"
            stroke="rgba(47,99,184,0.28)"
            strokeWidth={1.35}
            strokeLinejoin="round"
          />
          <path
            d={CHINA_OUTLINE_PATH}
            fill="none"
            stroke="rgba(47,99,184,0.1)"
            strokeWidth={6}
            strokeLinejoin="round"
            filter="url(#mapSoft)"
            opacity={0.7}
          />
        </g>

        <text
          x={CHINA_VIEW.w / 2}
          y={28}
          textAnchor="middle"
          fill="rgba(33,32,33,0.45)"
          fontSize="16"
          letterSpacing="5"
        >
          京津冀 · 新疆 · 苏赣粤 · 跨中心分布式协同
        </text>

        {/* 网关 → 各区域：始终连接；流速/相位各异 */}
        <g pointerEvents="none">
          {FLY_MARKS.map((mark) => {
            const active = mark.id === activeId
            const d = hubFlyPath(mark.x, mark.y, mark.bend)
            const flowStyle = {
              ['--fp-dur' as string]: `${mark.flowDuration}s`,
              ['--fp-delay' as string]: `${mark.flowDelay}s`,
            }
            return (
              <g key={`hub-${mark.id}`}>
                <path d={d} fill="none" stroke="#2f63b8" strokeWidth={active ? 3.2 : 2.2} strokeOpacity={0.1} />
                <path
                  d={d}
                  fill="none"
                  stroke={active ? '#2f63b8' : '#4e3f66'}
                  strokeWidth={active ? 2.1 : 1.45}
                  strokeOpacity={active ? 0.95 : 0.65}
                  className="fp-flow-var"
                  style={flowStyle}
                />
                <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.15} className="fp-bead-var" style={flowStyle} />
                {/* 脉冲包：沿路径加速-缓停，模拟非均匀传输 */}
                <circle r={3.4} fill={active ? '#2f63b8' : '#6b7fa8'} className="fp-pulse-dot">
                  <animateMotion
                    dur={`${mark.flowDuration * 1.2}s`}
                    begin={`${mark.flowDelay}s`}
                    repeatCount="indefinite"
                    path={d}
                    keyPoints="0;0.12;0.55;1"
                    keyTimes="0;0.18;0.55;1"
                    calcMode="spline"
                    keySplines="0.4 0 0.2 1;0.15 0 0.6 1;0.5 0 0.3 1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0.35;0"
                    keyTimes="0;0.06;0.7;0.9;1"
                    dur={`${mark.flowDuration * 1.2}s`}
                    begin={`${mark.flowDelay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="r"
                    values="2;4.2;3;2.2"
                    keyTimes="0;0.2;0.7;1"
                    dur={`${mark.flowDuration * 1.2}s`}
                    begin={`${mark.flowDelay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            )
          })}
        </g>

        {/* 区域 ↔ 区域：按需点亮，节奏独立 */}
        <g pointerEvents="none">
          {peers.map((link) => {
            const from = markById(link.from)
            const to = markById(link.to)
            if (!from || !to) return null
            const d = peerFlyPath(from, to, link.bend)
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2 - 14
            const label = link.label.length > 14 ? link.label.slice(0, 14) + '…' : link.label
            const labelW = Math.min(168, Math.max(120, label.length * 10 + 20))
            const labelX = Math.max(10, Math.min(CHINA_VIEW.w - labelW - 10, midX - labelW / 2))
            const flowStyle = {
              ['--fp-dur' as string]: `${link.flowDuration}s`,
              ['--fp-delay' as string]: `${link.flowDelay}s`,
            }
            return (
              <g key={link.id}>
                <path d={d} fill="none" stroke="#8a6232" strokeWidth={3.2} strokeOpacity={0.12} />
                <path
                  d={d}
                  fill="none"
                  stroke="#8a6232"
                  strokeWidth={2}
                  strokeOpacity={0.92}
                  className="fp-flow-var"
                  style={flowStyle}
                />
                <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.25} className="fp-bead-var" style={flowStyle} />
                <path
                  d={d}
                  fill="none"
                  stroke="#2f63b8"
                  strokeWidth={1.4}
                  strokeOpacity={0.4}
                  className="fp-flow-rev-var"
                  style={{
                    ['--fp-dur' as string]: `${link.flowDuration * 0.85}s`,
                    ['--fp-delay' as string]: `${link.flowDelay + 0.35}s`,
                  }}
                />
                <circle r={3.6} fill="#8a6232" className="fp-pulse-dot">
                  <animateMotion
                    dur={`${link.flowDuration}s`}
                    begin={`${link.flowDelay}s`}
                    repeatCount="indefinite"
                    path={d}
                    keyPoints="0;0.2;0.7;1"
                    keyTimes="0;0.22;0.62;1"
                    calcMode="spline"
                    keySplines="0.45 0 0.15 1;0.1 0 0.7 1;0.4 0 0.2 1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0.4;0"
                    keyTimes="0;0.05;0.72;0.9;1"
                    dur={`${link.flowDuration}s`}
                    begin={`${link.flowDelay}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="r"
                    values="2.2;4.6;3.2;2"
                    keyTimes="0;0.18;0.65;1"
                    dur={`${link.flowDuration}s`}
                    begin={`${link.flowDelay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                <g transform={`translate(${labelX}, ${Math.max(40, midY - 12)})`}>
                  <rect width={labelW} height={22} rx={11} fill="#ffffff" stroke="rgba(138,98,50,0.32)" />
                  <text x={labelW / 2} y={15} textAnchor="middle" fill="#8a6232" fontSize="10">
                    {label}
                  </text>
                </g>
              </g>
            )
          })}
        </g>

        <g pointerEvents="none">
          <circle cx={FLY_HUB.x} cy={FLY_HUB.y} r={18} fill="none" stroke="#2f63b8" strokeWidth="1.4" className="fp-ring" />
          <circle
            cx={FLY_HUB.x}
            cy={FLY_HUB.y}
            r={18}
            fill="none"
            stroke="#4e3f66"
            strokeWidth="1.4"
            className="fp-ring fp-ring-delay"
          />
          <circle cx={FLY_HUB.x} cy={FLY_HUB.y} r={22} fill="#2f63b8" opacity="0.12" filter="url(#dotGlow)" />
          <circle cx={FLY_HUB.x} cy={FLY_HUB.y} r={8} fill="#2f63b8" className="fp-core" />
          <g transform={`translate(${hubCardX}, ${hubCardY})`}>
            <rect width={hubCardW} height={58} rx={12} fill="#ffffff" stroke="rgba(61,49,79,0.18)" strokeWidth="1.2" />
            <text x={hubCardW / 2} y={18} textAnchor="middle" fill="#212021" fontSize="13">
              沐仞调度中心
            </text>
            <text
              x={hubCardW / 2}
              y={36}
              textAnchor="middle"
              fill="#2f63b8"
              fontSize="11"
              fontFamily="DM Mono, ui-monospace"
            >
              在调度 {running} · 排队 {queued}
            </text>
            <text
              x={hubCardW / 2}
              y={50}
              textAnchor="middle"
              fill="rgba(33,32,33,0.55)"
              fontSize="10"
              fontFamily="DM Mono, ui-monospace"
            >
              区域协同 {peers.length} 路
            </text>
          </g>
        </g>

        {FLY_MARKS.map((mark) => (
          <StationNode
            key={mark.id}
            mark={mark}
            active={mark.id === activeId}
            linked={peerIds.has(mark.id)}
            stat={byId.get(mark.id)}
            mw={mw.get(mark.id) ?? 0}
            onSelect={onSelect}
          />
        ))}

        <text x="28" y="22" fill="rgba(33,32,33,0.45)" fontSize="11">
          当前查看 · {activeTitle}
        </text>
      </svg>

      {/* 图例放在 HTML 层，避免 SVG 缩放后文字贴边溢出 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-gradient-to-t from-void via-void/90 to-transparent px-4 pb-3 pt-8 text-[11px] text-dim">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#2f9e44]" />
          健康
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#b8860b]" />
          紧张
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#9b3a3a]" />
          异常
        </span>
        <span className="text-muted">网关直连各区域</span>
        <span className="text-muted">区域间按需协同 · 脉冲非均匀</span>
        {peers[0] && (
          <span className="font-mono text-[10px] text-gang">
            当前协同 · {peers.map((p) => p.label.split(' · ')[0]).join(' / ')}
          </span>
        )}
      </div>
    </section>
  )
}

function StationNode({
  mark,
  active,
  linked,
  stat,
  mw,
  onSelect,
}: {
  mark: RegionMark
  active: boolean
  linked: boolean
  stat?: StationMapStat
  mw: number
  onSelect: (id: string) => void
}) {
  const health = stat?.health ?? 'healthy'
  const color = HEALTH_COLOR[health]
  const width = cardWidth(mark.pill, active, linked)
  const height = 46
  const cardX = clampCardX(mark.x, width, mark.cardDx ?? 0)
  const cardY = clampCardY(mark.y, height, mark.cardDy ?? (mark.y > CHINA_VIEW.h * 0.72 ? -64 : 14))
  const highlight = active || linked
  const pulseDelay = `${mark.flowDelay * 0.4}s`
  const pulseDur = `${1.6 + mark.flowDuration * 0.25}s`

  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onSelect(mark.id)}>
      {mark.region && (
        <text
          x={mark.region.x}
          y={mark.region.y}
          fill={highlight ? '#2f63b8' : mark.color}
          fontSize={mark.region.size ?? 22}
          fontWeight={highlight ? 600 : 500}
          opacity={highlight ? 1 : 0.55}
        >
          {mark.region.text}
        </text>
      )}
      <g filter="url(#dotGlow)">
        {highlight && (
          <>
            <circle
              cx={mark.x}
              cy={mark.y}
              r={10}
              fill="none"
              stroke={active ? color : '#2f63b8'}
              strokeWidth="1.6"
              className="fp-ring"
              style={{ animationDelay: pulseDelay, animationDuration: pulseDur }}
            />
            <circle
              cx={mark.x}
              cy={mark.y}
              r={10}
              fill="none"
              stroke={active ? color : '#2f63b8'}
              strokeWidth="1.6"
              className="fp-ring"
              style={{ animationDelay: `calc(${pulseDelay} + ${pulseDur} * 0.45)`, animationDuration: pulseDur }}
            />
          </>
        )}
        <circle cx={mark.x} cy={mark.y} r={highlight ? 11 : 7} fill={color} opacity={highlight ? 0.22 : 0.16} />
        <circle cx={mark.x} cy={mark.y} r={highlight ? 4.8 : 3.4} fill={color} className={highlight ? 'fp-core' : undefined} />
        <circle cx={mark.x} cy={mark.y} r={8} fill="none" stroke={color} strokeOpacity={highlight ? 1 : 0.8} />
      </g>
      <g transform={`translate(${cardX}, ${cardY})`}>
        <rect
          width={width}
          height={height}
          rx={10}
          fill="#ffffff"
          stroke={highlight ? '#2f63b8' : 'rgba(61,49,79,0.18)'}
          strokeWidth={highlight ? 1.5 : 1}
        />
        <rect width={4} height={height} rx={2} fill={linked && !active ? '#2f63b8' : color} />
        <text x={14} y={17} fill="#212021" fontSize="12">
          {mark.pill.length > 11 ? mark.pill.slice(0, 10) + '…' : mark.pill}
        </text>
        {active && (
          <text x={width - 10} y={17} textAnchor="end" fill="#2f63b8" fontSize="10">
            当前
          </text>
        )}
        {!active && linked && (
          <text x={width - 10} y={17} textAnchor="end" fill="#2f63b8" fontSize="10">
            协同
          </text>
        )}
        <text x={14} y={35} fill="rgba(33,32,33,0.6)" fontSize="11" fontFamily="DM Mono, ui-monospace">
          任务 {stat?.tasks ?? 0} · 空闲 {stat?.idle ?? 0}
        </text>
        {/* 状态词：色点+文字，不放窄 pill，避免「健康」贴边溢出 */}
        <circle cx={width - 40} cy={31} r={2.6} fill={color} />
        <text x={width - 32} y={35} fill={color} fontSize="11" fontWeight={500}>
          {HEALTH_LABEL[health]}
        </text>
      </g>
      <text
        x={Math.max(24, Math.min(CHINA_VIEW.w - 24, cardX + width / 2))}
        y={cardY > mark.y ? cardY + height + 14 : cardY - 8}
        textAnchor="middle"
        fill="rgba(33,32,33,0.45)"
        fontSize="10"
        fontFamily="DM Mono, ui-monospace"
      >
        {mw.toFixed(1)} MW
      </text>
    </g>
  )
}
