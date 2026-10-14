/**
 * API client for Supplier Document Desk backend.
 * Falls back to mock data when VITE_USE_MOCK=true or backend is unreachable.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw Object.assign(new Error(err.message || 'Request failed'), { status: res.status, data: err })
  }
  return res.json()
}

// ─── Documents ───────────────────────────────────────────────────────────────

export async function listDocuments({ status, limit = 20, cursor } = {}) {
  if (USE_MOCK) return getMockList(status)
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (limit) params.set('limit', limit)
  if (cursor) params.set('cursor', cursor)
  return request(`/documents?${params}`)
}

export async function getDocument(id) {
  if (USE_MOCK) return getMockDocument(id)
  return request(`/documents/${id}`)
}

export async function uploadDocument(file, { language = 'en', type = 'invoice' } = {}) {
  const form = new FormData()
  form.append('file', file)
  form.append('language', language)
  form.append('type', type)
  return fetch(`${BASE_URL}/documents`, {
    method: 'POST',
    body: form,
  }).then(r => r.json())
}

export async function submitDecision(id, action, note = '') {
  return request(`/documents/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  })
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export async function getMetrics() {
  if (USE_MOCK) return getMockMetrics()
  return request('/metrics')
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function getOrders() {
  return request('/orders')
}

// ─── Mock helpers (used when VITE_USE_MOCK=true) ─────────────────────────────

async function getMockList(status) {
  const mod = await import('../mocks/index.js')
  const docs = mod.MOCK_DOCUMENTS_LIST
  if (!status) return { documents: docs, nextCursor: null }
  return { documents: docs.filter(d => d.status === status), nextCursor: null }
}

async function getMockDocument(id) {
  const mod = await import('../mocks/index.js')
  return mod.getMockDoc(id)
}

async function getMockMetrics() {
  const mod = await import('../mocks/index.js')
  return mod.MOCK_METRICS
}
