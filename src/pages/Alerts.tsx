import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cpu,
  Gauge,
  Leaf,
  Search,
  Server,
  Thermometer,
} from 'lucide-react'
import { FilterSelect } from '../components/console/ui'
import { useApp } from '../store/AppContext'

type Severity = 'critical' | 'warning' | 'info'
type AlertKind = 'gpu' | 'node' | 'quota' | 'power' | 'schedule' | 'network'
type AlertStatus = 'firing' | 'acked' | 'resolved'

interface AlertItem {
  id: string
  severity: Severity
  kind: AlertKind
  status: AlertStatus
  title: string
  detail: string
  target: string
  source: string
  metric?: string
  threshold?: string
  pool?: string
  region?: string
  impact: string
  suggestion: string
  count: number
  ts: number
  durationSec: number
  action?: { label: string; to: string }
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
}

const KIND_LABEL: Record<AlertKind, string> = {
  gpu: 'GPU',
  node: '节点',
  quota: '配额',
  power: '算电',
  schedule: '调度',
  network: '网络',
}

const STATUS_LABEL: Record<AlertStatus, string> = {
  firing: '触发中',
  acked: '已确认',
  resolved: '已恢复',
}

function severityTone(severity: Severity) {
  if (severity === 'critical') return 'text-alert bg-[rgba(155,58,58,0.1)] border-[rgba(155,58,58,0.25)]'
  if (severity === 'warning') return 'text-gang bg-[rgba(138,98,50,0.1)] border-[rgba(138,98,50,0.25)]'
  return 'text-infer bg-[rgba(47,99,184,0.1)] border-[rgba(47,99,184,0.25)]'
}

function statusTone(status: AlertStatus) {
  if (status === 'firing') return 'text-alert'
  if (status === 'acked') return 'text-gang'
  return 'text-muted'
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  return `${Math.floor(sec / 86400)}d`
}

