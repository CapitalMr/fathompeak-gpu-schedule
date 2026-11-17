import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './store/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Monitor } from './pages/Monitor'
import { MonitorCluster } from './pages/MonitorCluster'
import { MonitorTask } from './pages/MonitorTask'
import { Workloads } from './pages/Workloads'
import { Queues } from './pages/Queues'
import { Clusters } from './pages/Clusters'
import { Energy } from './pages/Energy'
import { Projects } from './pages/Projects'
import { Policies, SchedulingRules } from './pages/Policies'
import { Alerts } from './pages/Alerts'
import { AlertConfig } from './pages/AlertConfig'
import { AuditPage } from './pages/Audit'
import { UsagePage } from './pages/Usage'
import { DepartmentsPage } from './pages/Departments'
import { SettingsPage } from './pages/Settings'
import { ClusterListPage, NodePoolPage } from './pages/platform/Resources'
import { AssetPage } from './pages/platform/Assets'
import {
  AccessRulesPage,
  MyAccessPage,
  RolesPage,
  ServiceAccountsPage,
  UsersPage,
} from './pages/platform/Access'

function Guard({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  if (!state.authenticated) return <Navigate to="/login" replace />
  return children
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { state } = useApp()
  if (state.authenticated) return <Navigate to="/workloads" replace />
  return children
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename="/gpu-schedule">
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            element={
              <Guard>
                <MainLayout />
              </Guard>
            }
          >
            <Route index element={<Navigate to="/workloads" replace />} />
            <Route path="workloads" element={<Workloads />} />
            <Route path="queues" element={<Queues />} />
            <Route path="overview" element={<Dashboard />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="monitor" element={<Monitor />} />
            <Route path="monitor/cluster" element={<MonitorCluster />} />
            <Route path="monitor/task" element={<MonitorTask />} />
            <Route path="monitor/task/:workloadId" element={<MonitorTask />} />
            <Route path="clusters" element={<ClusterListPage />} />
            <Route path="node-pools" element={<NodePoolPage />} />
            <Route path="nodes" element={<Clusters />} />
            <Route path="energy" element={<Energy />} />
            <Route path="departments" element={<DepartmentsPage />} />
            <Route path="projects" element={<Projects />} />
            <Route path="policies" element={<Policies />} />
            <Route path="scheduling" element={<SchedulingRules />} />
            <Route path="assets/:kind" element={<AssetPage />} />
            <Route path="access/users" element={<UsersPage />} />
            <Route path="access/service-accounts" element={<ServiceAccountsPage />} />
            <Route path="access/rules" element={<AccessRulesPage />} />
            <Route path="access/roles" element={<RolesPage />} />
            <Route path="access/me" element={<MyAccessPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="alerts/config" element={<AlertConfig />} />
            <Route path="audit" element={<AuditPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/workloads" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
