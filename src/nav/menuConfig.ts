import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Bell,
  Box,
  Boxes,
  Building2,
  ChartColumn,
  Cpu,
  Database,
  FolderKanban,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Leaf,
  ListOrdered,
  Monitor,
  Scale,
  ScrollText,
  Server,
  Settings,
  Settings2,
  Shield,
  Bot,
  Users,
  ClipboardList,
} from 'lucide-react'

export type NavGate = 'policies' | 'dataVolumes'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  gate?: NavGate
  end?: boolean
}

export type NavGroup = {
  title: string
  gate?: NavGate
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: '工作负载',
    items: [
      { to: '/workloads', label: '工作负载', icon: Boxes, end: true },
      { to: '/queues', label: '调度队列', icon: ListOrdered },
    ],
  },
  {
    title: '分析',
    items: [
      { to: '/overview', label: '概览', icon: LayoutDashboard },
      { to: '/usage', label: '用量计量', icon: ChartColumn },
    ],
  },
  {
    title: '资源',
    items: [
      { to: '/clusters', label: '集群', icon: Server, end: true },
      { to: '/node-pools', label: '节点池', icon: Layers },
      { to: '/nodes', label: '节点', icon: Cpu },
      { to: '/energy', label: '算电协同', icon: Leaf },
    ],
  },
  {
    title: '组织',
    items: [
      { to: '/departments', label: '部门', icon: Building2 },
      { to: '/projects', label: '项目', icon: FolderKanban },
    ],
  },
  {
    title: '治理',
    items: [
      { to: '/monitor', label: '监控大屏', icon: Monitor },
      { to: '/alerts', label: '告警中心', icon: Bell, end: true },
      { to: '/alerts/config', label: '告警配置', icon: Settings2 },
      { to: '/audit', label: '审计日志', icon: ClipboardList },
    ],
  },
  {
    title: '策略',
    gate: 'policies',
    items: [
      { to: '/policies', label: '工作负载策略', icon: ScrollText },
      { to: '/scheduling', label: '调度规则', icon: Scale },
    ],
  },
  {
    title: '资产',
    items: [
      { to: '/assets/templates', label: '模板', icon: LayoutTemplate },
      { to: '/assets/environments', label: '环境', icon: Box },
      { to: '/assets/compute', label: '计算规格', icon: Cpu },
      { to: '/assets/datasources', label: '数据源', icon: Database, gate: 'dataVolumes' },
      { to: '/assets/credentials', label: '凭证', icon: KeyRound },
    ],
  },
  {
    title: '访问',
    items: [
      { to: '/access/users', label: '用户', icon: Users },
      { to: '/access/service-accounts', label: '服务账号', icon: Bot },
      { to: '/access/rules', label: '访问规则', icon: Shield },
      { to: '/access/roles', label: '角色', icon: BadgeCheck },
    ],
  },
  {
    title: '设置',
    items: [{ to: '/settings', label: '常规设置', icon: Settings }],
  },
]
