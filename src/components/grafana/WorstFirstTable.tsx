import { useMemo } from 'react'
import type { ServerNode, Workload } from '../../types'
import { estimateGpuPowerW, specForModel } from '../monitor/gpuSpecs'
import { clamp, displayHostname, wave } from './format'

interface Row {
  key: string
  hostname: string
  slot: number
  model: string
  workload: string
  memUsed: number
  memTotal: number
  sm: number
  temp: number
  power: number
  pState: string
  throttle: string
  fault: boolean
}

function tone(temp: number, fault: boolean) {
  if (fault || temp >= 83) return 'text-[#F2495C]'
  if (temp >= 75) return 'text-[#FF9830]'
  return 'text-[#73BF69]'
}

export function WorstFirstTable({
  servers,
  workloads,
  tick,
}: {
  servers: ServerNode[]
  workloads: Workload[]
  tick: number
}) {
  const rows = useMemo<Row[]>(() => {
    const byId = new Map(workloads.map((workload) => [workload.id, workload.name]))
    const list: Row[] = []
    servers.forEach((server, serverIndex) => {
      server.gpus.forEach((gpu) => {
        const wobble = wave(serverIndex * 8 + gpu.index, Math.floor(tick / 2000))
        const spec = specForModel(gpu.cardModel || server.gpuModel)
        const fault = gpu.state === 'fault'
        const idle = gpu.state === 'idle' || fault
        const sm = fault ? 0 : clamp(gpu.utilization + wobble * 1.6, idle ? 0 : 8, 99)
        const memUsed = fault
          ? 0
          : clamp(gpu.memoryUsedGb + wobble * 0.35, 0.2, Math.max(0.4, gpu.memoryTotalGb - 0.2))
        const temp = fault ? clamp(gpu.temperature, 40, 96) : clamp(gpu.temperature + wobble * 0.7, 32, 94)
        const power = fault
          ? 0
          : estimateGpuPowerW(spec, idle ? 2 + Math.abs(wobble) : sm, wobble * 4)
        const throttle =
          fault ? 'Board Offline' : temp >= 83 ? 'HW Slowdown' : power >= spec.tdpW * 0.98 ? 'SW Power Cap' : 'None'
        const pState = fault || idle ? 'P8' : sm >= 45 ? 'P0' : 'P2'
        list.push({
          key: `${server.id}-${gpu.index}`,
          hostname: displayHostname(server.hostname),
          slot: gpu.index,
          model: gpu.cardModel || server.gpuModel,
          workload: (gpu.workloadId && byId.get(gpu.workloadId)) || gpu.modelName || '—',
          memUsed,
          memTotal: gpu.memoryTotalGb,
          sm,
          temp,
          power,
          pState,
          throttle,
          fault,
        })
      })
    })
    list.sort((a, b) => b.memUsed / b.memTotal - a.memUsed / a.memTotal || b.temp - a.temp)
    return list
  }, [servers, workloads, tick])

  return (
    <section className="border border-[#2c3235] bg-[#111217]">
      <header className="flex items-center justify-between px-3 py-2">
        <h3 className="font-sans text-[12px] font-medium text-[#d8d9da]">GPU 硬件风险优先巡检</h3>
        <span className="font-mono text-[10px] text-[#6e7781]">
          显存 / 温度倒序 · {rows.length} 卡
        </span>
      </header>
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full min-w-[1180px] text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-[#181b1f] text-[#8e8ea0]">
            <tr>
              {[
                'Node Hostname',
                'GPU Slot',
                'GPU Model',
                'Workload',
                'FB Memory Used',
                'SM Util (%)',
                'Core Temp (°C)',
                'Power (W / 700W)',
                'P-State',
                'Throttle Reason',
              ].map((head) => (
                <th key={head} className="border-b border-[#2c3235] px-3 py-2 font-medium">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ratio = row.memTotal ? row.memUsed / row.memTotal : 0
              const bar = ratio >= 0.9 ? '#F2495C' : ratio >= 0.75 ? '#FF9830' : '#73BF69'
              return (
                <tr key={row.key} className="border-b border-[#1f242b] hover:bg-[#181b1f]">
                  <td className="px-3 py-2 font-mono text-[#d8d9da]">{row.hostname}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-sm border border-[#2c3235] bg-[#0b0f19] px-1.5 py-0.5 font-mono text-[10px] text-[#9aa0a6]">
                      GPU {row.slot}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[#c7d0d9]">{row.model}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 font-mono text-[#9ecbff]">{row.workload}</td>
                  <td className="px-3 py-2">
                    <div className="w-[148px]">
                      <div className="mb-1 font-mono text-[10px] text-[#d8d9da]">
                        {row.memUsed.toFixed(1)} / {row.memTotal.toFixed(1)} GB
                      </div>
                      <div className="h-1.5 overflow-hidden bg-[#1f242b]">
                        <div className="h-full" style={{ width: `${Math.round(ratio * 100)}%`, background: bar }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[#06B6D4]">{row.sm.toFixed(1)}</td>
                  <td className={`px-3 py-2 font-mono ${tone(row.temp, row.fault)}`}>{row.temp.toFixed(0)}</td>
                  <td className="px-3 py-2 font-mono text-[#d8d9da]">
                    {row.power} / 700W
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] ${
                        row.pState === 'P0'
                          ? 'bg-[#06B6D4]/15 text-[#06B6D4]'
                          : 'bg-white/5 text-[#8e8ea0]'
                      }`}
                    >
                      {row.pState}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-2 font-mono ${
                      row.throttle === 'None' ? 'text-[#73BF69]' : 'text-[#FF9830]'
                    }`}
                  >
                    {row.throttle}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
