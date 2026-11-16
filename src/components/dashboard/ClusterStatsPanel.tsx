import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  Layers,
  Server,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import type { GpuState, WorkloadStatus } from '../../types'

const GPU_LABEL: Record<GpuState, string> = {
  idle: '空闲',
  infer: '单卡',
  multi: '多卡',
  gang: '跨机',
  fault: '故障',
}

const GPU_COLOR: Record<GpuState, string> = {
  idle: 'bg-idle',
  infer: 'bg-infer',
  multi: 'bg-multi',
  gang: 'bg-gang',
  fault: 'bg-alert',
}

const STATUS_LABEL: Record<WorkloadStatus, string> = {
  Running: '运行中',
  Pending: '排队中',
  Succeeded: '已完成',
  Failed: '失败',
  Stopping: '停止中',
}

const STATUS_TONE: Record<WorkloadStatus, string> = {
  Running: 'text-infer',
  Pending: 'text-gang',
  Succeeded: 'text-muted',
  Failed: 'text-alert',
  Stopping: 'text-dim',
}

const TYPE_LABEL = {
  Inference: '推理',
  Training: '训练',
  Workspace: '开发机',
} as const

const STRATEGY_LABEL = {
  single: '单卡装箱',
  tp: '单机多卡',
  pp: '跨机联动',
} as const

