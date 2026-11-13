import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createInitialState,
  spawnWorkload,
  stopWorkload,
  tickLiveMetrics,
} from '../mock/engine'
import type { AppState, CanvasRequest, ZoomPreset } from '../types'

interface AppContextValue {
  state: AppState
  login: () => Promise<void>
  logout: () => void
  setActiveStation: (stationId: string) => void
  selectWorkload: (id: string | null) => void
  focusServer: (serverId: string) => void
  focusPool: (poolId: string) => void
  setZoomPreset: (preset: ZoomPreset) => void
  simulate: (kind: 'single' | 'tp4' | 'gang') => void
  createWorkload: (input: {
    name: string
    model: string
    projectId: string
    kind: 'single' | 'tp4' | 'gang'
    gpuCount: number
    type?: import('../types').WorkloadType
  }) => void
  stop: (workloadId: string) => void
  togglePolicy: (id: string) => void
  clearCanvasRequest: () => void
  requestCanvas: (req: Omit<CanvasRequest, 'id'>) => void
  openScheduleFlow: (workloadId: string) => void
  closeScheduleFlow: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

const AUTH_KEY = 'fp-orch-auth'

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    const initial = createInitialState()
    try {
      if (sessionStorage.getItem(AUTH_KEY) === '1') initial.authenticated = true
    } catch {
      /* ignore */
    }
    return initial
  })

  useEffect(() => {
    if (!state.authenticated) return
    const timer = window.setInterval(() => {
      setState((prev) => tickLiveMetrics(prev))
    }, 1800)
    return () => window.clearInterval(timer)
  }, [state.authenticated])

  const login = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      sessionStorage.setItem(AUTH_KEY, '1')
    } catch {
      /* ignore */
    }
    setState((prev) => ({
      ...prev,
      authenticated: true,
      audits: [
        {
          id: `aud-login-${Date.now()}`,
          ts: Date.now(),
          actor: prev.user,
          action: '登录系统',
          target: 'Auth Gateway',
          detail: '集群超级管理员会话建立',
          level: 'success',
        },
        ...prev.audits,
      ],
    }))
  }, [])

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_KEY)
    } catch {
      /* ignore */
    }
    setState((prev) => ({ ...prev, authenticated: false, selectedWorkloadId: null }))
  }, [])

  const selectWorkload = useCallback((id: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedWorkloadId: id,
      canvasRequest: id
        ? { id: Date.now(), type: 'focus-workload', payload: { workloadId: id } }
        : prev.canvasRequest,
    }))
  }, [])

  const focusServer = useCallback((serverId: string) => {
    setState((prev) => ({
      ...prev,
      focusServerId: serverId,
      focusPoolId: prev.servers.find((s) => s.id === serverId)?.poolId ?? null,
      zoomPreset: 'micro',
      canvasRequest: {
        id: Date.now(),
        type: 'focus-server',
        payload: { serverId },
      },
    }))
  }, [])

  const setActiveStation = useCallback((stationId: string) => {
    setState((prev) => {
      const pool = prev.pools.find((p) => p.stationIds.includes(stationId))
      return {
        ...prev,
        activeStationId: stationId,
        focusPoolId: pool?.id ?? prev.focusPoolId,
        zoomPreset: 'meso',
        canvasRequest: pool
          ? { id: Date.now(), type: 'zoom-preset', payload: { preset: 'meso', poolId: pool.id } }
          : prev.canvasRequest,
      }
    })
  }, [])

  const focusPool = useCallback((poolId: string) => {
    setState((prev) => ({
      ...prev,
      focusPoolId: poolId,
      zoomPreset: 'meso',
      canvasRequest: {
        id: Date.now(),
        type: 'zoom-preset',
        payload: { preset: 'meso', poolId },
      },
    }))
  }, [])

  const setZoomPreset = useCallback((preset: ZoomPreset) => {
    setState((prev) => ({
      ...prev,
      zoomPreset: preset,
      canvasRequest: {
        id: Date.now(),
        type: 'zoom-preset',
        payload: { preset },
      },
    }))
  }, [])

  const simulate = useCallback((kind: 'single' | 'tp4' | 'gang') => {
    setState((prev) => spawnWorkload(prev, kind).state)
  }, [])

  const createWorkload = useCallback(
    (input: {
      name: string
      model: string
      projectId: string
      kind: 'single' | 'tp4' | 'gang'
      gpuCount: number
      type?: import('../types').WorkloadType
    }) => {
      setState((prev) =>
        spawnWorkload(prev, input.kind, {
          name: input.name,
          model: input.model,
          projectId: input.projectId,
          gpuCount: input.gpuCount,
          type: input.type,
        }).state,
      )
    },
    [],
  )

  const stop = useCallback((workloadId: string) => {
    setState((prev) => stopWorkload(prev, workloadId))
  }, [])

  const togglePolicy = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      policies: prev.policies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
      audits: [
        {
          id: `aud-pol-${Date.now()}`,
          ts: Date.now(),
          actor: prev.user,
          action: '切换策略',
          target: prev.policies.find((p) => p.id === id)?.name ?? id,
          detail: `${prev.policies.find((p) => p.id === id)?.enabled ? '关闭' : '启用'}调度策略`,
          level: 'warn',
        },
        ...prev.audits,
      ],
    }))
  }, [])

  const clearCanvasRequest = useCallback(() => {
    setState((prev) => ({ ...prev, canvasRequest: null }))
  }, [])

  const requestCanvas = useCallback((req: Omit<CanvasRequest, 'id'>) => {
    setState((prev) => ({
      ...prev,
      canvasRequest: { ...req, id: Date.now() },
    }))
  }, [])

  const openScheduleFlow = useCallback((workloadId: string) => {
    setState((prev) => ({ ...prev, scheduleFlowWorkloadId: workloadId, selectedWorkloadId: workloadId }))
  }, [])

  const closeScheduleFlow = useCallback(() => {
    setState((prev) => ({ ...prev, scheduleFlowWorkloadId: null }))
  }, [])

  const value = useMemo(
    () => ({
      state,
      login,
      logout,
      setActiveStation,
      selectWorkload,
      focusServer,
      focusPool,
      setZoomPreset,
      simulate,
      createWorkload,
      stop,
      togglePolicy,
      clearCanvasRequest,
      requestCanvas,
      openScheduleFlow,
      closeScheduleFlow,
    }),
    [
      state,
      login,
      logout,
      setActiveStation,
      selectWorkload,
      focusServer,
      focusPool,
      setZoomPreset,
      simulate,
      createWorkload,
      stop,
      togglePolicy,
      clearCanvasRequest,
      requestCanvas,
      openScheduleFlow,
      closeScheduleFlow,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
