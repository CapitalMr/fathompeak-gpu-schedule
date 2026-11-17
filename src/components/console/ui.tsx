import type { ReactNode } from 'react'

export function PageFrame({
  kicker,
  title,
  description,
  actions,
  children,
}: {
  kicker: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-3 pt-2">
        <div className="min-w-0">
          <div className="text-[11px] tracking-wide text-dim">{kicker}</div>
          <h2 className="mt-1 text-[22px] leading-none">{title}</h2>
          {description ? <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">{children}</div>
    </div>
  )
}

export function PrimaryButton({
  children,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="h-8 rounded-md bg-infer px-3 text-[12px] font-medium text-white hover:bg-[#254f94]"
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-8 rounded-md border border-border bg-white px-3 text-[12px] text-muted hover:text-text disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function DangerButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-md border border-alert/30 bg-white px-3 text-[12px] font-medium text-alert hover:bg-alert/10"
    >
      {children}
    </button>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = '确认',
  danger,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(33,32,33,0.34)] p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-white p-4 shadow-[0_16px_48px_rgba(0,0,0,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-[16px] font-medium text-text">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={onClose}>取消</GhostButton>
          {danger ? (
            <DangerButton
              onClick={() => {
                onConfirm()
                onClose()
              }}
            >
              {confirmLabel}
            </DangerButton>
          ) : (
            <PrimaryButton
              onClick={() => {
                onConfirm()
                onClose()
              }}
            >
              {confirmLabel}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className = '',
  size = 'md',
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  className?: string
  size?: 'sm' | 'md'
}) {
  const sizeClass = size === 'sm' ? 'h-7 text-[11px]' : 'h-8 text-[12px]'
  return (
    <label className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      {label ? <span className="shrink-0 text-[11px] text-dim">{label}</span> : null}
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={`${sizeClass} max-w-[16rem] min-w-[7.5rem] rounded-lg border border-border/80 bg-white px-2.5 pr-7 text-muted shadow-[0_1px_2px_rgba(33,32,33,0.05),0_4px_10px_rgba(33,32,33,0.03)] outline-none transition hover:border-[rgba(47,99,184,0.32)] hover:text-text focus:border-[rgba(47,99,184,0.45)]`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`h-8 rounded-md border border-border bg-white px-2.5 text-[12px] outline-none focus:border-[rgba(47,99,184,0.45)] ${className}`}
    />
  )
}

export function StatusPill({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad' | 'neutral'
  children: ReactNode
}) {
  const toneClass = {
    ok: 'bg-[rgba(47,99,184,0.1)] text-infer',
    warn: 'bg-[rgba(138,98,50,0.12)] text-gang',
    bad: 'bg-[rgba(155,58,58,0.1)] text-alert',
    neutral: 'bg-[rgba(61,49,79,0.06)] text-dim',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${toneClass}`}>{children}</span>
}

export function QuotaBar({ used, quota }: { used: number; quota: number }) {
  const pct = quota <= 0 ? 0 : Math.min(100, Math.round((used / quota) * 100))
  const over = used > quota
  return (
    <div className="flex min-w-[132px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceae4]">
        <div className={`h-full ${over ? 'bg-gang' : 'bg-infer'}`} style={{ width: `${Math.max(pct, used > 0 ? 4 : 0)}%` }} />
      </div>
      <span className="font-mono text-[11px] text-muted">
        {used}/{quota}
      </span>
    </div>
  )
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  toolbar,
  onRow,
}: {
  columns: Array<{ key: string; header: string; className?: string; render: (row: T) => ReactNode }>
  rows: T[]
  toolbar?: ReactNode
  onRow?: (row: T) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      {toolbar ? <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">{toolbar}</div> : null}
      <div className="overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead className="bg-[#f6f5f2] text-[11px] text-dim">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-3 py-2 font-medium ${column.className ?? ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-[13px] text-dim">
                  没有记录
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRow ? () => onRow(row) : undefined}
                  className={`border-t border-border/80 ${onRow ? 'cursor-pointer hover:bg-[#f7f8fb]' : ''}`}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`px-3 py-2.5 align-middle text-muted ${column.className ?? ''}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-3 py-2 text-[11px] text-dim">{rows.length} 条</div>
    </div>
  )
}

export function Drawer({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
}) {
  const widthClass = size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-xl' : 'max-w-md'
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(33,32,33,0.28)]" onClick={onClose}>
      <div
        className={`flex h-full w-full ${widthClass} flex-col bg-white shadow-[0_12px_40px_rgba(0,0,0,0.16)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[18px]">{title}</h3>
          <button type="button" onClick={onClose} className="text-[12px] text-dim hover:text-text">
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-[12px] text-muted">
      <span>{label}</span>
      {children}
    </label>
  )
}
