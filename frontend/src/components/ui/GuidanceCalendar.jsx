// src/components/ui/GuidanceCalendar.jsx
//
// Reusable calendar for both students and counselors.
//
// Student mode  (role="student"):
//   - Shows counselor availability dots on dates that have open slots
//   - Shows the student's own appointments as colored indicators
//   - Clicking an available date opens a slot-picker / mini booking flow
//
// Counselor mode (role="counselor"):
//   - Shows dates where the counselor has availability set
//   - Shows incoming appointments per day
//   - Clicking a date reveals the day's appointment list
//
// Props
// ─────
//   role           "student" | "counselor"   (required)
//   appointments   array of appointment objects from getMyAll
//   availability   array of availability objects from availabilityAPI.get()
//   counselors     array of counselor user objects  (student mode only)
//   onBookSlot     (slot, counselorId, date) => void   (student mode)
//   isLoading      bool
//
import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, CalendarDays,
  Clock, User, CheckCircle2, XCircle,
  AlertCircle, X, Loader2, Check, FileText, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { appointmentAPI } from '@/api'
import { formatTime, formatDateLong, STATUS_CLASS } from '@/lib/utils'
import AppointmentSourceBadge from '@/components/ui/AppointmentSourceBadge'
import { getHolidayName } from '@/lib/phHolidays'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, isSunday,
  format, addMonths, subMonths,
} from 'date-fns'

// ── Tiny status pill ─────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const icons = {
    completed:   <CheckCircle2 size={10} />,
    pending:     <Clock size={10} />,
    accepted:    <CheckCircle2 size={10} />,
    rejected:    <XCircle size={10} />,
    rescheduled: <AlertCircle size={10} />,
    cancelled:   <XCircle size={10} />,
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {icons[status]}
      {status}
    </span>
  )
}

