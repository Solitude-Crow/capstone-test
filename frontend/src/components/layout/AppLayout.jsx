// src/components/layout/AppLayout.jsx
import { useState, useEffect } from 'react'
import { Menu, Bell } from 'lucide-react'
import Sidebar from './Sidebar'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuthStore } from '@/store/authStore'
import { usePresenceSync } from '@/hooks/usePresenceSync'
import { useSocket } from '@/hooks/useSocket'
import Avatar from '@/components/ui/Avatar'
import { Link } from 'react-router-dom'

export default function AppLayout({ children }) {
  const { user } = useAuthStore()
  const { unreadCount, fetchUnreadCount } = useNotificationStore()

  // Real-time notifications (incl. reminders) + presence subscription/idle detection.
  useSocket()
  usePresenceSync()

  // Desktop: collapsed state  |  Mobile: open state
  const [collapsed, setCollapsed]   = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const notifPath   = user?.role === 'counselor' ? '/counselor/notifications' : '/student/notifications'
  const profilePath = user?.role === 'counselor' ? '/counselor/profile'       : '/student/profile'

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    const handle = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  useEffect(() => { fetchUnreadCount() }, [fetchUnreadCount])

  // Offset main content to the right of the sidebar on desktop
  const marginClass = collapsed ? 'lg:ml-[72px]' : 'lg:ml-[236px]'

  return (
    <div className="page-root">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${marginClass}`}>
        {/* Top bar */}
        <header className="topbar">
          {/* Mobile hamburger — only shown on small screens */}
          <button
            className="lg:hidden btn btn-ghost btn-sm btn-square"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="lg:hidden flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto">
            <Link to={notifPath} className="btn btn-ghost btn-sm btn-square relative">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="badge-count-sm bg-error text-white absolute -top-0.5 -right-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to={profilePath}>
              <Avatar
                name={user?.fullName}
                src={user?.profilePic}
                size="xs"
                className="cursor-pointer hover:ring-primary transition-all"
              />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 page-inner animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}