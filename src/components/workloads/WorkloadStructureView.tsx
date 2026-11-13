import type { Workload } from '../../types'
import { strategyLabel } from '../../mock/engine'

interface Props {
  workload: Workload
  expanded?: boolean
}

export function WorkloadStructureView({ workload, expanded }: Props) {
  const groups = groupByRole(workload)

  return (
    <div className={`flex flex-col gap-4 ${expanded ? 'min-h-[420px]' : ''}`}>
      <div className="text-[11px] text-dim">
        任务结构 · 根任务 → 工作组 → 容器
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="mx-auto flex min-w-[640px] flex-col items-center gap-3 px-2 py-2">
          {/* Root */}
          <StructureNode
            title={workload.name}
            subtitle={`${workload.type} · ${workload.architecture}`}
            meta={[
              `${workload.gpuCount} GPU`,
              `${workload.memoryGb} GB`,
              `${workload.podsRunning}/${workload.podsRequested} pods`,
            ]}
            accent="root"
            status={workload.status}
          />

          <Connector />

          {/* Endpoint for inference */}
          {workload.endpoint && (
            <>
              <div className="flex w-full items-start justify-center gap-8">
                <div className="flex flex-1 flex-col items-center gap-3">
                  <StageRow groups={groups} />
                </div>
                <div className="flex w-48 flex-col items-center gap-2 pt-1">
                  <div className="h-8 w-px bg-border" />
                  <StructureNode
                    title="Endpoint"
                    subtitle={workload.endpoint}
                    meta={['HTTP/gRPC', 'Ready']}
                    accent="endpoint"
                    status={workload.status}
                  />
                </div>
              </div>
            </>
          )}

          {!workload.endpoint && <StageRow groups={groups} />}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-void/50 p-3 text-[11px] text-muted">
        <div className="mb-1 font-medium text-text">调度语义</div>
        <div>
          {strategyLabel(workload.strategy)} ·{' '}
          {workload.strategy === 'pp'
            ? 'Gang Scheduling 成组锁定全部 PP Stage，防止部分占用以致死锁'
            : workload.strategy === 'tp'
              ? 'NVLink 亲和：同机 Worker 共享高速互联'
              : 'Binpack：优先填入已有碎片节点'}
        </div>
      </div>
    </div>
  )
}

function StageRow({
  groups,
}: {
  groups: { role: string; pods: Workload['pods']; gpu: number; mem: number }[]
}) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-4">
      {groups.map((g, idx) => (
        <div key={g.role} className="flex flex-col items-center gap-2">
          {idx > 0 && groups.length > 1 && (
            <div className="mb-[-6px] hidden text-[10px] text-gang md:block">PP / link</div>
          )}
          <StructureNode
            title={g.role}
            subtitle={`Worker Group · ${g.pods.length} pods`}
            meta={[`${g.gpu} GPU`, `${g.mem} GB`]}
            accent="group"
            status={g.pods.every((p) => p.status === 'Running') ? 'Running' : g.pods[0]?.status}
          />
          <div className="h-6 w-px bg-border" />
          <div className="flex flex-col gap-2">
            {g.pods.map((p) => (
              <StructureNode
                key={p.name}
                title={p.name}
                subtitle={`${p.nodePool} / ${p.nodeName}`}
                meta={[`GPU ${p.gpuIndices.join(',')}`, `${p.memoryGb} GB`]}
                accent="pod"
                status={p.status}
                compact
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Connector() {
  return <div className="h-8 w-px bg-gradient-to-b from-infer/60 to-border" />
}

function StructureNode({
  title,
  subtitle,
  meta,
  accent,
  status,
  compact,
}: {
  title: string
  subtitle: string
  meta: string[]
  accent: 'root' | 'group' | 'pod' | 'endpoint'
  status?: string
  compact?: boolean
}) {
  const border =
    accent === 'root'
      ? 'border-infer/50 shadow-[0_0_0_1px_rgba(47,99,184,0.12)]'
      : accent === 'endpoint'
        ? 'border-infer/40'
        : accent === 'group'
          ? 'border-multi/40'
          : 'border-border'

  return (
    <div
      className={`rounded-lg border bg-panel ${border} ${compact ? 'w-56 px-2.5 py-2' : 'w-64 px-3 py-2.5'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`truncate font-medium text-text ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {title}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-dim">{subtitle}</div>
        </div>
        {status && (
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
              status === 'Running'
                ? 'bg-[rgba(47,99,184,0.12)] text-infer'
                : status === 'Succeeded'
                  ? 'bg-[rgba(61,49,79,0.08)] text-dim'
                  : 'bg-[rgba(138,98,50,0.12)] text-gang'
            }`}
          >
            {status}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {meta.map((m) => (
          <span key={m} className="rounded border border-border bg-void px-1.5 py-0.5 font-mono text-[10px] text-muted">
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}

function groupByRole(workload: Workload) {
  const map = new Map<string, Workload['pods']>()
  workload.pods.forEach((p) => {
    const list = map.get(p.role) ?? []
    list.push(p)
    map.set(p.role, list)
  })
  return Array.from(map.entries()).map(([role, pods]) => ({
    role,
    pods,
    gpu: pods.reduce((n, p) => n + p.gpuRequest, 0),
    mem: pods.reduce((n, p) => n + p.memoryGb, 0),
  }))
}
