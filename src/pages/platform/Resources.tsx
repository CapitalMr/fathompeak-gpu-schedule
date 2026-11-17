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
  StatusPill,
  TextInput,
} from '../../components/console/ui'
import { useApp } from '../../store/AppContext'
import type { ManagedCluster, NodePool } from '../../types'

function gpuOf(servers: { gpus: { state: string }[] }[]) {
  const gpus = servers.flatMap((server) => server.gpus)
  return {
    total: gpus.length,
    used: gpus.filter((gpu) => gpu.state !== 'idle' && gpu.state !== 'fault').length,
  }
}

function clusterTone(status: ManagedCluster['status']): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (status === 'Connected') return 'ok'
  if (status === 'Connecting') return 'neutral'
  if (status === 'Degraded') return 'warn'
  return 'bad'
}

function clusterLabel(status: ManagedCluster['status']) {
  if (status === 'Connected') return '已连接'
  if (status === 'Connecting') return '连接中'
  if (status === 'Degraded') return '降级'
  return '已下线'
}

function poolTone(status?: NodePool['status']): 'ok' | 'warn' | 'neutral' {
  if (status === 'Ready') return 'ok'
  if (status === 'Draining') return 'warn'
  return 'neutral'
}

function poolLabel(status?: NodePool['status']) {
  if (status === 'Ready') return '就绪'
  if (status === 'Draining') return '排空中'
  return '已停用'
}

