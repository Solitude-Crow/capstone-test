// src/pages/student/MyAppointments.jsx
import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Clock, User, Trash2, RefreshCw,
  CheckCircle2, XCircle, AlertCircle,
  MessageCircleMore, Plus, Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { appointmentAPI } from '@/api'
import { formatTime, formatDate, STATUS_CLASS } from '@/lib/utils'
import PageBanner  from '@/components/ui/PageBanner'
import FilterTabs  from '@/components/ui/FilterTabs'
import AppointmentSourceBadge from '@/components/ui/AppointmentSourceBadge'
import EmptyState  from '@/components/ui/EmptyState'
import Avatar      from '@/components/ui/Avatar'

/* ── Lazy-loaded modals (not needed until user triggers them) ─── */
const RescheduleModal = lazy(() => import('@/components/ui/MyAppointments/RescheduleModal'))
const CancelModal     = lazy(() => import('@/components/ui/MyAppointments/CancelModal'))
const DeleteModal     = lazy(() => import('@/components/ui/MyAppointments/DeleteModal'))
const FeedbackModal   = lazy(() => import('@/components/ui/MyAppointments/FeedbackModal'))

/* ── Constants outside component (stable references) ─────────── */
const TAB_VALUES = ['all', 'pending', 'accepted', 'rescheduled', 'completed', 'cancelled', 'rejected']

/* ── Status badge ─────────────────────────────────────────────── */
const StatusBadge = memo(function StatusBadge({ status }) {
  const icons = {
    completed:   <CheckCircle2 size={12} />,
    pending:     <Clock size={12} />,
    accepted:    <CheckCircle2 size={12} />,
    rejected:    <XCircle size={12} />,
    rescheduled: <Calendar size={12} />,
    cancelled:   <XCircle size={12} />,
  }
  return (
    <span className={STATUS_CLASS[status] ?? 'badge-pill bg-slate-100 text-slate-600'}>
      {icons[status]}
      {status}
    </span>
  )
})

