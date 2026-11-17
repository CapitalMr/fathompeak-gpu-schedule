import { useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { defaultProjectMeta } from './model'

export function usePlatformScope() {
  const { state, projectMeta } = useApp()

  return useMemo(() => {
    const metaFor = (id: string, priority: number) => projectMeta[id] ?? defaultProjectMeta(priority)
    return {
      pools: state.pools,
      servers: state.servers,
      projects: state.projects,
      workloads: state.workloads,
      clusterWorkloads: state.workloads,
      metaFor,
    }
  }, [projectMeta, state])
}
