import { ScrollText, ShieldCheck, ToggleLeft } from 'lucide-react'
import { useApp } from '../store/AppContext'

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function policyTag(id: string): { label: string; tone: string } {
  if (id.includes('green')) return { label: '算电', tone: 'text-infer border-[rgba(47,99,184,0.28)] bg-[#eef3fb]' }
  if (id.includes('preempt')) return { label: '抢占', tone: 'text-gang border-[rgba(138,98,50,0.28)] bg-[rgba(138,98,50,0.08)]' }
  if (id.includes('nvlink') || id.includes('gang'))
    return { label: '拓扑', tone: 'text-multi border-[rgba(78,63,102,0.28)] bg-[rgba(78,63,102,0.08)]' }
  if (id.includes('mig')) return { label: '隔离', tone: 'text-muted border-border bg-void' }
  return { label: '装箱', tone: 'text-infer border-[rgba(47,99,184,0.22)] bg-[rgba(47,99,184,0.06)]' }
}

function auditDot(level: 'info' | 'warn' | 'success') {
  if (level === 'success') return 'bg-infer'
  if (level === 'warn') return 'bg-gang'
  return 'bg-multi'
}

export function Policies() {
  const { state, togglePolicy } = useApp()
  const enabled = state.policies.filter((p) => p.enabled).length
  const disabled = state.policies.length - enabled
  const warnAudits = state.audits.filter((a) => a.level === 'warn').length
  const dayAudits = state.audits.length

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto px-8 pb-8 pt-1">
      <div>
        <p className="mb-1 text-[12.5px] text-dim">治理</p>
        <h2 className="text-[28px] leading-none">调度策略</h2>
        <p className="mt-1.5 text-[13px] text-muted">
          拓扑亲和 · 配额抢占 · 算电权重 · 操作审计全程可回溯
        </p>
      </div>

      <div className="sheet grid grid-cols-2 overflow-hidden sm:grid-cols-4">
        {[
          { label: '已启用', value: String(enabled), unit: `/ ${state.policies.length} 条规则` },
          { label: '已关闭', value: String(disabled), unit: '待评估' },
          { label: '近次审计', value: String(dayAudits), unit: '操作记录' },
          { label: '告警级变更', value: String(warnAudits), unit: '需关注' },
        ].map((item, i) => (
          <div key={item.label} className={`grid gap-0.5 px-3 py-3 ${i > 0 ? 'border-l border-border' : ''}`}>
            <span className="text-[11px] text-dim">{item.label}</span>
            <b className="metric-num text-[24px] font-normal leading-none">{item.value}</b>
            <small className="text-[11px] text-dim">{item.unit}</small>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-2">
        <section className="space-y-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <ShieldCheck className="h-3.5 w-3.5 text-dim" />
            <h3 className="text-[13px] font-medium">激活中的调度器规则</h3>
          </div>
          {state.policies.map((p) => {
            const tag = policyTag(p.id)
            return (
              <div
                key={p.id}
                className={`sheet relative overflow-hidden p-3.5 transition ${
                  p.enabled ? 'side-glow' : 'opacity-90'
                }`}
              >
                <div
                  className={`absolute inset-y-0 left-0 w-[3px] ${p.enabled ? 'bg-infer' : 'bg-idle'}`}
                />
                <div className="flex items-start justify-between gap-3 pl-1.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-text">{p.name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${tag.tone}`}>
                        {tag.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          p.enabled
                            ? 'bg-[rgba(47,99,184,0.1)] text-infer'
                            : 'bg-[rgba(61,49,79,0.06)] text-dim'
                        }`}
                      >
                        {p.enabled ? '运行中' : '已停用'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{p.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePolicy(p.id)}
                    aria-label={p.enabled ? '关闭策略' : '启用策略'}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      p.enabled ? 'bg-infer' : 'bg-idle'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                        p.enabled ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
          {disabled > 0 && (
            <div className="rounded-xl border border-dashed border-border px-3.5 py-3 text-[12px] text-dim">
              有 {disabled} 条策略处于关闭状态，评估业务影响后再决定是否重新启用。
            </div>
          )}
        </section>

        <section className="sheet flex min-h-[420px] flex-col overflow-hidden">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-[rgba(248,248,248,0.92)] px-3.5 py-2.5 backdrop-blur">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <ScrollText className="h-3.5 w-3.5 text-dim" />
              操作审计
            </div>
            <span className="font-mono text-[11px] text-dim">{dayAudits} events</span>
          </div>
          <div className="flex-1 space-y-0 overflow-auto p-2">
            {state.audits.map((a) => (
              <div
                key={a.id}
                className="flex gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-[rgba(47,99,184,0.04)]"
              >
                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${auditDot(a.level)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="font-medium text-text">{a.action}</span>
                    <span className="text-dim">→</span>
                    <span className="truncate text-muted">{a.target}</span>
                    {a.level === 'warn' && (
                      <span className="rounded-full border border-[rgba(138,98,50,0.28)] bg-[rgba(138,98,50,0.08)] px-1.5 py-0.5 text-[10px] text-gang">
                        关注
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-dim">{a.detail}</div>
                  <div className="mt-1.5 flex gap-3 font-mono text-[10px] tracking-wide text-dim">
                    <span>{formatTime(a.ts)}</span>
                    <span>{a.actor}</span>
                  </div>
                </div>
              </div>
            ))}
            {state.audits.length === 0 && (
              <div className="grid place-items-center py-16 text-[13px] text-dim">
                <ToggleLeft className="mb-2 h-5 w-5 opacity-50" />
                暂无审计事件
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
