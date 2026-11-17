import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ConfirmDialog,
  DataTable,
  Drawer,
  Field,
  GhostButton,
  PageFrame,
  PrimaryButton,
  QuotaBar,
  TextInput,
} from '../components/console/ui'
import { usePlatformScope } from '../platform/useScope'
import { useApp } from '../store/AppContext'
import type { ManagedDepartment } from '../types'

export function DepartmentsPage() {
  const { state, createDepartment, updateDepartment, deleteDepartment } = useApp()
  const { clusterWorkloads } = usePlatformScope()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedDepartment | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', gpuQuota: 64 })

  const rows = useMemo(() => {
    return state.departments
      .filter((department) => !query.trim() || department.name.includes(query.trim()))
      .map((department) => {
        const projects = state.projects.filter((project) => project.department === department.name)
        const projectIds = new Set(projects.map((project) => project.id))
        const used = clusterWorkloads
          .filter((workload) => projectIds.has(workload.projectId) && workload.status === 'Running')
          .reduce((sum, workload) => sum + workload.gpuCount, 0)
        return {
          ...department,
          projectCount: projects.length,
          used,
        }
      })
  }, [clusterWorkloads, query, state.departments, state.projects])

  const confirmTarget = rows.find((row) => row.id === confirmId) ?? null

  return (
    <PageFrame
      kicker="组织"
      title="部门"
      description="部门是项目的上一级配额。可新建、调整配额与删除；打开「项目配额不得超过部门配额」后，项目超分上限不能高于部门 GPU 配额。"
      actions={
        <PrimaryButton
          onClick={() => {
            setEditing(null)
            setDraft({ name: '', gpuQuota: 64 })
            setOpen(true)
          }}
        >
          新建部门
        </PrimaryButton>
      }
    >
      <DataTable
        rows={rows}
        toolbar={<TextInput value={query} onChange={setQuery} placeholder="搜索部门" className="w-56" />}
        columns={[
          { key: 'name', header: '部门', render: (row) => <span className="font-medium text-text">{row.name}</span> },
          { key: 'projects', header: '项目', render: (row) => row.projectCount },
          { key: 'quota', header: 'GPU 配额', render: (row) => <span className="font-mono">{row.gpuQuota}</span> },
          {
            key: 'used',
            header: '运行中 GPU',
            render: (row) => <QuotaBar used={row.used} quota={row.gpuQuota} />,
          },
          {
            key: 'ratio',
            header: '分配比',
            render: (row) => `${row.gpuQuota ? Math.round((row.used / row.gpuQuota) * 100) : 0}%`,
          },
          {
            key: 'ops',
            header: '操作',
            render: (row) => (
              <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
                  onClick={() => {
                    setEditing(row)
                    setDraft({ name: row.name, gpuQuota: row.gpuQuota })
                    setOpen(true)
                  }}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-infer"
                  onClick={() => navigate('/projects')}
                >
                  项目
                </button>
                <button
                  type="button"
                  className="rounded-full border border-alert/25 px-2 py-0.5 text-[11px] text-alert"
                  onClick={() => setConfirmId(row.id)}
                >
                  删除
                </button>
              </div>
            ),
          },
        ]}
      />

      {open ? (
        <Drawer
          title={editing ? '编辑部门' : '新建部门'}
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!draft.name.trim()) return
                  if (editing) {
                    updateDepartment(editing.id, { name: draft.name.trim(), gpuQuota: Math.max(0, Number(draft.gpuQuota) || 0) })
                  } else {
                    createDepartment({ name: draft.name.trim(), gpuQuota: Math.max(0, Number(draft.gpuQuota) || 0) })
                  }
                  setOpen(false)
                }}
              >
                {editing ? '保存' : '创建'}
              </PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="部门名称">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="GPU 配额">
              <input
                type="number"
                min={0}
                value={draft.gpuQuota}
                onChange={(event) => setDraft({ ...draft, gpuQuota: Number(event.target.value) })}
                className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
              />
            </Field>
          </div>
        </Drawer>
      ) : null}

      {confirmTarget ? (
        <ConfirmDialog
          title={`删除部门 ${confirmTarget.name}`}
          message={
            confirmTarget.projectCount > 0
              ? `仍有 ${confirmTarget.projectCount} 个项目归属该部门，请先迁移或归档项目。`
              : '删除后该组织单元不可用。'
          }
          confirmLabel={confirmTarget.projectCount > 0 ? '知道了' : '删除部门'}
          danger={confirmTarget.projectCount === 0}
          onConfirm={() => {
            if (confirmTarget.projectCount === 0) deleteDepartment(confirmTarget.id)
          }}
          onClose={() => setConfirmId(null)}
        />
      ) : null}
    </PageFrame>
  )
}
