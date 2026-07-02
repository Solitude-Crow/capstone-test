// src/pages/counselor/CounselorDashboard.jsx
import { useEffect, useState, useCallback } from 'react'
import {
  CalendarDays, Clock, Users, CheckCircle2, AlertCircle,
  FileText, ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { appointmentAPI, availabilityAPI, preAssessmentAPI, referralAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { formatDate, formatTime } from '@/lib/utils'
import StatusBadge          from '@/components/ui/StatusBadge'
import Avatar               from '@/components/ui/Avatar'
import EmptyState           from '@/components/ui/EmptyState'
import GuidanceCalendar     from '@/components/ui/GuidanceCalendar'
import PresenceStatusPicker from '@/components/ui/PresenceStatusPicker'

export default function CounselorDashboard() {
  const { user } = useAuthStore()

  const [appointments,       setAppointments]       = useState([])
  const [availability,       setAvailability]       = useState([])
  const [pendingAssessments, setPendingAssessments] = useState(0)
  const [referralStats,      setReferralStats]      = useState({ total: 0, pending: 0, urgent: [] })
  const [loading,            setLoading]            = useState(true)
  const [loadingCalendar,    setLoadingCalendar]    = useState(true)
  const [calendarMonth,      setCalendarMonth]      = useState(new Date())

  // ── Core data ──
  useEffect(() => {
    Promise.all([
      appointmentAPI.getMyAll({ limit: 100 }),
      preAssessmentAPI.getCounselorAll({ status: 'submitted', limit: 1 }),
      referralAPI.getAllAdmin({ limit: 100 }),
    ])
      .then(([apptRes, assessRes, referralRes]) => {
        setAppointments(apptRes.data.appointments || [])
        setPendingAssessments(assessRes.data.pagination?.total || 0)
        const refs = referralRes.data.referrals || []
        setReferralStats({
          total:   refs.length,
          pending: refs.filter((r) => r.status === 'pending').length,
          urgent:  refs.filter((r) =>
            ['high', 'critical'].includes(r.priorityLevel ?? r.urgency) &&
            ['pending', 'under_review'].includes(r.status)
          ).slice(0, 3),
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Availability for calendar month ──
  useEffect(() => {
    if (!user?._id) return
    const start = format(startOfMonth(calendarMonth), 'yyyy-MM-dd')
    const end   = format(endOfMonth(calendarMonth),   'yyyy-MM-dd')
    const fetchAvailability = async () => {
      setLoadingCalendar(true)
      try {
        const { data } = await availabilityAPI.get({ counselorId: user._id, startDate: start, endDate: end })
        setAvailability(data)
      } catch {
        // silently ignore
      } finally {
        setLoadingCalendar(false)
      }
    }
    fetchAvailability()
  }, [calendarMonth, user?._id])

  const handleCalendarMonthChange = useCallback((newMonth) => {
    setCalendarMonth(newMonth)
  }, [])

  // Reflect calendar quick actions (accept/reject/complete/cancel) locally
  const handleAppointmentUpdate = useCallback((id, status) => {
    setAppointments((prev) => prev.map((a) => (a._id === id ? { ...a, status } : a)))
  }, [])

  const today = new Date().toDateString()
  const todayAppts = appointments.filter((a) =>
    new Date(a.date).toDateString() === today && ['accepted', 'pending'].includes(a.status)
  )
  const pending   = appointments.filter((a) => a.status === 'pending').length
  const accepted  = appointments.filter((a) => a.status === 'accepted').length
  const completed = appointments.filter((a) => a.status === 'completed').length

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="page-title">
              Welcome, <span className="text-primary-500">{user?.fullName?.split(' ')[0]}</span>
            </h1>
            <p className="page-subtitle">Here's your guidance office overview for today</p>
          </div>

          {/* Presence indicator */}
          <PresenceStatusPicker />
        </div>
      </div>

      {/* Appointment stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3">
        {[
          { label: "Today's Sessions", count: todayAppts.length, Icon: CalendarDays, color: 'bg-primary-50',  iconColor: 'text-primary-500' },
          { label: 'Pending Review',   count: pending,           Icon: Clock,        color: 'bg-amber-50',   iconColor: 'text-amber-500' },
          { label: 'Upcoming',         count: accepted,          Icon: Users,        color: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          { label: 'Completed',        count: completed,         Icon: CheckCircle2, color: 'bg-blue-50',    iconColor: 'text-blue-500' },
        ].map((item) => (
          <div key={item.label} className="stat-card">
            <div className={`stat-icon ${item.color} shrink-0`}>
              <item.Icon size={20} className={item.iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 font-display">{item.count}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Referral stats */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4">
        <Link to="/counselor/referrals" className="stat-card hover:shadow-md transition-shadow cursor-pointer">
          <div className="stat-icon bg-violet-50 shrink-0">
            <FileText size={20} className="text-violet-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-slate-900 font-display">{referralStats.total}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">Total Referrals</p>
          </div>
        </Link>
        <Link to="/counselor/referrals?filter=pending" className="stat-card hover:shadow-md transition-shadow cursor-pointer">
          <div className="stat-icon bg-orange-50 shrink-0">
            <AlertCircle size={20} className="text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-slate-900 font-display">{referralStats.pending}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">Pending Referrals</p>
          </div>
        </Link>
      </div>

      {/* Alerts */}
      {!loading && referralStats.urgent.length > 0 && (
        <Link to="/counselor/referrals"
          className="mb-3 flex items-center gap-3 sm:gap-4 p-3 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100 transition-colors">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-800 text-sm">
              {referralStats.urgent.length} high-urgency referral{referralStats.urgent.length > 1 ? 's' : ''} pending
            </p>
            <p className="text-red-600 text-xs">Students requiring immediate attention</p>
          </div>
          <span className="text-red-600 text-sm font-medium shrink-0">Review →</span>
        </Link>
      )}

      {pendingAssessments > 0 && (
        <Link to="/counselor/pre-assessments"
          className="mb-3 flex items-center gap-3 sm:gap-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl hover:bg-amber-100 transition-colors">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm">
              {pendingAssessments} unreviewed pre-assessment{pendingAssessments > 1 ? 's' : ''}
            </p>
            <p className="text-amber-600 text-xs">Review before upcoming sessions</p>
          </div>
          <span className="text-amber-600 text-sm font-medium shrink-0">Review →</span>
        </Link>
      )}

      {/* Calendar */}
      <div className="mb-4">
        <GuidanceCalendar
          role="counselor"
          appointments={appointments}
          availability={availability}
          isLoading={loadingCalendar}
          onMonthChange={handleCalendarMonthChange}
          onAppointmentUpdate={handleAppointmentUpdate}
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Today's schedule */}
        <div className="lg:col-span-3 card">
          <h2 className="font-display text-base sm:text-lg text-slate-900 mb-4 sm:mb-5">Today's Schedule</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : todayAppts.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No sessions today"
              description="Enjoy your free day or set up availability for upcoming sessions" />
          ) : (
            <div className="space-y-3">
              {todayAppts.map((appt) => (
                <div key={appt._id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-surface-50 rounded-xl border border-surface-200">
                  <div className="text-center min-w-12 shrink-0">
                    <p className="text-xs sm:text-sm font-bold text-primary-600">{formatTime(appt.startTime)}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400">{formatTime(appt.endTime)}</p>
                  </div>
                  <div className="w-px h-10 bg-surface-200 shrink-0" />
                  <Avatar name={appt.studentId?.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{appt.studentId?.fullName}</p>
                    <p className="text-xs text-slate-500 truncate">{appt.type}</p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending appointments */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="font-display text-base sm:text-lg text-slate-900">Pending Requests</h2>
            <Link to="/counselor/appointments" className="text-xs text-primary-500 font-medium hover:underline flex items-center gap-1">
              View all <ArrowRight size={11} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : appointments.filter((a) => a.status === 'pending').length === 0 ? (
            <EmptyState icon={Clock} title="No pending requests" description="All appointments are up to date" />
          ) : (
            <div className="space-y-2">
              {appointments.filter((a) => a.status === 'pending').slice(0, 5).map((appt) => (
                <div key={appt._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors">
                  <Avatar name={appt.studentId?.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{appt.studentId?.fullName}</p>
                    <p className="text-xs text-slate-500">{formatDate(appt.date)}</p>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