export function ClusterListPage() {
  const { state, setActiveStation, createCluster, setClusterStatus, deleteCluster } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    name: '',
    region: '',
    kubernetes: 'v1.29.6',
    endpoint: '',
    stationId: state.stations[0]?.id ?? '',
  })

  const rows = useMemo(() => {
    return state.clusters
      .filter((item) => item.name.includes(query.trim()) || item.region.includes(query.trim()))
      .map((item) => {
        const poolIds = Object.entries(state.poolBindings)
          .filter(([, ids]) => ids.includes(item.id))
          .map(([poolId]) => poolId)
        const servers = state.servers.filter((server) => poolIds.includes(server.poolId))
        const gpu = gpuOf(servers)
        const poolNames = poolIds.map((poolId) => state.pools.find((pool) => pool.id === poolId)?.name ?? poolId)
        return { ...item, nodes: servers.length, gpu, poolNames, poolIds }
      })
  }, [query, state.clusters, state.poolBindings, state.pools, state.servers])

  const confirmTarget = rows.find((row) => row.id === confirmId) ?? null

  return (
    <PageFrame
      kicker="资源"
      title="集群"
      description="纳管各地区 Kubernetes 控制面。可新增连接、重连、降级观察、下线与删除；节点归集群所有，并整池供出到同名节点池。"
      actions={<PrimaryButton onClick={() => setOpen(true)}>纳管集群</PrimaryButton>}
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: '集群总数', value: state.clusters.length },
          { label: '已连接', value: state.clusters.filter((c) => c.status === 'Connected').length },
          { label: '降级/连接中', value: state.clusters.filter((c) => c.status === 'Degraded' || c.status === 'Connecting').length },
          { label: '已下线', value: state.clusters.filter((c) => c.status === 'Offline').length },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-white px-3 py-2.5">
            <div className="text-[11px] text-dim">{item.label}</div>
            <div className="metric-num mt-1 text-[22px] leading-none">{item.value}</div>
          </div>
        ))}
      </div>

      <DataTable
        rows={rows}
        toolbar={<TextInput value={query} onChange={setQuery} placeholder="搜索集群或地区" className="w-56" />}
        columns={[
          {
            key: 'name',
            header: '集群',
            render: (row) => (
              <div>
                <div className="font-medium text-text">{row.name}</div>
                <div className="text-[11px] text-dim">{row.region}</div>
              </div>
            ),
          },
          {
            key: 'status',
            header: '连接',
            render: (row) => <StatusPill tone={clusterTone(row.status)}>{clusterLabel(row.status)}</StatusPill>,
          },
          { key: 'k8s', header: 'Kubernetes', render: (row) => <span className="font-mono text-[12px]">{row.kubernetes}</span> },
          {
            key: 'endpoint',
            header: 'API',
            render: (row) => <span className="font-mono text-[11px] text-dim">{row.endpoint ?? '—'}</span>,
          },
          { key: 'nodes', header: '节点', render: (row) => row.nodes },
          {
            key: 'gpu',
            header: 'GPU 已用 / 总量',
            render: (row) => <QuotaBar used={row.gpu.used} quota={row.gpu.total} />,
          },
          {
            key: 'pools',
            header: '供出节点池',
            render: (row) => row.poolNames.join('、') || '—',
          },
          {
            key: 'ops',
            header: '操作',
            render: (row) => (
              <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                {row.status !== 'Connected' ? (
                  <button
                    type="button"
                    className="rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2 py-0.5 text-[11px] text-infer"
                    onClick={() => {
                      setClusterStatus(row.id, 'Connecting')
                      window.setTimeout(() => setClusterStatus(row.id, 'Connected'), 900)
                    }}
                  >
                    连接
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
                    onClick={() => setClusterStatus(row.id, 'Offline')}
                  >
                    下线
                  </button>
                )}
                {row.status === 'Connected' ? (
                  <button
                    type="button"
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-text"
                    onClick={() => setClusterStatus(row.id, 'Degraded')}
                  >
                    标为降级
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-infer"
                  onClick={() => {
                    setActiveStation(row.stationId)
                    navigate('/energy')
                  }}
                >
                  算电
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
          title="纳管集群"
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!draft.name.trim() || !draft.region.trim()) return
                  createCluster({
                    name: draft.name.trim(),
                    region: draft.region.trim(),
                    kubernetes: draft.kubernetes.trim() || 'v1.29.6',
                    endpoint: draft.endpoint.trim(),
                    stationId: draft.stationId,
                  })
                  setOpen(false)
                  setDraft({ name: '', region: '', kubernetes: 'v1.29.6', endpoint: '', stationId: state.stations[0]?.id ?? '' })
                }}
              >
                开始连接
              </PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="集群名称">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="例如 cls-wuhan"
                className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
              />
            </Field>
            <Field label="地区">
              <input
                value={draft.region}
                onChange={(event) => setDraft({ ...draft, region: event.target.value })}
                placeholder="例如 湖北武汉"
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="API Endpoint">
              <input
                value={draft.endpoint}
                onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
                placeholder="https://api.cls-xxx.fathompeak.cn"
                className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
              />
            </Field>
            <Field label="Kubernetes 版本">
              <input
                value={draft.kubernetes}
                onChange={(event) => setDraft({ ...draft, kubernetes: event.target.value })}
                className="h-8 rounded-md border border-border px-2 font-mono text-[13px]"
              />
            </Field>
            <Field label="关联电站">
              <select
                value={draft.stationId}
                onChange={(event) => setDraft({ ...draft, stationId: event.target.value })}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              >
                {state.stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.name} · {station.region}
                  </option>
                ))}
              </select>
            </Field>
            <p className="rounded-lg border border-border bg-[#f7f8fb] px-3 py-2 text-[12px] text-muted">
              连接成功后，可在「节点池」创建对应供出池，再将节点加入调度域。
            </p>
          </div>
        </Drawer>
      ) : null}

      {confirmTarget ? (
        <ConfirmDialog
          title={`删除集群 ${confirmTarget.name}`}
          message={
            confirmTarget.poolIds.length
              ? `该集群仍绑定节点池（${confirmTarget.poolNames.join('、')}），请先解绑或删除节点池后再删除。`
              : '删除后控制面将不再管理该集群，此操作可在原型中演示，不影响真实环境。'
          }
          confirmLabel={confirmTarget.poolIds.length ? '知道了' : '删除集群'}
          danger={!confirmTarget.poolIds.length}
          onConfirm={() => {
            if (!confirmTarget.poolIds.length) deleteCluster(confirmTarget.id)
          }}
          onClose={() => setConfirmId(null)}
        />
      ) : null}
    </PageFrame>
  )
}

