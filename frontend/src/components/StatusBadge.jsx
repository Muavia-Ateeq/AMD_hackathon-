/**
 * StatusBadge — renders a coloured pill for every document status.
 */
const STATUS_MAP = {
  auto_approved:    { label: 'Auto Approved', cls: 'badge-approved' },
  needs_review:     { label: 'Needs Review',  cls: 'badge-review'   },
  rejected:         { label: 'Rejected',       cls: 'badge-rejected' },
  processing:       { label: 'Processing…',    cls: 'badge-processing' },
  approved_by_human:{ label: 'Human Approved', cls: 'badge-human'   },
}

export default function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status, cls: 'badge bg-gray-100 text-gray-700' }
  return <span className={cls}>{label}</span>
}
