import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, Server } from 'lucide-react'
import {
  ConfirmDialog,
  Drawer,
  FilterSelect,
  GhostButton,
  PrimaryButton,
  StatusPill,
} from '../components/console/ui'
import { usePlatformScope } from '../platform/useScope'
import { useApp } from '../store/AppContext'
import type { ServerNode } from '../types'

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
  const { state, focusServer, focusPool, cordonServer, drainServer, offlineServer, markGpuFault } = useApp()
  const { pools: scopedPools } = usePlatformScope()
  const navigate = useNavigate()
  const [poolId, setPoolId] = useState(scopedPools[0]?.id ?? state.pools[0]?.id ?? '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ type: 'drain' | 'offline'; server: ServerNode } | null>(null)

  useEffect(() => {
    if (!scopedPools.some((pool) => pool.id === poolId)) setPoolId(scopedPools[0]?.id ?? '')
  }, [poolId, scopedPools])

  const pool = state.pools.find((p) => p.id === poolId) ?? state.pools[0]
  const servers = useMemo(
    () => state.servers.filter((s) => s.poolId === pool.id),
    [state.servers, pool.id],
  )
  const stations = state.stations.filter((s) => pool.stationIds.includes(s.id))
  const selected = selectedId ? servers.find((server) => server.id === selectedId) ?? null : null

  const summary = useMemo(() => {
    const gpus = servers.flatMap((s) => s.gpus)
    const fault = gpus.filter((g) => g.state === 'fault').length
    const busy = gpus.filter((g) => g.state !== 'idle' && g.state !== 'fault').length
    const cordoned = servers.filter((s) => s.cordoned || s.nvlinkStatus === 'offline').length
    const avgTemp = servers.length
      ? Math.round(servers.reduce((n, s) => n + s.temperature, 0) / servers.length)
      : 0
    const powerKw = Math.round(servers.reduce((n, s) => n + s.powerW, 0) / 100) / 10
    return { gpus: gpus.length, fault, busy, avgTemp, powerKw, cordoned }
  }, [servers])

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-x-hidden overflow-y-auto px-8 pb-6 pt-1">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12.5px] text-dim">资源</p>
          <h2 className="text-[28px] leading-none">节点</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            支持 Cordon / Drain / 下线 / 故障卡标记。节点仍属于各自集群，这里按节点池运维。
          </p>
        </div>
        <FilterSelect
          label="节点池"
          value={pool.id}
          onChange={setPoolId}
          options={scopedPools.map((item) => ({ value: item.id, label: `${item.name} · ${item.region}` }))}
        />
      </div>

      <div className="sheet grid grid-cols-2 overflow-hidden sm:grid-cols-6">
        {[
          { label: '服务器', value: String(servers.length), unit: '台一体机' },
          { label: 'GPU', value: String(summary.gpus), unit: `${summary.busy} 运行中` },
          { label: '平均温度', value: `${summary.avgTemp}°C`, unit: '机箱均温' },
          { label: '合计功耗', value: `${summary.powerKw}`, unit: 'kW' },
          { label: '故障卡', value: String(summary.fault), unit: '已摘除调度' },
          { label: '不可调度', value: String(summary.cordoned), unit: 'Cordon/离线' },
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
              <div className="mt-0.5 text-[12px] text-dim">
                {pool.region} · {pool.status === 'Ready' ? '就绪' : pool.status === 'Draining' ? '排空中' : '已停用'}
              </div>
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
          <table className="w-full min-w-[1180px] text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[rgba(248,248,248,0.92)] text-dim backdrop-blur">
              <tr>
                {['主机名', 'IP', 'GPU 型号', '卡槽位', '健康', '调度', 'RDMA', '温度', '功耗', '操作'].map((h) => (
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
                const sched =
                  s.nvlinkStatus === 'offline'
                    ? '离线'
                    : s.draining
                      ? 'Drain'
                      : s.cordoned
                        ? 'Cordon'
                        : '可调度'
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
                    <td className="px-3 py-2.5">
                      <StatusPill tone={sched === '可调度' ? 'ok' : sched === '离线' ? 'bad' : 'warn'}>{sched}</StatusPill>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted">{s.rdmaGbps} Gbps</td>
                    <td className="px-3 py-2.5 font-mono text-muted">{s.temperature}°C</td>
                    <td
                      className="px-3 py-2.5 font-mono text-muted"
                      title={`GPU ${s.powerW - (s.chassisBaseW || 0)}W + 机箱 ${s.chassisBaseW || 0}W`}
                    >
                      {s.powerW >= 1000 ? `${(s.powerW / 1000).toFixed(1)} kW` : `${s.powerW} W`}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(s.id)}
                          className="rounded-full border border-border px-2 py-1 text-[10px] text-muted hover:text-text"
                        >
                          管控
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            focusServer(s.id)
                            navigate('/monitor')
                          }}
                          className="rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2 py-1 text-[10px] font-medium text-infer hover:bg-[#e3ecfa]"
                        >
                          透视
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <Drawer
          title={`节点管控 · ${selected.hostname}`}
          onClose={() => setSelectedId(null)}
          footer={
            <>
              <GhostButton onClick={() => setSelectedId(null)}>关闭</GhostButton>
              <PrimaryButton
                onClick={() => {
                  focusServer(selected.id)
                  navigate('/monitor')
                }}
              >
                监控透视
              </PrimaryButton>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border px-3 py-2">
                <div className="text-[10px] text-dim">健康</div>
                <div className="mt-1 text-[13px]">{statusLabel(selected.nvlinkStatus)}</div>
              </div>
              <div className="rounded-xl border border-border px-3 py-2">
                <div className="text-[10px] text-dim">调度</div>
                <div className="mt-1 text-[13px]">
                  {selected.nvlinkStatus === 'offline'
                    ? '离线'
                    : selected.cordoned
                      ? 'Cordon'
                      : '可调度'}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[12px] font-medium text-text">生命周期</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-border px-3 py-1.5 text-[12px] text-muted hover:text-text"
                  onClick={() => cordonServer(selected.id, !selected.cordoned)}
                  disabled={selected.nvlinkStatus === 'offline'}
                >
                  {selected.cordoned ? 'Uncordon' : 'Cordon'}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border px-3 py-1.5 text-[12px] text-muted hover:text-text"
                  onClick={() => setConfirm({ type: 'drain', server: selected })}
                  disabled={selected.nvlinkStatus === 'offline'}
                >
                  Drain 驱逐
                </button>
                <button
                  type="button"
                  className="rounded-full border border-alert/30 px-3 py-1.5 text-[12px] text-alert"
                  onClick={() => setConfirm({ type: 'offline', server: selected })}
                >
                  {selected.nvlinkStatus === 'offline' ? '重新上线' : '下线节点'}
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[12px] font-medium text-text">GPU 槽位</div>
              <div className="space-y-2">
                {selected.gpus.map((gpu) => (
                  <div key={gpu.index} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                    <div>
                      <div className="font-mono text-[12px] text-text">
                        GPU{gpu.index} · {gpu.cardModel}
                      </div>
                      <div className="mt-0.5 text-[11px] text-dim">
                        {gpu.state}
                        {gpu.modelName ? ` · ${gpu.modelName}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${
                        gpu.state === 'fault'
                          ? 'border-[rgba(47,99,184,0.28)] bg-[#eef3fb] text-infer'
                          : 'border-alert/25 text-alert'
                      }`}
                      onClick={() => markGpuFault(selected.id, gpu.index, gpu.state !== 'fault')}
                    >
                      {gpu.state === 'fault' ? '恢复' : '标故障'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={confirm.type === 'drain' ? `Drain ${confirm.server.hostname}` : `${confirm.server.nvlinkStatus === 'offline' ? '上线' : '下线'} ${confirm.server.hostname}`}
          message={
            confirm.type === 'drain'
              ? '将停止该节点上的运行中任务，并 Cordon 禁止新调度。适合滚动升级或维护窗口。'
              : confirm.server.nvlinkStatus === 'offline'
                ? '节点将重新加入调度域并恢复可调度。'
                : '节点将退出调度域，运行中任务会被停止。'
          }
          confirmLabel={confirm.type === 'drain' ? '开始 Drain' : confirm.server.nvlinkStatus === 'offline' ? '上线' : '下线'}
          danger={confirm.type === 'offline' && confirm.server.nvlinkStatus !== 'offline'}
          onConfirm={() => {
            if (confirm.type === 'drain') drainServer(confirm.server.id, true)
            else offlineServer(confirm.server.id, confirm.server.nvlinkStatus !== 'offline')
            setSelectedId(confirm.server.id)
          }}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  )
}