function Bar({
  segments,
}: {
  segments: { key: string; value: number; className: string; title: string }[]
}) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
      {segments.map((s) =>
        s.value > 0 ? (
          <div
            key={s.key}
            className={`${s.className} h-full`}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.title} ${s.value}`}
          />
        ) : null,
      )}
    </div>
  )
}

export function Alerts() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [severity, setSeverity] = useState<'all' | Severity>('all')
  const [kind, setKind] = useState<'all' | AlertKind>('all')
  const [status, setStatus] = useState<'all' | AlertStatus>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ackIds, setAckIds] = useState<Set<string>>(() => new Set())
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => new Set())

  const inventory = useMemo(() => {
    const gpus = state.servers.flatMap((s) => s.gpus)
    const faultGpus = gpus.filter((g) => g.state === 'fault').length
    const hotServers = state.servers.filter((s) => s.temperature >= 76).length
    const degraded = state.servers.filter((s) => s.nvlinkStatus === 'degraded').length
    const offline = state.servers.filter((s) => s.nvlinkStatus === 'offline').length
    const overQuota = state.projects.filter((p) => p.used > p.guaranteed).length
    const lowPower = state.stations.filter((s) => s.currentMw / s.capacityMw < 0.45).length
    const pending = state.workloads.filter((w) => w.status === 'Pending').length
    const failed = state.workloads.filter((w) => w.status === 'Failed').length
    const avgTemp = state.servers.length
      ? Math.round(state.servers.reduce((n, s) => n + s.temperature, 0) / state.servers.length)
      : 0
    const powerKw = Math.round(state.servers.reduce((n, s) => n + s.powerW, 0) / 100) / 10
    return {
      servers: state.servers.length,
      gpus: gpus.length,
      faultGpus,
      hotServers,
      degraded,
      offline,
      overQuota,
      lowPower,
      pending,
      failed,
      avgTemp,
      powerKw,
      pools: state.pools.length,
      projects: state.projects.length,
    }
  }, [state])

  const alerts = useMemo(() => {
    const now = Date.now()
    const items: AlertItem[] = []
    const poolName = (poolId: string) => state.pools.find((p) => p.id === poolId)?.name ?? poolId
    const poolRegion = (poolId: string) => state.pools.find((p) => p.id === poolId)?.region ?? '—'

    state.servers.forEach((server, index) => {
      const faultGpus = server.gpus.filter((g) => g.state === 'fault')
      if (faultGpus.length) {
        items.push({
          id: `gpu-fault-${server.id}`,
          severity: 'critical',
          kind: 'gpu',
          status: 'firing',
          title: `GPU 故障 · ${faultGpus.length} 张卡`,
          detail: `${server.hostname} 存在 Xid / ECC 异常，故障卡位已从调度池摘除。`,
          target: server.hostname,
          source: 'DCGM Exporter',
          metric: `fault_gpus=${faultGpus.length}`,
          threshold: 'fault_gpus > 0',
          pool: poolName(server.poolId),
          region: poolRegion(server.poolId),
          impact: `${faultGpus.length} 卡不可调度 · 同机任务风险升高`,
          suggestion: '隔离故障卡并触发节点巡检工单，必要时整机下线。',
          count: faultGpus.length,
          ts: now - (8 + index) * 60_000,
          durationSec: (8 + index) * 60,
          action: { label: '查看节点', to: '/nodes' },
        })
      }

      const hotGpus = server.gpus.filter((g) => g.temperature >= 82)
      if (hotGpus.length >= 2) {
        items.push({
          id: `gpu-temp-${server.id}`,
          severity: 'warning',
          kind: 'gpu',
          status: index % 5 === 0 ? 'acked' : 'firing',
          title: `GPU 热点 · ${hotGpus.length} 张卡 ≥82°C`,
          detail: `${server.hostname} 多卡温度持续偏高，可能触发降频。`,
          target: server.hostname,
          source: 'NVML',
          metric: `gpu_temp_max=${Math.max(...hotGpus.map((g) => g.temperature))}°C`,
          threshold: 'gpu_temp ≥ 82°C',
          pool: poolName(server.poolId),
          region: poolRegion(server.poolId),
          impact: '推理延迟抖动 / 训练 step time 拉长',
          suggestion: '检查液冷回路与机柜功耗，必要时迁移高功耗任务。',
          count: hotGpus.length,
          ts: now - (15 + index) * 60_000,
          durationSec: (15 + index) * 60,
          action: { label: '打开监控', to: '/monitor/cluster' },
        })
      }

      if (server.nvlinkStatus === 'degraded') {
        items.push({
          id: `nvlink-${server.id}`,
          severity: 'warning',
          kind: 'network',
          status: 'firing',
          title: '卡间互联拓扑降级',
          detail: `${server.hostname} 卡间互联链路不完整，同机多卡亲和调度可能失败。`,
          target: server.hostname,
          source: 'Fabric Manager',
          metric: 'fabric=degraded',
          threshold: 'fabric == healthy',
          pool: poolName(server.poolId),
          region: poolRegion(server.poolId),
          impact: '单机多卡任务无法落位',
          suggestion: '标记节点为 NoSchedule-TP，等待链路恢复后回池。',
          count: 1,
          ts: now - (28 + index) * 60_000,
          durationSec: (28 + index) * 60,
          action: { label: '查看节点', to: '/nodes' },
        })
      }

      if (server.nvlinkStatus === 'offline') {
        items.push({
          id: `offline-${server.id}`,
          severity: 'critical',
          kind: 'network',
          status: 'firing',
          title: '卡间互联 Fabric 离线',
          detail: `${server.hostname} 卡间互联管理面离线，同机多卡任务无法调度；节点 Agent 仍存活。`,
          target: server.hostname,
          source: 'Fabric Manager',
          metric: 'fabric=offline',
          threshold: 'fabric == healthy',
          pool: poolName(server.poolId),
          region: poolRegion(server.poolId),
          impact: `整机 ${server.gpus.length} 卡不可用于 TP/PP`,
          suggestion: '检查 Fabric Manager / 交换机，临时打 NoSchedule-TP。',
          count: 1,
          ts: now - (45 + index) * 60_000,
          durationSec: (45 + index) * 60,
          action: { label: '查看节点', to: '/nodes' },
        })
      }

      if (server.temperature >= 82) {
        items.push({
          id: `chassis-temp-${server.id}`,
          severity: 'critical',
          kind: 'node',
          status: 'firing',
          title: `机箱高温 ${server.temperature}°C`,
          detail: `${server.hostname} 超过安全阈值，建议限流或迁移高功耗任务。`,
          target: server.hostname,
          source: 'BMC / IPMI',
          metric: `chassis_temp=${server.temperature}°C`,
          threshold: 'chassis_temp < 82°C',
          pool: poolName(server.poolId),
          region: poolRegion(server.poolId),
          impact: '存在热关停风险',
          suggestion: '立即降载并检查冷却系统。',
          count: 1,
          ts: now - (6 + index) * 60_000,
          durationSec: (6 + index) * 60,
          action: { label: '打开监控', to: '/monitor/cluster' },
        })
      } else if (server.temperature >= 76) {
        items.push({
          id: `chassis-warn-${server.id}`,
          severity: 'warning',
          kind: 'node',
          status: index % 4 === 0 ? 'acked' : 'firing',
          title: `机箱温度偏高 ${server.temperature}°C`,
          detail: `${server.hostname} 接近热阈值，请关注液冷/风冷回路。`,
          target: server.hostname,
          source: 'BMC / IPMI',
          metric: `chassis_temp=${server.temperature}°C`,
          threshold: 'chassis_temp < 76°C',
          pool: poolName(server.poolId),
          region: poolRegion(server.poolId),
          impact: '后续任务落位需避开该机',
          suggestion: '观察 15 分钟，持续上升则迁移任务。',
          count: 1,
          ts: now - (18 + index) * 60_000,
          durationSec: (18 + index) * 60,
          action: { label: '打开监控', to: '/monitor/cluster' },
        })
      }

      if (server.rdmaGbps < 180 && server.gpus.some((g) => g.state === 'gang' || g.state === 'multi')) {
        items.push({
          id: `rdma-${server.id}`,
          severity: 'warning',
          kind: 'network',
          status: 'firing',
          title: `RDMA 带宽偏低 ${server.rdmaGbps} Gbps`,
          detail: `${server.hostname} 跨机通信带宽不足，PP/Gang 任务通信可能抖动。`,
          target: server.hostname,
          source: 'IB / RoCE Probe',
          metric: `rdma=${server.rdmaGbps} Gbps`,
          threshold: 'rdma ≥ 180 Gbps',
          pool: poolName(server.poolId),
          region: poolRegion(server.poolId),
          impact: '跨机训练吞吐下降',
          suggestion: '检查网卡队列与交换机拥塞。',
          count: 1,
          ts: now - (33 + index) * 60_000,
          durationSec: (33 + index) * 60,
          action: { label: '查看节点', to: '/nodes' },
        })
      }
    })

    state.projects.forEach((project, index) => {
      const usedPct = Math.round((project.used / project.overQuota) * 100)
      if (project.used >= project.overQuota) {
        items.push({
          id: `quota-cap-${project.id}`,
          severity: 'critical',
          kind: 'quota',
          status: 'firing',
          title: '超分上限已耗尽',
          detail: `${project.name} 已用 ${project.used}/${project.overQuota} GPU，新任务将持续排队。`,
          target: project.name,
          source: 'Quota Controller',
          metric: `used=${project.used}`,
          threshold: `used < ${project.overQuota}`,
          pool: '跨池',
          region: project.department,
          impact: '该项目新建工作负载全部 Pending',
          suggestion: '提升超分上限，或停止低优任务释放配额。',
          count: 1,
          ts: now - (22 + index * 3) * 60_000,
          durationSec: (22 + index * 3) * 60,
          action: { label: '查看配额', to: '/projects' },
        })
      } else if (project.used > project.guaranteed) {
        items.push({
          id: `quota-over-${project.id}`,
          severity: 'warning',
          kind: 'quota',
          status: 'firing',
          title: '进入 Over-quota 区间',
          detail: `${project.name} 已超过保底 ${project.guaranteed}，当前占用率 ${usedPct}%。`,
          target: project.name,
          source: 'Quota Controller',
          metric: `used=${project.used}/${project.overQuota}`,
          threshold: `used ≤ ${project.guaranteed}`,
          pool: '跨池',
          region: project.department,
          impact: project.preemptible ? '可被高优项目抢占' : '占用保底外资源',
          suggestion: '评估是否回收可抢占任务，保障高优推理。',
          count: 1,
          ts: now - (35 + index * 4) * 60_000,
          durationSec: (35 + index * 4) * 60,
          action: { label: '查看配额', to: '/projects' },
        })
      } else if (project.used / project.guaranteed >= 0.9) {
        items.push({
          id: `quota-near-${project.id}`,
          severity: 'info',
          kind: 'quota',
          status: 'acked',
          title: '保底配额将触顶',
          detail: `${project.name} 已使用保底配额的 ${Math.round((project.used / project.guaranteed) * 100)}%。`,
          target: project.name,
          source: 'Quota Controller',
          metric: `used=${project.used}/${project.guaranteed}`,
          threshold: 'used/guaranteed < 90%',
          pool: '跨池',
          region: project.department,
          impact: '后续突发可能进入超分',
          suggestion: '提前申请扩容或错峰提交训练任务。',
          count: 1,
          ts: now - (55 + index * 5) * 60_000,
          durationSec: (55 + index * 5) * 60,
          action: { label: '查看配额', to: '/projects' },
        })
      }
    })

    state.stations.forEach((station, index) => {
      const ratio = station.currentMw / station.capacityMw
      if (ratio < 0.45) {
        items.push({
          id: `power-low-${station.id}`,
          severity: 'warning',
          kind: 'power',
          status: 'firing',
          title: '电站出力偏低',
          detail: `${station.name} 当前 ${station.currentMw.toFixed(1)} / ${station.capacityMw} MW（${Math.round(ratio * 100)}%）。`,
          target: station.name,
          source: 'Energy Gateway',
          metric: `output=${station.currentMw.toFixed(1)} MW`,
          threshold: 'output_ratio ≥ 45%',
          pool: state.pools
            .filter((p) => p.stationIds.includes(station.id))
            .map((p) => p.name)
            .join(' / ') || '未绑定',
          region: station.region,
          impact: '绿电路由权重下降',
          suggestion: '降低该站关联池的可抢占任务权重。',
          count: 1,
          ts: now - (50 + index * 6) * 60_000,
          durationSec: (50 + index * 6) * 60,
          action: { label: '算电协同', to: '/energy' },
        })
      } else if (ratio >= 0.85) {
        items.push({
          id: `power-peak-${station.id}`,
          severity: 'info',
          kind: 'power',
          status: 'firing',
          title: '绿电高峰窗口',
          detail: `${station.name} 出力 ${Math.round(ratio * 100)}%，可承接迁移任务。`,
          target: station.name,
          source: 'Energy Gateway',
          metric: `output_ratio=${Math.round(ratio * 100)}%`,
          threshold: 'output_ratio ≥ 85%',
          pool: state.pools
            .filter((p) => p.stationIds.includes(station.id))
            .map((p) => p.name)
            .join(' / ') || '未绑定',
          region: station.region,
          impact: '适合迁移 Over-quota / 低优训练',
          suggestion: '提高关联节点池调度权重，触发绿电迁移。',
          count: 1,
          ts: now - (12 + index * 2) * 60_000,
          durationSec: (12 + index * 2) * 60,
          action: { label: '算电协同', to: '/energy' },
        })
      }
    })

    const pendingList = state.workloads.filter((w) => w.status === 'Pending')
    const pendingTotal = pendingList.length
    const pendingGpus = pendingList.reduce((n, q) => n + q.gpuCount, 0)
    items.push({
      id: 'queue-backlog',
      severity: pendingTotal >= 5 ? 'warning' : 'info',
      kind: 'schedule',
      status: 'firing',
      title: `调度队列积压 ${pendingTotal} 个任务`,
      detail: '存在配额不足、卡间互联亲和或 Gang 成组等待。',
      target: 'scheduler',
      source: 'Queue Manager',
      metric: `pending=${pendingTotal}`,
      threshold: 'pending < 3',
      pool: '全局',
      region: '全部园区',
      impact: `等待 GPU 约 ${pendingGpus} 张`,
      suggestion: '优先保障 P1 通道，清理低优占卡或扩容碎片节点。',
      count: pendingTotal,
      ts: now - 6 * 60_000,
      durationSec: 6 * 60,
      action: { label: '打开调度队列', to: '/queues' },
    })

    pendingList
      .filter((q) => (state.projects.find((p) => p.id === q.projectId)?.priority ?? 3) <= 1)
      .forEach((q, index) => {
      const waitReason =
        q.events.find((e) => e.phase === 'Pending')?.message ?? q.events[0]?.message ?? '等待可用资源'
      items.push({
        id: `queue-block-${q.id}`,
        severity: 'warning',
        kind: 'schedule',
        status: 'firing',
        title: `高优任务阻塞 · ${q.name}`,
        detail: waitReason,
        target: q.name,
        source: 'Scheduler',
        metric: `wait=${formatDuration(q.durationSec)}`,
        threshold: 'P1 wait < 5m',
        pool: '待分配',
        region: q.projectName,
        impact: `${q.gpuCount} 卡需求未满足`,
        suggestion: '检查保底配额与拓扑约束，必要时抢占低优任务。',
        count: 1,
        ts: now - (10 + index * 3) * 60_000,
        durationSec: q.durationSec,
        action: { label: '打开调度队列', to: '/queues' },
      })
    })

    state.policies
      .filter((p) => !p.enabled)
      .forEach((policy, index) => {
        items.push({
          id: `policy-${policy.id}`,
          severity: 'info',
          kind: 'schedule',
          status: 'acked',
          title: `策略未启用 · ${policy.name}`,
          detail: policy.description,
          target: policy.name,
          source: 'Policy Engine',
          metric: 'enabled=false',
          threshold: '关键策略建议开启',
          pool: '全局',
          region: '治理',
          impact: '调度行为可能偏离预期',
          suggestion: '评估业务影响后决定是否重新启用。',
          count: 1,
          ts: now - (90 + index * 10) * 60_000,
          durationSec: (90 + index * 10) * 60,
        action: { label: '调度规则', to: '/scheduling' },
      })
      })

    const sampleNode =
      state.servers.find((s) => s.poolId === 'pool-daxing' && s.gpus.some((g) => g.state === 'fault')) ??
      state.servers.find((s) => s.poolId === 'pool-daxing') ??
      state.servers[0]
    const hamiNode =
      state.servers.find((s) => s.poolId === 'pool-hami' && s.gpus.some((g) => g.state !== 'idle')) ??
      state.servers.find((s) => s.poolId === 'pool-hami')
    const preemptTargets = state.workloads
      .filter((w) => w.status === 'Running' && state.projects.find((p) => p.id === w.projectId)?.preemptible)
      .slice(0, 4)
      .map((w) => w.name)

    // 补充平台级告警目录，目标均绑定真实库存对象
    const catalog: AlertItem[] = [
      {
        id: 'catalog-xid-79',
        severity: 'critical',
        kind: 'gpu',
        status: 'firing',
        title: 'Xid 79 驱动错误',
        detail: '检测到 GPU Fallen Off Bus，相关进程已中断。',
        target: `${sampleNode?.hostname ?? 'bjdx-gpu-n01'} / GPU3`,
        source: 'DCGM',
        metric: 'xid=79',
        threshold: 'xid critical = 0',
        pool: poolName(sampleNode?.poolId ?? 'pool-daxing'),
        region: poolRegion(sampleNode?.poolId ?? 'pool-daxing'),
        impact: '1 张卡掉线，同机任务可能失败',
        suggestion: '重置 GPU 或重启节点，并复核 PCIe 链路。',
        count: 1,
        ts: now - 21 * 60_000,
        durationSec: 21 * 60,
        action: { label: '查看节点', to: '/nodes' },
      },
      {
        id: 'catalog-ecc',
        severity: 'warning',
        kind: 'gpu',
        status: 'firing',
        title: 'HBM ECC 可纠正错误增多',
        detail: `${hamiNode?.hostname ?? 'xjhm-gpu-n01'} 1 小时内 Correctable ECC 上升超过基线 3 倍。`,
        target: hamiNode?.hostname ?? 'xjhm-gpu-n01',
        source: 'DCGM',
        metric: 'ecc_db_e=128/h',
        threshold: 'ecc_db_e < 40/h',
        pool: 'Pool-哈密',
        region: '新疆哈密',
        impact: '潜在显存老化风险',
        suggestion: '持续观察 24h，若继续上升则更换卡位。',
        count: 128,
        ts: now - 70 * 60_000,
        durationSec: 70 * 60,
        action: { label: '查看节点', to: '/nodes' },
      },
      {
        id: 'catalog-mem',
        severity: 'warning',
        kind: 'gpu',
        status: 'acked',
        title: '显存水位持续高位',
        detail: '华北双池多台推理节点 VRAM 使用率 > 92%，碎片回收变慢。',
        target: '推理舰队 · Pool-大兴 / Pool-滨海',
        source: 'Telemetry',
        metric: 'vram_util=93%',
        threshold: 'vram_util < 90%',
        pool: 'Pool-大兴',
        region: '北京大兴',
        impact: '新推理副本启动变慢',
        suggestion: '触发模型卸载或扩容单卡副本。',
        count: 12,
        ts: now - 40 * 60_000,
        durationSec: 40 * 60,
        action: { label: '集群总览', to: '/overview' },
      },
      {
        id: 'catalog-preempt',
        severity: 'info',
        kind: 'schedule',
        status: 'firing',
        title: '低优任务即将被抢占',
        detail: `高优推理突发到来，候选：${preemptTargets.join('、') || '无可抢占 Over-quota 任务'}。`,
        target: preemptTargets[0] ?? 'scheduler',
        source: 'Preemption',
        metric: `preempt_candidates=${Math.max(preemptTargets.length, 1)}`,
        threshold: '—',
        pool: '全局',
        region: '全部园区',
        impact: `${Math.max(preemptTargets.length, 1)} 个低优任务可能被中断`,
        suggestion: '通知项目负责人，或按策略调整任务优先级。',
        count: Math.max(preemptTargets.length, 1),
        ts: now - 15 * 60_000,
        durationSec: 15 * 60,
        action: { label: '打开调度队列', to: '/queues' },
      },
      {
        id: 'catalog-audit',
        severity: 'info',
        kind: 'schedule',
        status: 'resolved',
        title: '配额调整已生效',
        detail: 'LLM 预训练平台 Guaranteed Quota 调整为 192 GPU。',
        target: 'LLM 预训练平台',
        source: 'Audit Trail',
        metric: 'guaranteed=192',
        threshold: '—',
        pool: '跨池',
        region: '基础模型事业部',
        impact: '高优通道容量对齐部门配额',
        suggestion: '无需处理，可在审计中回看变更。',
        count: 1,
        ts: now - 150 * 60_000,
        durationSec: 5 * 60,
        action: { label: '审计日志', to: '/audit' },
      },
      {
        id: 'catalog-power-shift',
        severity: 'info',
        kind: 'power',
        status: 'resolved',
        title: '绿电迁移完成',
        detail: '已将 3 组可抢占任务迁移至 Pool-哈密（新疆园区光伏接入）。',
        target: 'Pool-哈密',
        source: 'Energy Scheduler',
        metric: 'migrated_jobs=3',
        threshold: '—',
        pool: 'Pool-哈密',
        region: '新疆哈密',
        impact: '目标池绿电路由权重提升',
        suggestion: '持续观察目标池温度与 RDMA。',
        count: 3,
        ts: now - 180 * 60_000,
        durationSec: 25 * 60,
        action: { label: '算电协同', to: '/energy' },
      },
    ]

    catalog.forEach((item) => {
      if (!items.some((existing) => existing.id === item.id)) items.push(item)
    })

    return items.sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 }
      const statusRank = { firing: 0, acked: 1, resolved: 2 }
      return rank[a.severity] - rank[b.severity] || statusRank[a.status] - statusRank[b.status] || b.ts - a.ts
    })
  }, [state])

  const liveAlerts = useMemo(
    () =>
      alerts.map((item) => {
        if (resolvedIds.has(item.id)) return { ...item, status: 'resolved' as const }
        if (ackIds.has(item.id) && item.status === 'firing') return { ...item, status: 'acked' as const }
        return item
      }),
    [ackIds, alerts, resolvedIds],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return liveAlerts.filter((a) => {
      if (severity !== 'all' && a.severity !== severity) return false
      if (kind !== 'all' && a.kind !== kind) return false
      if (status !== 'all' && a.status !== status) return false
      if (!q) return true
      return (
        a.title.toLowerCase().includes(q) ||
        a.detail.toLowerCase().includes(q) ||
        a.target.toLowerCase().includes(q) ||
        (a.pool ?? '').toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      )
    })
  }, [liveAlerts, severity, kind, status, query])

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null

  const counts = {
    total: liveAlerts.length,
    critical: liveAlerts.filter((a) => a.severity === 'critical').length,
    warning: liveAlerts.filter((a) => a.severity === 'warning').length,
    info: liveAlerts.filter((a) => a.severity === 'info').length,
    firing: liveAlerts.filter((a) => a.status === 'firing').length,
    acked: liveAlerts.filter((a) => a.status === 'acked').length,
    resolved: liveAlerts.filter((a) => a.status === 'resolved').length,
  }

  const byKind = (Object.keys(KIND_LABEL) as AlertKind[]).map((key) => ({
    key,
    label: KIND_LABEL[key],
    value: liveAlerts.filter((a) => a.kind === key).length,
  }))

  return (
    <div className="h-full min-h-0 overflow-y-auto px-8 pb-8 pt-1">
      <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[12.5px] text-dim">治理</p>
          <h2 className="text-[28px] leading-none">告警中心</h2>
          <p className="mt-1.5 text-[13px] text-muted">
            覆盖 GPU / 节点 / 网络 / 配额 / 调度 / 算电 · 当前触发中 {counts.firing} 条
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题 / 对象 / 节点池 / 来源"
            className="h-9 w-[280px] rounded-lg border border-border bg-white pl-9 pr-3 text-[12px] shadow-[0_1px_2px_rgba(33,32,33,0.04)] outline-none focus:border-[rgba(47,99,184,0.45)]"
          />
        </div>
      </div>

      <div className="sheet grid shrink-0 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        {[
          { label: '告警总数', value: String(counts.total), unit: '全量事件' },
          { label: '触发中', value: String(counts.firing), unit: '待处理' },
          { label: '严重', value: String(counts.critical), unit: '阻断级' },
          { label: '警告', value: String(counts.warning), unit: '关注级' },
          { label: '故障 GPU', value: String(inventory.faultGpus), unit: `/ ${inventory.gpus} 卡` },
          { label: '高温机', value: String(inventory.hotServers), unit: `/ ${inventory.servers} 机` },
          { label: '排队任务', value: String(inventory.pending), unit: '调度积压' },
          { label: '超分项目', value: String(inventory.overQuota), unit: `/ ${inventory.projects} 个` },
        ].map((item, i) => (
          <div
            key={item.label}
            className={`grid gap-0.5 px-3 py-2.5 ${i > 0 ? 'border-l border-border' : ''} ${
              i >= 2 ? 'border-t border-border md:border-t-0' : ''
            } ${i >= 4 ? 'md:border-t xl:border-t-0' : ''}`}
          >
            <span className="text-[11px] text-dim">{item.label}</span>
            <b className="metric-num text-[22px] font-normal leading-none">{item.value}</b>
            <small className="truncate text-[11px] text-dim">{item.unit}</small>
          </div>
        ))}
      </div>

      <div className="grid shrink-0 items-stretch gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <section className="sheet flex flex-col p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-dim" />
            <h3 className="text-[13px] font-medium">风险盘点</h3>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { icon: Cpu, label: '故障卡', value: inventory.faultGpus, hint: 'Xid / ECC' },
              { icon: Thermometer, label: '高温机', value: inventory.hotServers, hint: `均温 ${inventory.avgTemp}°C` },
              { icon: Server, label: '互联降级', value: inventory.degraded, hint: `离线 ${inventory.offline}` },
              { icon: Activity, label: '排队', value: inventory.pending, hint: `失败 ${inventory.failed}` },
              { icon: Bell, label: '超分项目', value: inventory.overQuota, hint: 'Over-quota' },
              { icon: Leaf, label: '低出力电站', value: inventory.lowPower, hint: `功耗 ${inventory.powerKw} kW` },
            ].map((card) => (
              <div key={card.label} className="flex min-h-[88px] flex-col justify-between rounded-xl border border-border bg-white/70 px-2.5 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-dim">
                  <card.icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{card.label}</span>
                </div>
                <div className="metric-num text-[20px] leading-none">{card.value}</div>
                <div className="mt-1 truncate text-[10px] text-muted">{card.hint}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="sheet flex flex-col p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-dim" />
              <h3 className="text-[13px] font-medium">级别分布</h3>
            </div>
            <span className="shrink-0 text-[11px] text-dim">已确认 {counts.acked} · 已恢复 {counts.resolved}</span>
          </div>
          <Bar
            segments={[
              { key: 'c', value: counts.critical, className: 'bg-alert', title: '严重' },
              { key: 'w', value: counts.warning, className: 'bg-gang', title: '警告' },
              { key: 'i', value: counts.info, className: 'bg-infer', title: '提示' },
            ]}
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ['critical', counts.critical, '严重'],
                ['warning', counts.warning, '警告'],
                ['info', counts.info, '提示'],
              ] as const
            ).map(([key, value, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSeverity(severity === key ? 'all' : key)}
                className={`rounded-xl border px-2.5 py-2 text-left transition ${
                  severity === key ? 'border-[rgba(47,99,184,0.4)] bg-[#eef3fb]' : 'border-border'
                }`}
              >
                <div className="text-[11px] text-dim">{label}</div>
                <div className="metric-num mt-0.5 text-[18px] leading-none">{value}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            {(
              [
                ['firing', counts.firing, '触发中'],
                ['acked', counts.acked, '已确认'],
                ['resolved', counts.resolved, '已恢复'],
              ] as const
            ).map(([key, value, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(status === key ? 'all' : key)}
                className={`rounded-lg border px-2 py-1.5 text-left ${
                  status === key ? 'border-[rgba(47,99,184,0.35)] text-infer' : 'border-border text-muted'
                }`}
              >
                {label} <b className="ml-1 font-mono text-text">{value}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="sheet flex flex-col p-3.5 lg:col-span-2 xl:col-span-1">
          <div className="mb-2.5 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-dim" />
            <h3 className="text-[13px] font-medium">类型覆盖</h3>
          </div>
          <div className="flex flex-1 flex-col justify-center space-y-2">
            {byKind.map((item) => {
              const max = Math.max(...byKind.map((k) => k.value), 1)
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setKind(kind === item.key ? 'all' : item.key)}
                  className={`grid w-full grid-cols-[52px_1fr_28px] items-center gap-2 rounded-lg px-1 py-0.5 text-left ${
                    kind === item.key ? 'bg-[#eef3fb]' : 'hover:bg-[rgba(61,49,79,0.03)]'
                  }`}
                >
                  <span className="text-[12px] text-muted">{item.label}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
                    <div
                      className="h-full rounded-full bg-infer"
                      style={{ width: `${(item.value / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-right font-mono text-[12px]">{item.value}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect
          label="级别"
          size="sm"
          value={severity}
          onChange={(value) => setSeverity(value as typeof severity)}
          options={[
            { value: 'all', label: '全部级别' },
            { value: 'critical', label: '严重' },
            { value: 'warning', label: '警告' },
            { value: 'info', label: '提示' },
          ]}
        />
        <FilterSelect
          label="类型"
          size="sm"
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
        <FilterSelect
          label="状态"
          size="sm"
          value={status}
          onChange={(value) => setStatus(value as typeof status)}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'firing', label: '触发中' },
            { value: 'acked', label: '已确认' },
            { value: 'resolved', label: '已恢复' },
          ]}
        />
        <span className="ml-auto self-center text-[11px] text-dim">
          显示 {filtered.length} / {liveAlerts.length}
        </span>
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-12">
        <section className="sheet xl:col-span-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[12px]">
              <thead className="bg-[rgba(61,49,79,0.035)] text-[11px] text-dim">
                <tr>
                  <th className="px-3 py-2.5 font-medium">级别</th>
                  <th className="px-2 py-2.5 font-medium">状态</th>
                  <th className="px-2 py-2.5 font-medium">类型</th>
                  <th className="px-2 py-2.5 font-medium">告警</th>
                  <th className="px-2 py-2.5 font-medium">对象</th>
                  <th className="px-2 py-2.5 font-medium">节点池</th>
                  <th className="px-2 py-2.5 font-medium">指标</th>
                  <th className="px-2 py-2.5 font-medium">持续</th>
                  <th className="px-3 py-2.5 font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => {
                  const active = selected?.id === alert.id
                  return (
                    <tr
                      key={alert.id}
                      onClick={() => setSelectedId(alert.id)}
                      className={`cursor-pointer border-t border-border/80 ${
                        active
                          ? 'bg-[#eef3fb] shadow-[inset_2px_0_0_0_#2f63b8]'
                          : 'hover:bg-[rgba(47,99,184,0.03)]'
                      }`}
                    >
                      <td className="relative px-3 py-2.5">
                        {alert.severity === 'critical' && (
                          <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-alert" />
                        )}
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${severityTone(alert.severity)}`}>
                          {SEVERITY_LABEL[alert.severity]}
                        </span>
                      </td>
                      <td className={`px-2 py-2.5 ${statusTone(alert.status)}`}>{STATUS_LABEL[alert.status]}</td>
                      <td className="px-2 py-2.5 text-muted">{KIND_LABEL[alert.kind]}</td>
                      <td className="px-2 py-2.5">
                        <div className="font-medium text-text">{alert.title}</div>
                        <div className="mt-0.5 max-w-[260px] truncate text-[11px] text-dim">{alert.detail}</div>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-muted">{alert.target}</td>
                      <td className="px-2 py-2.5 text-muted">{alert.pool ?? '—'}</td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-dim">{alert.metric ?? '—'}</td>
                      <td className="px-2 py-2.5 font-mono text-muted">{formatDuration(alert.durationSec)}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-dim">{formatTime(alert.ts)}</td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-12 text-center text-dim">
                      当前筛选条件下无告警
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="sheet xl:col-span-4 flex flex-col p-3.5">
          {selected ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityTone(selected.severity)}`}>
                  {SEVERITY_LABEL[selected.severity]}
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-dim">
                  {KIND_LABEL[selected.kind]}
                </span>
                <span className={`text-[11px] ${statusTone(selected.status)}`}>{STATUS_LABEL[selected.status]}</span>
              </div>
              <h3 className="text-[15px] font-medium leading-snug">{selected.title}</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">{selected.detail}</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                {[
                  ['对象', selected.target],
                  ['来源', selected.source],
                  ['节点池', selected.pool ?? '—'],
                  ['区域', selected.region ?? '—'],
                  ['指标', selected.metric ?? '—'],
                  ['阈值', selected.threshold ?? '—'],
                  ['次数/数量', String(selected.count)],
                  ['持续时长', formatDuration(selected.durationSec)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border px-2.5 py-2">
                    <div className="text-[10px] text-dim">{label}</div>
                    <div className="mt-0.5 break-all font-mono text-[11px] text-text">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-border bg-[rgba(61,49,79,0.03)] px-3 py-2.5">
                <div className="text-[11px] text-dim">影响面</div>
                <div className="mt-1 text-[12px] text-text">{selected.impact}</div>
              </div>
              <div className="mt-2 rounded-xl border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-3 py-2.5">
                <div className="text-[11px] text-dim">处置建议</div>
                <div className="mt-1 text-[12px] text-text">{selected.suggestion}</div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {selected.action && (
                  <button
                    type="button"
                    onClick={() => navigate(selected.action!.to)}
                    className="flex-1 rounded-full border border-[rgba(47,99,184,0.28)] bg-[#eef3fb] px-3 py-2 text-[12px] font-medium text-infer hover:bg-[#e3ecfa]"
                  >
                    {selected.action.label}
                  </button>
                )}
                {selected.status === 'firing' ? (
                  <button
                    type="button"
                    onClick={() => setAckIds((prev) => new Set(prev).add(selected.id))}
                    className="rounded-full border border-border px-3 py-2 text-[12px] text-muted hover:text-text"
                  >
                    确认告警
                  </button>
                ) : null}
                {selected.status !== 'resolved' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setResolvedIds((prev) => new Set(prev).add(selected.id))
                      setAckIds((prev) => {
                        const next = new Set(prev)
                        next.delete(selected.id)
                        return next
                      })
                    }}
                    className="rounded-full border border-[rgba(47,99,184,0.22)] px-3 py-2 text-[12px] text-infer hover:bg-[#eef3fb]"
                  >
                    标记恢复
                  </button>
                ) : (
                  <span className="rounded-full border border-border px-3 py-2 text-[12px] text-dim">已恢复</span>
                )}
              </div>
              <div className="mt-2 font-mono text-[10px] text-dim">首次触发 · {formatTime(selected.ts)}</div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-[13px] text-dim">选择一条告警查看详情</div>
          )}
        </aside>
      </div>
      </div>
    </div>
  )
}
