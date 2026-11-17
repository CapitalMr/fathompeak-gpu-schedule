import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/AppContext'
import type { ServerNode, Workload, ZoomPreset } from '../../types'

const COLORS = {
  void: '#f8f8f8',
  panel: '#ffffff',
  border: 'rgba(61,49,79,0.18)',
  idle: '#d8d2c8',
  infer: '#2f63b8',
  multi: '#4e3f66',
  gang: '#8a6232',
  alert: '#9b3a3a',
  text: '#212021',
  muted: 'rgba(33,32,33,0.62)',
  dim: 'rgba(33,32,33,0.42)',
}

function gpuColor(state: string) {
  if (state === 'infer') return COLORS.infer
  if (state === 'multi') return COLORS.multi
  if (state === 'gang') return COLORS.gang
  if (state === 'fault') return COLORS.alert
  return COLORS.idle
}

function serverDominant(server: ServerNode) {
  const counts = { idle: 0, infer: 0, multi: 0, gang: 0, fault: 0 }
  server.gpus.forEach((g) => {
    counts[g.state]++
  })
  if (counts.fault) return 'fault'
  if (counts.gang) return 'gang'
  if (counts.multi) return 'multi'
  if (counts.infer) return 'infer'
  return 'idle'
}

interface ViewState {
  scale: number
  offsetX: number
  offsetY: number
}

interface HoverInfo {
  x: number
  y: number
  title: string
  lines: string[]
}

const WORLD = { w: 1200, h: 900 }

