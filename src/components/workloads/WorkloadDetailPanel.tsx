import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair, ListOrdered, RotateCcw, Share2, Square, X } from 'lucide-react'
import { formatDuration, strategyLabel } from '../../mock/engine'
import { useApp } from '../../store/AppContext'
import type { Workload } from '../../types'
import { WorkloadStructureView } from './WorkloadStructureView'

const TABS = [
  { id: 'Details', label: '详情' },
  { id: 'Structure', label: '结构' },
  { id: 'Pods', label: '容器' },
  { id: 'Events', label: '事件' },
  { id: 'Metrics', label: '指标' },
] as const

interface Props {
  workload: Workload
  onClose: () => void
}

function statusTone(status: Workload['status']) {
  if (status === 'Running') return 'bg-[rgba(47,99,184,0.12)] text-infer'
  if (status === 'Pending') return 'bg-[rgba(138,98,50,0.12)] text-gang'
  if (status === 'Failed') return 'bg-[rgba(155,58,58,0.12)] text-alert'
  return 'bg-[rgba(61,49,79,0.08)] text-dim'
}

function statusLabel(status: Workload['status']) {
  if (status === 'Running') return '运行中'
  if (status === 'Pending') return '排队中'
  if (status === 'Failed') return '失败'
  if (status === 'Stopping') return '停止中'
  return '已完成'
}