function pct(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function Bar({
  segments,
}: {
  segments: { key: string; value: number; color: string; title: string }[]
}) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
      {segments.map((s) =>
        s.value > 0 ? (
          <div
            key={s.key}
            className={`${s.color} h-full`}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.title} ${s.value}`}
          />
        ) : null,
      )}
    </div>
  )
}

function MiniStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-white/70 px-3 py-2.5">
      <div className="text-[11px] text-dim">{label}</div>
      <div className={`metric-num mt-0.5 text-[20px] leading-none tracking-tight ${tone ?? 'text-text'}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </div>
  )
}

export function ClusterStatsPanel() {
  const { state, selectWorkload } = useApp()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const station = state.stations.find((s) => s.id === state.activeStationId) ?? state.stations[0]
    const pool = state.pools.find((p) => p.stationIds.includes(station?.id ?? ''))
    const servers = pool ? state.servers.filter((s) => s.poolId === pool.id) : state.servers
    const gpus = servers.flatMap((s) => s.gpus)
    const serverIds = new Set(servers.map((s) => s.id))

    const gpuByState: Record<GpuState, number> = {
      idle: 0,
      infer: 0,
      multi: 0,
      gang: 0,
      fault: 0,
    }
    gpus.forEach((g) => {
      gpuByState[g.state] += 1
    })

    const busy = gpus.length - gpuByState.idle - gpuByState.fault
    const healthyServers = servers.filter(
      (s) => s.nvlinkStatus === 'healthy' && !s.gpus.some((g) => g.state === 'fault'),
    ).length
    const degradedServers = servers.filter((s) => s.nvlinkStatus === 'degraded').length
    const offlineServers = servers.filter((s) => s.nvlinkStatus === 'offline').length
    const faultServers = servers.filter((s) => s.gpus.some((g) => g.state === 'fault')).length
    const hotServers = servers.filter((s) => s.temperature >= 78).length
    const avgTemp = servers.length
      ? Math.round(servers.reduce((n, s) => n + s.temperature, 0) / servers.length)
      : 0
    const avgUtil = gpus.length
      ? Math.round(gpus.reduce((n, g) => n + g.utilization, 0) / gpus.length)
      : 0
    const memUsed = gpus.reduce((n, g) => n + g.memoryUsedGb, 0)
    const memTotal = gpus.reduce((n, g) => n + g.memoryTotalGb, 0)
    const powerKw = Math.round(servers.reduce((n, s) => n + s.powerW, 0) / 100) / 10

    const scopedWorkloads = state.workloads.filter(
      (w) =>
        !pool ||
        w.allocations.some((a) => a.poolId === pool.id) ||
        w.status === 'Pending' ||
        w.status === 'Succeeded' ||
        w.status === 'Failed',
    )

    const byStatus: Record<WorkloadStatus, number> = {
      Running: 0,
      Pending: 0,
      Succeeded: 0,
      Failed: 0,
      Stopping: 0,
    }
    const byType = { Inference: 0, Training: 0, Workspace: 0 }
    const byStrategy = { single: 0, tp: 0, pp: 0 }
    scopedWorkloads.forEach((w) => {
      byStatus[w.status] += 1
      byType[w.type] += 1
      byStrategy[w.strategy] += 1
    })

    const runningScoped = state.workloads.filter(
      (w) =>
        w.status === 'Running' &&
        (!pool || w.allocations.some((a) => a.poolId === pool.id || serverIds.has(a.serverId))),
    )

    const poolRows = state.pools.map((p) => {
      const poolServers = state.servers.filter((s) => s.poolId === p.id)
      const poolGpus = poolServers.flatMap((s) => s.gpus)
      const poolBusy = poolGpus.filter((g) => g.state !== 'idle' && g.state !== 'fault').length
      const poolTasks = state.workloads.filter(
        (w) => w.status === 'Running' && w.allocations.some((a) => a.poolId === p.id),
      ).length
      return {
        id: p.id,
        name: p.name,
        region: p.region,
        servers: poolServers.length,
        gpus: poolGpus.length,
        util: pct(poolBusy, poolGpus.length),
        tasks: poolTasks,
        active: p.id === pool?.id,
      }
    })

    const clusterOk = gpuByState.fault === 0 && offlineServers === 0
    const clusterWarn = gpuByState.fault > 0 || offlineServers > 0 || degradedServers > 0

    return {
      station,
      pool,
      servers,
      gpus,
      gpuByState,
      busy,
      healthyServers,
      degradedServers,
      offlineServers,
      faultServers,
      hotServers,
      avgTemp,
      avgUtil,
      memUsed,
      memTotal,
      powerKw,
      byStatus,
      byType,
      byStrategy,
      runningScoped,
      poolRows,
      clusterOk,
      clusterWarn,
      totalTasks: scopedWorkloads.length,
    }
  }, [state])

  const statusItems = (['Running', 'Pending', 'Succeeded', 'Failed', 'Stopping'] as WorkloadStatus[])
    .map((key) => ({ key, count: stats.byStatus[key] }))
    .filter((item) => item.count > 0 || item.key === 'Running' || item.key === 'Pending')

  return (
    <div className="grid gap-3">
      {/* 集群状态条 */}
      <div className="sheet flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {stats.clusterOk ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-infer" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-alert" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-medium">
                集群状态 · {stats.clusterOk ? '正常' : stats.clusterWarn ? '降级' : '异常'}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  stats.clusterOk
                    ? 'bg-[rgba(47,99,184,0.1)] text-infer'
                    : 'bg-[rgba(196,74,74,0.12)] text-alert'
                }`}
              >
                {stats.pool?.label ?? '全部节点池'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {stats.servers.length} 台机器 · {stats.gpus.length} 张 GPU · 运行 {stats.byStatus.Running}{' '}
              / 排队 {stats.byStatus.Pending} · 功耗 {stats.powerKw} kW · 均温 {stats.avgTemp}°C
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-border bg-white/80 px-2.5 py-1 text-muted">
            健康机 <b className="ml-1 font-mono text-text">{stats.healthyServers}</b>
          </span>
          <span className="rounded-full border border-border bg-white/80 px-2.5 py-1 text-muted">
            降级 <b className="ml-1 font-mono text-text">{stats.degradedServers}</b>
          </span>
          <span className="rounded-full border border-border bg-white/80 px-2.5 py-1 text-muted">
            故障卡 <b className="ml-1 font-mono text-alert">{stats.gpuByState.fault}</b>
          </span>
          <span className="rounded-full border border-border bg-white/80 px-2.5 py-1 text-muted">
            高温机 <b className="ml-1 font-mono text-text">{stats.hotServers}</b>
          </span>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        {/* 机器 / GPU */}
        <section className="sheet xl:col-span-4 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-dim" />
              <h3 className="text-[13px] font-medium">机器与 GPU</h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/clusters')}
              className="text-[11px] text-muted hover:text-infer"
            >
              查看节点
            </button>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <MiniStat label="机器" value={stats.servers.length} hint="台服务器" />
            <MiniStat label="GPU 卡" value={stats.gpus.length} hint="张加速卡" tone="text-infer" />
            <MiniStat
              label="占用率"
              value={`${pct(stats.busy, stats.gpus.length)}%`}
              hint={`${stats.busy}/${stats.gpus.length} 已分配`}
            />
          </div>

          <div className="mb-2 flex items-center justify-between text-[11px] text-dim">
            <span>GPU 状态分布</span>
            <span className="font-mono text-muted">SM 均用 {stats.avgUtil}%</span>
          </div>
          <Bar
            segments={(Object.keys(GPU_LABEL) as GpuState[]).map((key) => ({
              key,
              value: stats.gpuByState[key],
              color: GPU_COLOR[key],
              title: GPU_LABEL[key],
            }))}
          />
          <div className="mt-2 grid grid-cols-5 gap-1">
            {(Object.keys(GPU_LABEL) as GpuState[]).map((key) => (
              <div key={key} className="rounded-lg bg-[rgba(61,49,79,0.035)] px-1.5 py-1.5 text-center">
                <i className={`mx-auto mb-1 block h-1.5 w-1.5 rounded-full ${GPU_COLOR[key]}`} />
                <div className="font-mono text-[13px] leading-none">{stats.gpuByState[key]}</div>
                <div className="mt-0.5 text-[10px] text-dim">{GPU_LABEL[key]}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-xl border border-border px-3 py-2">
              <div className="text-[11px] text-dim">显存水位</div>
              <div className="mt-1 font-mono text-[15px]">
                {(stats.memUsed / 1024).toFixed(2)} / {(stats.memTotal / 1024).toFixed(2)} TB
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
                <div
                  className="h-full rounded-full bg-multi"
                  style={{ width: `${pct(stats.memUsed, stats.memTotal)}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border px-3 py-2">
              <div className="text-[11px] text-dim">机柜功耗</div>
              <div className="mt-1 font-mono text-[15px]">{stats.powerKw} kW</div>
              <div className="mt-1 text-[11px] text-muted">
                离线机 {stats.offlineServers} · 故障机 {stats.faultServers}
              </div>
            </div>
          </div>
        </section>

        {/* 任务统计 */}
        <section className="sheet xl:col-span-4 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-dim" />
              <h3 className="text-[13px] font-medium">任务统计</h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/workloads')}
              className="text-[11px] text-muted hover:text-infer"
            >
              工作负载
            </button>
          </div>

          <div className="mb-3 grid grid-cols-4 gap-2">
            <MiniStat label="合计" value={stats.totalTasks} />
            <MiniStat label="运行" value={stats.byStatus.Running} tone="text-infer" />
            <MiniStat label="排队" value={stats.byStatus.Pending} tone="text-gang" />
            <MiniStat label="失败" value={stats.byStatus.Failed} tone="text-alert" />
          </div>

          <div className="mb-2 text-[11px] text-dim">按状态</div>
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            {statusItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border border-border px-2.5 py-1.5"
              >
                <span className={`text-[12px] ${STATUS_TONE[item.key]}`}>{STATUS_LABEL[item.key]}</span>
                <span className="font-mono text-[13px]">{item.count}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[11px] text-dim">按类型</div>
              <div className="space-y-1.5">
                {(Object.keys(TYPE_LABEL) as Array<keyof typeof TYPE_LABEL>).map((key) => (
                  <div key={key} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted">{TYPE_LABEL[key]}</span>
                    <span className="font-mono">{stats.byType[key]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] text-dim">按策略</div>
              <div className="space-y-1.5">
                {(Object.keys(STRATEGY_LABEL) as Array<keyof typeof STRATEGY_LABEL>).map((key) => (
                  <div key={key} className="flex items-center justify-between text-[12px]">
                    <span className="text-muted">{STRATEGY_LABEL[key]}</span>
                    <span className="font-mono">{stats.byStrategy[key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 节点池 */}
        <section className="sheet xl:col-span-4 p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-dim" />
            <h3 className="text-[13px] font-medium">节点池容量</h3>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[rgba(61,49,79,0.035)] text-[11px] text-dim">
                <tr>
                  <th className="px-2.5 py-2 font-medium">池</th>
                  <th className="px-2 py-2 font-medium">机</th>
                  <th className="px-2 py-2 font-medium">卡</th>
                  <th className="px-2 py-2 font-medium">利用率</th>
                  <th className="px-2.5 py-2 font-medium">任务</th>
                </tr>
              </thead>
              <tbody>
                {stats.poolRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-border ${row.active ? 'bg-[rgba(47,99,184,0.06)]' : ''}`}
                  >
                    <td className="px-2.5 py-2">
                      <div className="font-medium text-text">{row.name}</div>
                      <div className="text-[10px] text-dim">{row.region}</div>
                    </td>
                    <td className="px-2 py-2 font-mono">{row.servers}</td>
                    <td className="px-2 py-2 font-mono">{row.gpus}</td>
                    <td className="px-2 py-2">
                      <div className="font-mono">{row.util}%</div>
                      <div className="mt-1 h-1 w-14 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
                        <div className="h-full rounded-full bg-infer" style={{ width: `${row.util}%` }} />
                      </div>
                    </td>
                    <td className="px-2.5 py-2 font-mono">{row.tasks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-[rgba(47,99,184,0.28)] bg-[rgba(238,243,251,0.55)] px-3 py-2 text-[11px] text-muted">
            <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-infer" />
            <span>
              当前电站关联 {stats.pool?.name ?? '—'}，全国合计 {state.pools.length} 个节点池 /{' '}
              {state.servers.length} 台机 / {state.servers.length * 8} 卡。
            </span>
          </div>
        </section>
      </div>

      {/* 运行中任务 */}
      <section className="sheet p-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-dim" />
            <h3 className="text-[13px] font-medium">运行中任务</h3>
            <span className="rounded-full bg-[rgba(47,99,184,0.1)] px-2 py-0.5 font-mono text-[11px] text-infer">
              {stats.runningScoped.length}
            </span>
          </div>
          <span className="text-[11px] text-dim">点击可打开详情</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="text-[11px] text-dim">
              <tr className="border-b border-border">
                <th className="pb-2 pr-3 font-medium">名称</th>
                <th className="pb-2 pr-3 font-medium">模型</th>
                <th className="pb-2 pr-3 font-medium">类型</th>
                <th className="pb-2 pr-3 font-medium">策略</th>
                <th className="pb-2 pr-3 font-medium">GPU</th>
                <th className="pb-2 pr-3 font-medium">节点</th>
                <th className="pb-2 font-medium">吞吐</th>
              </tr>
            </thead>
            <tbody>
              {stats.runningScoped.slice(0, 8).map((w) => (
                <tr
                  key={w.id}
                  className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-[rgba(47,99,184,0.04)]"
                  onClick={() => {
                    selectWorkload(w.id)
                    navigate('/workloads')
                  }}
                >
                  <td className="py-2 pr-3 font-medium text-text">{w.name}</td>
                  <td className="py-2 pr-3 font-mono text-muted">{w.model}</td>
                  <td className="py-2 pr-3 text-muted">{TYPE_LABEL[w.type]}</td>
                  <td className="py-2 pr-3 text-muted">{STRATEGY_LABEL[w.strategy]}</td>
                  <td className="py-2 pr-3 font-mono">{w.gpuCount}</td>
                  <td className="max-w-[180px] truncate py-2 pr-3 font-mono text-muted">
                    {w.allocations.map((a) => a.hostname).slice(0, 2).join(' · ') || '—'}
                  </td>
                  <td className="py-2 font-mono text-muted">
                    {w.tokensPerSec ? `${w.tokensPerSec} t/s` : w.latencyMs ? `${w.latencyMs} ms` : '—'}
                  </td>
                </tr>
              ))}
              {stats.runningScoped.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-dim">
                    当前无运行中任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
