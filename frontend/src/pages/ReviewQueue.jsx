import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react'
import { listDocuments } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const RISK_RANK = { rejected: 3, needs_review: 2, processing: 1, auto_approved: 0 }

export default function ReviewQueue() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      listDocuments({ status: 'needs_review' }),
      listDocuments({ status: 'rejected' }),
    ])
      .then(([reviewRes, rejectedRes]) => {
        const all = [...(reviewRes.documents || []), ...(rejectedRes.documents || [])]
        all.sort((a, b) => {
          const rd = (RISK_RANK[b.status] || 0) - (RISK_RANK[a.status] || 0)
          if (rd !== 0) return rd
          return new Date(b.uploadedAt) - new Date(a.uploadedAt)
        })
        setDocs(all)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-amd-sub animate-pulse gap-2">
      <LoaderCircle size={20} className="text-amd-red animate-spin" aria-hidden="true" />
      Loading review queue…
    </div>
  )
  if (error) return (
    <div className="card border-red-900 bg-red-950/40 text-red-400 flex items-center gap-2">
      <AlertTriangle size={16} aria-hidden="true" /> {error}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amd-text">Review Queue</h1>
          <p className="text-sm text-amd-sub mt-0.5">Documents requiring human review, sorted by risk</p>
        </div>
        <span className="badge bg-amber-950 text-amber-400 border border-amber-900 text-base px-3 py-1.5">
          {docs.length} pending
        </span>
      </div>

      {docs.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-green-400" aria-hidden="true" />
          <p className="text-lg font-semibold text-amd-text">All clear!</p>
          <p className="text-sm text-amd-sub mt-1">No documents need human review right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <div key={doc.id}
              className="card hover:border-amd-muted transition-all duration-150 flex items-start gap-4">
              {/* Risk stripe */}
              <div className={`w-1 self-stretch rounded-full shrink-0 ${
                doc.status === 'rejected' ? 'bg-amd-red shadow-sm shadow-amd-red/50' : 'bg-amber-500'
              }`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-amd-text">{doc.fileName}</p>
                    <p className="text-sm text-amd-sub mt-0.5">
                      {doc.supplierName} · {doc.language?.toUpperCase()} · {doc.type === 'invoice' ? '🧾 Invoice' : '📦 Delivery Note'}
                    </p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                <p className="text-xs text-amd-sub mt-2">
                  Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                </p>
              </div>

              <Link to={`/documents/${doc.id}`} className="btn-primary shrink-0">
                Review <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-amd-sub text-center">
        High-risk documents (bank changes, duplicates) are shown first regardless of upload time.
      </p>
    </div>
  )
}
