import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, Server } from 'lucide-react'
import { useApp } from '../store/AppContext'

function slotColor(state: string) {
  if (state === 'infer') return 'bg-infer'
  if (state === 'multi') return 'bg-multi'
  if (state === 'gang') return 'bg-gang'
  if (state === 'fault') return 'bg-alert'
  return 'bg-idle'
}

function statusTone(status: string) {
  if (status === 'healthy') return 'text-infer'
  if (status === 'degraded') return 'text-gang'
  return 'text-alert'
}

function statusLabel(status: string) {
  if (status === 'healthy') return '健康'
  if (status === 'degraded') return '降级'
  return '离线'
}

const SLOT_LEGEND = [
  { key: 'idle', label: '空闲', color: 'bg-idle' },
  { key: 'infer', label: '单卡', color: 'bg-infer' },
  { key: 'multi', label: '多卡', color: 'bg-multi' },
  { key: 'gang', label: '跨机', color: 'bg-gang' },
  { key: 'fault', label: '故障', color: 'bg-alert' },
] as const

export function Clusters() {
  const { state, focusServer, focusPool } = useApp()
  const navigate = useNavigate()
  const [poolId, setPoolId] = useState(state.pools[0]?.id ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const matched = state.pools.find((p) => p.stationIds.includes(state.activeStationId))
    if (matched) setPoolId(matched.id)
  }, [state.activeStationId, state.pools])

  const pool = state.pools.find((p) => p.id === poolId) ?? state.pools[0]
  const servers = useMemo(
    () => state.servers.filter((s) => s.poolId === pool.id),
    [state.servers, pool.id],
  )
  const stations = state.stations.filter((s) => pool.stationIds.includes(s.id))

  const summary = useMemo(() => {
    const gpus = servers.flatMap((s) => s.gpus)
    const fault = gpus.filter((g) => g.state === 'fault').length
    const busy = gpus.filter((g) => g.state !== 'idle' && g.state !== 'fault').length
    const avgTemp = servers.length
      ? Math.round(servers.reduce((n, s) => n + s.temperature, 0) / servers.length)
      : 0
    const powerKw = Math.round(servers.reduce((n, s) => n + s.powerW, 0) / 100) / 10
    return { gpus: gpus.length, fault, busy, avgTemp, powerKw }
  }, [servers])

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto px-8 pb-6 pt-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12.5px] text-dim">资源</p>
          <h2 className="text-[28px] leading-none">节点</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            当前节点池 · 4/8/16/32 槽 · 同卡满配或合理混卡（如 H100+H200、昇腾 910B+910C、A800+A100）
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-full bg-[rgba(61,49,79,0.06)] p-1">
          {state.pools.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPoolId(p.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] transition ${
                pool.id === p.id
                  ? 'bg-panel text-text shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                  : 'text-dim hover:text-text'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="sheet grid grid-cols-2 overflow-hidden sm:grid-cols-5">
        {[
          { label: '服务器', value: String(servers.length), unit: '台一体机' },
          { label: 'GPU', value: String(summary.gpus), unit: `${summary.busy} 运行中` },
          { label: '平均温度', value: `${summary.avgTemp}°C`, unit: '机箱均温' },
          { label: '合计功耗', value: `${summary.powerKw}`, unit: 'kW' },
          { label: '故障卡', value: String(summary.fault), unit: '已摘除调度' },
        ].map((item, i) => (
          <div
            key={item.label}
            className={`grid gap-0.5 px-3 py-3 ${i > 0 ? 'border-l border-border' : ''} ${
              i >= 2 ? 'border-t border-border sm:border-t-0' : ''
            }`}
          >
            <span className="text-[11px] text-dim">{item.label}</span>
            <b className="metric-num text-[24px] font-normal leading-none">{item.value}</b>
            <small className="text-[11px] text-dim">{item.unit}</small>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="sheet side-glow p-3.5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[14px] font-medium">{pool.label}</div>
              <div className="mt-0.5 text-[12px] text-dim">{pool.region}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                focusPool(pool.id)
                navigate('/monitor')
              }}
              className="flex items-center gap-1.5 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-3 py-1.5 text-[11px] font-medium text-infer hover:bg-[#e3ecfa]"
            >
              <Crosshair className="h-3 w-3" />
              在监控大屏定位
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {stations.map((st) => (
              <div
                key={st.id}
                className="rounded-full border border-border bg-void/80 px-2.5 py-1 text-[11px] text-muted"
              >
                <span className="text-text">{st.name}</span>
                <span className="mx-1.5 text-border-bright">·</span>
                <span className="font-mono text-infer">{st.currentMw.toFixed(1)} MW</span>
              </div>
            ))}
            {stations.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-3 py-2 text-[11px] text-dim">
                未绑定电站
              </div>
            )}
          </div>
        </div>

        <div className="sheet p-3.5">
          <div className="text-[11px] text-dim">节点池摘要</div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {[
              { label: '服务器', value: servers.length, tone: 'text-infer' },
              { label: 'GPU', value: summary.gpus, tone: 'text-multi' },
              { label: '运行卡', value: summary.busy, tone: 'text-text' },
              { label: '故障卡', value: summary.fault, tone: summary.fault ? 'text-alert' : 'text-muted' },
            ].map((cell) => (
              <div key={cell.label} className="rounded-xl border border-border bg-void/50 px-2.5 py-2 text-center">
                <div className="text-[10px] text-dim">{cell.label}</div>
                <div className={`metric-num mt-0.5 text-[20px] leading-none ${cell.tone}`}>{cell.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sheet min-h-0 flex-1 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="text-[13px] font-medium">主机清单</div>
          <div className="flex flex-wrap items-center gap-3">
            {SLOT_LEGEND.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] text-dim">
                <i className={`h-2.5 w-3.5 rounded-sm ${item.color}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div className="max-h-[calc(100vh-420px)] min-h-[280px] overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[rgba(248,248,248,0.92)] text-dim backdrop-blur">
              <tr>
                {['主机名', 'IP', 'GPU 型号', '卡槽位', '状态', 'RDMA', '温度', '功耗', '操作'].map((h) => (
                  <th key={h} className="border-b border-border px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => {
                const active = selectedId === s.id
                const slotN = s.gpus.length
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className={`cursor-pointer border-b border-border/70 transition ${
                      active
                        ? 'bg-[#eef3fb] shadow-[inset_2px_0_0_0_#2f63b8]'
                        : 'hover:bg-[rgba(61,49,79,0.04)]'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-dim" />
                        <span className="font-mono text-text">{s.hostname}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted">{s.ip}</td>
                    <td className="px-3 py-2.5 text-muted">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{s.gpuModel}</span>
                        {new Set(s.gpus.map((g) => g.cardModel)).size > 1 && (
                          <span className="rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-1.5 py-0.5 text-[10px] font-medium text-infer">
                            混卡
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex max-w-[240px] flex-wrap gap-0.5">
                          {s.gpus.map((g) => (
                            <div
                              key={g.index}
                              title={`GPU ${g.index}: ${g.cardModel} · ${g.state}${g.modelName ? ` · ${g.modelName}` : ''}`}
                              className={`h-3 w-3 rounded-sm sm:w-3.5 ${slotColor(g.state)}`}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-[10px] text-dim">{slotN} 槽</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 font-medium ${statusTone(s.nvlinkStatus)}`}>
                      {statusLabel(s.nvlinkStatus)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted">{s.rdmaGbps} Gbps</td>
                    <td className="px-3 py-2.5 font-mono text-muted">{s.temperature}°C</td>
                    <td className="px-3 py-2.5 font-mono text-muted" title={`GPU ${s.powerW - (s.chassisBaseW || 0)}W + 机箱 ${s.chassisBaseW || 0}W`}>
                      {s.powerW >= 1000 ? `${(s.powerW / 1000).toFixed(1)} kW` : `${s.powerW} W`}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          focusServer(s.id)
                          navigate('/monitor')
                        }}
                        className="rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2.5 py-1 text-[11px] font-medium text-infer hover:bg-[#e3ecfa]"
                      >
                        {slotN}卡透视
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
