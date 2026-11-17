import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ConfirmDialog,
  DataTable,
  Drawer,
  Field,
  GhostButton,
  PageFrame,
  PrimaryButton,
  StatusPill,
  TextInput,
} from '../../components/console/ui'
import {
  ASSET_META,
  ASSET_SEED,
  type AssetKind,
  type AssetRow,
  type WorkloadTemplateType,
} from '../../platform/model'

const KINDS = new Set<AssetKind>(['templates', 'environments', 'compute', 'datasources', 'credentials'])

const TYPE_LABEL: Record<WorkloadTemplateType, string> = {
  Inference: '推理',
  Training: '训练',
  Workspace: '工作空间',
}

const DEFAULT_TEMPLATE_YAML = `apiVersion: serving.fathompeak.cn/v1alpha1
kind: InferenceService
metadata:
  name: \${WORKLOAD_NAME}
  namespace: \${NAMESPACE}
spec:
  runtime: vllm
  image: registry.fathompeak.cn/serving/vllm:0.6.3
  resources:
    requests:
      nvidia.com/gpu: "1"
      cpu: "8"
      memory: 32Gi
  scheduling:
    schedulerName: volcano
`

function formatTime(ts?: number) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

export function AssetPage() {
  const { kind = 'templates' } = useParams()
  const assetKind: AssetKind = KINDS.has(kind as AssetKind) ? (kind as AssetKind) : 'templates'
  const meta = ASSET_META[assetKind]
  const [rows, setRows] = useState<AssetRow[]>(ASSET_SEED)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AssetRow | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const [apiVersion, setApiVersion] = useState('serving.fathompeak.cn/v1alpha1')
  const [k8sKind, setK8sKind] = useState('InferenceService')
  const [workloadType, setWorkloadType] = useState<WorkloadTemplateType>('Inference')
  const [version, setVersion] = useState('v0.1.0')
  const [namespace, setNamespace] = useState('fp-serving')
  const [image, setImage] = useState('')
  const [schedulerName, setSchedulerName] = useState('volcano')
  const [yaml, setYaml] = useState(DEFAULT_TEMPLATE_YAML)

  const isTemplate = assetKind === 'templates'

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.kind === assetKind &&
          (!query.trim() ||
            row.name.toLowerCase().includes(query.trim().toLowerCase()) ||
            row.detail.toLowerCase().includes(query.trim().toLowerCase()) ||
            (row.apiVersion ?? '').toLowerCase().includes(query.trim().toLowerCase()) ||
            (row.k8sKind ?? '').toLowerCase().includes(query.trim().toLowerCase()) ||
            (row.image ?? '').toLowerCase().includes(query.trim().toLowerCase())),
      ),
    [assetKind, query, rows],
  )

  const confirmTarget = rows.find((row) => row.id === confirmId) ?? null

  const openCreate = () => {
    setEditing(null)
    setName('')
    setDetail('')
    setApiVersion('serving.fathompeak.cn/v1alpha1')
    setK8sKind('InferenceService')
    setWorkloadType('Inference')
    setVersion('v0.1.0')
    setNamespace('fp-serving')
    setImage('registry.fathompeak.cn/serving/vllm:0.6.3')
    setSchedulerName('volcano')
    setYaml(DEFAULT_TEMPLATE_YAML)
    setOpen(true)
  }

  const openEdit = (row: AssetRow) => {
    setEditing(row)
    setName(row.name)
    setDetail(row.detail)
    setApiVersion(row.apiVersion ?? 'serving.fathompeak.cn/v1alpha1')
    setK8sKind(row.k8sKind ?? 'InferenceService')
    setWorkloadType(row.workloadType ?? 'Inference')
    setVersion(row.version ?? 'v0.1.0')
    setNamespace(row.namespace ?? 'fp-serving')
    setImage(row.image ?? '')
    setSchedulerName(row.schedulerName ?? 'volcano')
    setYaml(row.yaml ?? DEFAULT_TEMPLATE_YAML)
    setOpen(true)
  }

  const saveRow = () => {
    if (!name.trim()) return
    if (isTemplate) {
      const next: AssetRow = {
        id: editing?.id ?? `tpl-${Date.now()}`,
        name: name.trim(),
        kind: 'templates',
        scope: editing?.scope ?? '项目 · 当前作用域',
        detail: detail.trim() || `${schedulerName} · ${k8sKind}`,
        status: editing?.status ?? '可用',
        apiVersion: apiVersion.trim(),
        k8sKind: k8sKind.trim(),
        workloadType,
        version: version.trim() || 'v0.1.0',
        namespace: namespace.trim() || 'default',
        image: image.trim(),
        schedulerName: schedulerName.trim() || 'default-scheduler',
        yaml: yaml.trim() || DEFAULT_TEMPLATE_YAML,
        updatedAt: Date.now(),
      }
      setRows((prev) => (editing ? prev.map((item) => (item.id === editing.id ? next : item)) : [next, ...prev]))
    } else if (editing) {
      setRows((prev) =>
        prev.map((item) =>
          item.id === editing.id ? { ...item, name: name.trim(), detail: detail.trim() || item.detail } : item,
        ),
      )
    } else {
      setRows((prev) => [
        {
          id: `${assetKind}-${Date.now()}`,
          name: name.trim(),
          kind: assetKind,
          scope: '项目 · 当前作用域',
          detail: detail.trim() || '自定义',
          status: '可用',
        },
        ...prev,
      ])
    }
    setOpen(false)
  }

  const templateColumns = [
    {
      key: 'name',
      header: '模板',
      render: (row: AssetRow) => (
        <div>
          <div className="font-medium text-text">{row.name}</div>
          <div className="font-mono text-[11px] text-dim">{row.version ?? '—'}</div>
        </div>
      ),
    },
    {
      key: 'crd',
      header: 'API / Kind',
      render: (row: AssetRow) => (
        <div className="max-w-[220px]">
          <div className="truncate font-mono text-[11px] text-text">{row.apiVersion}</div>
          <div className="text-[12px] text-muted">{row.k8sKind}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: '类型',
      render: (row: AssetRow) => (row.workloadType ? TYPE_LABEL[row.workloadType] : '—'),
    },
    {
      key: 'image',
      header: '镜像',
      render: (row: AssetRow) => (
        <span className="block max-w-[240px] truncate font-mono text-[11px]" title={row.image}>
          {row.image ?? '—'}
        </span>
      ),
    },
    {
      key: 'sched',
      header: '调度器',
      render: (row: AssetRow) => <span className="font-mono text-[12px]">{row.schedulerName ?? '—'}</span>,
    },
    { key: 'scope', header: '作用域', render: (row: AssetRow) => row.scope },
    {
      key: 'detail',
      header: '资源摘要',
      render: (row: AssetRow) => <span className="text-[12px]">{row.detail}</span>,
    },
    {
      key: 'status',
      header: '状态',
      render: (row: AssetRow) => (
        <StatusPill tone={row.status.includes('停') ? 'neutral' : 'ok'}>{row.status}</StatusPill>
      ),
    },
    {
      key: 'ops',
      header: '操作',
      render: (row: AssetRow) => (
        <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
            onClick={() => openEdit(row)}
          >
            查看 / 编辑
          </button>
          <button
            type="button"
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
            onClick={() =>
              setRows((prev) =>
                prev.map((item) =>
                  item.id === row.id ? { ...item, status: item.status === '可用' ? '停用' : '可用' } : item,
                ),
              )
            }
          >
            {row.status === '停用' ? '启用' : '停用'}
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
  ]

  const genericColumns = [
    { key: 'name', header: '名称', render: (row: AssetRow) => <span className="font-medium text-text">{row.name}</span> },
    { key: 'scope', header: '作用域', render: (row: AssetRow) => row.scope },
    { key: 'detail', header: '规格', render: (row: AssetRow) => <span className="font-mono text-[12px]">{row.detail}</span> },
    {
      key: 'status',
      header: '状态',
      render: (row: AssetRow) => (
        <StatusPill tone={row.status.includes('停') || row.status.includes('失效') ? 'neutral' : 'ok'}>
          {row.status}
        </StatusPill>
      ),
    },
    {
      key: 'ops',
      header: '操作',
      render: (row: AssetRow) => (
        <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
            onClick={() => openEdit(row)}
          >
            编辑
          </button>
          <button
            type="button"
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
            onClick={() =>
              setRows((prev) =>
                prev.map((item) =>
                  item.id === row.id
                    ? {
                        ...item,
                        status:
                          item.status === '可用' || item.status === '已绑定' || item.status === '有效' ? '停用' : '可用',
                      }
                    : item,
                ),
              )
            }
          >
            {row.status === '停用' ? '启用' : '停用'}
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
  ]

  return (
    <PageFrame
      kicker={meta.kicker}
      title={meta.title}
      description={meta.description}
      actions={<PrimaryButton onClick={openCreate}>新建</PrimaryButton>}
    >
      <DataTable
        rows={visible}
        onRow={isTemplate ? openEdit : undefined}
        toolbar={
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder={isTemplate ? '搜索模板、API、Kind 或镜像' : `搜索${meta.title}`}
            className="w-72"
          />
        }
        columns={isTemplate ? templateColumns : genericColumns}
      />

      {open ? (
        <Drawer
          title={`${editing ? (isTemplate ? '查看 / 编辑' : '编辑') : '新建'}${meta.title}`}
          size={isTemplate ? 'xl' : 'md'}
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton onClick={saveRow}>{editing ? '保存' : '创建'}</PrimaryButton>
            </>
          }
        >
          {isTemplate ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={meta.nameLabel}>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="inference-vllm"
                    className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
                  />
                </Field>
                <Field label="版本">
                  <input
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="apiVersion">
                  <input
                    value={apiVersion}
                    onChange={(event) => setApiVersion(event.target.value)}
                    className="h-8 rounded-md border border-border px-2 font-mono text-[12px]"
                  />
                </Field>
                <Field label="kind">
                  <input
                    value={k8sKind}
                    onChange={(event) => setK8sKind(event.target.value)}
                    className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="工作负载类型">
                  <select
                    value={workloadType}
                    onChange={(event) => setWorkloadType(event.target.value as WorkloadTemplateType)}
                    className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
                  >
                    <option value="Inference">推理</option>
                    <option value="Training">训练</option>
                    <option value="Workspace">工作空间</option>
                  </select>
                </Field>
                <Field label="默认命名空间">
                  <input
                    value={namespace}
                    onChange={(event) => setNamespace(event.target.value)}
                    className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="镜像">
                  <input
                    value={image}
                    onChange={(event) => setImage(event.target.value)}
                    className="h-8 rounded-md border border-border px-2 font-mono text-[12px]"
                  />
                </Field>
                <Field label="schedulerName">
                  <input
                    value={schedulerName}
                    onChange={(event) => setSchedulerName(event.target.value)}
                    className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
                  />
                </Field>
              </div>
              <Field label="资源 / 调度摘要">
                <input
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder="8 GPU · TP · volcano"
                  className="h-8 rounded-md border border-border px-2 text-[13px]"
                />
              </Field>
              {editing?.updatedAt ? (
                <div className="text-[11px] text-dim">最近更新 · {formatTime(editing.updatedAt)}</div>
              ) : null}
              <Field label="Kubernetes 清单（支持 ${WORKLOAD_NAME} / ${NAMESPACE} / ${MODEL_NAME} 等变量）">
                <textarea
                  value={yaml}
                  onChange={(event) => setYaml(event.target.value)}
                  spellCheck={false}
                  className="min-h-[360px] rounded-md border border-border bg-[#f7f8fb] px-3 py-2 font-mono text-[11px] leading-relaxed text-text outline-none focus:border-[rgba(47,99,184,0.45)]"
                />
              </Field>
            </div>
          ) : (
            <div className="grid gap-3">
              <Field label={meta.nameLabel}>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-8 rounded-md border border-border px-2 text-[13px]"
                />
              </Field>
              <Field label="说明">
                <input
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  className="h-8 rounded-md border border-border px-2 text-[13px]"
                />
              </Field>
            </div>
          )}
        </Drawer>
      ) : null}

      {confirmTarget ? (
        <ConfirmDialog
          title={`删除 ${confirmTarget.name}`}
          message="删除后提交工作负载将无法再引用该资产。历史任务不受影响。"
          confirmLabel="删除"
          danger
          onConfirm={() => setRows((prev) => prev.filter((row) => row.id !== confirmTarget.id))}
          onClose={() => setConfirmId(null)}
        />
      ) : null}
    </PageFrame>
  )
}
