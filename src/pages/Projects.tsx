import { useApp } from '../store/AppContext'

export function Projects() {
  const { state } = useApp()

  return (
    <div className="flex h-full flex-col gap-5 overflow-auto px-8 pb-10 pt-1">
      <div>
        <p className="mb-1 text-[12.5px] text-dim">组织</p>
        <h2 className="text-[32px] leading-none">项目配额</h2>
        <p className="mt-2 text-sm text-muted">保底配额、超分上限与抢占优先级。</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {state.projects.map((p) => {
          const usedPct = Math.min(100, Math.round((p.used / p.overQuota) * 100))
          const guaranteePct = Math.round((p.guaranteed / p.overQuota) * 100)
          const overUsed = p.used > p.guaranteed
          return (
            <div key={p.id} className="rounded-xl border border-border bg-panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-text">{p.name}</div>
                  <div className="text-[11px] text-dim">{p.department}</div>
                </div>
                <div className="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted">
                  P{p.priority}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-[11px] text-muted">
                  <span>已用 / 超分上限</span>
                  <span className="font-mono">
                    {p.used} / {p.overQuota} GPU
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-void">
                  <div
                    className="absolute inset-y-0 left-0 bg-slate-700/80"
                    style={{ width: `${guaranteePct}%` }}
                  />
                  <div
                    className={`absolute inset-y-0 left-0 ${overUsed ? 'bg-gang' : 'bg-infer'}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-dim">
                  <span>保底配额 Guaranteed: {p.guaranteed}</span>
                  <span>{p.preemptible ? '可抢占 Over-quota' : '不可抢占'}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-void/50 p-2 text-center">
                <div>
                  <div className="text-[10px] text-dim">保底</div>
                  <div className="font-mono text-sm text-infer">{p.guaranteed}</div>
                </div>
                <div>
                  <div className="text-[10px] text-dim">已用</div>
                  <div className="font-mono text-sm text-text">{p.used}</div>
                </div>
                <div>
                  <div className="text-[10px] text-dim">余量</div>
                  <div className="font-mono text-sm text-muted">{Math.max(0, p.overQuota - p.used)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-panel p-4">
        <div className="mb-2 text-sm font-medium">配额调度说明</div>
        <ul className="space-y-1.5 text-xs text-muted">
          <li>· Guaranteed Quota：项目组保底卡数，调度器优先保障，不受低优任务挤压。</li>
          <li>· Over-quota：允许在集群空闲时超分使用，但可被更高优先级项目抢占回收。</li>
          <li>· Priority：数值越小优先级越高；算电协同组可在绿电高峰获得额外调度权重。</li>
        </ul>
      </div>
    </div>
  )
}