export function TwinCanvas() {
  const { state, setZoomPreset, clearCanvasRequest, selectWorkload } = useApp()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<ViewState>({ scale: 0.32, offsetX: 80, offsetY: 40 })
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 })
  const animRef = useRef(0)
  const particlesRef = useRef<{ x: number; y: number; t: number; color: string }[]>([])
  const spawnBallsRef = useRef<
    { x: number; y: number; tx: number; ty: number; progress: number; color: string }[]
  >([])
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [floating, setFloating] = useState<{ x: number; y: number; wl: Workload } | null>(null)
  const [zoomLabel, setZoomLabel] = useState('宏观')

  const selected = state.selectedWorkloadId
    ? state.workloads.find((w) => w.id === state.selectedWorkloadId)
    : null

  const applyPreset = useCallback(
    (preset: ZoomPreset, poolId?: string, serverId?: string) => {
      const view = viewRef.current
      if (preset === 'macro') {
        view.scale = 0.32
        view.offsetX = 80
        view.offsetY = 40
      } else if (preset === 'meso') {
        view.scale = 0.58
        const pool = state.pools.find((p) => p.id === (poolId ?? state.focusPoolId ?? 'pool-east-01'))
        view.offsetX = 200 - (pool?.x ?? 180) * view.scale
        view.offsetY = 80 - (pool?.y ?? 280) * view.scale + 40
      } else {
        view.scale = 1.35
        const server =
          state.servers.find((s) => s.id === (serverId ?? state.focusServerId)) ??
          state.servers.find((s) => s.poolId === (poolId ?? state.focusPoolId ?? 'pool-east-01')) ??
          state.servers[0]
        const pool = state.pools.find((p) => p.id === server.poolId)!
        const sx = pool.x - 180 + server.rackCol * 42
        const sy = pool.y - 40 + server.rackRow * 52
        view.offsetX = 280 - sx * view.scale
        view.offsetY = 160 - sy * view.scale
      }
      setZoomPreset(preset)
      updateZoomLabel(view.scale)
    },
    [setZoomPreset, state.focusPoolId, state.focusServerId, state.pools, state.servers],
  )

  const updateZoomLabel = (scale: number) => {
    if (scale < 0.4) setZoomLabel('宏观 · 节点池')
    else if (scale < 0.75) setZoomLabel('中观 · 50台矩阵')
    else setZoomLabel('微观 · 节点透视')
  }

  useEffect(() => {
    const req = state.canvasRequest
    if (!req) return
    if (req.type === 'zoom-preset') {
      applyPreset((req.payload?.preset as ZoomPreset) ?? 'macro', req.payload?.poolId as string)
    } else if (req.type === 'focus-server') {
      applyPreset('micro', undefined, req.payload?.serverId as string)
    } else if (req.type === 'focus-workload') {
      const wl = state.workloads.find((w) => w.id === req.payload?.workloadId)
      if (wl?.allocations[0]) {
        if (wl.strategy === 'pp') applyPreset('macro')
        else if (wl.strategy === 'tp') applyPreset('micro', wl.allocations[0].poolId, wl.allocations[0].serverId)
        else applyPreset('meso', wl.allocations[0].poolId)
      }
    } else if (req.type === 'spawn-animation') {
      const wl = state.workloads.find((w) => w.id === req.payload?.workloadId)
      if (wl) {
        const color = wl.strategy === 'pp' ? COLORS.gang : wl.strategy === 'tp' ? COLORS.multi : COLORS.infer
        wl.allocations.forEach((a, i) => {
          const pool = state.pools.find((p) => p.id === a.poolId)!
          const server = state.servers.find((s) => s.id === a.serverId)!
          const tx = pool.x - 180 + server.rackCol * 42 + 16
          const ty = pool.y - 40 + server.rackRow * 52 + 16
          spawnBallsRef.current.push({
            x: WORLD.w / 2,
            y: 90,
            tx,
            ty,
            progress: -i * 0.12,
            color,
          })
        })
        if (wl.strategy === 'pp') applyPreset('macro')
        else if (wl.strategy === 'tp') applyPreset('micro', wl.allocations[0]?.poolId, wl.allocations[0]?.serverId)
        else applyPreset('meso', wl.allocations[0]?.poolId)
      }
    }
    clearCanvasRequest()
  }, [state.canvasRequest, applyPreset, clearCanvasRequest, state.workloads, state.pools, state.servers])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (ts: number) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const view = viewRef.current
      const t = ts / 1000

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // background
      const grd = ctx.createLinearGradient(0, 0, 0, h)
      grd.addColorStop(0, '#eef3fb')
      grd.addColorStop(1, '#f8f8f8')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      // grid
      ctx.save()
      ctx.translate(view.offsetX, view.offsetY)
      ctx.scale(view.scale, view.scale)

      ctx.strokeStyle = 'rgba(61,49,79,0.08)'
      ctx.lineWidth = 1 / view.scale
      for (let x = 0; x < WORLD.w; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, WORLD.h)
        ctx.stroke()
      }
      for (let y = 0; y < WORLD.h; y += 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(WORLD.w, y)
        ctx.stroke()
      }

      const highlightIds = new Set(selected?.allocations.map((a) => a.serverId) ?? [])
      const dimOthers = !!selected

      // Gateway
      drawGateway(ctx, t)

      // Beams for gang / selected PP
      const gangWorkloads = state.workloads.filter(
        (wl) => wl.status === 'Running' && wl.strategy === 'pp' && (!selected || selected.id === wl.id),
      )
      gangWorkloads.forEach((wl) => {
        wl.allocations.forEach((a) => {
          const pool = state.pools.find((p) => p.id === a.poolId)!
          const server = state.servers.find((s) => s.id === a.serverId)!
          const sx = pool.x - 180 + server.rackCol * 42 + 18
          const sy = pool.y - 40 + server.rackRow * 52 + 14
          drawBeam(ctx, 550, 110, sx, sy, t, COLORS.gang, dimOthers && !highlightIds.has(a.serverId) ? 0.15 : 0.85)
        })
      })

      // Pools & servers
      state.pools.forEach((pool) => {
        const poolServers = state.servers.filter((s) => s.poolId === pool.id)
        drawPoolFrame(ctx, pool.x, pool.y, pool.label, pool.region, view.scale)

        poolServers.forEach((server) => {
          const sx = pool.x - 180 + server.rackCol * 42
          const sy = pool.y - 40 + server.rackRow * 52
          const highlighted = !dimOthers || highlightIds.has(server.id)
          const alpha = highlighted ? 1 : 0.18

          if (view.scale > 0.75) {
            drawChassis(ctx, sx - 10, sy - 8, server, t, alpha, selected?.id)
          } else {
            drawServerCapsule(ctx, sx, sy, server, view.scale, alpha)
          }
        })
      })

      // spawn balls
      spawnBallsRef.current = spawnBallsRef.current.filter((b) => {
        b.progress += 0.02
        if (b.progress < 0) return true
        if (b.progress >= 1) {
          particlesRef.current.push({ x: b.tx, y: b.ty, t: 0, color: b.color })
          return false
        }
        const ease = 1 - Math.pow(1 - b.progress, 3)
        const x = b.x + (b.tx - b.x) * ease
        const y = b.y + (b.ty - b.y) * ease - Math.sin(ease * Math.PI) * 60
        ctx.beginPath()
        ctx.fillStyle = b.color
        ctx.shadowColor = b.color
        ctx.shadowBlur = 16
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        return true
      })

      particlesRef.current = particlesRef.current.filter((p) => {
        p.t += 0.04
        if (p.t > 1) return false
        ctx.globalAlpha = 1 - p.t
        ctx.beginPath()
        ctx.strokeStyle = p.color
        ctx.lineWidth = 2
        ctx.arc(p.x, p.y, 10 + p.t * 30, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        return true
      })

      ctx.restore()

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.strokeStyle = COLORS.border
      ctx.lineWidth = 1
      roundRect(ctx, 12, h - 36, 220, 24, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = COLORS.muted
      ctx.font = '11px sans-serif'
      ctx.fillText(`缩放 ${(view.scale * 100).toFixed(0)}% · ${zoomLabel}`, 22, h - 20)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [state.pools, state.servers, state.workloads, selected, zoomLabel])

  const worldFromEvent = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const view = viewRef.current
    return {
      x: (e.clientX - rect.left - view.offsetX) / view.scale,
      y: (e.clientY - rect.top - view.offsetY) / view.scale,
      sx: e.clientX - rect.left,
      sy: e.clientY - rect.top,
    }
  }

  const hitServer = (wx: number, wy: number) => {
    for (const pool of state.pools) {
      for (const server of state.servers.filter((s) => s.poolId === pool.id)) {
        const sx = pool.x - 180 + server.rackCol * 42
        const sy = pool.y - 40 + server.rackRow * 52
        const pad = viewRef.current.scale > 0.75 ? 50 : 18
        if (wx >= sx - 8 && wx <= sx + 36 + pad && wy >= sy - 8 && wy <= sy + 28 + pad) {
          return { server, sx, sy }
        }
      }
    }
    return null
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const view = viewRef.current
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const beforeX = (mx - view.offsetX) / view.scale
    const beforeY = (my - view.offsetY) / view.scale
    const delta = e.deltaY > 0 ? 0.92 : 1.08
    view.scale = Math.min(2.2, Math.max(0.22, view.scale * delta))
    view.offsetX = mx - beforeX * view.scale
    view.offsetY = my - beforeY * view.scale
    updateZoomLabel(view.scale)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { active: true, x: e.clientX, y: e.clientY }
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current.active) {
      viewRef.current.offsetX += e.clientX - dragRef.current.x
      viewRef.current.offsetY += e.clientY - dragRef.current.y
      dragRef.current.x = e.clientX
      dragRef.current.y = e.clientY
      setHover(null)
      return
    }
    const { x, y, sx, sy } = worldFromEvent(e)
    const hit = hitServer(x, y)
    if (!hit) {
      setHover(null)
      if (!selected) setFloating(null)
      return
    }
    const { server } = hit
    const scale = viewRef.current.scale
    if (scale > 0.75) {
      const localY = y - (hit.sy - 8)
      const gi = Math.floor((localY - 36) / 28)
      if (gi >= 0 && gi < server.gpus.length) {
        const gpu = server.gpus[gi]
        if (!gpu) return
        setHover({
          x: sx + 14,
          y: sy + 14,
          title: `${server.hostname} · GPU ${gi}`,
          lines: [
            gpu.cardModel,
            gpu.modelName ?? '空闲待机',
            `显存 ${gpu.memoryUsedGb}GB / ${gpu.memoryTotalGb}GB`,
            `利用率 ${gpu.utilization}% · ${gpu.temperature}°C · ${gpu.powerW}W`,
          ],
        })
      } else {
        setHover({
          x: sx + 14,
          y: sy + 14,
          title: server.hostname,
          lines: [
            server.ip,
            `${server.gpuModel} · ${server.gpus.length} 槽`,
            `功耗 ${server.powerW >= 1000 ? `${(server.powerW / 1000).toFixed(1)} kW` : `${server.powerW} W`} · 状态 ${
              server.nvlinkStatus === 'healthy' ? '健康' : server.nvlinkStatus === 'degraded' ? '降级' : '离线'
            }`,
          ],
        })
      }
    } else {
      const dom = serverDominant(server)
      setHover({
        x: sx + 14,
        y: sy + 14,
        title: server.hostname,
        lines: [
          server.ip,
          `状态 ${dom} · 占用 ${server.gpus.filter((g) => g.state !== 'idle').length}/${server.gpus.length}`,
          `温度 ${server.temperature}°C · RDMA ${server.rdmaGbps}Gbps`,
        ],
      })
    }

    if (selected) {
      const onTask = selected.allocations.some((a) => a.serverId === server.id)
      if (onTask) setFloating({ x: sx, y: sy, wl: selected })
    }
  }

  const onMouseUp = () => {
    dragRef.current.active = false
  }

  const onClick = (e: React.MouseEvent) => {
    const { x, y } = worldFromEvent(e)
    const hit = hitServer(x, y)
    if (!hit) {
      selectWorkload(null)
      setFloating(null)
      return
    }
    const wl = state.workloads.find(
      (w) => w.status === 'Running' && w.allocations.some((a) => a.serverId === hit.server.id),
    )
    if (wl) selectWorkload(wl.id)
  }

  return (
    <div ref={containerRef} className="sheet side-glow relative h-full w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        <div className="scanline" />
      </div>
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
        {(
          [
            ['macro', '全局宏观'],
            ['meso', '50台节点矩阵'],
            ['micro', '单机透视'],
          ] as const
        ).map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            onClick={() => applyPreset(preset)}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition ${
              state.zoomPreset === preset
                ? 'border-infer/50 bg-infer/10 text-infer'
                : 'border-border bg-panel/90 text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onClick}
      />

      {hover && (
        <div
          className="pointer-events-none absolute z-20 max-w-xs rounded-lg border border-border bg-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="font-medium text-text">{hover.title}</div>
          {hover.lines.map((line) => (
            <div key={line} className="mt-0.5 text-muted">
              {line}
            </div>
          ))}
        </div>
      )}

      {floating && selected && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-gang/40 bg-panel/95 px-3 py-2 text-xs shadow-[0_0_24px_rgba(245,158,11,0.2)]"
          style={{ left: Math.min(floating.x + 24, (containerRef.current?.clientWidth ?? 400) - 180), top: floating.y - 10 }}
        >
          <div className="font-medium text-gang">{selected.name}</div>
          <div className="mt-1 text-muted">Latency {selected.latencyMs} ms</div>
          <div className="text-muted">Throughput {selected.tokensPerSec || '—'} Tokens/s</div>
        </div>
      )}
    </div>
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawGateway(ctx: CanvasRenderingContext2D, t: number) {
  const x = 470
  const y = 48
  ctx.save()
  ctx.shadowColor = COLORS.infer
  ctx.shadowBlur = 18 + Math.sin(t * 3) * 6
  roundRect(ctx, x, y, 160, 54, 10)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = COLORS.infer
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = COLORS.text
  ctx.font = 'bold 13px sans-serif'
  ctx.fillText('AI 推理调度网关', x + 28, y + 24)
  ctx.fillStyle = COLORS.muted
  ctx.font = '10px sans-serif'
  ctx.fillText('Gang / Binpack / Topology Aware', x + 18, y + 42)
  ctx.restore()
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
  color: string,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.lineWidth = 1.8
  ctx.setLineDash([8, 10])
  ctx.lineDashOffset = -t * 40
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  const mx = (x1 + x2) / 2
  const my = Math.min(y1, y2) - 40
  ctx.quadraticCurveTo(mx, my, x2, y2)
  ctx.stroke()
  ctx.setLineDash([])

  const p = (t * 0.35) % 1
  const qx = (1 - p) * (1 - p) * x1 + 2 * (1 - p) * p * mx + p * p * x2
  const qy = (1 - p) * (1 - p) * y1 + 2 * (1 - p) * p * my + p * p * y2
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(qx, qy, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPoolFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  region: string,
  scale: number,
) {
  const w = 430
  const h = 290
  roundRect(ctx, x - 200, y - 60, w, h, 12)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.fill()
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.fillStyle = COLORS.text
  ctx.font = `${scale > 0.5 ? 13 : 11}px sans-serif`
  ctx.fillText(label, x - 188, y - 38)
  ctx.fillStyle = COLORS.dim
  ctx.font = '10px sans-serif'
  ctx.fillText(region, x - 188, y - 22)
}

function drawServerCapsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  server: ServerNode,
  scale: number,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  roundRect(ctx, x, y, 36, 22, 4)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = COLORS.border
  ctx.stroke()

  const iconSlots = Math.min(8, server.gpus.length)
  for (let i = 0; i < iconSlots; i++) {
    const gpu = server.gpus[i]
    if (!gpu) continue
    const gx = x + 2 + (i % 4) * 8
    const gy = y + 3 + Math.floor(i / 4) * 9
    ctx.fillStyle = gpuColor(gpu.state)
    roundRect(ctx, gx, gy, 7, 7, 1.5)
    ctx.fill()
  }

  if (scale > 0.5) {
    ctx.fillStyle = COLORS.dim
    ctx.font = '8px monospace'
    ctx.fillText(server.id.replace('node-', 'N'), x + 1, y + 32)
  }
  ctx.restore()
}

function drawChassis(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  server: ServerNode,
  t: number,
  alpha: number,
  selectedWorkloadId?: string,
) {
  ctx.save()
  ctx.globalAlpha = alpha

  const slotN = server.gpus.length
  const showN = Math.min(slotN, 8)
  const slotH = showN <= 4 ? 28 : 24
  const bodyH = 50 + showN * slotH + 28

  // chassis body 2.5D
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, x, y, 150, bodyH, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(61,49,79,0.22)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // top bevel
  ctx.fillStyle = '#f3f1ea'
  ctx.beginPath()
  ctx.moveTo(x + 8, y)
  ctx.lineTo(x + 142, y)
  ctx.lineTo(x + 150, y + 10)
  ctx.lineTo(x, y + 10)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = COLORS.text
  ctx.font = 'bold 11px sans-serif'
  ctx.fillText(server.hostname, x + 10, y + 26)
  ctx.fillStyle = COLORS.dim
  ctx.font = '9px monospace'
  ctx.fillText(`${server.ip} · ${slotN}槽`, x + 10, y + 40)

  // GPU slots（透视最多展示 8 槽，余量在标题体现）
  for (let i = 0; i < showN; i++) {
    const gpu = server.gpus[i]
    if (!gpu) continue
    const gy = y + 50 + i * slotH
    roundRect(ctx, x + 10, gy, 130, slotH - 4, 4)
    ctx.fillStyle = '#f8f8f8'
    ctx.fill()
    ctx.strokeStyle = gpuColor(gpu.state)
    ctx.globalAlpha = alpha * (gpu.state === 'idle' ? 0.45 : 1)
    ctx.stroke()
    ctx.globalAlpha = alpha

    ctx.fillStyle = gpuColor(gpu.state)
    ctx.fillRect(x + 14, gy + 5, 4, 10)

    ctx.fillStyle = COLORS.muted
    ctx.font = '9px sans-serif'
    const short = gpu.cardModel.replace(/^NVIDIA (GeForce )?/, '').replace(/^华为昇腾 /, '').replace(/^寒武纪思元 /, '')
    ctx.fillText(`GPU${i} ${short.slice(0, 14)}`, x + 24, gy + 13)

    const memRatio = gpu.memoryUsedGb / Math.max(1, gpu.memoryTotalGb)
    ctx.fillStyle = 'rgba(61,49,79,0.08)'
    roundRect(ctx, x + 62, gy + 6, 70, 8, 2)
    ctx.fill()
    ctx.fillStyle = gpuColor(gpu.state)
    roundRect(ctx, x + 62, gy + 6, Math.max(2, 70 * memRatio), 8, 2)
    ctx.fill()

    if (selectedWorkloadId && gpu.workloadId === selectedWorkloadId) {
      ctx.strokeStyle = '#2f63b8'
      ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.2
      roundRect(ctx, x + 10, gy, 130, slotH - 4, 4)
      ctx.stroke()
      ctx.globalAlpha = alpha
    }
  }

  // fans
  for (let i = 0; i < 3; i++) {
    const fx = x + 118
    const fy = y + 14 + i * 10
    ctx.strokeStyle = COLORS.dim
    ctx.beginPath()
    ctx.arc(fx, fy, 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.lineTo(fx + Math.cos(t * 8 + i) * 3, fy + Math.sin(t * 8 + i) * 3)
    ctx.stroke()
  }

  // 卡间互联总线（按机箱实际 fabric，非一律 NVLink）
  const multiOrGang = server.gpus.some((g) => g.state === 'multi' || g.state === 'gang')
  const fabric =
    /昇腾|910/.test(server.gpuModel)
      ? 'HCCS'
      : /思元|MLU/.test(server.gpuModel)
        ? 'MLU-Link'
        : /5090|4060|PCIe/.test(server.gpuModel)
          ? 'PCIe'
          : 'NVLink'
  const busY = y + bodyH - 18
  roundRect(ctx, x + 10, busY, 130, 12, 3)
  ctx.fillStyle = multiOrGang ? 'rgba(138,98,50,0.12)' : '#f8f8f8'
  ctx.fill()
  ctx.strokeStyle = multiOrGang ? COLORS.gang : COLORS.border
  ctx.stroke()
  ctx.fillStyle = multiOrGang ? COLORS.gang : COLORS.dim
  ctx.font = '8px sans-serif'
  ctx.fillText(`${fabric} 卡间互联${slotN > 8 ? ` · 共${slotN}槽` : ''}`, x + 22, busY + 9)

  if (multiOrGang) {
    for (let i = 0; i < 5; i++) {
      const px = x + 16 + ((t * 60 + i * 24) % 110)
      ctx.fillStyle = COLORS.gang
      ctx.globalAlpha = alpha * 0.8
      ctx.beginPath()
      ctx.arc(px, busY + 6, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = alpha
  }

  ctx.restore()
}
