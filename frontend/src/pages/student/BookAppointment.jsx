// src/pages/student/BookAppointment.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { format, isSunday, isSaturday } from 'date-fns'
import {
  CalendarDays, User, RefreshCw, ChevronRight, ChevronLeft,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { authAPI, availabilityAPI, appointmentAPI, preAssessmentAPI } from '@/api'
import { formatTime, formatDateLong, APPOINTMENT_TYPES } from '@/lib/utils'
import { isHoliday } from '@/lib/phHolidays'
import { useAuthStore } from '@/store/authStore'
import {
  shouldShowPrivacyNotice, canOfferDontRemind, recordPrivacyConsent,
} from '@/lib/privacyConsent'
import PageBanner    from '@/components/ui/PageBanner'
import TimeSlotGrid  from '@/components/ui/TimeSlotGrid'
import Avatar        from '@/components/ui/Avatar'
import PrivacyNotice from '@/components/ui/PrivacyNotice'

/* ── Step definitions ─────────────────────────────────────────── */
const STEPS = [
  { id: 0, label: 'Counselor',  icon: User },
  { id: 1, label: 'Date & Time',icon: CalendarDays },
  { id: 2, label: 'Details',    icon: CheckCircle2 },
  { id: 3, label: 'Confirm',    icon: CheckCircle2 },
]

function StepBar({ current }) {
  return (
    <ol className="flex items-center w-full mb-6 px-1 overflow-x-auto gap-0 pb-1">
      {STEPS.map((step, i) => {
        const done    = i < current
        const active  = i === current
        const Icon    = step.icon
        return (
          <li key={step.id} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className={`flex items-center gap-1.5 shrink-0 text-xs font-semibold
              ${done ? 'text-success' : active ? 'text-primary' : 'text-base-300'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0
                ${done   ? 'border-success bg-success text-white'
                  : active ? 'border-primary bg-primary text-white'
                  :          'border-base-300 bg-base-100 text-base-300'}`}>
                {done ? <CheckCircle2 size={13} /> : i + 1}
              </span>
              <span className="hidden sm:block">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${done ? 'bg-success' : 'bg-base-300'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function CounselorCard({ counselor, selected, onSelect }) {
  const isSelected = selected === counselor._id
  return (
    <button
      type="button"
      onClick={() => onSelect(counselor._id, counselor)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 flex items-center gap-4
        ${isSelected ? 'border-primary bg-primary/5' : 'border-base-200 hover:border-primary/40 hover:bg-base-50'}`}
    >
      <Avatar name={counselor.fullName} src={counselor.profilePic} size="md" />
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm truncate ${isSelected ? 'text-primary' : 'text-base-content'}`}>
          {counselor.fullName}
        </p>
        {counselor.specialization && (
          <p className="text-xs text-gray-500 truncate">{counselor.specialization}</p>
        )}
      </div>
      {isSelected && <CheckCircle2 size={18} className="text-primary shrink-0" />}
    </button>
  )
}

function ConfirmRow({ Icon: RowIcon, label, value }) { // eslint-disable-line no-unused-vars
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-base-100 last:border-0">
      <RowIcon size={15} className="text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-base-content">{value}</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
export default function BookAppointment() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // When the student arrives from a pre-assessment results/detail page, this is set
  // and the new appointment is linked to that pre-assessment after booking.
  const preAssessmentId = searchParams.get('preAssessmentId')

  const user = useAuthStore((s) => s.user)

  const [step, setStep]             = useState(0)
  const [counselors, setCounselors] = useState([])
  const [availability, setAvailability] = useState([])
  const [loadingCounselors, setLoadingCounselors] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  const [form, setForm] = useState({
    counselorId: '',
    counselorObj: null,
    date: null,
    slot: null,
    type: '',
    notes: '',
  })

  /* Fetch counselors on mount */
  useEffect(() => {
    authAPI.getUsersByRole('counselor')
      .then(({ data }) => setCounselors(data))
      .catch(() => toast.error('Failed to load counselors'))
      .finally(() => setLoadingCounselors(false))
  }, [])

  /* Fetch availability whenever counselor or date changes */
  const fetchSlots = useCallback(async (counselorId, date) => {
    if (!counselorId || !date) return
    setLoadingSlots(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      const { data } = await availabilityAPI.get({
        counselorId,
        startDate: dateStr,
        endDate: dateStr,
      })
      setAvailability(data)
    } catch {
      toast.error('Failed to load time slots')
      setAvailability([])
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  useEffect(() => {
    if (form.counselorId && form.date) {
      setForm((f) => ({ ...f, slot: null }))
      fetchSlots(form.counselorId, form.date)
    }
  }, [form.counselorId, form.date, fetchSlots])

  const availableSlots = availability.flatMap((a) =>
    a.availableSlots.filter((s) => !s.isBooked)
  )

  const canNext = () => {
    if (step === 0) return !!form.counselorId
    if (step === 1) return form.date && form.slot
    if (step === 2) return !!form.type
    return true
  }

  const handleCounselorSelect = (id, obj) => {
    setForm((f) => ({ ...f, counselorId: id, counselorObj: obj, date: null, slot: null }))
    setAvailability([])
  }

  const handleDateChange = (date) => {
    setForm((f) => ({ ...f, date, slot: null }))
  }

  const handleRefresh = async () => {
    if (!form.counselorId || !form.date) return
    setIsRefreshing(true)
    await fetchSlots(form.counselorId, form.date)
    setTimeout(() => setIsRefreshing(false), 600)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Send date as yyyy-MM-dd to avoid UTC offset shifting the date
      // e.g. UTC+8: date.toISOString() turns Apr 14 local → Apr 13 UTC
      const dateStr = format(form.date, 'yyyy-MM-dd')
      const { data: created } = await appointmentAPI.create({
        counselorId: form.counselorId,
        type:        form.type,
        date:        dateStr,
        startTime:   form.slot.startTime,
        endTime:     form.slot.endTime,
        notes:       form.notes,
      })

      // Link a pre-assessment to this appointment if the student came from one.
      // Best-effort: the booking already succeeded, so a link failure is non-fatal.
      if (preAssessmentId && created?._id) {
        try {
          await preAssessmentAPI.linkToAppointment(preAssessmentId, { appointmentId: created._id })
        } catch {
          toast('Appointment booked, but linking your pre-assessment failed.')
        }
      }

      toast.success('Appointment booked successfully!')
      navigate('/student/appointments')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Gate the booking behind the Privacy Notice (skipped if the user opted out).
  const handleConfirm = () => {
    if (shouldShowPrivacyNotice(user)) setShowPrivacy(true)
    else handleSubmit()
  }

  const handlePrivacyAgree = ({ dontRemind }) => {
    recordPrivacyConsent(user, { dontRemind })
    setShowPrivacy(false)
    handleSubmit()
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="animate-fade-in space-y-3">
            <p className="text-sm text-gray-500 mb-4">Choose a guidance counselor for your session.</p>
            {loadingCounselors ? (
              <div className="space-y-3">
                {[1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
              </div>
            ) : counselors.length === 0 ? (
              <div className="alert alert-info text-sm">No counselors available at this time.</div>
            ) : (
              counselors.map((c) => (
                <CounselorCard
                  key={c._id}
                  counselor={c}
                  selected={form.counselorId}
                  onSelect={handleCounselorSelect}
                />
              ))
            )}
          </div>
        )

      case 1:
        return (
          <div className="animate-fade-in space-y-5">
            <p className="text-sm text-gray-500">Select a date and available time slot.</p>
            <div>
              <label className="field-label">Date <span className="text-error">*</span></label>
              <DatePicker
                selected={form.date}
                onChange={handleDateChange}
                filterDate={(d) => !isSaturday(d) && !isSunday(d) && !isHoliday(d)}
                dayClassName={(d) => (isHoliday(d) ? 'ph-holiday-day' : undefined)}
                minDate={new Date()}
                className="field-input"
                placeholderText="Pick a date (Mon – Fri)"
                dateFormat="MMMM d, yyyy"
                isClearable
              />
            </div>
            {form.date && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="field-label mb-0">
                    Available Slots <span className="text-error">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={loadingSlots}
                    className="btn btn-ghost btn-xs gap-1 text-primary"
                  >
                    <RefreshCw size={13} className={isRefreshing ? 'animate-spin-once' : ''} />
                    Refresh
                  </button>
                </div>
                <TimeSlotGrid
                  slots={availableSlots}
                  selected={form.slot}
                  onSelect={(slot) => setForm((f) => ({ ...f, slot }))}
                  loading={loadingSlots}
                  ready={!!(form.counselorId && form.date)}
                />
              </div>
            )}
          </div>
        )

      case 2:
        return (
          <div className="animate-fade-in space-y-5">
            <p className="text-sm text-gray-500">Tell us what you'd like to discuss.</p>
            <div>
              <label className="field-label">Type of Concern <span className="text-error">*</span></label>
              <select
                className="field-select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                required
              >
                <option value="">Select type…</option>
                {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                className="field-textarea min-h-25"
                placeholder="Briefly describe your concern or reason for the appointment…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                maxLength={1000}
              />
              <p className="text-xs text-gray-400 text-right mt-1">{form.notes.length}/1000</p>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="animate-fade-in">
            <p className="text-sm text-gray-500 mb-5">Review your appointment details before confirming.</p>
            <div className="mkd-card p-4! bg-base-50 border border-primary/20">
              <ConfirmRow Icon={User}        label="Counselor"   value={form.counselorObj?.fullName} />
              <ConfirmRow Icon={CalendarDays}label="Date"        value={form.date ? formatDateLong(form.date) : '—'} />
              <ConfirmRow Icon={CheckCircle2}label="Time Slot"   value={form.slot ? `${formatTime(form.slot.startTime)} – ${formatTime(form.slot.endTime)}` : '—'} />
              <ConfirmRow Icon={CheckCircle2}label="Type"        value={form.type} />
              {form.notes && <ConfirmRow Icon={CheckCircle2} label="Notes" value={form.notes} />}
            </div>
            <div className="alert alert-info text-xs mt-4">
              <AlertCircle size={14} />
              Please arrive on time. Cancel at least 24 hours in advance if you cannot attend.
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <PageBanner title="Book an Appointment" subtitle="Schedule a session with a guidance counselor" />

      <div className="max-w-2xl mx-auto">
        <div className="mkd-card">
          <StepBar current={step} />
          {renderStep()}

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-base-200">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="btn btn-outline btn-sm gap-1">
                <ChevronLeft size={15} /> Back
              </button>
            ) : <div />}

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
                className="btn btn-primary btn-sm gap-1"
              >
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                disabled={submitting || !canNext()}
                className="btn btn-primary btn-sm gap-1"
              >
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> Booking…</>
                  : <><CheckCircle2 size={15} /> Confirm Booking</>
                }
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNotice
        open={showPrivacy}
        canOfferDontRemind={canOfferDontRemind(user)}
        onAgree={handlePrivacyAgree}
        onClose={() => setShowPrivacy(false)}
      />
    </>
  )
}