export function NodePoolPage() {
  const { state, createNodePool, setPoolStatus, deleteNodePool } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    name: '',
    region: '',
    clusterId: state.clusters[0]?.id ?? '',
  })

  const rows = state.pools
    .filter((pool) => pool.name.toLowerCase().includes(query.trim().toLowerCase()) || pool.region.includes(query.trim()))
    .map((pool) => {
      const nodes = state.servers.filter((server) => server.poolId === pool.id)
      const gpu = gpuOf(nodes)
      const clusterId = state.poolBindings[pool.id]?.[0] ?? pool.clusterId
      const cluster = state.clusters.find((item) => item.id === clusterId) ?? null
      return {
        ...pool,
        nodes: nodes.length,
        gpu,
        clusterName: cluster?.name ?? '—',
        clusterRegion: cluster?.region ?? pool.region,
        clusterId: clusterId ?? '',
      }
    })

  const confirmTarget = rows.find((row) => row.id === confirmId) ?? null

  return (
    <PageFrame
      kicker="资源"
      title="节点池"
      description="节点池是调度域。可创建、启用/停用、排空与删除；项目配额与工作负载按节点池放置。"
      actions={<PrimaryButton onClick={() => setOpen(true)}>新建节点池</PrimaryButton>}
    >
      <DataTable
        rows={rows}
        toolbar={<TextInput value={query} onChange={setQuery} placeholder="搜索节点池" className="w-56" />}
        columns={[
          {
            key: 'name',
            header: '节点池',
            render: (row) => (
              <button type="button" className="text-left" onClick={() => navigate('/nodes')}>
                <div className="font-medium text-text">{row.name}</div>
                <div className="text-[11px] text-dim">{row.region}</div>
              </button>
            ),
          },
          {
            key: 'status',
            header: '状态',
            render: (row) => <StatusPill tone={poolTone(row.status)}>{poolLabel(row.status)}</StatusPill>,
          },
          {
            key: 'cluster',
            header: '对应集群',
            render: (row) => (
              <div>
                <div className="font-medium text-text">{row.clusterName}</div>
                <div className="text-[11px] text-dim">{row.clusterRegion}</div>
              </div>
            ),
          },
          { key: 'nodes', header: '节点', render: (row) => row.nodes },
          {
            key: 'gpu',
            header: 'GPU 已用 / 总量',
            render: (row) => <QuotaBar used={row.gpu.used} quota={row.gpu.total} />,
          },
          {
            key: 'ops',
            header: '操作',
            render: (row) => (
              <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                {row.status !== 'Ready' ? (
                  <button
                    type="button"
                    className="rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-2 py-0.5 text-[11px] text-infer"
                    onClick={() => setPoolStatus(row.id, 'Ready')}
                  >
                    启用
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
                    onClick={() => setPoolStatus(row.id, 'Disabled')}
                  >
                    停用
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
                  onClick={() => setPoolStatus(row.id, 'Draining')}
                >
                  排空
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted hover:text-infer"
                  onClick={() => navigate('/nodes')}
                >
                  节点
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
          title="新建节点池"
          onClose={() => setOpen(false)}
          footer={
            <>
              <GhostButton onClick={() => setOpen(false)}>取消</GhostButton>
              <PrimaryButton
                onClick={() => {
                  if (!draft.name.trim() || !draft.clusterId) return
                  const cluster = state.clusters.find((item) => item.id === draft.clusterId)
                  createNodePool({
                    name: draft.name.trim(),
                    region: draft.region.trim() || cluster?.region || '未分区',
                    clusterId: draft.clusterId,
                    stationId: cluster?.stationId,
                  })
                  setOpen(false)
                  setDraft({ name: '', region: '', clusterId: state.clusters[0]?.id ?? '' })
                }}
              >
                创建
              </PrimaryButton>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="节点池名称">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="例如 武汉-推理池"
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
            <Field label="绑定集群">
              <select
                value={draft.clusterId}
                onChange={(event) => {
                  const cluster = state.clusters.find((item) => item.id === event.target.value)
                  setDraft({
                    ...draft,
                    clusterId: event.target.value,
                    region: cluster?.region ?? draft.region,
                  })
                }}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              >
                {state.clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.name} · {cluster.region} · {clusterLabel(cluster.status)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="地区">
              <input
                value={draft.region}
                onChange={(event) => setDraft({ ...draft, region: event.target.value })}
                className="h-8 rounded-md border border-border px-2 text-[13px]"
              />
            </Field>
          </div>
        </Drawer>
      ) : null}

      {confirmTarget ? (
        <ConfirmDialog
          title={`删除节点池 ${confirmTarget.name}`}
          message={
            confirmTarget.nodes > 0
              ? `池内仍有 ${confirmTarget.nodes} 台节点，请先迁移或下线节点。`
              : '删除后该调度域不可用，已绑定的项目需重新选择节点池。'
          }
          confirmLabel={confirmTarget.nodes > 0 ? '知道了' : '删除节点池'}
          danger={confirmTarget.nodes === 0}
          onConfirm={() => {
            if (confirmTarget.nodes === 0) deleteNodePool(confirmTarget.id)
          }}
          onClose={() => setConfirmId(null)}
        />
      ) : null}
    </PageFrame>
  )
}
