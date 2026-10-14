/**
 * ConfidenceBar — coloured mini bar showing field confidence (0.0 – 1.0).
 * Green ≥ 0.90 | Amber 0.70–0.89 | Red < 0.70
 */
export default function ConfidenceBar({ value }) {
  if (value == null) return <span className="text-xs text-amd-sub">—</span>
  const pct = Math.round(value * 100)
  const color =
    value >= 0.90 ? 'bg-green-500' :
    value >= 0.70 ? 'bg-amber-400' :
    'bg-amd-red'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-amd-muted rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-amd-sub w-9 text-right">{pct}%</span>
    </div>
  )
}
