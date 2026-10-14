import { NavLink } from 'react-router-dom'
import { ClipboardCheck, FileUp, LayoutDashboard, Zap } from 'lucide-react'

const NAV = [
  { to: '/',        label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/upload',  label: 'Upload',     icon: FileUp },
  { to: '/review',  label: 'Review Queue', icon: ClipboardCheck },
  { to: '/metrics', label: 'Metrics / AMD', icon: Zap },
]

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-amd-dark">
      {/* Top bar */}
      <header
        className="h-14 flex items-center px-6 gap-4 z-10 border-b border-amd-border"
        style={{ background: 'linear-gradient(90deg, #0A0A0A 0%, #110000 100%)' }}
      >
        {/* Logo mark */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-xs font-black text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, #B00010 0%, #6B0008 100%)', boxShadow: '0 0 12px rgba(176,0,16,0.5)' }}
          >
            A
          </div>
          <span className="font-semibold text-sm tracking-wide text-amd-text">
            Supplier Document Desk
          </span>
          <span className="hidden md:inline text-amd-border text-sm">|</span>
          <span className="hidden md:inline text-xs text-amd-sub">AMD Hackathon ACT III</span>
        </div>

        {/* Nav links */}
        <nav className="flex gap-0.5 ml-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-amd-red/20 text-white border border-amd-red/40 shadow-sm shadow-amd-red/20'
                    : 'text-amd-sub hover:bg-amd-muted hover:text-amd-text'
                }`
              }
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right badge */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-amd-sub hidden lg:inline">Team Code Voyagers</span>
          <span className="badge bg-amd-red/10 text-amd-red border border-amd-red/30 text-[10px] px-2 py-0.5">
            LIVE
          </span>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
