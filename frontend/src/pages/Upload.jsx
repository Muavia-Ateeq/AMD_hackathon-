import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  AlertTriangle,
  Calculator,
  Check,
  CloudUpload,
  FileText,
  FolderOpen,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  ScanSearch,
  Sparkles,
} from 'lucide-react'
import { uploadDocument } from '../api/client'

const STEPS = [
  { id: 'upload',   label: 'Uploading file',              icon: CloudUpload },
  { id: 'extract',  label: 'Extracting fields (Evolus)',  icon: ScanSearch },
  { id: 'classify', label: 'Classifying with AMD model',  icon: Sparkles },
  { id: 'rules',    label: 'Running rules engine',        icon: Calculator },
  { id: 'explain',  label: 'Generating explanation',      icon: MessageSquareText },
  { id: 'done',     label: 'Complete',                    icon: Check },
]

function ProgressStep({ step, state }) {
  const styles = {
    done:    'text-green-400',
    active:  'text-amd-redGlow animate-pulse',
    pending: 'text-amd-border',
  }
  const Icon = step.icon
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-amd-border last:border-0 transition-colors ${styles[state]}`}>
      <Icon size={18} className="w-7 shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium">{step.label}</span>
      {state === 'done' && <Check size={16} className="ml-auto text-green-500" aria-hidden="true" />}
      {state === 'active' && <LoaderCircle size={16} className="ml-auto animate-spin" aria-hidden="true" />}
    </div>
  )
}

export default function Upload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('en')
  const [docType, setDocType] = useState('invoice')
  const [uploading, setUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [error, setError] = useState(null)

  const onDrop = useCallback(accepted => {
    setFile(accepted[0] || null)
    setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
  })

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setCurrentStep(0)
    setError(null)

    try {
      const advance = (step, delay) =>
        new Promise(r => setTimeout(() => { setCurrentStep(step); r() }, delay))

      const [res] = await Promise.all([
        uploadDocument(file, { language, type: docType }),
        (async () => {
          await advance(1, 800)
          await advance(2, 1800)
          await advance(3, 2800)
          await advance(4, 3600)
        })(),
      ])

      setCurrentStep(5)
      if (res.id) {
        await new Promise(r => setTimeout(r, 600))
        navigate(`/documents/${res.id}`)
      }
    } catch (e) {
      setError(e.message || 'Upload failed')
      setCurrentStep(-1)
    } finally {
      setUploading(false)
    }
  }

  function stepState(idx) {
    if (currentStep < 0) return 'pending'
    if (idx < currentStep) return 'done'
    if (idx === currentStep) return 'active'
    return 'pending'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amd-text">Upload Document</h1>
        <p className="text-sm text-amd-sub mt-0.5">PDF invoices and delivery notes, up to 20 MB</p>
      </div>

      <div className="card space-y-5">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? 'border-amd-red bg-amd-red/5 shadow-lg shadow-amd-red/10'
              : 'border-amd-border hover:border-amd-red hover:bg-amd-muted/50'
          }`}
        >
          <input {...getInputProps()} />
          {file
            ? <FileText size={36} className="mx-auto mb-3 text-amd-red" aria-hidden="true" />
            : <FolderOpen size={36} className="mx-auto mb-3 text-amd-sub" aria-hidden="true" />}
          {file ? (
            <div>
              <p className="font-semibold text-amd-text">{file.name}</p>
              <p className="text-xs text-amd-sub mt-1">{(file.size / 1024).toFixed(0)} KB</p>
              <button
                onClick={e => { e.stopPropagation(); setFile(null) }}
                className="mt-2 text-xs text-amd-red hover:text-amd-redGlow transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <p className="text-amd-text font-medium">Drop a PDF here, or click to browse</p>
              <p className="text-xs text-amd-sub mt-1">PDF only · max 20 MB</p>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-amd-sub mb-1 block uppercase tracking-wide">Document Language</label>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="input"
            >
              <option value="en">🇬🇧 English</option>
              <option value="it">🇮🇹 Italian</option>
              <option value="de">🇩🇪 German</option>
              <option value="fr">🇫🇷 French</option>
              <option value="es">🇪🇸 Spanish</option>
              <option value="ar">🇸🇦 Arabic</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-amd-sub mb-1 block uppercase tracking-wide">Document Type</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="input"
            >
              <option value="invoice">🧾 Invoice</option>
              <option value="delivery_note">📦 Delivery Note</option>
            </select>
          </div>
        </div>

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {uploading
            ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Processing…</>
            : <><Sparkles size={18} aria-hidden="true" /> Process with AMD AI</>}
        </button>

        {error && (
          <div className="border border-red-900 bg-red-950/40 text-red-400 rounded-lg p-3 text-sm flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" /> {error}
          </div>
        )}
      </div>

      {/* Progress steps */}
      {currentStep >= 0 && (
        <div className="card">
          <h2 className="font-semibold text-amd-text mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amd-red rounded-full animate-pulse inline-block" />
            Processing Pipeline
          </h2>
          {STEPS.map((step, i) => (
            <ProgressStep key={step.id} step={step} state={stepState(i)} />
          ))}
        </div>
      )}

      <p className="text-xs text-amd-sub text-center">
        <Lightbulb size={14} className="inline-block mr-1" aria-hidden="true" />Demo: navigate to{' '}
        <span className="font-mono text-amd-red">/documents/doc-total-mismatch</span>
        {' '}to see the Italian invoice example.
      </p>
    </div>
  )
}
