import { useState } from 'react'
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
  ACCESS_RULES,
  ACCESS_USERS,
  ROLES,
  SERVICE_ACCOUNTS,
  type AccessRule,
  type AccessUser,
  type ServiceAccount,
} from '../../platform/model'
import { useApp } from '../../store/AppContext'

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

export function UsersPage() {
  const [users, setUsers] = useState<AccessUser[]>(ACCESS_USERS)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const visible = users.filter((user) => !query.trim() || user.email.includes(query.trim()) || user.name.includes(query.trim()))
  const confirmTarget = users.find((user) => user.id === confirmId) ?? null

  return (
    <PageFrame
      kicker="访问"
      title="用户"
      description="本地用户和身份提供方同步过来的用户。权限不直接写在用户上，而是通过访问规则把角色授到某个作用域。"
      actions={<PrimaryButton onClick={() => setOpen(true)}>邀请用户</PrimaryButton>}
    >
      <DataTable
        rows={visible}
        toolbar={<TextInput value={query} onChange={setQuery} placeholder="搜索姓名或邮箱" className="w-64" />}
        columns={[
          { key: 'name', header: '用户', render: (row) => <span className="font-medium text-text">{row.name}</span> },
          { key: 'email', header: '邮箱', render: (row) => <span className="font-mono text-[12px]">{row.email}</span> },
          { key: 'type', header: '类型', render: (row) => row.type },
          {
            key: 'status',
            header: '状态',
            render: (row) => <StatusPill tone={row.status === '启用' ? 'ok' : 'warn'}>{row.status}</StatusPill>,
          },
          {
            key: 'ops',
            header: '操作',
            render: (row) => (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
                  onClick={() =>
                    setUsers((prev) =>
                      prev.map((user) =>
                        user.id === row.id
                          ? { ...user, status: user.status === '启用' ? '邀请中' : '启用' }
                          : user,
                      ),
                    )
                  }
                >
                  {row.status === '启用' ? '停用' : '启用'}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-alert/25 px-2 py-0.5 text-[11px] text-alert"
                  onClick={() => setConfirmId(row.id)}
                >
                  移除
                </button>
              </div>
            ),
          },
        ]}
      />
      {open ? (
        <Drawer
          title="邀请用户"
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!email.includes('@')) return
                  setUsers((prev) => [
                    ...prev,
                    { id: `u-${Date.now()}`, name: email.split('@')[0], email, type: 'SSO', status: '邀请中' },
                  ])
                  setEmail('')
                  setOpen(false)
                }}
              >
                发送邀请
              </PrimaryButton>
            </>
          }
        >
          <Field label="邮箱">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@fathompeak.cn"
              className="h-8 rounded-md border border-border px-2 text-[13px]"
            />
          </Field>
        </Drawer>
      ) : null}
      {confirmTarget ? (
        <ConfirmDialog
          title={`移除用户 ${confirmTarget.name}`}
          message="移除后该用户将无法登录控制台，已有访问规则需另行清理。"
          confirmLabel="移除"
          danger
          onConfirm={() => setUsers((prev) => prev.filter((user) => user.id !== confirmTarget.id))}
          onClose={() => setConfirmId(null)}
        />
      ) : null}
    </PageFrame>
  )
}

export function AccessRulesPage() {
  const [rules, setRules] = useState<AccessRule[]>(ACCESS_RULES)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ subject: '', role: ROLES[2].name, scope: '项目 · 算法预研专项' })

  return (
    <PageFrame
      kicker="访问"
      title="访问规则"
      description="一条访问规则是：某个用户、SSO 组或服务账号，在一个作用域里担任一个角色。"
      actions={<PrimaryButton onClick={() => setOpen(true)}>新建访问规则</PrimaryButton>}
    >
      <DataTable
        rows={rules}
        columns={[
          { key: 'type', header: '类型', render: (row) => row.subjectType },
          { key: 'subject', header: '主体', render: (row) => <span className="font-mono text-[12px]">{row.subject}</span> },
          { key: 'role', header: '角色', render: (row) => row.role },
          { key: 'scope', header: '作用域', render: (row) => row.scope },
          {
            key: 'ops',
            header: '操作',
            render: (row) => (
              <button
                type="button"
                className="rounded-full border border-alert/25 px-2 py-0.5 text-[11px] text-alert"
                onClick={() => setRules((prev) => prev.filter((item) => item.id !== row.id))}
              >
                撤销
              </button>
            ),
          },
        ]}
      />
      {open ? (
        <Drawer
          title="新建访问规则"
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!draft.subject.trim()) return
                  setRules((prev) => [
                    {
                      id: `ar-${Date.now()}`,
                      subject: draft.subject.trim(),
                      subjectType: '用户',
                      role: draft.role,
                      scope: draft.scope,
                    },
                    ...prev,
                  ])
                  setOpen(false)
                }}
              >
                授权
              </PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="用户邮箱">
              <input
                value={draft.subject}
                onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="角色">
              <select
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              >
                {ROLES.map((role) => (
                  <option key={role.id}>{role.name}</option>
                ))}
              </select>
            </Field>
            <Field label="作用域">
              <input
                value={draft.scope}
                onChange={(event) => setDraft({ ...draft, scope: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
          </div>
        </Drawer>
      ) : null}
    </PageFrame>
  )
}

