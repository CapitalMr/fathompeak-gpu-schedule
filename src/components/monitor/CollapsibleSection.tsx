import { useState, type ReactNode } from 'react'

export function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string
  badge?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-[14px] border border-border-bright bg-panel shadow-[0_2px_12px_rgba(33,32,33,0.06)]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className={`inline-block w-3 font-mono text-[13px] text-infer transition ${open ? '' : '-rotate-90'}`}>v</span>
        <span className="font-sans text-[13px] font-medium text-text">{title}</span>
        {badge ? <span className="ml-auto font-mono text-[10px] tracking-wide text-muted">{badge}</span> : null}
      </button>
      {open ? <div className="grid gap-2 border-t border-border bg-[#f7f6f2] px-2 pb-2 pt-2">{children}</div> : null}
    </section>
  )
}