export function WorkloadDetailPanel({ workload, onClose }: Props) {
  const { stop, cancelQueue, retryFailed, selectWorkload, openScheduleFlow, state } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('Structure')
  const project = state.projects.find((item) => item.id === workload.projectId)
  const waitReason =
    workload.status === 'Pending'
      ? workload.events.find((event) => event.phase === 'Pending')?.message ??
        workload.events[0]?.message ??
        '等待可用资源'
      : null
  const failReason =
    workload.status === 'Failed'
      ? workload.events.find((event) => event.phase === 'Failed')?.message ??
        workload.events[workload.events.length - 1]?.message ??
        '任务执行失败'
      : null

  return (
    <aside className="flex h-full w-[420px] shrink-0 flex-col border-l border-border bg-[linear-gradient(180deg,#ffffff_0%,#fbfaf7_100%)] shadow-[-8px_0_24px_rgba(47,99,184,0.04)]">
      <div className="flex items-start justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{workload.name}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded-full border border-[rgba(47,99,184,0.22)] bg-[#eef3fb] px-2 py-0.5 text-infer">
              {workload.type === 'Inference' ? '推理' : workload.type === 'Training' ? '训练' : '工作空间'}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-muted">
              {workload.architecture === 'Standard' ? '标准' : '分布式'}
            </span>
            <span className={`rounded-full px-2 py-0.5 ${statusTone(workload.status)}`}>
              {statusLabel(workload.status)}
            </span>
            {project ? (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-muted">P{project.priority}</span>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-dim hover:bg-[rgba(61,49,79,0.06)] hover:text-text">
          <X className="h-4 w-4" />
        </button>
      </div>

      {(waitReason || failReason) && (
        <div
          className={`border-b px-4 py-2.5 text-[12px] ${
            failReason
              ? 'border-[rgba(155,58,58,0.18)] bg-[rgba(155,58,58,0.06)] text-alert'
              : 'border-[rgba(138,98,50,0.18)] bg-[rgba(138,98,50,0.08)] text-gang'
          }`}
        >
          <div className="text-[10px] opacity-80">{failReason ? '失败原因' : '阻塞原因'}</div>
          <div className="mt-0.5 leading-relaxed">{failReason ?? waitReason}</div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3">
        <div className="rounded-xl border border-border bg-void/50 px-2.5 py-2 text-center">
          <div className="text-[10px] text-dim">GPU</div>
          <div className="metric-num mt-0.5 text-[18px] leading-none text-infer">{workload.gpuCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-void/50 px-2.5 py-2 text-center">
          <div className="text-[10px] text-dim">时长</div>
          <div className="metric-num mt-0.5 text-[16px] leading-none">{formatDuration(workload.durationSec)}</div>
        </div>
        <div className="rounded-xl border border-border bg-void/50 px-2.5 py-2 text-center">
          <div className="text-[10px] text-dim">容器</div>
          <div className="metric-num mt-0.5 text-[18px] leading-none">
            {workload.podsRunning}/{workload.podsRequested}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-2.5 py-2 text-[11px] transition ${
              tab === t.id ? 'border-infer text-infer' : 'border-transparent text-dim hover:text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'Details' && (
          <dl className="space-y-3 text-xs">
            {[
              ['项目', workload.projectName],
              ['优先级', project ? `P${project.priority}` : '—'],
              ['集群', workload.clusterName],
              ['创建人', workload.createdBy],
              ['模型', workload.model],
              ['镜像', workload.image],
              ['策略', strategyLabel(workload.strategy)],
              ['GPU', `${workload.gpuCount}`],
              ['显存', `${workload.memoryGb} GB`],
              ['容器', `${workload.podsRunning} / ${workload.podsRequested}`],
              ['运行时长', formatDuration(workload.durationSec)],
              ['服务地址', workload.endpoint ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                <dt className="text-dim">{k}</dt>
                <dd className="break-all font-mono text-[11px] text-text">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {tab === 'Structure' && <WorkloadStructureView workload={workload} />}

        {tab === 'Pods' && (
          <div className="space-y-2">
            {workload.pods.map((p) => (
              <div key={p.name} className="rounded-xl border border-border bg-void/40 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-mono text-[11px] text-text">{p.name}</div>
                  <span className="rounded-full bg-[rgba(47,99,184,0.1)] px-2 py-0.5 text-[10px] text-infer">
                    {p.status}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-dim">
                  {p.role} · {p.nodePool} / {p.nodeName}
                </div>
                <div className="mt-1 font-mono text-[10px] text-muted">
                  GPU {p.gpuIndices.join(',')} · {p.memoryGb} GB · {p.image.split('/').pop()}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Events' && (
          <div className="space-y-0">
            {workload.events.map((e, i) => (
              <div key={`${e.ts}-${i}`} className="flex gap-3 border-b border-border/60 py-2.5 last:border-0">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-infer" />
                <div>
                  <div className="text-xs text-text">
                    <span className="font-medium">{e.phase}</span>
                    <span className="ml-2 font-mono text-[10px] text-dim">
                      {new Date(e.ts).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">{e.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Metrics' && (
          <div className="grid grid-cols-2 gap-2">
            <Metric label="时延" value={workload.latencyMs ? `${workload.latencyMs} ms` : '—'} />
            <Metric label="吞吐" value={workload.tokensPerSec ? `${workload.tokensPerSec} tok/s` : '—'} />
            <Metric
              label="GPU 占用"
              value={workload.status === 'Running' ? `${Math.min(98, 62 + (workload.gpuCount % 18))}%` : '—'}
            />
            <Metric label="显存申请" value={`${workload.memoryGb} GB`} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={() => openScheduleFlow(workload.id)}
          className="flex items-center justify-center gap-1.5 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2 py-2 text-[11px] font-medium text-infer hover:bg-[#e3ecfa]"
        >
          <Share2 className="h-3.5 w-3.5" />
          查看调度流程
        </button>
        <div className="flex gap-2">
          {workload.status === 'Pending' ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/queues')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-2 py-2 text-[11px] text-muted hover:text-infer"
              >
                <ListOrdered className="h-3.5 w-3.5" />
                打开队列
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelQueue(workload.id)
                  onClose()
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-alert/30 px-2 py-2 text-[11px] text-alert hover:bg-alert/10"
              >
                <Square className="h-3.5 w-3.5" />
                取消排队
              </button>
            </>
          ) : null}
          {workload.status === 'Failed' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  selectWorkload(workload.id)
                  navigate('/queues')
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-2 py-2 text-[11px] text-muted hover:text-infer"
              >
                <ListOrdered className="h-3.5 w-3.5" />
                查看队列
              </button>
              <button
                type="button"
                onClick={() => retryFailed(workload.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2 py-2 text-[11px] font-medium text-infer hover:bg-[#e3ecfa]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重试
              </button>
            </>
          ) : null}
          {workload.status === 'Running' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  selectWorkload(workload.id)
                  navigate('/monitor')
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-2 py-2 text-[11px] text-muted hover:text-infer"
              >
                <Crosshair className="h-3.5 w-3.5" />
                定位到总览
              </button>
              <button
                type="button"
                onClick={() => stop(workload.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-alert/30 px-2 py-2 text-[11px] text-alert hover:bg-alert/10"
              >
                <Square className="h-3.5 w-3.5" />
                停止
              </button>
            </>
          ) : null}
          {workload.status !== 'Running' && workload.status !== 'Pending' && workload.status !== 'Failed' ? (
            <button
              type="button"
              onClick={() => openScheduleFlow(workload.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border px-2 py-2 text-[11px] text-muted hover:text-infer"
            >
              <Share2 className="h-3.5 w-3.5" />
              回看调度
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-void/50 px-3 py-2.5">
      <div className="text-[10px] text-dim">{label}</div>
      <div className="metric-num mt-1 text-[18px] leading-none text-text">{value}</div>
    </div>
  )
}
