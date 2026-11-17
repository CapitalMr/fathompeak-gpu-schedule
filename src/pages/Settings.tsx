import type { ReactNode } from 'react'
import { PageFrame } from '../components/console/ui'
import { useApp } from '../store/AppContext'
import type { PlatformSettings } from '../platform/model'

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-infer' : 'bg-idle'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-5' : 'left-0.5'}`} />
    </button>
  )
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-border px-4 py-3 first:border-t-0">
      <div>
        <div className="text-[13px] text-text">{title}</div>
        <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-dim">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white">
      <h3 className="border-b border-border px-4 py-3 text-[16px]">{title}</h3>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const { settings, updateSettings } = useApp()
  const flip = (key: keyof PlatformSettings) => updateSettings({ [key]: !settings[key] })

  return (
    <PageFrame
      kicker="设置"
      title="常规设置"
      description="这些开关作用于整个账户。资源类开关会改变项目表的列，策略开关会显示或收起侧栏里的策略菜单。"
    >
      <div className="grid max-w-4xl gap-4">
        <Section title="分析">
          <SettingRow title="GPU 指标采集" description="打开后，节点表和工作负载详情可以看显存、利用率和功耗。">
            <Toggle label="GPU 指标采集" on={settings.gpuProfiling} onClick={() => flip('gpuProfiling')} />
          </SettingRow>
        </Section>

        <Section title="资源">
          <SettingRow title="项目配额不得超过部门配额" description="保存项目配额时，超分上限不能高于所属部门的 GPU 配额。">
            <Toggle label="配额约束" on={settings.limitProjectQuota} onClick={() => flip('limitProjectQuota')} />
          </SettingRow>
          <SettingRow title="CPU 配额" description="打开后，项目表增加 CPU 核配额列，可在配额抽屉里修改。">
            <Toggle label="CPU 配额" on={settings.cpuQuota} onClick={() => flip('cpuQuota')} />
          </SettingRow>
          <SettingRow title="超分权重" description="空闲 GPU 按权重分给已经用完保底配额的项目。">
            <Toggle label="超分权重" on={settings.overQuotaWeight} onClick={() => flip('overQuotaWeight')} />
          </SettingRow>
          <SettingRow title="GPU 显存优化" description="允许工作负载按显存而不是整卡申请 GPU。">
            <Toggle label="显存优化" on={settings.gpuOptimization} onClick={() => flip('gpuOptimization')} />
          </SettingRow>
        </Section>

        <Section title="工作负载">
          <SettingRow title="策略" description="关闭后侧栏不再显示工作负载策略和调度规则。">
            <Toggle label="策略" on={settings.policies} onClick={() => flip('policies')} />
          </SettingRow>
          <SettingRow title="灵活提交" description="新建工作负载时可以选择模板，或从空白表单开始。">
            <Toggle label="灵活提交" on={settings.flexibleSubmission} onClick={() => flip('flexibleSubmission')} />
          </SettingRow>
          <SettingRow title="数据卷" description="关闭后侧栏隐藏数据源。">
            <Toggle label="数据卷" on={settings.dataVolumes} onClick={() => flip('dataVolumes')} />
          </SettingRow>
          <SettingRow title="允许 YAML 提交" description="研究员可以用 Kubernetes YAML 提交受支持的工作负载类型。">
            <Toggle label="YAML 提交" on={settings.yamlSubmit} onClick={() => flip('yamlSubmit')} />
          </SettingRow>
        </Section>

        <Section title="安全">
          <SettingRow title="闲置退出（分钟）" description="只影响控制台。命令行和 API 不受这个超时影响。默认 1440 分钟。">
            <input
              type="number"
              min={5}
              value={settings.inactivityMinutes}
              onChange={(event) => updateSettings({ inactivityMinutes: Number(event.target.value) })}
              className="h-8 w-28 rounded-md border border-border px-2 text-right font-mono text-[13px]"
            />
          </SettingRow>
          <SettingRow title="登出跳转地址" description="用户退出控制台后打开的地址。留空则回到登录页。">
            <input
              value={settings.logoutRedirect}
              onChange={(event) => updateSettings({ logoutRedirect: event.target.value })}
              placeholder="https://"
              className="h-8 w-64 rounded-md border border-border px-2 text-[13px]"
            />
          </SettingRow>
        </Section>

        <Section title="通知">
          <SettingRow title="系统公告" description="保存后显示在控制台顶部，所有已登录用户都能看见。">
            <input
              value={settings.systemNotice}
              onChange={(event) => updateSettings({ systemNotice: event.target.value })}
              placeholder="例如：今晚 22:00 升级调度器"
              className="h-8 w-72 rounded-md border border-border px-2 text-[13px]"
            />
          </SettingRow>
        </Section>
      </div>
    </PageFrame>
  )
}
