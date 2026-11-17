import { useMemo, useState } from 'react'
import {
  ConfirmDialog,
  DataTable,
  Drawer,
  Field,
  GhostButton,
  PageFrame,
  PrimaryButton,
  QuotaBar,
  StatusPill,
  TextInput,
} from '../components/console/ui'
import { departmentByName } from '../platform/model'
import { usePlatformScope } from '../platform/useScope'
import { useApp } from '../store/AppContext'
import type { ProjectQuota } from '../types'

type Draft = {
  guaranteed: number
  overQuota: number
  priority: number
  preemptible: boolean
  weight: number
  cpuCores: number
}

type CreateDraft = {
  name: string
  department: string
  guaranteed: number
  overQuota: number
  priority: number
  preemptible: boolean
}

export function Projects() {
  const { state, settings, updateProject, setProjectMeta, createProject, deleteProject } = useApp()
  const { projects, workloads, metaFor } = usePlatformScope()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ProjectQuota | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [creating, setCreating] = useState(false)
  const [createDraft, setCreateDraft] = useState<CreateDraft>({
    name: '',
    department: state.departments[0]?.name ?? '',
    guaranteed: 8,
    overQuota: 16,
    priority: 3,
    preemptible: true,
  })
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const rows = useMemo(() => {
    const q = query.trim()
    return projects.filter((project) => !q || project.name.includes(q) || project.department.includes(q))
  }, [projects, query])

  const open = (project: ProjectQuota) => {
    const meta = metaFor(project.id, project.priority)
    setEditing(project)
    setError('')
    setDraft({
      guaranteed: project.guaranteed,
      overQuota: project.overQuota,
      priority: project.priority,
      preemptible: project.preemptible,
      weight: meta.weight,
      cpuCores: meta.cpuCores,
    })
  }

  const save = () => {
    if (!editing || !draft) return
    const department = departmentByName(editing.department, state.departments)
    if (settings.limitProjectQuota && department && draft.overQuota > department.gpuQuota) {
      setError(`超分上限不能超过部门配额 ${department.gpuQuota} GPU`)
      return
    }
    if (draft.guaranteed > draft.overQuota) {
      setError('保底配额不能高于超分上限')
      return
    }
    updateProject(editing.id, {
      guaranteed: draft.guaranteed,
      overQuota: draft.overQuota,
      priority: draft.priority,
      preemptible: draft.preemptible,
    })
    setProjectMeta(editing.id, { weight: draft.weight, cpuCores: draft.cpuCores })
    setEditing(null)
  }

  const confirmTarget = rows.find((row) => row.id === confirmId) ?? null
  const confirmBusy = confirmTarget
    ? workloads.filter(
        (workload) =>
          workload.projectId === confirmTarget.id && (workload.status === 'Running' || workload.status === 'Pending'),
      ).length
    : 0

  return (
    <PageFrame
      kicker="组织"
      title="项目"
      description="项目是提交工作负载的配额单位。可新建、编辑配额优先级、归档删除。保底优先保障，超分可被更高优先级抢占。"
      actions={
        <PrimaryButton
          onClick={() => {
            setCreateDraft({
              name: '',
              department: state.departments[0]?.name ?? '',
              guaranteed: 8,
              overQuota: 16,
              priority: 3,
              preemptible: true,
            })
            setCreating(true)
            setError('')
          }}
        >
          新建项目
        </PrimaryButton>
      }
    >
      <DataTable
        rows={rows}
        toolbar={<TextInput value={query} onChange={setQuery} placeholder="搜索项目或部门" className="w-64" />}
        onRow={open}
        columns={[
          {
            key: 'name',
            header: '项目',
            render: (row) => (
              <div>
                <div className="font-medium text-text">{row.name}</div>
                <div className="text-[11px] text-dim">{row.department}</div>
              </div>
            ),
          },
          { key: 'pools', header: '节点池', render: () => '全部' },
          {
            key: 'gpu',
            header: 'GPU 已用 / 超分',
            render: (row) => {
              const used = workloads
                .filter((workload) => workload.projectId === row.id && workload.status === 'Running')
                .reduce((sum, workload) => sum + workload.gpuCount, 0)
              return <QuotaBar used={used || row.used} quota={row.overQuota} />
            },
          },
          { key: 'guaranteed', header: '保底', render: (row) => <span className="font-mono">{row.guaranteed}</span> },
          ...(settings.overQuotaWeight
            ? [
                {
                  key: 'weight',
                  header: '超分权重',
                  render: (row: ProjectQuota) => <span className="font-mono">{metaFor(row.id, row.priority).weight}</span>,
                },
              ]
            : []),
          ...(settings.cpuQuota
            ? [
                {
                  key: 'cpu',
                  header: 'CPU 配额',
                  render: (row: ProjectQuota) => (
                    <span className="font-mono">{metaFor(row.id, row.priority).cpuCores} 核</span>
                  ),
                },
              ]
            : []),
          { key: 'priority', header: '优先级', render: (row) => <span className="font-mono">P{row.priority}</span> },
          {
            key: 'preempt',
            header: '抢占',
            render: (row) => (
              <StatusPill tone={row.preemptible ? 'warn' : 'ok'}>{row.preemptible ? '可抢占' : '不可抢占'}</StatusPill>
            ),
          },
          {
            key: 'ops',
            header: '操作',
            render: (row) => (
              <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-infer"
                  onClick={() => open(row)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="rounded-full border border-alert/25 px-2 py-0.5 text-[11px] text-alert"
                  onClick={() => setConfirmId(row.id)}
                >
                  归档
                </button>
              </div>
            ),
          },
        ]}
      />

      {editing && draft ? (
        <Drawer
          title={editing.name}
          onClose={() => setEditing(null)}
          footer={
            <>
              <GhostButton onClick={() => setEditing(null)}>取消</GhostButton>
              <PrimaryButton onClick={save}>保存</PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <p className="text-[12px] text-dim">{editing.department} · 节点池全部</p>
            <Field label="保底 GPU">
              <input
                type="number"
                min={0}
                value={draft.guaranteed}
                onChange={(event) => setDraft({ ...draft, guaranteed: Number(event.target.value) })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="超分上限 GPU">
              <input
                type="number"
                min={0}
                value={draft.overQuota}
                onChange={(event) => setDraft({ ...draft, overQuota: Number(event.target.value) })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            {settings.overQuotaWeight ? (
              <Field label="超分权重">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={draft.weight}
                  onChange={(event) => setDraft({ ...draft, weight: Number(event.target.value) })}
                  className="h-8 rounded-md border border-border px-2 text-[13px]"
                />
              </Field>
            ) : null}
            {settings.cpuQuota ? (
              <Field label="CPU 配额（核）">
                <input
                  type="number"
                  min={0}
                  value={draft.cpuCores}
                  onChange={(event) => setDraft({ ...draft, cpuCores: Number(event.target.value) })}
                  className="h-8 rounded-md border border-border px-2 text-[13px]"
                />
              </Field>
            ) : null}
            <Field label="优先级（数字越小越高）">
              <input
                type="number"
                min={1}
                max={9}
                value={draft.priority}
                onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-text">
              <input
                type="checkbox"
                checked={draft.preemptible}
                onChange={(event) => setDraft({ ...draft, preemptible: event.target.checked })}
              />
              超分部分允许被抢占
            </label>
            {error ? <p className="text-[12px] text-alert">{error}</p> : null}
          </div>
        </Drawer>
      ) : null}

      {creating ? (
        <Drawer
          title="新建项目"
          onClose={() => setCreating(false)}
          footer={
            <>
              <GhostButton onClick={() => setCreating(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!createDraft.name.trim() || !createDraft.department) {
                    setError('请填写项目名称并选择部门')
                    return
                  }
                  const department = departmentByName(createDraft.department, state.departments)
                  if (settings.limitProjectQuota && department && createDraft.overQuota > department.gpuQuota) {
                    setError(`超分上限不能超过部门配额 ${department.gpuQuota} GPU`)
                    return
                  }
                  createProject(createDraft)
                  setCreating(false)
                }}
              >
                创建
              </PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="项目名称">
              <input
                value={createDraft.name}
                onChange={(event) => setCreateDraft({ ...createDraft, name: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="归属部门">
              <select
                value={createDraft.department}
                onChange={(event) => setCreateDraft({ ...createDraft, department: event.target.value })}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              >
                {state.departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name} · 配额 {department.gpuQuota}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="保底 GPU">
              <input
                type="number"
                min={0}
                value={createDraft.guaranteed}
                onChange={(event) => setCreateDraft({ ...createDraft, guaranteed: Number(event.target.value) })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="超分上限 GPU">
              <input
                type="number"
                min={0}
                value={createDraft.overQuota}
                onChange={(event) => setCreateDraft({ ...createDraft, overQuota: Number(event.target.value) })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="优先级">
              <input
                type="number"
                min={1}
                max={9}
                value={createDraft.priority}
                onChange={(event) => setCreateDraft({ ...createDraft, priority: Number(event.target.value) })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-text">
              <input
                type="checkbox"
                checked={createDraft.preemptible}
                onChange={(event) => setCreateDraft({ ...createDraft, preemptible: event.target.checked })}
              />
              默认可抢占
            </label>
            {error ? <p className="text-[12px] text-alert">{error}</p> : null}
          </div>
        </Drawer>
      ) : null}

      {confirmTarget ? (
        <ConfirmDialog
          title={`归档项目 ${confirmTarget.name}`}
          message={
            confirmBusy > 0
              ? `仍有 ${confirmBusy} 个运行中或排队任务，请先停止后再归档。`
              : '归档后项目将从配额表移除，历史工作负载仍可在审计中追溯。'
          }
          confirmLabel={confirmBusy > 0 ? '知道了' : '归档项目'}
          danger={confirmBusy === 0}
          onConfirm={() => {
            if (confirmBusy === 0) deleteProject(confirmTarget.id)
          }}
          onClose={() => setConfirmId(null)}
        />
      ) : null}
    </PageFrame>
  )
}
