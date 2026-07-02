// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, ClipboardList, Bell, User, LogOut,
  Clock, FileText, BarChart3, ChevronLeft, ChevronRight,
  Users, History,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import Avatar from '@/components/ui/Avatar'
import { BrandLogo, BrandLockup } from '@/components/ui/BrandLogo'
import toast from 'react-hot-toast'

const ICON_MAP = {
  LayoutDashboard, CalendarDays, ClipboardList, Bell, User, Clock,
  FileText, BarChart3, Users, History,
}

// "Book Appointment" is intentionally absent — students book straight from the
// dashboard calendar (the /student/book route still exists for deep links).
const STUDENT_LINKS = [
  { to: '/student/dashboard',      icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: '/student/appointments',   icon: 'ClipboardList',   label: 'My Appointments' },
  { to: '/student/referrals',      icon: 'Users',           label: 'My Referrals' },
  { to: '/student/pre-assessments',icon: 'FileText',        label: 'Pre-Assessments' },
  { to: '/student/notifications',  icon: 'Bell',            label: 'Notifications' },
  { to: '/student/profile',        icon: 'User',            label: 'Profile' },
]

const COUNSELOR_LINKS = [
  { to: '/counselor/dashboard',       icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: '/counselor/schedule',        icon: 'Clock',           label: 'My Schedule' },
  { to: '/counselor/appointments',    icon: 'ClipboardList',   label: 'Appointments' },
  { to: '/counselor/referrals',       icon: 'Users',           label: 'Referrals' },
  { to: '/counselor/history',         icon: 'History',         label: 'Student History' },
  { to: '/counselor/pre-assessments', icon: 'FileText',        label: 'Pre-Assessments' },
  { to: '/counselor/reports',         icon: 'BarChart3',       label: 'Reports' },
  { to: '/counselor/notifications',   icon: 'Bell',            label: 'Notifications' },
  { to: '/counselor/profile',         icon: 'User',            label: 'Profile' },
]

const FACULTY_LINKS = [
  { to: '/faculty/dashboard',       icon: 'LayoutDashboard', label: 'Dashboard' },
  { to: '/faculty/referrals',       icon: 'Users',           label: 'My Referrals' },
  { to: '/faculty/referrals/new',   icon: 'ClipboardList',   label: 'New Referral' },
  { to: '/faculty/notifications',   icon: 'Bell',            label: 'Notifications' },
  { to: '/faculty/profile',         icon: 'User',            label: 'Profile' },
]

const ROLE_LINKS = {
  student:   STUDENT_LINKS,
  counselor: COUNSELOR_LINKS,
  faculty:   FACULTY_LINKS,
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { user, logout } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const navigate = useNavigate()

  const links = ROLE_LINKS[user?.role] ?? STUDENT_LINKS

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
  ].filter(Boolean).join(' ')

  const mobileVisibility = mobileOpen
    ? 'translate-x-0'
    : '-translate-x-full lg:translate-x-0'

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`${sidebarClass} fixed top-0 left-0 h-full z-30 transition-transform duration-300 ${mobileVisibility} flex flex-col`}
        aria-label="Navigation sidebar"
      >
        {/* Logo area — official GAB.AI brand lockup */}
        <div className="sidebar-logo-area">
          {collapsed ? (
            <div className="w-full flex justify-center">
              <span className="flex items-center justify-center rounded-xl bg-white/15" style={{ width: 40, height: 40 }}>
                <BrandLogo variant="white" size={26} />
              </span>
            </div>
          ) : (
            <BrandLockup tone="light" size={32} subtitle="MKD Guidance Office" wordmarkClass="text-base" />
          )}
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Avatar name={user?.fullName} src={user?.profilePic} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.fullName}</p>
                <p className="text-[11px] text-white/50 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {links.map(({ to, icon, label }) => {
            const Icon = ICON_MAP[icon] || User
            const isNotif = icon === 'Bell'
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  `sidebar-nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0 mx-3' : ''}`
                }
              >
                <div className={`sidebar-icon-wrap ${collapsed ? 'w-10 h-10' : ''}`}>
                  <Icon size={18} />
                </div>
                {!collapsed && <span className="flex-1 text-sm">{label}</span>}
                {isNotif && unreadCount > 0 && (
                  <span className="badge-count bg-error text-white shrink-0">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom section: Collapse toggle (desktop) + Logout */}
        <div className="px-2 py-3 border-t border-white/10 space-y-1">
          {/* Desktop collapse toggle — now lives at the bottom */}
          <button
            onClick={onToggle}
            className={`hidden lg:flex sidebar-nav-link w-full text-white/60 hover:text-white hover:bg-white/10 ${collapsed ? 'justify-center px-0' : ''}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div className="sidebar-icon-wrap">
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </div>
            {!collapsed && <span className="text-sm">Collapse</span>}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`sidebar-nav-link w-full text-red-300 hover:bg-red-500/20 hover:text-red-200 ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <div className="sidebar-icon-wrap">
              <LogOut size={18} />
            </div>
            {!collapsed && <span className="text-sm">Log Out</span>}
          </button>
        </div>
      </aside>
    </>
  )
}