/* ── Appointment card ─────────────────────────────────────────── */
const AppointmentCard = memo(function AppointmentCard({
  appointment,
  onReschedule,
  onCancel,
  onDelete,
  onFeedback,
}) {
  const isActionable =
    (appointment.status === 'pending' || appointment.status === 'accepted') && !appointment.isPast

  const counselor = appointment.counselorId

  const handleReschedule     = useCallback(() => onReschedule(appointment), [appointment, onReschedule])
  const handleCancel         = useCallback(() => onCancel(appointment),     [appointment, onCancel])
  const handleDelete         = useCallback(() => onDelete(appointment),     [appointment, onDelete])
  const handleFeedback       = useCallback(() => onFeedback(appointment),   [appointment, onFeedback])

  const canDelete   = ['cancelled', 'rejected', 'completed'].includes(appointment.status)
  const canFeedback = appointment.status === 'completed' && !appointment.feedback?.content

  return (
    <div className="mkd-card p-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
      {/* Avatar — desktop only */}
      <Avatar
        name={counselor?.fullName}
        src={counselor?.profilePic}
        size="md"
        className="shrink-0 hidden sm:flex"
      />

      <div className="flex-1 min-w-0 space-y-2">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Avatar
              name={counselor?.fullName}
              src={counselor?.profilePic}
              size="xs"
              className="sm:hidden"
            />
            <p className="font-semibold text-base-content text-sm">
              {counselor?.fullName ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <AppointmentSourceBadge appointment={appointment} />
            <StatusBadge status={appointment.status} />
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <CalendarDays size={12} className="text-primary" />
            {formatDate(appointment.date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-primary" />
            {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
          </span>
          <span className="flex items-center gap-1">
            <User size={12} className="text-primary" />
            {appointment.type}
          </span>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <p className="text-xs text-gray-400 line-clamp-2 italic">"{appointment.notes}"</p>
        )}

        {/* Rescheduled notice */}
        {appointment.status === 'rescheduled' && appointment.previousDetails && (
          <div className="alert alert-info text-xs py-2 px-3">
            <AlertCircle size={13} />
            <span>
              Rescheduled by{' '}
              <strong className="capitalize">{appointment.previousDetails.rescheduledBy}</strong>.
              {' '}Original: {formatDate(appointment.previousDetails.date)}{' '}
              {formatTime(appointment.previousDetails.startTime)}
            </span>
          </div>
        )}

        {/* Cancellation reason */}
        {appointment.status === 'cancelled' && appointment.cancellationReason && (
          <p className="text-xs text-error">Reason: {appointment.cancellationReason}</p>
        )}

        {/* Counselor notes */}
        {appointment.status === 'completed' && appointment.counselorNotes && (
          <div className="bg-base-50 border border-base-200 rounded-lg p-2 text-xs text-gray-600">
            <span className="font-medium text-base-content">Counselor notes: </span>
            {appointment.counselorNotes}
          </div>
        )}

        {/* Feedback given */}
        {appointment.feedback?.content && (
          <div className="flex items-start gap-1 text-xs text-gray-400 italic">
            <MessageCircleMore size={12} className="mt-0.5 shrink-0 text-primary" />
            <span className="line-clamp-1">Your feedback: "{appointment.feedback.content}"</span>
          </div>
        )}

        {/* Actions */}
        {(isActionable || canFeedback || canDelete) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {isActionable && (
              <>
                <button
                  onClick={handleReschedule}
                  className="btn btn-outline btn-primary btn-xs gap-1"
                >
                  <RefreshCw size={12} /> Reschedule
                </button>
                <button
                  onClick={handleCancel}
                  className="btn btn-outline btn-error btn-xs gap-1"
                >
                  <XCircle size={12} /> Cancel
                </button>
              </>
            )}

            {canFeedback && (
              <button
                onClick={handleFeedback}
                className="btn btn-outline btn-primary btn-xs gap-1"
              >
                <MessageCircleMore size={12} /> Leave Feedback
              </button>
            )}

            {canDelete && (
              <button
                onClick={handleDelete}
                className="btn btn-outline btn-error btn-xs gap-1"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════ */
export default function MyAppointments() {
  const navigate = useNavigate()

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('all')

  /* ── Modal targets (null = closed) ── */
  const [rescheduleTarget, setRescheduleTarget] = useState(null)
  const [cancelTarget, setCancelTarget]         = useState(null)
  const [deleteTarget, setDeleteTarget]         = useState(null)
  const [feedbackTarget, setFeedbackTarget]     = useState(null)

  /* ── Fetch ── */
  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await appointmentAPI.getMyAll({ limit: 1000 })
      // Preprocess timestamps once — isPast is stable for the lifetime of
      // the fetched data (appointments don't un-pass their date).
      const now = Date.now()
      setAppointments(
        data.appointments.map((a) => ({
          ...a,
          createdAtMs: new Date(a.createdAt).getTime(),
          isPast: new Date(a.date).getTime() < now,
        }))
      )
    } catch {
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  /* ── Optimistic update helper ── */
  const applyMutation = useCallback(({ _id, action, patch }) => {
    setAppointments((prev) => {
      if (action === 'delete') return prev.filter((a) => a._id !== _id)
      return prev.map((a) => {
        if (a._id !== _id) return a
        if (action === 'cancel')     return { ...a, status: 'cancelled', ...(patch ?? {}) }
        if (action === 'reschedule') return { ...a, status: 'rescheduled', ...(patch ?? {}) }
        if (action === 'feedback')   return { ...a, feedback: patch?.feedback ?? a.feedback }
        return a
      })
    })
  }, [])

  /* ── Memoized counts ── */
  const counts = useMemo(() => {
    return TAB_VALUES.reduce((acc, v) => {
      acc[v] = v === 'all'
        ? appointments.length
        : appointments.filter((a) => a.status === v).length
      return acc
    }, {})
  }, [appointments])

  /* ── Memoized tabs ── */
  const tabs = useMemo(() =>
    TAB_VALUES.map((v) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
      count: counts[v],
    }))
  , [counts])

  /* ── Memoized filtered + sorted list ── */
  const filtered = useMemo(() => {
    const base = filter === 'all'
      ? appointments
      : appointments.filter((a) => a.status === filter)
    return [...base].sort((a, b) => b.createdAtMs - a.createdAtMs)
  }, [appointments, filter])

  /* ── Stable handlers ── */
  const initiateReschedule = useCallback((appt) => setRescheduleTarget(appt), [])
  const initiateCancel     = useCallback((appt) => setCancelTarget(appt),     [])
  const initiateDelete     = useCallback((appt) => setDeleteTarget(appt),     [])
  const initiateFeedback   = useCallback((appt) => setFeedbackTarget(appt),   [])

  const closeReschedule = useCallback(() => setRescheduleTarget(null), [])
  const closeCancel     = useCallback(() => setCancelTarget(null),     [])
  const closeDelete     = useCallback(() => setDeleteTarget(null),     [])
  const closeFeedback   = useCallback(() => setFeedbackTarget(null),   [])

  /* ── Render ── */
  return (
    <>
      <PageBanner
        title="My Appointments"
        subtitle="View and manage your counseling sessions"
        action={
          <button
            onClick={() => navigate('/student/book')}
            className="btn btn-white btn-sm gap-1.5 shadow"
          >
            <Plus size={14} /> Book New
          </button>
        }
      />

      <div className="space-y-4">
        <FilterTabs tabs={tabs} active={filter} onChange={setFilter} />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={filter === 'all' ? 'No appointments yet' : `No ${filter} appointments`}
            description={
              filter === 'all'
                ? 'Book a session with a guidance counselor to get started.'
                : `You have no ${filter} appointments at the moment.`
            }
            action={
              filter === 'all' && (
                <button
                  onClick={() => navigate('/student/book')}
                  className="btn btn-primary btn-sm gap-1"
                >
                  <Plus size={14} /> Book Appointment
                </button>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((appt) => (
              <AppointmentCard
                key={appt._id}
                appointment={appt}
                onReschedule={initiateReschedule}
                onCancel={initiateCancel}
                onDelete={initiateDelete}
                onFeedback={initiateFeedback}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lazy-loaded modals — only mounted when a target is set ── */}
      <Suspense fallback={null}>
        {rescheduleTarget && (
          <RescheduleModal
            isOpen={!!rescheduleTarget}
            appointment={rescheduleTarget}
            onClose={closeReschedule}
            onSuccess={applyMutation}
          />
        )}
        {cancelTarget && (
          <CancelModal
            isOpen={!!cancelTarget}
            appointment={cancelTarget}
            onClose={closeCancel}
            onSuccess={applyMutation}
          />
        )}
        {deleteTarget && (
          <DeleteModal
            isOpen={!!deleteTarget}
            appointment={deleteTarget}
            onClose={closeDelete}
            onSuccess={applyMutation}
          />
        )}
        {feedbackTarget && (
          <FeedbackModal
            isOpen={!!feedbackTarget}
            appointment={feedbackTarget}
            onClose={closeFeedback}
            onSuccess={applyMutation}
          />
        )}
      </Suspense>
    </>
  )
}