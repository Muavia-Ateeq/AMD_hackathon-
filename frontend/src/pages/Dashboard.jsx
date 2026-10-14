import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, FileText, FileUp, LoaderCircle, SearchCheck } from 'lucide-react'
import { listDocuments, getMetrics } from '../api/client'
import StatusBadge from '../components/StatusBadge'

function StatCard({ label, value, sub, color = 'default', index = 0 }) {
  const accent = {
    green:  'border-l-4 border-green-600',
    amber:  'border-l-4 border-amber-500',
    red:    'border-l-4 border-amd-red',
    blue:   'border-l-4 border-blue-600',
    purple: 'border-l-4 border-purple-600',
    default:'border-l-4 border-amd-border',
  }[color]
  return (
    <div className={`card stat-card ${accent}`} style={{ animationDelay: `${index * 120}ms` }}>
      <p className="text-xs text-amd-sub uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-amd-text">{value ?? '—'}</p>
      {sub && <p className="text-xs text-amd-sub mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [docs, setDocs] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([listDocuments({ limit: 20 }), getMetrics()])
      .then(([docRes, metRes]) => {
        setDocs(docRes.documents || [])
        setMetrics(metRes)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-amd-sub animate-pulse gap-2">
      <LoaderCircle size={20} className="text-amd-red animate-spin" aria-hidden="true" />
      Loading dashboard…
    </div>
  )
  if (error) return (
    <div className="card border-red-900 bg-red-950/40 text-red-400 flex items-center gap-2">
      <AlertTriangle size={16} aria-hidden="true" /> {error}
    </div>
  )

  const counts = metrics?.countsByStatus || {}
  const total = Object.values(counts).reduce((s, v) => s + v, 0)
  const minutesSaved = metrics?.minutesSavedPerDoc
    ? `${(metrics.minutesSavedPerDoc * total).toFixed(0)} min saved total`
    : null

  const reviewDocs = docs.filter(d => d.status === 'needs_review')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amd-text">Dashboard</h1>
          <p className="text-sm text-amd-sub mt-0.5">Real-time supplier document processing</p>
        </div>
        <Link to="/upload" className="btn-primary">
          <FileUp size={16} aria-hidden="true" /> Upload Document
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total" value={total} sub={minutesSaved} color="default" index={0} />
        <StatCard label="Auto Approved" value={counts.auto_approved} color="green" index={1} />
        <StatCard label="Needs Review" value={counts.needs_review} color="amber" index={2} />
        <StatCard label="Rejected" value={counts.rejected} color="red" index={3} />
        <StatCard label="Processing" value={counts.processing} color="blue" index={4} />
      </div>

      {/* Review queue highlight */}
      {reviewDocs.length > 0 && (
        <div className="card border-amber-900/60 bg-amber-950/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-amber-400 flex items-center gap-2">
              <SearchCheck size={18} aria-hidden="true" />
              Needs Your Attention ({reviewDocs.length})
            </h2>
            <Link to="/review" className="text-xs text-amber-500 font-medium hover:text-amber-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {reviewDocs.slice(0, 3).map(doc => (
              <Link key={doc.id} to={`/documents/${doc.id}`}
                className="flex items-center gap-3 p-2.5 bg-amd-muted rounded-lg border border-amd-border hover:border-amber-800 transition-colors">
                <span className="text-lg">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amd-text truncate">{doc.fileName}</p>
                  <p className="text-xs text-amd-sub">{doc.supplierName} · {doc.language?.toUpperCase()}</p>
                </div>
                <StatusBadge status={doc.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent documents table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-amd-border flex items-center justify-between">
          <h2 className="font-semibold text-amd-text">Recent Documents</h2>
          <span className="text-xs text-amd-sub">{docs.length} shown</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-amd-sub uppercase tracking-wider bg-black/30">
            <tr>
              <th className="text-left px-6 py-3">File</th>
              <th className="text-left px-6 py-3">Supplier</th>
              <th className="text-left px-6 py-3">Type</th>
              <th className="text-left px-6 py-3">Lang</th>
              <th className="text-left px-6 py-3">Uploaded</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amd-border">
            {docs.map(doc => (
              <tr key={doc.id} className="hover:bg-amd-muted/50 transition-colors">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="shrink-0 text-amd-sub" aria-hidden="true" />
                    <span className="font-mono text-xs text-amd-sub truncate max-w-[160px]">{doc.fileName}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-amd-text">{doc.supplierName}</td>
                <td className="px-6 py-3">
                  <span className="badge bg-amd-muted text-amd-sub border border-amd-border">
                    {doc.type === 'invoice' ? '🧾 Invoice' : '📦 Delivery'}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span className="badge bg-blue-950 text-blue-400 border border-blue-900">
                    {doc.language?.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-3 text-amd-sub text-xs">
                  {new Date(doc.uploadedAt).toLocaleString()}
                </td>
                <td className="px-6 py-3"><StatusBadge status={doc.status} /></td>
                <td className="px-6 py-3">
                  <Link to={`/documents/${doc.id}`} className="btn-secondary text-xs py-1 px-2.5">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 0 && (
          <p className="text-center py-12 text-amd-sub">No documents yet. Upload one to get started.</p>
        )}
      </div>
    </div>
  )
}
