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
  cancelQueuedWorkload,
  createInitialState,
  retryFailedWorkload,
  spawnWorkload,
  stopWorkload,
  tickLiveMetrics,
} from '../mock/engine'
import {
  bulkStopWorkloads,
  createCluster,
  createDepartment,
  createNodePool,
  createProject,
  deleteCluster,
  deleteDepartment,
  deleteNodePool,
  deleteProject,
  markGpuFault,
  setClusterStatus,
  setPoolStatus,
  setServerCordon,
  setServerDrain,
  setServerOffline,
  updateDepartment,
} from '../mock/inventory'
import {
  DEFAULT_SCOPE,
  DEFAULT_SETTINGS,
  type PlatformScope,
  type PlatformSettings,
  type ProjectMeta,
} from '../platform/model'
import type {
  AppState,
  CanvasRequest,
  ManagedCluster,
  ManagedDepartment,
  NodePool,
  ProjectQuota,
  ZoomPreset,
} from '../types'

interface AppContextValue {
  state: AppState
  scope: PlatformScope
  settings: PlatformSettings
  projectMeta: Record<string, ProjectMeta>
  login: () => Promise<void>
  logout: () => void
  setScope: (patch: Partial<PlatformScope>) => void
  updateSettings: (patch: Partial<PlatformSettings>) => void
  updateProject: (id: string, patch: Partial<ProjectQuota>) => void
  setProjectMeta: (id: string, patch: Partial<ProjectMeta>) => void
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
  cancelQueue: (workloadId: string) => void
  retryFailed: (workloadId: string) => void
  promotePriority: (projectId: string) => void
  togglePolicy: (id: string) => void
  clearCanvasRequest: () => void
  requestCanvas: (req: Omit<CanvasRequest, 'id'>) => void
  openScheduleFlow: (workloadId: string) => void
  closeScheduleFlow: () => void
  createCluster: (input: { name: string; region: string; kubernetes: string; endpoint: string; stationId: string }) => void
  setClusterStatus: (clusterId: string, status: ManagedCluster['status']) => void
  deleteCluster: (clusterId: string) => void
  createNodePool: (input: { name: string; region: string; clusterId: string; stationId?: string }) => void
  setPoolStatus: (poolId: string, status: NonNullable<NodePool['status']>) => void
  deleteNodePool: (poolId: string) => void
  cordonServer: (serverId: string, cordoned: boolean) => void
  drainServer: (serverId: string, draining?: boolean) => void
  offlineServer: (serverId: string, offline: boolean) => void
  markGpuFault: (serverId: string, gpuIndex: number, fault: boolean) => void
  createDepartment: (input: { name: string; gpuQuota: number }) => void
  updateDepartment: (id: string, patch: Partial<ManagedDepartment>) => void
  deleteDepartment: (id: string) => void
  createProject: (input: {
    name: string
    department: string
    guaranteed: number
    overQuota: number
    priority: number
    preemptible: boolean
  }) => void
  deleteProject: (projectId: string) => void
  bulkStop: (workloadIds: string[]) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const AUTH_KEY = 'fp-orch-auth'

export function AppProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<PlatformScope>(DEFAULT_SCOPE)
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS)
  const [projectMeta, setProjectMetaState] = useState<Record<string, ProjectMeta>>({})
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

  const setScope = useCallback((patch: Partial<PlatformScope>) => {
    setScopeState((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateSettings = useCallback((patch: Partial<PlatformSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const updateProject = useCallback((id: string, patch: Partial<ProjectQuota>) => {
    setState((prev) => {
      const current = prev.projects.find((project) => project.id === id)
      return {
        ...prev,
        projects: prev.projects.map((project) => (project.id === id ? { ...project, ...patch } : project)),
        audits: [
          {
            id: `aud-quota-${Date.now()}`,
            ts: Date.now(),
            actor: prev.user,
            action: '调整配额',
            target: current?.name ?? id,
            detail: '更新项目 GPU 配额、优先级或抢占策略',
            level: 'warn' as const,
          },
          ...prev.audits,
        ],
      }
    })
  }, [])

  const setProjectMeta = useCallback((id: string, patch: Partial<ProjectMeta>) => {
    setProjectMetaState((prev) => ({
      ...prev,
      [id]: {
        weight: patch.weight ?? prev[id]?.weight ?? 1,
        cpuCores: patch.cpuCores ?? prev[id]?.cpuCores ?? 0,
      },
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

  const cancelQueue = useCallback((workloadId: string) => {
    setState((prev) => cancelQueuedWorkload(prev, workloadId))
  }, [])

  const retryFailed = useCallback((workloadId: string) => {
    setState((prev) => retryFailedWorkload(prev, workloadId))
  }, [])

  const promotePriority = useCallback((projectId: string) => {
    setState((prev) => {
      const current = prev.projects.find((project) => project.id === projectId)
      if (!current || current.priority <= 1) return prev
      const nextPriority = Math.max(1, current.priority - 1)
      return {
        ...prev,
        projects: prev.projects.map((project) =>
          project.id === projectId ? { ...project, priority: nextPriority } : project,
        ),
        audits: [
          {
            id: `aud-promote-${Date.now()}`,
            ts: Date.now(),
            actor: prev.user,
            action: '提升优先级',
            target: current.name,
            detail: `项目优先级 P${current.priority} → P${nextPriority}`,
            level: 'warn' as const,
          },
          ...prev.audits,
        ],
      }
    })
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

  const createClusterAction = useCallback(
    (input: { name: string; region: string; kubernetes: string; endpoint: string; stationId: string }) => {
      setState((prev) => {
        const next = createCluster(prev, input)
        window.setTimeout(() => {
          setState((current) => {
            const created = current.clusters.find((cluster) => cluster.name === next.clusters[0]?.name)
            if (!created || created.status !== 'Connecting') return current
            return setClusterStatus(current, created.id, 'Connected')
          })
        }, 1200)
        return next
      })
    },
    [],
  )

  const setClusterStatusAction = useCallback((clusterId: string, status: ManagedCluster['status']) => {
    setState((prev) => setClusterStatus(prev, clusterId, status))
  }, [])

  const deleteClusterAction = useCallback((clusterId: string) => {
    setState((prev) => deleteCluster(prev, clusterId))
  }, [])

  const createNodePoolAction = useCallback(
    (input: { name: string; region: string; clusterId: string; stationId?: string }) => {
      setState((prev) => createNodePool(prev, input))
    },
    [],
  )

  const setPoolStatusAction = useCallback((poolId: string, status: NonNullable<NodePool['status']>) => {
    setState((prev) => setPoolStatus(prev, poolId, status))
  }, [])

  const deleteNodePoolAction = useCallback((poolId: string) => {
    setState((prev) => deleteNodePool(prev, poolId))
  }, [])

  const cordonServer = useCallback((serverId: string, cordoned: boolean) => {
    setState((prev) => setServerCordon(prev, serverId, cordoned))
  }, [])

  const drainServer = useCallback((serverId: string, draining = true) => {
    setState((prev) => setServerDrain(prev, serverId, draining))
  }, [])

  const offlineServer = useCallback((serverId: string, offline: boolean) => {
    setState((prev) => setServerOffline(prev, serverId, offline))
  }, [])

  const markGpuFaultAction = useCallback((serverId: string, gpuIndex: number, fault: boolean) => {
    setState((prev) => markGpuFault(prev, serverId, gpuIndex, fault))
  }, [])

  const createDepartmentAction = useCallback((input: { name: string; gpuQuota: number }) => {
    setState((prev) => createDepartment(prev, input))
  }, [])

  const updateDepartmentAction = useCallback((id: string, patch: Partial<ManagedDepartment>) => {
    setState((prev) => updateDepartment(prev, id, patch))
  }, [])

  const deleteDepartmentAction = useCallback((id: string) => {
    setState((prev) => deleteDepartment(prev, id))
  }, [])

  const createProjectAction = useCallback(
    (input: {
      name: string
      department: string
      guaranteed: number
      overQuota: number
      priority: number
      preemptible: boolean
    }) => {
      setState((prev) => createProject(prev, input))
    },
    [],
  )

  const deleteProjectAction = useCallback((projectId: string) => {
    setState((prev) => deleteProject(prev, projectId))
  }, [])

  const bulkStop = useCallback((workloadIds: string[]) => {
    setState((prev) => bulkStopWorkloads(prev, workloadIds))
  }, [])

  const value = useMemo(
    () => ({
      state,
      scope,
      settings,
      projectMeta,
      login,
      logout,
      setScope,
      updateSettings,
      updateProject,
      setProjectMeta,
      setActiveStation,
      selectWorkload,
      focusServer,
      focusPool,
      setZoomPreset,
      simulate,
      createWorkload,
      stop,
      cancelQueue,
      retryFailed,
      promotePriority,
      togglePolicy,
      clearCanvasRequest,
      requestCanvas,
      openScheduleFlow,
      closeScheduleFlow,
      createCluster: createClusterAction,
      setClusterStatus: setClusterStatusAction,
      deleteCluster: deleteClusterAction,
      createNodePool: createNodePoolAction,
      setPoolStatus: setPoolStatusAction,
      deleteNodePool: deleteNodePoolAction,
      cordonServer,
      drainServer,
      offlineServer,
      markGpuFault: markGpuFaultAction,
      createDepartment: createDepartmentAction,
      updateDepartment: updateDepartmentAction,
      deleteDepartment: deleteDepartmentAction,
      createProject: createProjectAction,
      deleteProject: deleteProjectAction,
      bulkStop,
    }),
    [
      state,
      scope,
      settings,
      projectMeta,
      login,
      logout,
      setScope,
      updateSettings,
      updateProject,
      setProjectMeta,
      setActiveStation,
      selectWorkload,
      focusServer,
      focusPool,
      setZoomPreset,
      simulate,
      createWorkload,
      stop,
      cancelQueue,
      retryFailed,
      promotePriority,
      togglePolicy,
      clearCanvasRequest,
      requestCanvas,
      openScheduleFlow,
      closeScheduleFlow,
      createClusterAction,
      setClusterStatusAction,
      deleteClusterAction,
      createNodePoolAction,
      setPoolStatusAction,
      deleteNodePoolAction,
      cordonServer,
      drainServer,
      offlineServer,
      markGpuFaultAction,
      createDepartmentAction,
      updateDepartmentAction,
      deleteDepartmentAction,
      createProjectAction,
      deleteProjectAction,
      bulkStop,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
