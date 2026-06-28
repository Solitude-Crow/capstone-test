// src/pages/counselor/CounselorReferrals.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { RefreshCw, X, Loader2, CalendarDays, XCircle, Users, FileText, Clock } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { referralAPI, availabilityAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import { APPOINTMENT_TYPES, formatTime } from '@/lib/utils'
import PageBanner    from '@/components/ui/PageBanner'
import FilterTabs    from '@/components/ui/FilterTabs'
import EmptyState    from '@/components/ui/EmptyState'
import SkeletonList  from '@/components/ui/SkeletonList'
import ReferralCard  from '@/components/ui/ReferralCard'

const STATUSES = ['all', 'pending', 'under_review', 'accepted', 'scheduled', 'completed', 'rejected']

const STATUS_LABELS = {
  all: 'All', pending: 'Pending', under_review: 'Under Review',
  accepted: 'Accepted', scheduled: 'Scheduled', completed: 'Completed', rejected: 'Rejected',
}

// ── Reject modal ──────────────────────────────────────────────────────────────
function RejectModal({ referral, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await referralAPI.updateStatus(referral._id, { status: 'rejected', rejectionReason: reason })
      toast.success('Referral declined')
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to decline referral')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200">
          <div>
            <p className="font-display font-semibold text-slate-900">Decline Referral</p>
            <p className="text-xs text-slate-500 mt-0.5">
              For {referral.studentId?.fullName ?? 'student'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Reason for declining <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this referral cannot be accepted…"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Convert-to-appointment modal ──────────────────────────────────────────────
function ConvertModal({ referral, onClose, onDone }) {
  const { user }          = useAuthStore()
  const [date,            setDate]          = useState(
    referral.preferredDate ? new Date(referral.preferredDate) : null
  )
  const [selectedSlot,    setSelectedSlot]  = useState(null)
  const [type,            setType]          = useState(
    referral.category?.includes('Academic') ? 'Academic Counseling' : 'General Inquiry'
  )
  const [notes,           setNotes]         = useState(referral.reason ?? '')
  const [counselorNotes,  setCounselorNotes]= useState('')
  const [loading,         setLoading]       = useState(false)
  const [availability,    setAvailability]  = useState([])
  const [loadingAvail,    setLoadingAvail]  = useState(false)

  // Load counselor's own availability (next 60 days)
  useEffect(() => {
    if (!user?._id) return
    const load = async () => {
      setLoadingAvail(true)
      try {
        const today = new Date().toISOString().split('T')[0]
        const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { data } = await availabilityAPI.get({ counselorId: user._id, startDate: today, endDate: future })
        setAvailability(data)
      } catch {
        // silently ignore
      } finally {
        setLoadingAvail(false)
      }
    }
    load()
  }, [user?._id])

  // Dates with at least one free slot
  const availableDatesSet = useMemo(() => new Set(
    availability
      .filter((a) => !a.isHoliday && a.availableSlots.some((s) => !s.isBooked))
      .map((a) => new Date(a.date).toDateString())
  ), [availability])

  // Slots for selected date
  const slotsForDate = useMemo(() => {
    if (!date) return []
    return (
      availability.find((a) => isSameDay(new Date(a.date), date))
        ?.availableSlots.filter((s) => !s.isBooked) ?? []
    )
  }, [date, availability])

  const filterDate = (d) => availableDatesSet.has(d.toDateString())

  const submit = async () => {
    if (!date || !selectedSlot) {
      toast.error('Please select a date and time slot')
      return
    }
    setLoading(true)
    try {
      await referralAPI.convert(referral._id, {
        date:          date.toISOString(),
        startTime:     selectedSlot.startTime,
        endTime:       selectedSlot.endTime,
        type,
        notes:         notes || undefined,
        counselorNotes:counselorNotes || undefined,
      })
      toast.success('Appointment scheduled')
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to schedule appointment')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200 shrink-0">
          <div>
            <p className="font-display font-semibold text-slate-900">Schedule Appointment</p>
            <p className="text-xs text-slate-500 mt-0.5">
              For {referral.studentSnapshot?.fullName ?? referral.studentId?.fullName ?? 'student'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Date picker — only available dates */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Date <span className="text-red-400">*</span>
            </label>
            {loadingAvail ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Loader2 size={14} className="animate-spin" /> Loading your schedule…
              </div>
            ) : availableDatesSet.size === 0 ? (
              <p className="text-xs text-amber-600 py-2">
                No available dates found. Please set your availability in Manage Availability first.
              </p>
            ) : (
              <DatePicker
                selected={date}
                onChange={(d) => { setDate(d); setSelectedSlot(null) }}
                filterDate={filterDate}
                minDate={new Date()}
                dateFormat="MMMM d, yyyy"
                placeholderText="Select an available date"
                className={inputCls}
                calendarClassName="shadow-xl"
              />
            )}
          </div>

          {/* Time slot picker */}
          {date && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Time Slot <span className="text-red-400">*</span>
              </label>
              {slotsForDate.length === 0 ? (
                <p className="text-xs text-amber-600">No available slots on this date.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slotsForDate.map((slot, i) => {
                    const isSel = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedSlot(isSel ? null : slot)}
                        className={`flex flex-col items-center p-2 rounded-xl border text-xs font-medium transition-all ${
                          isSel
                            ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200 text-primary-700'
                            : 'border-slate-200 bg-white hover:border-primary-300 text-slate-700'
                        }`}
                      >
                        <Clock size={11} className="mb-0.5 opacity-70" />
                        <span>{formatTime(slot.startTime)}</span>
                        <span className="opacity-60">– {formatTime(slot.endTime)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Appointment type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Session Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
              {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Counselor notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Counselor Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={counselorNotes}
              onChange={(e) => setCounselorNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes for this session…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* General notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notes for Student <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 shrink-0 border-t border-slate-100 pt-4">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !date || !selectedSlot}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Scheduling…</>
              : <><CalendarDays size={14} /> Confirm Schedule</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CounselorReferrals() {
  const [referrals, setReferrals] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')

  const [rejectTarget,  setRejectTarget]  = useState(null)
  const [convertTarget, setConvertTarget] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await referralAPI.getAllAdmin({ limit: 100 })
      setReferrals(data.referrals || [])
    } catch {
      toast.error('Failed to load referrals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleAccept = useCallback(async (referral) => {
    try {
      const { data } = await referralAPI.updateStatus(referral._id, { status: 'accepted' })
      setReferrals((prev) => prev.map((r) => r._id === referral._id ? data : r))
      toast.success('Referral accepted')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to accept referral')
    }
  }, [])

  const handleReview = useCallback(async (referral) => {
    try {
      const { data } = await referralAPI.updateStatus(referral._id, { status: 'under_review' })
      setReferrals((prev) => prev.map((r) => r._id === referral._id ? data : r))
      toast.success('Referral marked as under review')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update referral')
    }
  }, [])

  const handleAfterAction = useCallback(() => {
    fetch()
  }, [fetch])

  const tabs = useMemo(() =>
    STATUSES.map((s) => ({
      value: s,
      label: STATUS_LABELS[s] ?? s,
      count: s === 'all'
        ? referrals.length
        : referrals.filter((r) => r.status === s).length,
    })),
  [referrals])

  const filtered = useMemo(() =>
    filter === 'all' ? referrals : referrals.filter((r) => r.status === filter),
  [referrals, filter])

  const urgent = referrals.filter((r) =>
    ['high', 'critical'].includes(r.priorityLevel ?? r.urgency) &&
    ['pending', 'under_review'].includes(r.status)
  )

  return (
    <>
      <PageBanner
        title="Referral Management"
        subtitle="Review and manage all student referrals from faculty"
        action={
          <button
            onClick={fetch}
            disabled={loading}
            className="btn btn-white btn-sm gap-1.5 shadow"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <div className="space-y-4">
        {/* Urgent alert */}
        {!loading && urgent.length > 0 && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <Users size={16} className="text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-800 flex-1">
              {urgent.length} referral{urgent.length > 1 ? 's' : ''} with high or critical urgency
              require{urgent.length === 1 ? 's' : ''} immediate attention.
            </p>
            <button
              onClick={() => setFilter('pending')}
              className="text-xs font-semibold text-red-600 hover:underline shrink-0"
            >
              View →
            </button>
          </div>
        )}

        <FilterTabs tabs={tabs} active={filter} onChange={setFilter} />

        {loading ? (
          <SkeletonList count={4} height="h-28" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filter === 'all' ? 'No referrals yet' : `No ${filter} referrals`}
            description="Referrals from faculty members will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {filtered.map((r) => (
              <ReferralCard
                key={r._id}
                referral={r}
                viewerRole="counselor"
                onAccept={handleAccept}
                onReview={handleReview}
                onReject={(ref) => setRejectTarget(ref)}
                onConvert={(ref) => setConvertTarget(ref)}
              />
            ))}
          </div>
        )}
      </div>

      {rejectTarget && (
        <RejectModal
          referral={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={handleAfterAction}
        />
      )}

      {convertTarget && (
        <ConvertModal
          referral={convertTarget}
          onClose={() => setConvertTarget(null)}
          onDone={handleAfterAction}
        />
      )}
    </>
  )
}
