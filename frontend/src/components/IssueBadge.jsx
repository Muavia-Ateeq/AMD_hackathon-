/**
 * IssueBadge — coloured pill for TOTAL_MISMATCH, PRICE_MISMATCH, etc.
 */
const SEVERITY_MAP = {
  high:   'bg-red-100 text-red-800 border border-red-200',
  medium: 'bg-amber-100 text-amber-800 border border-amber-200',
  low:    'bg-gray-100 text-gray-600 border border-gray-200',
}

const ICONS = {
  TOTAL_MISMATCH:     '🔢',
  DUPLICATE_INVOICE:  '🔁',
  BANK_DETAILS_CHANGED:'🏦',
  PRICE_MISMATCH:     '💰',
  QTY_MISMATCH:       '📦',
  MISSING_PO:         '📋',
  UNKNOWN_SUPPLIER:   '❓',
  LOW_CONFIDENCE:     '🔎',
}

export function IssueBadge({ type, severity }) {
  const cls = SEVERITY_MAP[severity] || SEVERITY_MAP.low
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {ICONS[type] || '⚠️'} {type.replace(/_/g, ' ')}
    </span>
  )
}

export function IssueCard({ issue }) {
  const sev = issue.severity || 'low'
  const borderCls = `severity-${sev}`
  return (
    <div className={`rounded-lg border p-3 text-sm ${borderCls}`}>
      <div className="flex items-start gap-2">
        <IssueBadge type={issue.type} severity={sev} />
        <span className="text-xs text-gray-500 ml-auto capitalize">{sev} severity</span>
      </div>
      <p className="mt-1 leading-snug">{issue.message}</p>
      {issue.field && (
        <p className="text-xs mt-0.5 opacity-70">Field: <code>{issue.field}</code></p>
      )}
    </div>
  )
}
