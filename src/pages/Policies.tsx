import { useState } from 'react'
import { DataTable, Drawer, Field, GhostButton, PageFrame, PrimaryButton, StatusPill, TextInput } from '../components/console/ui'
import { WORKLOAD_POLICIES, type WorkloadPolicy } from '../platform/model'
import { useApp } from '../store/AppContext'

const SOURCES = ['系统', '集群', '部门', '项目'] as const

export function Policies() {
  const [rows, setRows] = useState<WorkloadPolicy[]>(WORKLOAD_POLICIES)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', parameter: 'gpu', rule: '', source: '项目' as WorkloadPolicy['source'] })

  const visible = rows.filter((row) => !query.trim() || row.name.includes(query.trim()) || row.parameter.includes(query.trim()))

  return (
    <PageFrame
      kicker="策略"
      title="工作负载策略"
      description="策略约束提交表单里的字段，并给出默认值。下级作用域会继承上级规则，每一行都标出来源。"
      actions={
        <PrimaryButton
          onClick={() => {
            setDraft({ name: '', parameter: 'gpu', rule: '', source: '项目' })
            setOpen(true)
          }}
        >
          新建策略
        </PrimaryButton>
      }
    >
      <div className="mb-3 rounded-xl border border-border bg-white px-3.5 py-2.5 text-[12px] text-muted">
        列表按作用域继承展示 · 新建策略会追加到当前会话，便于演示提交约束链路
      </div>
      <DataTable
        rows={visible}
        toolbar={<TextInput value={query} onChange={setQuery} placeholder="搜索策略或参数" className="w-64" />}
        columns={[
          { key: 'name', header: '策略', render: (row) => <span className="font-medium text-text">{row.name}</span> },
          { key: 'scope', header: '作用域', render: (row) => row.scope },
          { key: 'type', header: '工作负载', render: (row) => row.workloadType },
          { key: 'param', header: '参数', render: (row) => <span className="font-mono text-[12px]">{row.parameter}</span> },
          { key: 'default', header: '默认值', render: (row) => row.defaultValue },
          { key: 'rule', header: '规则', render: (row) => row.rule },
          {
            key: 'source',
            header: '来源',
            render: (row) => <StatusPill tone={row.source === '系统' ? 'neutral' : 'ok'}>{row.source}</StatusPill>,
          },
        ]}
      />
      {open ? (
        <Drawer
          title="新建工作负载策略"
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!draft.name.trim() || !draft.rule.trim()) return
                  setRows((prev) => [
                    {
                      id: `wp-${Date.now()}`,
                      name: draft.name.trim(),
                      scope: '项目 · 当前作用域',
                      workloadType: '全部',
                      parameter: draft.parameter,
                      defaultValue: '—',
                      rule: draft.rule.trim(),
                      source: draft.source,
                    },
                    ...prev,
                  ])
                  setOpen(false)
                }}
              >
                创建
              </PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="名称">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="参数">
              <input
                value={draft.parameter}
                onChange={(event) => setDraft({ ...draft, parameter: event.target.value })}
                className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
              />
            </Field>
            <Field label="规则">
              <input
                value={draft.rule}
                onChange={(event) => setDraft({ ...draft, rule: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="来源">
              <select
                value={draft.source}
                onChange={(event) => setDraft({ ...draft, source: event.target.value as WorkloadPolicy['source'] })}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              >
                {SOURCES.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            </Field>
          </div>
        </Drawer>
      ) : null}
    </PageFrame>
  )
}

const RULE_SCOPE: Record<string, string> = {
  'pol-binpack': '账户',
  'pol-nvlink': '集群 · 全部',
  'pol-gang': '集群 · 全部',
  'pol-mig': '集群 · cls-daxing',
  'pol-green': '集群 · 全部',
  'pol-preempt': '账户',
}

export function SchedulingRules() {
  const { state, togglePolicy } = useApp()
  const enabledCount = state.policies.filter((row) => row.enabled).length
  const [toast, setToast] = useState<string | null>(null)

  return (
    <PageFrame
      kicker="策略"
      title="调度规则"
      description="调度规则决定工作负载怎样放置和让出 GPU：装箱、拓扑亲和、Gang、显存切分、抢占，以及绿电出力权重。"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(47,99,184,0.18)] bg-[#eef3fb] px-3.5 py-3">
        <div>
          <div className="text-[12px] font-medium text-infer">规则生效面</div>
          <p className="mt-0.5 text-[12px] text-muted">
            当前 {enabledCount}/{state.policies.length} 条启用 · 变更会写入审计，并影响后续排队与放置解释
          </p>
        </div>
        {toast ? <div className="rounded-full bg-white px-3 py-1 text-[11px] text-infer shadow-sm">{toast}</div> : null}
      </div>
      <DataTable
        rows={state.policies}
        columns={[
          { key: 'name', header: '规则', render: (row) => <span className="font-medium text-text">{row.name}</span> },
          { key: 'scope', header: '作用域', render: (row) => RULE_SCOPE[row.id] ?? '集群' },
          { key: 'desc', header: '行为', render: (row) => row.description },
          {
            key: 'state',
            header: '状态',
            render: (row) => <StatusPill tone={row.enabled ? 'ok' : 'neutral'}>{row.enabled ? '生效' : '关闭'}</StatusPill>,
          },
          {
            key: 'toggle',
            header: '操作',
            render: (row) => (
              <button
                type="button"
                className="rounded-full border border-[rgba(47,99,184,0.28)] bg-white px-2.5 py-1 text-[11px] font-medium text-infer hover:bg-[#eef3fb]"
                onClick={() => {
                  const next = !row.enabled
                  togglePolicy(row.id)
                  setToast(`已${next ? '启用' : '关闭'}「${row.name}」`)
                  window.setTimeout(() => setToast(null), 2200)
                }}
              >
                {row.enabled ? '关闭' : '启用'}
              </button>
            ),
          },
        ]}
      />
    </PageFrame>
  )
}
