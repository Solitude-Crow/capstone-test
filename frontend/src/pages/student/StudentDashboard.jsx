// src/pages/student/StudentDashboard.jsx
import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays, Clock, CheckCircle2, AlertCircle,
  ArrowRight, FileText, ClipboardList, Sparkles,
  BookOpen, Phone, Eye, ChevronRight, X, Loader2,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { appointmentAPI, availabilityAPI, authAPI, referralAPI } from '@/api'
import { formatDate, formatTime, timeAgo, APPOINTMENT_TYPES, RISK_LEVEL_CONFIG } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import ReferralStatusBadge from '@/components/ui/ReferralStatusBadge'
import UrgencyBadge from '@/components/ui/UrgencyBadge'
import EmptyState from '@/components/ui/EmptyState'
import GuidanceCalendar from '@/components/ui/GuidanceCalendar'
import { format, startOfMonth, endOfMonth } from 'date-fns'

// Maps AI recommendedAction → icon + color for the dashboard pill
const ACTION_DISPLAY = {
  book_appointment:  { label: 'Book Appointment',  Icon: CalendarDays, color: 'text-primary-600',  bg: 'bg-primary-50'  },
  self_help:         { label: 'Self-Help',          Icon: BookOpen,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  external_referral: { label: 'Seek Referral',      Icon: Phone,        color: 'text-orange-600',  bg: 'bg-orange-50'  },
  monitor_self:      { label: 'Self-Monitor',        Icon: Eye,          color: 'text-blue-600',    bg: 'bg-blue-50'    },
}

// ── Quick-book modal ──────────────────────────────────────────────────────────
function QuickBookModal({ slot, counselorId, date, counselors, onClose, onBooked }) {
  const [type, setType] = useState(APPOINTMENT_TYPES[0])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const counselor = counselors.find(
    (c) => c._id === counselorId || c._id === counselorId?._id || c._id === counselorId?.toString()
  )

  const handleBook = async () => {
    setSubmitting(true)
    try {
      const { data } = await appointmentAPI.create({
        counselorId: counselor?._id ?? counselorId,
        type,
        date: format(date, 'yyyy-MM-dd'),
        startTime: slot.startTime,
        endTime: slot.endTime,
        notes,
      })
      toast.success('Appointment booked!')
      onBooked(data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to book appointment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-200">
          <div>
            <p className="text-xs text-primary-500 font-semibold uppercase tracking-wide">Quick Book</p>
            <p className="font-display font-semibold text-slate-900 mt-0.5">
              {formatDate(date)} · {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
            </p>
            {counselor && (
              <p className="text-xs text-slate-500 mt-0.5">with {counselor.fullName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Appointment type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Appointment Type <span className="text-red-400">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all"
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Briefly describe your concern…"
              className="w-full px-3 py-2 rounded-xl border border-surface-200 bg-surface-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all resize-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-surface-200 text-sm font-medium text-slate-600 hover:bg-surface-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBook}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Booking…</> : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [appointments,    setAppointments]    = useState([])
  const [assessments,     setAssessments]     = useState([])
  const [availability,    setAvailability]    = useState([])
  const [counselors,      setCounselors]      = useState([])
  const [referrals,       setReferrals]       = useState([])
  const [calendarMonth,   setCalendarMonth]   = useState(new Date())
  const [loadingAppts,    setLoadingAppts]    = useState(true)
  const [loadingAssess,   setLoadingAssess]   = useState(true)
  const [loadingCalendar, setLoadingCalendar] = useState(true)

  // Quick-book state
  const [bookTarget, setBookTarget] = useState(null) // { slot, counselorId, date }

  // ── Fetch core data ──
  useEffect(() => {
    appointmentAPI.getMyAll({ limit: 100 })
      .then(({ data }) => setAppointments(data.appointments || []))
      .catch(() => {})
      .finally(() => setLoadingAppts(false))

    import('@/api').then(({ preAssessmentAPI }) => {
      preAssessmentAPI.getMyAll({ limit: 3 })
        .then(({ data }) => setAssessments(data.assessments || []))
        .catch(() => {})
        .finally(() => setLoadingAssess(false))
    })

    authAPI.getUsersByRole('counselor')
      .then(({ data }) => setCounselors(data.users || data || []))
      .catch(() => {})

    referralAPI.getAll({ limit: 10 })
      .then(({ data }) => setReferrals(data.referrals || []))
      .catch(() => {})
  }, [])

  // ── Fetch availability for current calendar month ──
  useEffect(() => {
    const fetchCalendarData = async () => {
      setLoadingCalendar(true)
      try {
        const start = format(startOfMonth(calendarMonth), 'yyyy-MM-dd')
        const end   = format(endOfMonth(calendarMonth),   'yyyy-MM-dd')

        // Fetch availability for all counselors in parallel
        const results = await Promise.allSettled(
          (counselors.length > 0 ? counselors : []).map((c) =>
            availabilityAPI.get({ counselorId: c._id, startDate: start, endDate: end })
              .then(({ data }) => data)
          )
        )
        const all = results
          .filter((r) => r.status === 'fulfilled')
          .flatMap((r) => r.value)
        setAvailability(all)
      } catch {
        // silently ignore
      } finally {
        setLoadingCalendar(false)
      }
    }

    if (counselors.length > 0) {
      fetchCalendarData()
    } else {
      setLoadingCalendar(false)
    }
  }, [calendarMonth, counselors])

  const counts = {
    pending:   appointments.filter((a) => a.status === 'pending').length,
    accepted:  appointments.filter((a) => a.status === 'accepted').length,
    completed: appointments.filter((a) => a.status === 'completed').length,
    cancelled: appointments.filter((a) => ['cancelled', 'rejected'].includes(a.status)).length,
  }

  const upcoming = appointments.find((a) => ['pending', 'accepted', 'rescheduled'].includes(a.status))

  const greeting = new Date().getHours() < 12 ? 'morning'
    : new Date().getHours() < 17 ? 'afternoon' : 'evening'

  // Called when the calendar's month changes
  const handleCalendarMonthChange = useCallback((newMonth) => {
    setCalendarMonth(newMonth)
  }, [])

  // Called when user clicks a free slot in the calendar
  const handleBookSlot = useCallback((slot, counselorId, date) => {
    setBookTarget({ slot, counselorId, date })
  }, [])

  // After booking succeeds, add the new appointment to local state
  const handleBooked = useCallback((newAppt) => {
    setAppointments((prev) => [newAppt, ...prev])
    // Mark the slot as booked in local availability
    setAvailability((prev) =>
      prev.map((av) => {
        const avKey  = typeof av.date === 'string' ? av.date.slice(0, 10) : ''
        const dateKey = format(bookTarget?.date ?? new Date(), 'yyyy-MM-dd')
        if (avKey !== dateKey) return av
        return {
          ...av,
          availableSlots: av.availableSlots.map((s) =>
            s.startTime === bookTarget?.slot?.startTime && s.endTime === bookTarget?.slot?.endTime
              ? { ...s, isBooked: true }
              : s
          ),
        }
      })
    )
  }, [bookTarget])

  return (
    <>
      <div className="animate-fade-in max-w-7xl mx-auto px-2 lg:px-6">
        {/* Header */}
        <div className="page-header">
          <h1 className="text-3xl page-title">
            Good {greeting},{' '}
            <span className="text-primary-500">{user?.fullName?.split(' ')[0]}</span>
          </h1>
          <p className="page-subtitle">Here's an overview of your guidance journey</p>
        </div>

        {/* ── Pre-assessment CTA ── */}
        {!loadingAssess && (
          assessments.length === 0 ? (
            <div className="mb-6 rounded-2xl overflow-hidden border border-primary-200 bg-linear-to-br from-primary-50 to-white">
              <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center shrink-0">
                  <ClipboardList size={22} className="text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="font-display font-semibold text-slate-900">
                    Start with a Pre-Assessment
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Answer a few questions about your concern and get a personalized recommendation — including whether to book a counseling session.
                  </p>
                </div>
                <Link to="/student/pre-assessment"
                  className="btn-primary shrink-0 flex items-center gap-2 self-start sm:self-auto border border-primary-600 rounded-xl px-4 py-2 font-semibold">
                  Get Started <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mb-6 flex items-center justify-between p-4 bg-surface-50 border border-surface-200 rounded-xl">
              <div className="flex items-center gap-3">
                <Sparkles size={16} className="text-primary-400" />
                <p className="text-sm text-slate-600">
                  Have a new concern? <span className="text-slate-400 text-xs">Pre-assessments help your counselor prepare.</span>
                </p>
              </div>
              <Link to="/student/pre-assessment"
                className="text-sm text-primary-600 font-semibold flex items-center gap-1 hover:text-primary-700">
                New Assessment <ChevronRight size={14} />
              </Link>
            </div>
          )
        )}

        {/* ── Upcoming appointment banner ── */}
        {upcoming && (
          <div className="mb-6 bg-white border-2 border-primary-200 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center shrink-0">
                <CalendarDays size={22} className="text-primary-600" />
              </div>
              <div>
                <p className="text-primary-500 text-xs font-semibold uppercase tracking-wide">Upcoming Appointment</p>
                <p className="font-display text-lg mt-0.5 text-slate-900 font-bold">{upcoming.type}</p>
                <p className="text-slate-600 text-sm mt-0.5">
                  {formatDate(upcoming.date)} · {formatTime(upcoming.startTime)} – {formatTime(upcoming.endTime)}
                  {upcoming.counselorId?.fullName && (
                    <span className="text-primary-500 font-medium"> · {upcoming.counselorId.fullName}</span>
                  )}
                </p>
              </div>
            </div>
            <StatusBadge status={upcoming.status} />
          </div>
        )}

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pending',   count: counts.pending,   Icon: Clock,        color: 'bg-amber-50',   iconColor: 'text-amber-500'  },
            { label: 'Accepted',  count: counts.accepted,  Icon: CheckCircle2, color: 'bg-emerald-50', iconColor: 'text-emerald-500' },
            { label: 'Completed', count: counts.completed, Icon: CalendarDays, color: 'bg-blue-50',    iconColor: 'text-blue-500'    },
            { label: 'Cancelled', count: counts.cancelled, Icon: AlertCircle,  color: 'bg-red-50',     iconColor: 'text-red-400'     },
          ].map((item) => (
            <div key={item.label} className="stat-card">
              <div className={`stat-icon ${item.color}`}>
                <item.Icon size={20} className={item.iconColor} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 font-display">{item.count}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Active referral banner ── */}
        {referrals.filter((r) => ['pending', 'under_review', 'accepted'].includes(r.status)).length > 0 && (
          <div className="mb-6 bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-start gap-4">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
              <Users size={18} className="text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-violet-900 text-sm">You have an active counseling referral</p>
              <div className="mt-2 space-y-1.5">
                {referrals
                  .filter((r) => ['pending', 'under_review', 'accepted'].includes(r.status))
                  .slice(0, 2)
                  .map((r) => (
                    <div key={r._id} className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-violet-700">{r.category}</span>
                      <UrgencyBadge urgency={r.urgency} />
                      <ReferralStatusBadge status={r.status} />
                      <span className="text-xs text-violet-500">
                        · Referred by {r.facultyId?.fullName ?? 'faculty'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to="/student/pre-assessment" className="card-hover group flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center group-hover:bg-violet-100 transition-colors">
              <ClipboardList size={22} className="text-violet-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">Pre-Assessment</p>
              <p className="text-xs text-slate-500 mt-0.5">Get a personalized recommendation</p>
            </div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-violet-500 transition-colors" />
          </Link>

          <Link to="/student/book" className="card-hover group flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
              <CalendarDays size={22} className="text-primary-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">Book an Appointment</p>
              <p className="text-xs text-slate-500 mt-0.5">Schedule a session with a counselor</p>
            </div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
          </Link>

          <Link to="/student/appointments" className="card-hover group flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-50 rounded-xl flex items-center justify-center group-hover:bg-accent-100 transition-colors">
              <FileText size={22} className="text-accent-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-800">My Appointments</p>
              <p className="text-xs text-slate-500 mt-0.5">View and manage your appointments</p>
            </div>
            <ArrowRight size={16} className="text-slate-400 group-hover:text-accent-500 transition-colors" />
          </Link>
        </div>

        {/* ── Calendar ── */}
        <div className="mb-8">
          <GuidanceCalendar
            role="student"
            appointments={appointments}
            availability={availability}
            counselors={counselors}
            onBookSlot={handleBookSlot}
            isLoading={loadingCalendar && counselors.length > 0}
            onMonthChange={handleCalendarMonthChange}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Recent pre-assessments ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-slate-900">My Pre-Assessments</h2>
              <Link to="/student/pre-assessments" className="text-sm text-primary-500 font-medium hover:underline">
                View all
              </Link>
            </div>

            {loadingAssess ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
              </div>
            ) : assessments.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No assessments yet"
                description="Complete a pre-assessment to get personalized guidance"
                action={
                  <Link to="/student/pre-assessment" className="btn-primary text-sm">
                    Start Now
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {assessments.map((a) => {
                  const ar       = a.assessmentResults
                  const riskCfg  = ar?.riskLevel ? RISK_LEVEL_CONFIG[ar.riskLevel] : null
                  const category = ar?.detectedCategory || a.primaryConcern || 'Pre-Assessment'
                  // Legacy fallback for old AI submissions
                  const action = a.aiRecommendations?.recommendedAction
                  const display = action ? ACTION_DISPLAY[action] : null
                  const ActionIcon = display?.Icon
                  return (
                    <div key={a._id}
                      className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/student/pre-assessment/${a._id}/detail`)}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${display?.bg || 'bg-primary-50'}`}>
                        {ActionIcon
                          ? <ActionIcon size={15} className={display.color} />
                          : <ClipboardList size={15} className="text-primary-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{category}</p>
                        <p className="text-xs text-slate-400">{timeAgo(a.createdAt)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {riskCfg ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>
                            {riskCfg.label}
                          </span>
                        ) : display ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${display.bg} ${display.color}`}>
                            {display.label}
                          </span>
                        ) : null}
                        {a.appointmentId && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle2 size={12} /> Linked
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Recent appointments ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-slate-900">Recent Appointments</h2>
              <Link to="/student/appointments" className="text-sm text-primary-500 font-medium hover:underline">
                View all
              </Link>
            </div>

            {loadingAppts ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
              </div>
            ) : appointments.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No appointments yet"
                description="Complete a pre-assessment first, then book a session"
                action={
                  <Link to="/student/pre-assessment" className="btn-primary text-sm">
                    Start Pre-Assessment
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {appointments.slice(0, 5).map((appt) => (
                  <div key={appt._id}
                    className="flex items-center justify-between p-4 bg-surface-50 rounded-xl hover:bg-surface-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl border border-surface-200 flex items-center justify-center">
                        <CalendarDays size={16} className="text-primary-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{appt.type}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(appt.date)} · {formatTime(appt.startTime)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick-book modal ── */}
      {bookTarget && (
        <QuickBookModal
          slot={bookTarget.slot}
          counselorId={bookTarget.counselorId}
          date={bookTarget.date}
          counselors={counselors}
          onClose={() => setBookTarget(null)}
          onBooked={handleBooked}
        />
      )}
    </>
  )
}