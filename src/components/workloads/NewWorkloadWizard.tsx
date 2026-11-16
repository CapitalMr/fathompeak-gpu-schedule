import { useMemo, useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { clusterTitle } from '../../mock/engine'
import { useApp } from '../../store/AppContext'
import type { WorkloadType } from '../../types'

type Kind = 'single' | 'tp4' | 'gang'

const TYPES: Array<{
  type: WorkloadType
  title: string
  desc: string
}> = [
  {
    type: 'Workspace',
    title: '工作空间',
    desc: '交互式开发环境，适合调试与实验',
  },
  {
    type: 'Training',
    title: '训练',
    desc: '标准或分布式训练，适合资源密集的模型开发',
  },
  {
    type: 'Inference',
    title: '推理',
    desc: '模型推理服务，通过接口对外提供服务',
  },
]

const MODELS: Record<WorkloadType, Array<{ model: string; kind: Kind; gpuCount: number; label: string }>> = {
  Inference: [
    { model: 'MiniMax-H3', kind: 'tp4', gpuCount: 4, label: 'RTX 5090 亲和 · TP4' },
    { model: 'Qwen-7B-Chat', kind: 'single', gpuCount: 1, label: 'V100 / 入门卡 · Binpack' },
    { model: 'Qwen2.5-14B', kind: 'single', gpuCount: 1, label: 'V100 / A100 · Binpack' },
    { model: 'Llama-3-70B-Instruct', kind: 'tp4', gpuCount: 4, label: 'H100 / H200 · TP · NVLink' },
    { model: 'DeepSeek-V4', kind: 'gang', gpuCount: 16, label: '昇腾 910B/C · Gang' },
    { model: 'DeepSeek-V3-671B', kind: 'gang', gpuCount: 32, label: '昇腾 / 思元 / H200 · PP' },
    { model: 'InternVL2-40B', kind: 'tp4', gpuCount: 4, label: '思元 590 亲和 · TP' },
    { model: 'GLM-4-9B', kind: 'single', gpuCount: 1, label: 'RTX 5090 / H20 · Binpack' },
  ],
  Training: [
    { model: 'Qwen2.5-14B-SFT', kind: 'tp4', gpuCount: 8, label: 'A800 / A100 · TP8' },
    { model: 'Llama-3-70B-LoRA', kind: 'tp4', gpuCount: 4, label: 'H100 亲和 · LoRA TP4' },
  ],
  Workspace: [
    { model: 'InternVL2-Dev', kind: 'single', gpuCount: 1, label: 'RTX 4060 / V100 · 交互' },
    { model: 'VSCode-MultiGPU', kind: 'tp4', gpuCount: 2, label: '混卡节点 · 2 GPU' },
  ],
}

const STEPS = ['任务类型', '范围', '配置', '确认提交'] as const

interface Props {
  onClose: () => void
  onSubmitted: (workloadId: string) => void
}

export function NewWorkloadWizard({ onClose, onSubmitted }: Props) {
  const { state, createWorkload } = useApp()
  const [step, setStep] = useState(0)
  const [type, setType] = useState<WorkloadType>('Inference')
  const [projectId, setProjectId] = useState(state.projects[0]?.id ?? '')
  const [cluster] = useState('fp-ai-factory-01')
  const [name, setName] = useState('')
  const [modelIdx, setModelIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const models = MODELS[type]
  const selected = models[modelIdx] ?? models[0]
  const project = state.projects.find((p) => p.id === projectId)

  const autoName = useMemo(() => {
    const prefix = type === 'Inference' ? 'inf' : type === 'Training' ? 'train' : 'ws'
    return `${prefix}-${selected.model.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18)}`
  }, [type, selected.model])

  const finalName = name.trim() || autoName

  const canNext =
    step === 0 ||
    (step === 1 && !!projectId) ||
    (step === 2 && !!selected) ||
    step === 3

  const submit = async () => {
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 700))
    createWorkload({
      name: finalName,
      model: selected.model,
      projectId,
      kind: selected.kind,
      gpuCount: selected.gpuCount,
      type,
    })
    setSubmitting(false)
    // select after create — id is newest in list after state update; parent handles via effect/callback
    onSubmitted('__latest__')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(33,32,33,0.28)] p-4 backdrop-blur-[2px]">
      <div className="sheet flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-[0_24px_64px_rgba(47,99,184,0.12)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <div className="text-sm font-semibold">新建工作负载</div>
            <div className="text-[11px] text-dim">创建并提交至调度器</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-dim hover:bg-[rgba(61,49,79,0.06)] hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-border px-5 py-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-[11px]">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] tracking-wide ${
                  i < step
                    ? 'bg-infer text-white'
                    : i === step
                      ? 'border border-infer bg-[#eef3fb] text-infer'
                      : 'border border-border text-dim'
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : String(i + 1).padStart(2, '0')}
              </span>
              <span className={i === step ? 'text-text' : 'text-dim'}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-dim" />}
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <div className="grid gap-3 md:grid-cols-3">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    setType(t.type)
                    setModelIdx(0)
                  }}
                  className={`relative overflow-hidden rounded-xl border p-4 text-left transition ${
                    type === t.type
                      ? 'border-[rgba(47,99,184,0.4)] bg-[#eef3fb]'
                      : 'border-border bg-white/80 hover:border-[rgba(47,99,184,0.28)]'
                  }`}
                >
                  {type === t.type && <span className="absolute inset-y-0 left-0 w-[3px] bg-infer" />}
                  <div className="text-sm font-medium text-text">{t.title}</div>
                  <div className="mt-2 text-[11px] leading-relaxed text-muted">{t.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="mx-auto max-w-lg space-y-4">
              <div>
                <label className="mb-1 block text-[11px] text-dim">电站集群</label>
                <select
                  value={cluster}
                  disabled
                  className="w-full rounded-lg border border-border bg-void px-3 py-2 text-sm"
                >
                  <option value={cluster}>
                    {(() => {
                      const s = state.stations.find((st) => st.id === state.activeStationId)
                      return s ? clusterTitle(s.name) : cluster
                    })()}
                  </option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-dim">项目</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-void px-3 py-2 text-sm outline-none focus:border-infer"
                >
                  {state.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · 已用 {p.used}/{p.overQuota} GPU
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-lg border border-border bg-void/50 p-3 text-[11px] text-muted">
                保底配额 {project?.guaranteed ?? 0} · 超分上限 {project?.overQuota ?? 0} · 优先级 P
                {project?.priority ?? '-'}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mx-auto max-w-xl space-y-4">
              <div>
                <label className="mb-1 block text-[11px] text-dim">任务名称</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={autoName}
                  className="w-full rounded-lg border border-border bg-void px-3 py-2 font-mono text-sm outline-none focus:border-infer"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-dim">架构</label>
                <div className="rounded-lg border border-border bg-void px-3 py-2 text-sm">
                  {selected.kind === 'single' ? '标准' : '分布式'}
                  <span className="ml-2 text-[11px] text-dim">{selected.label}</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-dim">模型与规格</label>
                <div className="space-y-2">
                  {models.map((m, i) => (
                    <button
                      key={m.model}
                      type="button"
                      onClick={() => setModelIdx(i)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        modelIdx === i
                          ? 'border-infer/40 bg-infer/10'
                          : 'border-border bg-void/40 hover:border-border-bright'
                      }`}
                    >
                      <div>
                        <div className="text-text">{m.model}</div>
                        <div className="text-[11px] text-dim">{m.label}</div>
                      </div>
                      <div className="font-mono text-xs text-muted">{m.gpuCount} GPU</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mx-auto max-w-lg space-y-3 rounded-xl border border-border bg-void/40 p-4 text-xs">
              <Row k="类型" v={type === 'Inference' ? '推理' : type === 'Training' ? '训练' : '工作空间'} />
              <Row k="名称" v={finalName} />
              <Row
                k="电站"
                v={(() => {
                  const s = state.stations.find((st) => st.id === state.activeStationId)
                  return s ? clusterTitle(s.name) : cluster
                })()}
              />
              <Row k="项目" v={project?.name ?? ''} />
              <Row k="模型" v={selected.model} />
              <Row k="架构" v={selected.kind === 'single' ? '标准' : '分布式'} />
              <Row k="GPU" v={String(selected.gpuCount)} />
              <Row k="调度" v={selected.label} />
              <div className="pt-2 text-[11px] text-dim">
                提交后将进入排队、调度、运行，并可在结构视图查看任务拓扑。
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="rounded-md border border-border px-3 py-2 text-xs text-muted hover:text-text"
          >
            {step === 0 ? '取消' : '上一步'}
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => s + 1)}
              className="h-9 rounded-full bg-black px-4 text-[13px] font-medium text-white disabled:opacity-40"
            >
              继续
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="h-9 rounded-full bg-black px-4 text-[13px] font-medium text-white hover:bg-[#424242] disabled:opacity-60"
            >
              {submitting ? '提交中…' : '创建工作负载'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-dim">{k}</span>
      <span className="text-right font-mono text-text">{v}</span>
    </div>
  )
}
