import { useApp } from '../../store/AppContext'

export function PowerStrip() {
  const { state } = useApp()

  return (
    <div className="flex gap-2 overflow-x-auto">
      {state.stations.map((st) => {
        const ratio = Math.round((st.currentMw / st.capacityMw) * 100)
        return (
          <div key={st.id} className="sheet min-w-[188px] px-3 py-2.5 transition hover:shadow-[0_0_0_1px_rgba(47,99,184,0.18)]">
            <div className="text-[12px] text-dim">{st.type}</div>
            <div className="mt-0.5 truncate text-[13px]">{st.name.replace('电站', '')}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(61,49,79,0.08)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2f63b8] to-[#5284d7]"
                style={{ width: `${ratio}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
              <span>{st.currentMw.toFixed(1)} MW</span>
              <span>{ratio}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