// ── Counselor quick actions (manage an appointment without leaving the calendar)
// Allowed transitions mirror the backend: pending/rescheduled → accept/reject,
// accepted → complete/cancel. Reject and cancel need a confirming second click.
function CounselorApptActions({ appt, onUpdated }) {
  const [busy, setBusy]                   = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const run = async (status) => {
    setBusy(status)
    try {
      await appointmentAPI.updateStatus(appt._id, { status })
      toast.success(`Appointment ${status}`)
      onUpdated?.(appt._id, status)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setBusy(null)
      setConfirmAction(null)
    }
  }

  // Destructive actions ask for a confirming second click
  const ask = (status) => {
    if (confirmAction === status) run(status)
    else setConfirmAction(status)
  }

  const isPendingLike = ['pending', 'rescheduled'].includes(appt.status)
  const isAccepted    = appt.status === 'accepted'
  if (!isPendingLike && !isAccepted) return null

  const btnBase = 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-50'

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-surface-200">
      {isPendingLike && (
        <>
          <button
            onClick={() => run('accepted')}
            disabled={!!busy}
            className={`${btnBase} bg-emerald-500 hover:bg-emerald-600 text-white`}
          >
            {busy === 'accepted' ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
            Accept
          </button>
          <button
            onClick={() => ask('rejected')}
            disabled={!!busy}
            className={`${btnBase} ${confirmAction === 'rejected'
              ? 'bg-red-500 text-white'
              : 'border border-red-200 text-red-600 hover:bg-red-50'}`}
          >
            {busy === 'rejected' ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
            {confirmAction === 'rejected' ? 'Confirm reject?' : 'Reject'}
          </button>
        </>
      )}
      {isAccepted && (
        <>
          <button
            onClick={() => run('completed')}
            disabled={!!busy}
            className={`${btnBase} bg-primary-500 hover:bg-primary-600 text-white`}
          >
            {busy === 'completed' ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
            Complete
          </button>
          <button
            onClick={() => ask('cancelled')}
            disabled={!!busy}
            className={`${btnBase} ${confirmAction === 'cancelled'
              ? 'bg-red-500 text-white'
              : 'border border-red-200 text-red-600 hover:bg-red-50'}`}
          >
            {busy === 'cancelled' ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
            {confirmAction === 'cancelled' ? 'Confirm cancel?' : 'Cancel'}
          </button>
        </>
      )}
    </div>
  )
}

// ── Day-detail panel (slides in from right on mobile, inline on desktop) ─────
function DayPanel({ date, appointments, availability, role, onClose, onBookSlot, counselors, onAppointmentUpdate }) {
  const [selectedCounselor, setSelectedCounselor] = useState(null)

  const dateStr = format(date, 'yyyy-MM-dd')

  // Appointments on this day
  const dayAppointments = useMemo(() =>
    appointments.filter((a) => {
      const d = typeof a.date === 'string' ? a.date : a.date?.toISOString?.() ?? ''
      return d.startsWith(dateStr)
    }),
  [appointments, dateStr])

  // Availability for this day (student sees all counselors, counselor sees own)
  const dayAvailability = useMemo(() =>
    availability.filter((av) => {
      const d = typeof av.date === 'string' ? av.date : av.date?.toISOString?.() ?? ''
      return d.startsWith(dateStr)
    }),
  [availability, dateStr])

  const counselorAvail = selectedCounselor
    ? dayAvailability.filter((av) =>
        av.counselorId === selectedCounselor ||
        av.counselorId?._id === selectedCounselor ||
        av.counselorId?.toString() === selectedCounselor
      )
    : dayAvailability

  const freeSlots = useMemo(() =>
    counselorAvail.flatMap((av) =>
      (av.availableSlots || [])
        .filter((s) => !s.isBooked)
        .map((s) => ({ ...s, counselorId: av.counselorId, availabilityId: av._id }))
    ),
  [counselorAvail])

  const isPast = date < new Date(new Date().setHours(0, 0, 0, 0))
  const holiday = getHolidayName(date)
  const closedLabel = holiday || (isSunday(date) ? 'Sunday' : null)

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-200">
        <div>
          <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide">
            {isToday(date) ? 'Today' : format(date, 'EEEE')}
          </p>
          <p className="font-display font-semibold text-slate-900 text-base leading-tight">
            {formatDateLong(date)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-100 transition-colors text-slate-400 hover:text-slate-600"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">

        {/* ── Closed-day notice (PH holiday or Sunday) ── */}
        {closedLabel && (
          <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700">{closedLabel}</p>
              <p className="text-[10px] text-red-500">
                {holiday
                  ? 'Philippine holiday — the guidance office is closed and counselors are unavailable.'
                  : 'The guidance office is closed on Sundays — counselors are unavailable.'}
              </p>
            </div>
          </div>
        )}

        {/* ── STUDENT: show available slots ── */}
        {role === 'student' && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Available Slots
            </p>

            {counselors && counselors.length > 1 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                <button
                  onClick={() => setSelectedCounselor(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    !selectedCounselor
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-100 text-slate-600 hover:bg-surface-200'
                  }`}
                >
                  All
                </button>
                {counselors.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => setSelectedCounselor(c._id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      selectedCounselor === c._id
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-100 text-slate-600 hover:bg-surface-200'
                    }`}
                  >
                    {c.fullName?.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}

            {isPast ? (
              <p className="text-xs text-slate-400 italic">This date has passed.</p>
            ) : freeSlots.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No available slots on this day.</p>
            ) : (
              <div className="space-y-1.5">
                {freeSlots.map((slot, i) => {
                  const counselorName = counselors?.find((c) =>
                    c._id === slot.counselorId ||
                    c._id === slot.counselorId?._id ||
                    c._id === slot.counselorId?.toString()
                  )?.fullName

                  return (
                    <button
                      key={i}
                      onClick={() => onBookSlot?.(slot, slot.counselorId, date)}
                      className="w-full flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 hover:border-emerald-300 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                          <Clock size={13} className="text-emerald-600" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-semibold text-emerald-800">
                            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                          </p>
                          {counselorName && (
                            <p className="text-[10px] text-emerald-600">{counselorName}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full group-hover:bg-emerald-200 transition-colors">
                        Book
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── COUNSELOR: show their availability for this day ── */}
        {role === 'counselor' && dayAvailability.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Your Slots
            </p>
            <div className="space-y-1.5">
              {dayAvailability[0].availableSlots?.map((slot, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                  slot.isBooked
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                }`}>
                  <span className="font-medium">{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</span>
                  <span className={`font-semibold ${slot.isBooked ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {slot.isBooked ? 'Booked' : 'Open'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Appointments on this day ── */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {role === 'student' ? 'Your Appointments' : 'Appointments'}
          </p>
          {dayAppointments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No appointments on this day.</p>
          ) : (
            <div className="space-y-2">
              {dayAppointments.map((appt) => {
                const person = role === 'student' ? appt.counselorId : appt.studentId
                const name = person?.fullName ?? person ?? '—'
                const student = role === 'counselor' ? appt.studentId : null
                const hasPreAssessment = appt.preAssessmentSubmitted || appt.preAssessmentId
                return (
                  <div key={appt._id} className="p-3 bg-surface-50 rounded-xl border border-surface-200">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User size={11} className="text-slate-400 shrink-0" />
                        <p className="text-xs font-semibold text-slate-800 truncate">{name}</p>
                      </div>
                      <StatusPill status={appt.status} />
                    </div>
                    {/* Student info (counselor view) */}
                    {student && (student.studentIDnum || student.course) && (
                      <p className="text-[10px] text-slate-400">
                        {[student.studentIDnum, student.course, student.yearLevel].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500">{appt.type}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                    </p>
                    {appt.notes && (
                      <p className="text-[10px] text-slate-400 italic mt-1 line-clamp-1">
                        "{appt.notes}"
                      </p>
                    )}

                    {role === 'counselor' && (
                      <>
                        {/* Source + linked records */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <AppointmentSourceBadge appointment={appt} />
                          {hasPreAssessment && (
                            <Link
                              to={`/counselor/pre-assessments/appointment/${appt._id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold hover:bg-blue-200 transition-colors"
                            >
                              <FileText size={9} /> Pre-Assessment
                            </Link>
                          )}
                          {appt.referralId && (
                            <Link
                              to="/counselor/referrals"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold hover:bg-violet-200 transition-colors"
                            >
                              <Users size={9} /> View Referral
                            </Link>
                          )}
                        </div>

                        {/* Quick actions */}
                        <CounselorApptActions appt={appt} onUpdated={onAppointmentUpdate} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calendar Component
// ─────────────────────────────────────────────────────────────────────────────
export default function GuidanceCalendar({
  role = 'student',
  appointments = [],
  availability = [],
  counselors = [],
  onBookSlot,
  onMonthChange,
  onAppointmentUpdate,
  isLoading = false,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  // Local midnight today — dates before this can no longer be booked.
  const todayStart = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), [])

  // Build a lookup: dateStr → { hasAvailability, freeSlots, appointmentCount, statuses }
  const dayData = useMemo(() => {
    const map = {}

    availability.forEach((av) => {
      const raw = typeof av.date === 'string' ? av.date : av.date?.toISOString?.() ?? ''
      const key = raw.slice(0, 10)
      if (!map[key]) map[key] = { hasAvailability: false, freeSlots: 0, bookedSlots: 0, appointments: [] }
      map[key].hasAvailability = true
      ;(av.availableSlots || []).forEach((s) => {
        if (s.isBooked) map[key].bookedSlots++
        else map[key].freeSlots++
      })
    })

    appointments.forEach((appt) => {
      const raw = typeof appt.date === 'string' ? appt.date : appt.date?.toISOString?.() ?? ''
      const key = raw.slice(0, 10)
      if (!map[key]) map[key] = { hasAvailability: false, freeSlots: 0, bookedSlots: 0, appointments: [] }
      map[key].appointments.push(appt.status)
    })

    return map
  }, [availability, appointments])

  // Calendar grid — 6 weeks (42 days)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(currentMonth),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const prevMonth = useCallback(() => {
    setCurrentMonth((m) => {
      const next = subMonths(m, 1)
      onMonthChange?.(next)
      return next
    })
  }, [onMonthChange])

  const nextMonth = useCallback(() => {
    setCurrentMonth((m) => {
      const next = addMonths(m, 1)
      onMonthChange?.(next)
      return next
    })
  }, [onMonthChange])

  const goToday = useCallback(() => {
    const now = new Date()
    setCurrentMonth(now)
    setSelectedDate(now)
    onMonthChange?.(now)
  }, [onMonthChange])

  const handleDayClick = useCallback((day) => {
    setSelectedDate((prev) => (prev && isSameDay(prev, day) ? null : day))
  }, [])

  const STATUS_DOT = {
    pending:     'bg-amber-400',
    accepted:    'bg-emerald-500',
    rescheduled: 'bg-blue-400',
    completed:   'bg-slate-400',
    cancelled:   'bg-red-400',
    rejected:    'bg-red-400',
  }

  // Slot-availability chip tones: green = available, orange = limited (≤2),
  // red = fully booked. Returns null when the day offers no availability.
  const SLOT_TONE = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-orange-100 text-orange-700',
    red:   'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-400',
  }
  // Past dates can no longer be booked — show a muted "Past" marker instead of a
  // misleading "X left" count for any past day that had availability set.
  const getSlotLabel = (free, hasAvail, isPast) => {
    if (!hasAvail) return null
    if (isPast)     return { text: 'Past', tone: 'slate' }
    if (free === 0) return { text: 'Full', tone: 'red' }
    if (free <= 2)  return { text: `${free} left`, tone: 'amber' }
    return { text: `${free} left`, tone: 'green' }
  }

  return (
    <div className="card overflow-hidden">
      {/* ── Calendar header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-primary-500" />
          <h2 className="font-display font-semibold text-slate-900">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToday}
            className="text-xs font-medium text-primary-500 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
          >
            Today
          </button>
          <button
            onClick={prevMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-100 transition-colors text-slate-500"
            aria-label="Previous month"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={nextMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-100 transition-colors text-slate-500"
            aria-label="Next month"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className={`transition-all duration-300 ${selectedDate ? 'grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4' : ''}`}>
        {/* ── Grid ── */}
        <div>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={20} className="animate-spin text-primary-400" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const data = dayData[key]
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = selectedDate && isSameDay(selectedDate, day)
                const isTodayDay = isToday(day)
                const holiday = getHolidayName(day)
                const isSun = isSunday(day)
                // Office is closed on PH holidays and Sundays → mark red
                const isClosed = isCurrentMonth && (!!holiday || isSun)
                // Past days (before today) can no longer be booked
                const isPastDay = isCurrentMonth && day < todayStart
                const apptStatuses = data?.appointments ?? []
                const uniqueStatuses = [...new Set(apptStatuses)].slice(0, 3)
                // Slot count chip — only on open (non-closed) days that offer availability
                const slot = isCurrentMonth && !isClosed
                  ? getSlotLabel(data?.freeSlots ?? 0, !!data?.hasAvailability, isPastDay)
                  : null

                return (
                  <button
                    key={key}
                    onClick={() => handleDayClick(day)}
                    title={holiday || (isSun ? 'Sunday — office closed' : undefined)}
                    className={[
                      'relative flex flex-col items-center pt-1.5 pb-2 rounded-xl transition-all min-h-[64px]',
                      isCurrentMonth ? 'text-slate-700' : 'text-slate-300',
                      isSelected
                        ? 'bg-primary-500 text-white shadow-md shadow-primary-200'
                        : isClosed
                        ? 'bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100'
                        : isTodayDay
                        ? 'bg-primary-50 ring-2 ring-primary-300 ring-offset-1'
                        : 'hover:bg-surface-100',
                      // Past days are dimmed to read as inactive (still clickable to review)
                      isPastDay && !isSelected && !isClosed ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    <span className={`text-xs font-semibold leading-none mb-1 ${
                      isSelected ? 'text-white' : isClosed ? 'text-red-600' : isTodayDay ? 'text-primary-600' : ''
                    }`}>
                      {format(day, 'd')}
                    </span>

                    {/* Holiday name (desktop) — abbreviated, full name on hover/tap via title + day panel */}
                    {isCurrentMonth && holiday && (
                      <span className={`hidden sm:block w-full px-0.5 text-[8px] font-semibold leading-tight text-center truncate ${
                        isSelected ? 'text-white/90' : 'text-red-500'
                      }`}>
                        {holiday}
                      </span>
                    )}

                    {/* Slot-count chip = counselor availability for the day */}
                    {slot && (
                      <span
                        className={`mt-0.5 px-1 rounded-full text-[9px] font-bold leading-none whitespace-nowrap ${
                          isSelected ? 'bg-white/25 text-white' : SLOT_TONE[slot.tone]
                        }`}
                      >
                        {slot.text}
                      </span>
                    )}

                    {/* Indicators row */}
                    {isCurrentMonth && (isClosed || uniqueStatuses.length > 0) && (
                      <div className="flex items-center gap-0.5 flex-wrap justify-center max-w-full px-0.5 mt-0.5">
                        {/* Red dot = office closed — always on mobile; on desktop only when no name shown (Sundays) */}
                        {isClosed && (
                          <span className={`${holiday ? 'sm:hidden' : ''} w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white/80' : 'bg-red-400'}`} />
                        )}
                        {/* Appointment status dots */}
                        {uniqueStatuses.map((s, i) => (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-white/70' : STATUS_DOT[s] ?? 'bg-slate-400'}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Legend ── */}
          <div className="mt-3 pt-3 border-t border-surface-100 space-y-2">
            {/* Slot availability chips */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <SlotLegend chipClass="bg-emerald-100 text-emerald-700" sample="5 left" label="Available" />
              <SlotLegend chipClass="bg-orange-100 text-orange-700" sample="2 left" label="Limited" />
              <SlotLegend chipClass="bg-red-100 text-red-700" sample="Full" label="Fully booked" />
              <SlotLegend chipClass="bg-slate-100 text-slate-400" sample="Past" label="Date passed" />
            </div>
            {/* Appointment status dots */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <LegendItem color="bg-amber-400" label="Pending" />
              <LegendItem color="bg-emerald-500" label="Accepted" />
              <LegendItem color="bg-blue-400" label="Rescheduled" />
              <LegendItem color="bg-slate-400" label="Completed" />
              <LegendItem color="bg-red-400" label="Holiday / Office closed" />
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Slot counts show counselor availability per day. Dates marked
              &quot;Past&quot; have already gone by and can no longer be booked. Holidays show the official
              name (e.g. Christmas Day, Labor Day, Independence Day, Rizal Day); hover or tap a date for the full name.
            </p>
          </div>
        </div>

        {/* ── Day detail panel ── */}
        {selectedDate && (
          <div className="lg:border-l lg:border-surface-200 lg:pl-4">
            <DayPanel
              date={selectedDate}
              appointments={appointments}
              availability={availability}
              role={role}
              onClose={() => setSelectedDate(null)}
              onBookSlot={onBookSlot}
              counselors={counselors}
              onAppointmentUpdate={onAppointmentUpdate}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  )
}

function SlotLegend({ chipClass, sample, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`px-1 rounded-full text-[9px] font-bold leading-none ${chipClass}`}>{sample}</span>
      <span className="text-[10px] text-slate-400">{label}</span>
    </div>
  )
}