import { useEffect, useMemo, useState } from 'react'
import type { PowerStation } from '../../types'
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
    const timer = window.setInterval(() => setPeers(randomPeerLinks()), 4200)
    return () => window.clearInterval(timer)
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

  return (
    <section className="relative h-full overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-40" />
      <svg
        viewBox="0 0 1280 600"
        preserveAspectRatio="xMidYMid meet"
        className="relative h-full w-full"
        role="img"
        aria-label="全国电站集群算力拓扑"
      >
        <defs>
          <radialGradient id="mapGlow" cx="58%" cy="42%" r="48%">
            <stop offset="0%" stopColor="#2f63b8" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#f8f8f8" stopOpacity="0" />
          </radialGradient>
          <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="1280" height="600" fill="url(#mapGlow)" />
        <text x="640" y="34" textAnchor="middle" fill="rgba(33,32,33,0.45)" fontSize="18" letterSpacing="6">
          京津冀 · 新疆 · 苏赣粤 · 跨中心分布式协同
        </text>

        {/* 网关 → 各区域：始终连接并流动 */}
        <g pointerEvents="none">
          {FLY_MARKS.map((mark) => {
            const active = mark.id === activeId
            const d = hubFlyPath(mark.x, mark.y, mark.bend)
            return (
              <g key={`hub-${mark.id}`}>
                <path d={d} fill="none" stroke="#2f63b8" strokeWidth={active ? 3.2 : 2.4} strokeOpacity={0.12} />
                <path
                  d={d}
                  fill="none"
                  stroke={active ? '#2f63b8' : '#4e3f66'}
                  strokeWidth={active ? 2.1 : 1.55}
                  strokeOpacity={active ? 0.95 : 0.72}
                  className="fp-flow"
                />
                <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.2} className="fp-bead" />
              </g>
            )
          })}
        </g>

        {/* 区域 ↔ 区域：按需点亮 1～2 条协同链路 */}
        <g pointerEvents="none">
          {peers.map((link) => {
            const from = markById(link.from)
            const to = markById(link.to)
            if (!from || !to) return null
            const d = peerFlyPath(from, to, link.bend)
            const midX = (from.x + to.x) / 2
            const midY = (from.y + to.y) / 2 - 12
            return (
              <g key={link.id}>
                <path d={d} fill="none" stroke="#8a6232" strokeWidth={3.4} strokeOpacity={0.14} />
                <path d={d} fill="none" stroke="#8a6232" strokeWidth={2.1} strokeOpacity={0.92} className="fp-flow" />
                <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.3} className="fp-bead" />
                <path d={d} fill="none" stroke="#2f63b8" strokeWidth={1.5} strokeOpacity={0.45} className="fp-flow-rev" />
                <g transform={`translate(${midX - 78}, ${midY - 12})`}>
                  <rect width="156" height="24" rx="12" fill="#ffffff" stroke="rgba(138,98,50,0.32)" />
                  <text x="78" y="16" textAnchor="middle" fill="#8a6232" fontSize="10">
                    {link.label}
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
          <g transform={`translate(${FLY_HUB.x - 78}, ${FLY_HUB.y + 16})`}>
            <rect width="156" height="58" rx="12" fill="#ffffff" stroke="rgba(61,49,79,0.18)" strokeWidth="1.2" />
            <text x="78" y="18" textAnchor="middle" fill="#212021" fontSize="13">
              沐仞调度中心
            </text>
            <text x="78" y="36" textAnchor="middle" fill="#2f63b8" fontSize="11" fontFamily="DM Mono, ui-monospace">
              在调度 {running} · 排队 {queued}
            </text>
            <text x="78" y="50" textAnchor="middle" fill="rgba(33,32,33,0.55)" fontSize="10" fontFamily="DM Mono, ui-monospace">
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

        <g pointerEvents="none">
          <text x="28" y="548" fill="rgba(33,32,33,0.5)" fontSize="11">
            健康
          </text>
          <circle cx="62" cy="544" r="4" fill="#2f9e44" />
          <text x="74" y="548" fill="rgba(33,32,33,0.5)" fontSize="11">
            紧张
          </text>
          <circle cx="108" cy="544" r="4" fill="#b8860b" />
          <text x="120" y="548" fill="rgba(33,32,33,0.5)" fontSize="11">
            异常
          </text>
          <circle cx="154" cy="544" r="4" fill="#9b3a3a" />
          <text x="176" y="548" fill="rgba(33,32,33,0.5)" fontSize="11">
            网关直连各区域
          </text>
          <text x="300" y="548" fill="rgba(33,32,33,0.5)" fontSize="11">
            区域间按需协同
          </text>
          {peers[0] && (
            <text x="420" y="548" fill="#8a6232" fontSize="11" fontFamily="DM Mono, ui-monospace">
              当前协同 · {peers.map((p) => p.label.split(' · ')[0]).join(' / ')}
            </text>
          )}
        </g>
        <text x="28" y="22" fill="rgba(33,32,33,0.45)" fontSize="11">
          当前查看 · {activeTitle}
        </text>
      </svg>
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
  const width = Math.max(156, mark.pill.length * 12 + (active ? 40 : 24))
  const cardAbove = mark.y > 470
  const cardY = cardAbove ? mark.y - 64 : mark.y + 14
  const highlight = active || linked

  return (
    <g style={{ cursor: 'pointer' }} onClick={() => onSelect(mark.id)}>
      {mark.region && (
        <text
          x={mark.region.x}
          y={mark.region.y}
          fill={highlight ? '#2f63b8' : mark.color}
          fontSize={mark.region.size ?? 22}
          fontWeight={highlight ? 600 : 500}
          opacity={highlight ? 1 : 0.7}
        >
          {mark.region.text}
        </text>
      )}
      <g filter="url(#dotGlow)">
        {highlight && (
          <>
            <circle cx={mark.x} cy={mark.y} r={10} fill="none" stroke={active ? color : '#2f63b8'} strokeWidth="1.6" className="fp-ring" />
            <circle
              cx={mark.x}
              cy={mark.y}
              r={10}
              fill="none"
              stroke={active ? color : '#2f63b8'}
              strokeWidth="1.6"
              className="fp-ring fp-ring-delay"
            />
          </>
        )}
        <circle cx={mark.x} cy={mark.y} r={highlight ? 11 : 7} fill={color} opacity={highlight ? 0.22 : 0.16} />
        <circle cx={mark.x} cy={mark.y} r={highlight ? 4.8 : 3.4} fill={color} className={highlight ? 'fp-core' : undefined} />
        <circle cx={mark.x} cy={mark.y} r={8} fill="none" stroke={color} strokeOpacity={highlight ? 1 : 0.8} />
      </g>
      <g transform={`translate(${mark.x - width / 2}, ${cardY})`}>
        <rect
          width={width}
          height={46}
          rx={10}
          fill="#ffffff"
          stroke={highlight ? '#2f63b8' : 'rgba(61,49,79,0.18)'}
          strokeWidth={highlight ? 1.5 : 1}
        />
        <rect width={4} height={46} rx={2} fill={linked && !active ? '#2f63b8' : color} />
        <text x={14} y={18} fill="#212021" fontSize="12">
          {mark.pill}
        </text>
        {active && (
          <text x={width - 10} y={18} textAnchor="end" fill="#2f63b8" fontSize="10">
            当前
          </text>
        )}
        {!active && linked && (
          <text x={width - 10} y={18} textAnchor="end" fill="#2f63b8" fontSize="10">
            协同
          </text>
        )}
        <text x={14} y={36} fill="rgba(33,32,33,0.6)" fontSize="11" fontFamily="DM Mono, ui-monospace">
          任务 {stat?.tasks ?? 0} · 空闲 {stat?.idle ?? 0} · {HEALTH_LABEL[health]}
        </text>
      </g>
      <text
        x={mark.x}
        y={cardAbove ? cardY - 8 : cardY + 60}
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
