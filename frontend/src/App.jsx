import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import DocumentDetail from './pages/DocumentDetail'
import ReviewQueue from './pages/ReviewQueue'
import Metrics from './pages/Metrics'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/documents/:id" element={<DocumentDetail />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="*" element={
            <div className="text-center py-20">
              <p className="text-6xl mb-4">🗂️</p>
              <p className="text-xl font-semibold text-gray-700">Page not found</p>
            </div>
          } />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
