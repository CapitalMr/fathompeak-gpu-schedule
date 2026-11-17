import { useMemo, useState } from 'react'
import {
  DataTable,
  Drawer,
  Field,
  FilterSelect,
  GhostButton,
  PageFrame,
  PrimaryButton,
  StatusPill,
} from '../components/console/ui'

type AlertChannel = '控制台' | '邮件' | 'Webhook'
type RuleKind = 'gpu' | 'node' | 'network' | 'quota' | 'power' | 'schedule'

type AlertRule = {
  id: string
  name: string
  kind: RuleKind
  metric: string
  operator: '>' | '>=' | '<' | '<='
  threshold: string
  duration: string
  severity: '严重' | '警告' | '提示'
  channels: AlertChannel[]
  enabled: boolean
  scope: string
}

const KIND_LABEL: Record<RuleKind, string> = {
  gpu: 'GPU',
  node: '节点',
  network: '网络',
  quota: '配额',
  power: '算电',
  schedule: '调度',
}

const SEED: AlertRule[] = [
  {
    id: 'rule-gpu-temp',
    name: 'GPU 温度过高',
    kind: 'gpu',
    metric: 'gpu.temperature',
    operator: '>=',
    threshold: '82°C',
    duration: '持续 3 分钟',
    severity: '警告',
    channels: ['控制台', '邮件'],
    enabled: true,
    scope: '全部集群',
  },
  {
    id: 'rule-gpu-xid',
    name: 'GPU Xid / ECC 故障',
    kind: 'gpu',
    metric: 'gpu.xid.count',
    operator: '>',
    threshold: '0',
    duration: '立即',
    severity: '严重',
    channels: ['控制台', '邮件', 'Webhook'],
    enabled: true,
    scope: '全部集群',
  },
  {
    id: 'rule-node-offline',
    name: '节点离线',
    kind: 'node',
    metric: 'node.ready',
    operator: '<',
    threshold: '1',
    duration: '持续 2 分钟',
    severity: '严重',
    channels: ['控制台', 'Webhook'],
    enabled: true,
    scope: '全部集群',
  },
  {
    id: 'rule-rdma',
    name: 'RDMA / 互联降级',
    kind: 'network',
    metric: 'fabric.link_health',
    operator: '<',
    threshold: '0.95',
    duration: '持续 5 分钟',
    severity: '警告',
    channels: ['控制台'],
    enabled: true,
    scope: '全部节点池',
  },
  {
    id: 'rule-quota',
    name: '项目超分逼近上限',
    kind: 'quota',
    metric: 'project.gpu_alloc_ratio',
    operator: '>=',
    threshold: '90%',
    duration: '持续 10 分钟',
    severity: '警告',
    channels: ['控制台', '邮件'],
    enabled: true,
    scope: '全部项目',
  },
  {
    id: 'rule-power',
    name: '电站出力偏低',
    kind: 'power',
    metric: 'station.output_ratio',
    operator: '<',
    threshold: '50%',
    duration: '持续 15 分钟',
    severity: '提示',
    channels: ['控制台'],
    enabled: true,
    scope: '全部电站',
  },
  {
    id: 'rule-pending',
    name: '排队积压',
    kind: 'schedule',
    metric: 'queue.pending_count',
    operator: '>=',
    threshold: '8',
    duration: '持续 5 分钟',
    severity: '警告',
    channels: ['控制台', '邮件'],
    enabled: false,
    scope: '账户',
  },
]

