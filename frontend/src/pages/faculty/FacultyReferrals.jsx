// src/pages/faculty/FacultyReferrals.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, X, Loader2, CalendarDays, Clock, AlertTriangle } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { referralAPI } from '@/api'
import { APPOINTMENT_TYPES, formatTime } from '@/lib/utils'
import PageBanner    from '@/components/ui/PageBanner'
import FilterTabs   from '@/components/ui/FilterTabs'
import EmptyState   from '@/components/ui/EmptyState'
import SkeletonList from '@/components/ui/SkeletonList'
import ReferralCard from '@/components/ui/ReferralCard'
import Avatar       from '@/components/ui/Avatar'
import PresenceBadge from '@/components/ui/PresenceBadge'
import { Users } from 'lucide-react'

const STATUSES = ['all', 'pending', 'accepted', 'scheduled', 'completed', 'rejected']

// ── Request Appointment Modal ──────────────────────────────────────────────────
function RequestAppointmentModal({ referral, onClose, onDone }) {
  const [counselorData,    setCounselorData]    = useState([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [counselorId,      setCounselorId]      = useState(null)
  const [date,             setDate]             = useState(null)
  const [selectedSlot,     setSelectedSlot]     = useState(null)
  const [type,             setType]             = useState('General Inquiry')
  const [submitting,       setSubmitting]        = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const today     = new Date().toISOString().split('T')[0]
        const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { data } = await referralAPI.getCounselorSchedules({ startDate: today, endDate: nextMonth })
        setCounselorData(data)
      } catch {
        setCounselorData([]) // let the empty-state UI handle messaging
      } finally {
        setLoadingSchedules(false)
      }
    }
    load()
  }, [])

  const counselorEntry = counselorData.find((d) => d.counselor._id === counselorId)

  const availableDatesSet = useMemo(() => new Set(
    (counselorEntry?.availability ?? [])
      .filter((a) => !a.isHoliday && a.availableSlots.some((s) => !s.isBooked))
      .map((a) => new Date(a.date).toDateString())
  ), [counselorEntry])

  const slotsForDate = useMemo(() => {
    if (!date || !counselorEntry) return []
    return counselorEntry.availability
      .find((a) => isSameDay(new Date(a.date), date))
      ?.availableSlots.filter((s) => !s.isBooked) ?? []
  }, [date, counselorEntry])

  const filterDate = (d) => availableDatesSet.has(d.toDateString())

  const submit = async () => {
    if (!counselorId || !date || !selectedSlot) {
      toast.error('Please select a counselor, date, and time slot')
      return
    }
    setSubmitting(true)
    try {
      await referralAPI.requestAppointment(referral._id, {
        counselorId,
        date:      date.toISOString(),
        startTime: selectedSlot.startTime,
        endTime:   selectedSlot.endTime,
        type,
      })
      toast.success('Appointment requested! The counselor will confirm it.')
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to request appointment')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200 shrink-0">
          <div>
            <p className="font-display font-semibold text-slate-900">Request Appointment</p>
            <p className="text-xs text-slate-500 mt-0.5">
              For {referral.studentSnapshot?.fullName ?? referral.studentId?.fullName ?? 'student'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 overflow-y-auto flex-1">
          {loadingSchedules ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading counselor schedules…</span>
            </div>
          ) : counselorData.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">No available schedules</p>
                <p className="text-xs mt-0.5 text-amber-600">
                  The guidance counselors have not set up their availability yet.
                  The counselor will schedule the appointment after reviewing your referral.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Counselor picker */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Select Counselor</p>
                <div className="space-y-2">
                  {counselorData.map(({ counselor }) => {
                    const isUnavailable = ['on_leave', 'offline'].includes(counselor.presenceStatus)
                    const isSelected    = counselorId === counselor._id
                    return (
                      <button
                        key={counselor._id}
                        type="button"
                        disabled={isUnavailable}
                        onClick={() => { setCounselorId(counselor._id); setDate(null); setSelectedSlot(null) }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                            : isUnavailable
                              ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                              : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                        }`}
                      >
                        <Avatar name={counselor.fullName} src={counselor.profilePic} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm truncate">{counselor.fullName}</p>
                          {counselor.specialization && (
                            <p className="text-xs text-slate-500 truncate">{counselor.specialization}</p>
                          )}
                        </div>
                        <PresenceBadge status={counselor.presenceStatus} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. Date picker */}
              {counselorId && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Select Date</p>
                  {availableDatesSet.size === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                      <AlertTriangle size={13} className="shrink-0" />
                      This counselor has no available dates in the next 30 days.
                    </div>
                  ) : (
                    <DatePicker
                      selected={date}
                      onChange={(d) => { setDate(d); setSelectedSlot(null) }}
                      filterDate={filterDate}
                      minDate={new Date()}
                      dateFormat="MMMM d, yyyy"
                      placeholderText="Click to choose an available date"
                      className={inputCls}
                      calendarClassName="shadow-xl"
                      inline
                    />
                  )}
                </div>
              )}

              {/* 3. Time slot */}
              {date && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Select Time Slot</p>
                  {slotsForDate.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                      <AlertTriangle size={13} className="shrink-0" />
                      No available slots on this date. Choose another date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slotsForDate.map((slot, i) => {
                        const isSel = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedSlot(isSel ? null : slot)}
                            className={`flex flex-col items-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
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

              {/* 4. Type */}
              {selectedSlot && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Appointment Type</p>
                  <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                    {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {/* Summary */}
              {selectedSlot && counselorEntry && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                  <p className="font-semibold">Appointment Summary</p>
                  <p>Counselor: <span className="font-medium">{counselorEntry.counselor.fullName}</span></p>
                  <p>Date: <span className="font-medium">{date?.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></p>
                  <p>Time: <span className="font-medium">{formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}</span></p>
                  <p>Type: <span className="font-medium">{type}</span></p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5 shrink-0 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !counselorId || !date || !selectedSlot}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Requesting…</>
              : <><CalendarDays size={14} /> Request Appointment</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FacultyReferrals() {
  const navigate = useNavigate()
  const [referrals,       setReferrals]       = useState([])
  const [loading,         setLoading]         = useState(true)
  const [filter,          setFilter]          = useState('all')
  const [requestTarget,   setRequestTarget]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await referralAPI.getAll({ limit: 100 })
      setReferrals(data.referrals || [])
    } catch {
      toast.error('Failed to load referrals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const handleDelete = useCallback(async (referral) => {
    if (!window.confirm(`Delete this ${referral.status} referral? This cannot be undone.`)) return
    try {
      await referralAPI.delete(referral._id)
      setReferrals((prev) => prev.filter((r) => r._id !== referral._id))
      toast.success('Referral deleted')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete referral')
    }
  }, [])

  const tabs = useMemo(() =>
    STATUSES.map((s) => ({
      value: s,
      label: s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' '),
      count: s === 'all' ? referrals.length : referrals.filter((r) => r.status === s).length,
    })),
  [referrals])

  const filtered = useMemo(() =>
    filter === 'all' ? referrals : referrals.filter((r) => r.status === filter),
  [referrals, filter])

  return (
    <>
      <PageBanner
        title="My Referrals"
        subtitle="Track all students you have referred for counseling"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetch}
              disabled={loading}
              className="btn btn-white btn-sm gap-1.5 shadow"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={() => navigate('/faculty/referrals/new')}
              className="btn btn-white btn-sm gap-1.5 shadow"
            >
              <Plus size={13} /> New Referral
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        <FilterTabs tabs={tabs} active={filter} onChange={setFilter} />

        {loading ? (
          <SkeletonList count={4} height="h-28" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filter === 'all' ? 'No referrals yet' : `No ${filter} referrals`}
            description="Refer a student to the Guidance Counselor to get started."
            action={
              filter === 'all' && (
                <button
                  onClick={() => navigate('/faculty/referrals/new')}
                  className="btn btn-primary btn-sm gap-1"
                >
                  <Plus size={14} /> New Referral
                </button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            {filtered.map((r) => (
              <ReferralCard
                key={r._id}
                referral={r}
                viewerRole="faculty"
                onRequestAppointment={(ref) => setRequestTarget(ref)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {requestTarget && (
        <RequestAppointmentModal
          referral={requestTarget}
          onClose={() => setRequestTarget(null)}
          onDone={fetch}
        />
      )}
    </>
  )
}