export function ServiceAccountsPage() {
  const [rows, setRows] = useState<ServiceAccount[]>(SERVICE_ACCOUNTS)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '', scope: '项目 · 算法预研专项', role: ROLES[2].name })

  return (
    <PageFrame
      kicker="访问"
      title="服务账号"
      description="供调度器、CI 与财务导出等机器身份使用。令牌只在创建时展示一次，列表里只保留脱敏提示。"
      actions={<PrimaryButton onClick={() => setOpen(true)}>新建服务账号</PrimaryButton>}
    >
      <DataTable
        rows={rows}
        columns={[
          { key: 'name', header: '名称', render: (row) => <span className="font-medium text-text">{row.name}</span> },
          { key: 'description', header: '用途', render: (row) => row.description },
          { key: 'scope', header: '作用域', render: (row) => row.scope },
          { key: 'role', header: '角色', render: (row) => row.role },
          { key: 'token', header: '令牌', render: (row) => <span className="font-mono text-[12px]">{row.tokenHint}</span> },
          {
            key: 'lastUsed',
            header: '最近使用',
            render: (row) => <span className="font-mono text-[12px]">{formatTime(row.lastUsedAt)}</span>,
          },
          {
            key: 'status',
            header: '状态',
            render: (row) => <StatusPill tone={row.status === '启用' ? 'ok' : 'neutral'}>{row.status}</StatusPill>,
          },
        ]}
      />
      {open ? (
        <Drawer
          title="新建服务账号"
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!draft.name.trim()) return
                  setRows((prev) => [
                    {
                      id: `sa-${Date.now()}`,
                      name: draft.name.trim(),
                      description: draft.description.trim() || '自动化集成',
                      scope: draft.scope,
                      role: draft.role,
                      tokenHint: `sa_fp_••••${Math.random().toString(36).slice(2, 6)}`,
                      lastUsedAt: Date.now(),
                      status: '启用',
                    },
                    ...prev,
                  ])
                  setOpen(false)
                  setDraft({ name: '', description: '', scope: '项目 · 算法预研专项', role: ROLES[2].name })
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
                placeholder="ci-pipeline"
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="用途">
              <input
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="角色">
              <select
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              >
                {ROLES.map((role) => (
                  <option key={role.id}>{role.name}</option>
                ))}
              </select>
            </Field>
            <Field label="作用域">
              <input
                value={draft.scope}
                onChange={(event) => setDraft({ ...draft, scope: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
          </div>
        </Drawer>
      ) : null}
    </PageFrame>
  )
}

export function RolesPage() {
  return (
    <PageFrame
      kicker="访问"
      title="角色"
      description="预置角色对应一组权限。自定义角色需要同时带上界面读权限，否则无法进入控制台。"
    >
      <DataTable
        rows={ROLES}
        columns={[
          { key: 'name', header: '角色', render: (row) => <span className="font-medium text-text">{row.name}</span> },
          {
            key: 'builtin',
            header: '类型',
            render: (row) => <StatusPill tone="neutral">{row.builtin ? '预置' : '自定义'}</StatusPill>,
          },
          { key: 'summary', header: '权限', render: (row) => row.summary },
        ]}
      />
    </PageFrame>
  )
}

export function MyAccessPage() {
  const { state } = useApp()
  const mine = ACCESS_RULES.filter((rule) => rule.subject === state.user)
  return (
    <PageFrame kicker="访问" title="我的权限" description={`${state.user} · ${state.role}`}>
      <DataTable
        rows={mine.length ? mine : ACCESS_RULES.filter((rule) => rule.role === '系统管理员')}
        columns={[
          { key: 'role', header: '角色', render: (row) => row.role },
          { key: 'scope', header: '作用域', render: (row) => row.scope },
          { key: 'subject', header: '主体', render: (row) => row.subject },
        ]}
      />
    </PageFrame>
  )
}
