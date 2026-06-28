// src/pages/counselor/AppointmentRequest.jsx
// (maps to /counselor/appointments route)
import { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import {
  Check, X, FileText, Trash2, CheckCircle2, Clock,
  CalendarDays, Loader2, AlertCircle, ChevronDown, ChevronUp, Star,
  RefreshCw, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { appointmentAPI } from '@/api'
import { formatDate, formatTime } from '@/lib/utils'
import PageBanner    from '@/components/ui/PageBanner'
import StatusBadge   from '@/components/ui/StatusBadge'
import FilterTabs    from '@/components/ui/FilterTabs'
import Modal         from '@/components/ui/Modal'
import EmptyState    from '@/components/ui/EmptyState'
import Avatar        from '@/components/ui/Avatar'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

/* ── Lazy-loaded modals (shared with the student appointments page) ─── */
const RescheduleModal = lazy(() => import('@/components/ui/MyAppointments/RescheduleModal'))
const CancelModal     = lazy(() => import('@/components/ui/MyAppointments/CancelModal'))

/* ── Notes Modal content ─────────────────────────────────────── */
function NotesContent({ appt }) {
  if (!appt) return null
  return (
    <div className="space-y-4">
      {appt.notes ? (
        <div>
          <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Student Notes</p>
          <p className="text-sm text-gray-700 bg-base-100 rounded-xl p-3 border border-base-200">{appt.notes}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No notes provided by the student.</p>
      )}
      {appt.counselorNotes && (
        <div>
          <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Your Notes</p>
          <p className="text-sm text-gray-700 bg-base-100 rounded-xl p-3 border border-base-200">{appt.counselorNotes}</p>
        </div>
      )}
      {appt.feedback?.content && (
        <div>
          <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Student Feedback</p>
          <div className="bg-warning/10 rounded-xl p-3 border border-warning/30">
            <div className="flex items-center gap-0.5 mb-1.5">
              {Array.from({ length: appt.feedback.rating }).map((_, i) => (
                <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm text-gray-700">{appt.feedback.content}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Mobile appointment card (< md) ─────────────────────────── */
const MobileCard = memo(({ appt, onAction, loadingActions }) => {
  const [expanded, setExpanded] = useState(false)
  const isPending    = appt.status === 'pending'
  const isAccepted   = appt.status === 'accepted'
  const isActionBusy = !!loadingActions[appt._id]

  return (
    <div className="mkd-card animate-slide-up">
      <div className="flex items-start gap-3">
        <Avatar name={appt.studentId?.fullName} src={appt.studentId?.profilePic} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-base-content truncate">{appt.studentId?.fullName}</p>
              {appt.studentId?.course && (
                <p className="text-xs text-gray-400">{appt.studentId.course} · {appt.studentId.yearLevel}</p>
              )}
            </div>
            <StatusBadge status={appt.status} />
          </div>
          <p className="text-xs text-gray-600 mt-1">{appt.type}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <CalendarDays size={11} /> {formatDate(appt.date)} · {formatTime(appt.startTime)}
          </p>
        </div>
      </div>

      <div className="divider my-2" />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {isPending && (
          <>
            <button
              onClick={() => onAction(appt._id, 'accepted')}
              disabled={isActionBusy}
              className="btn btn-success btn-xs gap-1 text-white"
            >
              {loadingActions[appt._id] === 'accepted' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Accept
            </button>
            <button
              onClick={() => onAction(appt._id, 'rejected')}
              disabled={isActionBusy}
              className="btn btn-error btn-xs gap-1 text-white"
            >
              {loadingActions[appt._id] === 'rejected' ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
              Reject
            </button>
          </>
        )}
        {isAccepted && (
          <button
            onClick={() => onAction(appt._id, 'completed')}
            disabled={isActionBusy}
            className="btn btn-secondary btn-xs gap-1 text-white"
          >
            {loadingActions[appt._id] === 'completed' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Complete
          </button>
        )}
        {(isPending || isAccepted) && (
          <button
            onClick={() => onAction(appt._id, 'reschedule')}
            disabled={isActionBusy}
            className="btn btn-outline btn-primary btn-xs gap-1"
          >
            <RefreshCw size={12} /> Reschedule
          </button>
        )}
        {(isPending || isAccepted || appt.status === 'rescheduled') && (
          <button
            onClick={() => onAction(appt._id, 'cancel')}
            disabled={isActionBusy}
            className="btn btn-outline btn-error btn-xs gap-1"
          >
            <XCircle size={12} /> Cancel
          </button>
        )}
        <button onClick={() => onAction(appt._id, 'notes')} className="btn btn-ghost btn-xs gap-1 btn-outline">
          <FileText size={12} /> Notes
        </button>
        {appt.preAssessmentSubmitted && (
          <Link to={`/counselor/pre-assessments/appointment/${appt._id}`} className="btn btn-outline btn-xs gap-1 btn-info">
            <FileText size={12} /> Pre-Assessment
          </Link>
        )}
        <button
          onClick={() => onAction(appt._id, 'delete')}
          disabled={isActionBusy}
          className="btn btn-ghost btn-xs gap-1 btn-outline text-error"
        >
          <Trash2 size={12} /> Delete
        </button>
        <button onClick={() => setExpanded(!expanded)} className="btn btn-ghost btn-xs ml-auto">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && appt.notes && (
        <div className="mt-3 pt-3 border-t border-base-100 animate-fade-in">
          <p className="text-xs text-gray-500 mb-1">Student notes:</p>
          <p className="text-xs text-gray-700 bg-base-50 rounded-lg p-2">{appt.notes}</p>
        </div>
      )}
    </div>
  )
})
MobileCard.displayName = 'MobileCard'

/* ── Desktop table row (≥ md) ───────────────────────────────── */
const TableRow = memo(({ appt, onAction, loadingActions }) => {
  const isPending    = appt.status === 'pending'
  const isAccepted   = appt.status === 'accepted'
  const isActionBusy = !!loadingActions[appt._id]

  return (
    <tr className="hover:bg-base-50 transition-colors">
      {/* Student */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={appt.studentId?.fullName} src={appt.studentId?.profilePic} size="sm" />
          <div>
            <p className="text-sm font-semibold text-base-content">{appt.studentId?.fullName}</p>
            {appt.studentId?.studentIDnum && (
              <p className="text-xs text-gray-400">ID: {appt.studentId.studentIDnum}</p>
            )}
            {appt.studentId?.course && (
              <p className="text-xs text-gray-400">{appt.studentId.course} · {appt.studentId.yearLevel}</p>
            )}
          </div>
        </div>
      </td>
      {/* Type */}
      <td className="px-5 py-4 text-sm text-gray-700">{appt.type}</td>
      {/* Date/Time */}
      <td className="px-5 py-4">
        <p className="text-sm text-gray-900 flex items-center gap-1">
          <CalendarDays size={13} className="text-primary" /> {formatDate(appt.date)}
        </p>
        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
          <Clock size={11} /> {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
        </p>
      </td>
      {/* Status */}
      <td className="px-5 py-4"><StatusBadge status={appt.status} /></td>
      {/* Actions */}
      <td className="px-5 py-4">
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {isPending && (
            <>
              <button
                onClick={() => onAction(appt._id, 'accepted')}
                disabled={isActionBusy}
                className="btn btn-success btn-xs text-white gap-1"
              >
                {loadingActions[appt._id] === 'accepted' ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Accept
              </button>
              <button
                onClick={() => onAction(appt._id, 'rejected')}
                disabled={isActionBusy}
                className="btn btn-error btn-xs text-white gap-1"
              >
                {loadingActions[appt._id] === 'rejected' ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />} Reject
              </button>
            </>
          )}
          {isAccepted && (
            <button
              onClick={() => onAction(appt._id, 'completed')}
              disabled={isActionBusy}
              className="btn btn-secondary btn-xs text-white gap-1"
            >
              {loadingActions[appt._id] === 'completed' ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} Complete
            </button>
          )}
          {(isPending || isAccepted) && (
            <button
              onClick={() => onAction(appt._id, 'reschedule')}
              disabled={isActionBusy}
              className="btn btn-outline btn-primary btn-xs gap-1"
            >
              <RefreshCw size={11} /> Reschedule
            </button>
          )}
          {(isPending || isAccepted || appt.status === 'rescheduled') && (
            <button
              onClick={() => onAction(appt._id, 'cancel')}
              disabled={isActionBusy}
              className="btn btn-outline btn-error btn-xs gap-1"
            >
              <XCircle size={11} /> Cancel
            </button>
          )}
          <button onClick={() => onAction(appt._id, 'notes')} className="btn btn-ghost btn-xs btn-outline gap-1">
            <FileText size={11} /> Notes
          </button>
          {appt.preAssessmentSubmitted && (
            <Link to={`/counselor/pre-assessments/appointment/${appt._id}`} className="btn btn-info btn-xs text-white gap-1">
              <FileText size={11} /> Form
            </Link>
          )}
          <button
            onClick={() => onAction(appt._id, 'delete')}
            disabled={isActionBusy}
            className="btn btn-ghost btn-xs btn-outline gap-1 text-error"
          >
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </td>
    </tr>
  )
})
TableRow.displayName = 'TableRow'

/* ═══════════════════════════════════════════════════════════════ */
const FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'pending',     label: 'Pending' },
  { value: 'accepted',    label: 'Accepted' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'completed',   label: 'Completed' },
  { value: 'rejected',    label: 'Rejected' },
  { value: 'cancelled',   label: 'Cancelled' },
]

export default function AppointmentRequest() {
  const [appointments, setAppointments]   = useState([])
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState('all')
  const [loadingActions, setLoadingActions] = useState({})  // { [id]: status }
  const [modal, setModal]                 = useState(null)   // 'notes' | 'delete'
  const [selectedAppt, setSelectedAppt]   = useState(null)
  const [deleting, setDeleting]           = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState(null)
  const [cancelTarget, setCancelTarget]         = useState(null)

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter !== 'all' ? { status: filter, limit: 100 } : { limit: 100 }
      const { data } = await appointmentAPI.getMyAll(params)
      setAppointments(data.appointments || [])
    } catch {
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const handleAction = useCallback(async (id, action) => {
    if (action === 'notes' || action === 'delete') {
      const appt = appointments.find((a) => a._id === id)
      setSelectedAppt(appt)
      setModal(action)
      return
    }

    // Reschedule / cancel open their own modal (reused from the student page).
    if (action === 'reschedule' || action === 'cancel') {
      const appt = appointments.find((a) => a._id === id)
      if (action === 'reschedule') setRescheduleTarget(appt)
      else setCancelTarget(appt)
      return
    }

    setLoadingActions((p) => ({ ...p, [id]: action }))
    try {
      await appointmentAPI.updateStatus(id, { status: action })
      toast.success(`Appointment ${action}`)
      setAppointments((prev) => prev.map((a) => a._id === id ? { ...a, status: action } : a))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setLoadingActions((p) => { const n = { ...p }; delete n[id]; return n })
    }
  }, [appointments])

  const handleConfirmDelete = async () => {
    if (!selectedAppt) return
    setDeleting(true)
    try {
      await appointmentAPI.delete(selectedAppt._id)
      toast.success('Appointment deleted')
      setAppointments((prev) => prev.filter((a) => a._id !== selectedAppt._id))
      setModal(null)
      setSelectedAppt(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete appointment')
    } finally {
      setDeleting(false)
    }
  }

  // Reflect a reschedule/cancel done via the shared modals in local state.
  const handleModalSuccess = useCallback(({ _id, action, patch }) => {
    setAppointments((prev) => prev.map((a) => {
      if (a._id !== _id) return a
      if (action === 'cancel')     return { ...a, status: 'cancelled',   ...(patch ?? {}) }
      if (action === 'reschedule') return { ...a, status: 'rescheduled', ...(patch ?? {}) }
      return a
    }))
  }, [])

  const filtersWithCounts = FILTERS.map((f) => ({
    ...f,
    count: f.value === 'all' ? appointments.length : appointments.filter((a) => a.status === f.value).length,
  }))

  const pendingCount = appointments.filter((a) => a.status === 'pending').length

  return (
    <>
      <PageBanner
        title="Appointment Requests"
        subtitle="Review and manage student appointment requests"
      />

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="alert alert-warning text-sm mb-5">
          <AlertCircle size={16} />
          <span>You have <strong>{pendingCount}</strong> pending appointment{pendingCount > 1 ? 's' : ''} awaiting review.</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-5 overflow-x-auto pb-1">
        <FilterTabs tabs={filtersWithCounts} active={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : appointments.length === 0 ? (
        <div className="mkd-card">
          <EmptyState icon={CalendarDays} title="No appointments" description="Appointment requests from students will appear here." />
        </div>
      ) : (
        <>
          {/* Mobile cards (< md) */}
          <div className="md:hidden space-y-4">
            {appointments.map((appt) => (
              <MobileCard key={appt._id} appt={appt} onAction={handleAction} loadingActions={loadingActions} />
            ))}
          </div>

          {/* Desktop table (≥ md) */}
          <div className="hidden md:block table-wrap">
            <table className="table table-zebra w-full text-sm">
              <thead className="bg-base-200 text-base-content">
                <tr>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wide">Student</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wide">Type</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wide">Date / Time</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wide">Status</th>
                  <th className="px-5 py-4 font-semibold text-xs uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <TableRow key={appt._id} appt={appt} onAction={handleAction} loadingActions={loadingActions} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Notes Modal */}
      <Modal isOpen={modal === 'notes'} onClose={() => setModal(null)} title="Appointment Notes">
        {selectedAppt && (
          <>
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-base-200">
              <Avatar name={selectedAppt.studentId?.fullName} size="sm" />
              <div>
                <p className="font-semibold text-sm">{selectedAppt.studentId?.fullName}</p>
                <p className="text-xs text-gray-400">{selectedAppt.type} · {formatDate(selectedAppt.date)}</p>
              </div>
              <StatusBadge status={selectedAppt.status} />
            </div>
            <NotesContent appt={selectedAppt} />
          </>
        )}
        <div className="flex justify-end mt-5">
          <button onClick={() => setModal(null)} className="btn btn-outline btn-sm">Close</button>
        </div>
      </Modal>

      {/* Delete confirmation Modal */}
      <Modal isOpen={modal === 'delete'} onClose={() => !deleting && setModal(null)} title="Delete Appointment">
        {selectedAppt && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-error/10 border border-error/30 rounded-xl">
              <AlertCircle size={18} className="text-error shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 leading-relaxed">
                Delete the <strong>{selectedAppt.status}</strong> appointment with{' '}
                <strong>{selectedAppt.studentId?.fullName || 'this student'}</strong> on{' '}
                {formatDate(selectedAppt.date)}?
                {['pending', 'accepted', 'rescheduled'].includes(selectedAppt.status) &&
                  ' The reserved time slot will be freed and the student will be notified.'}{' '}
                This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={deleting} className="btn btn-outline btn-sm">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} disabled={deleting} className="btn btn-error btn-sm text-white gap-1.5">
                {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule / Cancel modals (shared with the student page) */}
      <Suspense fallback={null}>
        {rescheduleTarget && (
          <RescheduleModal
            isOpen={!!rescheduleTarget}
            appointment={rescheduleTarget}
            viewerRole="counselor"
            onClose={() => setRescheduleTarget(null)}
            onSuccess={handleModalSuccess}
          />
        )}
        {cancelTarget && (
          <CancelModal
            isOpen={!!cancelTarget}
            appointment={cancelTarget}
            viewerRole="counselor"
            onClose={() => setCancelTarget(null)}
            onSuccess={handleModalSuccess}
          />
        )}
      </Suspense>
    </>
  )
}