export function AlertConfig() {
  const [rows, setRows] = useState(SEED)
  const [kind, setKind] = useState<'all' | RuleKind>('all')
  const [editing, setEditing] = useState<AlertRule | null>(null)
  const [draft, setDraft] = useState<AlertRule | null>(null)

  const visible = useMemo(
    () => rows.filter((row) => (kind === 'all' ? true : row.kind === kind)),
    [kind, rows],
  )

  const open = (row: AlertRule) => {
    setEditing(row)
    setDraft({ ...row, channels: [...row.channels] })
  }

  const save = () => {
    if (!editing || !draft) return
    setRows((prev) => prev.map((row) => (row.id === editing.id ? draft : row)))
    setEditing(null)
    setDraft(null)
  }

  const toggle = (id: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, enabled: !row.enabled } : row)))
  }

  return (
    <PageFrame
      kicker="治理"
      title="告警配置"
      description="定义触发条件、持续时间和通知渠道。规则生效后，符合条件的事件会出现在告警中心。"
      actions={
        <PrimaryButton
          onClick={() => {
            const blank: AlertRule = {
              id: `rule-${Date.now()}`,
              name: '新建告警规则',
              kind: 'gpu',
              metric: 'gpu.utilization',
              operator: '>=',
              threshold: '95%',
              duration: '持续 5 分钟',
              severity: '警告',
              channels: ['控制台'],
              enabled: true,
              scope: '全部集群',
            }
            setRows((prev) => [blank, ...prev])
            open(blank)
          }}
        >
          新建规则
        </PrimaryButton>
      }
    >
      <div className="mb-3">
        <FilterSelect
          label="类型"
          value={kind}
          onChange={(value) => setKind(value as typeof kind)}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'gpu', label: 'GPU' },
            { value: 'node', label: '节点' },
            { value: 'network', label: '网络' },
            { value: 'quota', label: '配额' },
            { value: 'power', label: '算电' },
            { value: 'schedule', label: '调度' },
          ]}
        />
      </div>

      <DataTable
        rows={visible}
        onRow={open}
        columns={[
          {
            key: 'name',
            header: '规则',
            render: (row) => (
              <div>
                <div className="font-medium text-text">{row.name}</div>
                <div className="font-mono text-[11px] text-dim">{row.metric}</div>
              </div>
            ),
          },
          { key: 'kind', header: '类型', render: (row) => KIND_LABEL[row.kind] },
          {
            key: 'condition',
            header: '条件',
            render: (row) => (
              <span className="font-mono text-[12px]">
                {row.operator} {row.threshold}
              </span>
            ),
          },
          { key: 'duration', header: '持续', render: (row) => row.duration },
          {
            key: 'severity',
            header: '级别',
            render: (row) => (
              <StatusPill tone={row.severity === '严重' ? 'bad' : row.severity === '警告' ? 'warn' : 'neutral'}>
                {row.severity}
              </StatusPill>
            ),
          },
          { key: 'scope', header: '作用范围', render: (row) => row.scope },
          {
            key: 'channels',
            header: '通知',
            render: (row) => row.channels.join(' · '),
          },
          {
            key: 'enabled',
            header: '状态',
            render: (row) => (
              <StatusPill tone={row.enabled ? 'ok' : 'neutral'}>{row.enabled ? '启用' : '停用'}</StatusPill>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[12px] text-infer"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggle(row.id)
                  }}
                >
                  {row.enabled ? '停用' : '启用'}
                </button>
                <button
                  type="button"
                  className="text-[12px] text-infer"
                  onClick={(event) => {
                    event.stopPropagation()
                    open(row)
                  }}
                >
                  编辑
                </button>
              </div>
            ),
          },
        ]}
      />

      {editing && draft ? (
        <Drawer
          title={draft.name}
          onClose={() => {
            setEditing(null)
            setDraft(null)
          }}
          footer={
            <>
              <GhostButton
                onClick={() => {
                  setEditing(null)
                  setDraft(null)
                }}
              >
                取消
              </GhostButton>
              <PrimaryButton onClick={save}>保存</PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="规则名称">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="指标">
              <input
                value={draft.metric}
                onChange={(event) => setDraft({ ...draft, metric: event.target.value })}
                className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="比较">
                <select
                  value={draft.operator}
                  onChange={(event) => setDraft({ ...draft, operator: event.target.value as AlertRule['operator'] })}
                  className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
                >
                  {(['>', '>=', '<', '<='] as const).map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="阈值">
                <input
                  value={draft.threshold}
                  onChange={(event) => setDraft({ ...draft, threshold: event.target.value })}
                  className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
                />
              </Field>
            </div>
            <Field label="持续时间">
              <input
                value={draft.duration}
                onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="级别">
              <select
                value={draft.severity}
                onChange={(event) => setDraft({ ...draft, severity: event.target.value as AlertRule['severity'] })}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              >
                {(['严重', '警告', '提示'] as const).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="作用范围">
              <input
                value={draft.scope}
                onChange={(event) => setDraft({ ...draft, scope: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <div className="grid gap-1.5">
              <span className="text-[12px] text-muted">通知渠道</span>
              {(['控制台', '邮件', 'Webhook'] as AlertChannel[]).map((channel) => (
                <label key={channel} className="flex items-center gap-2 text-[13px] text-text">
                  <input
                    type="checkbox"
                    checked={draft.channels.includes(channel)}
                    onChange={(event) => {
                      setDraft({
                        ...draft,
                        channels: event.target.checked
                          ? [...draft.channels, channel]
                          : draft.channels.filter((item) => item !== channel),
                      })
                    }}
                  />
                  {channel}
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[13px] text-text">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              />
              启用该规则
            </label>
          </div>
        </Drawer>
      ) : null}
    </PageFrame>
  )
}
