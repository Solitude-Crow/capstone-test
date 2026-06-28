// src/pages/student/appointments/RescheduleModal.jsx
import { useState, useEffect, useCallback, memo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { format, isSaturday, isSunday } from 'date-fns'
import { RefreshCw, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { appointmentAPI, availabilityAPI } from '@/api'
import { formatTime, formatDateLong } from '@/lib/utils'
import { isHoliday } from '@/lib/phHolidays'
import Modal       from '@/components/ui/Modal'
import TimeSlotGrid from '@/components/ui/TimeSlotGrid'

const RescheduleModal = memo(function RescheduleModal({ isOpen, appointment, onClose, onSuccess, viewerRole = 'student' }) {
  // Whose name to show in the summary: the student sees the counselor, the
  // counselor sees the student. Availability is always the counselor's own.
  const partyName = viewerRole === 'counselor'
    ? (appointment?.studentId?.fullName ?? 'the student')
    : (appointment?.counselorId?.fullName ?? 'the counselor')
  const [date, setDate]               = useState(null)
  const [availableSlots, setSlots]    = useState([])
  const [selectedSlot, setSelected]   = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting]   = useState(false)

  /* Reset when modal opens with a new appointment */
  useEffect(() => {
    if (isOpen) {
      setDate(null)
      setSlots([])
      setSelected(null)
    }
  }, [isOpen, appointment?._id])

  /* Debounced slot fetch on date change */
  useEffect(() => {
    if (!date || !appointment) return

    const delay = setTimeout(() => {
      setLoadingSlots(true)
      setSlots([])
      setSelected(null)
      const dateStr = format(date, 'yyyy-MM-dd')
      availabilityAPI
        .get({
          counselorId: appointment.counselorId?._id,
          startDate: dateStr,
          endDate: dateStr,
        })
        .then(({ data }) => {
          setSlots(data.flatMap((a) => a.availableSlots.filter((s) => !s.isBooked)))
        })
        .catch(() => toast.error('Failed to load slots'))
        .finally(() => setLoadingSlots(false))
    }, 300)

    return () => clearTimeout(delay)
  }, [date, appointment])

  const handleSubmit = useCallback(async () => {
    if (!date || !selectedSlot) return
    setSubmitting(true)
    try {
      await appointmentAPI.reschedule(appointment._id, {
        // Send yyyy-MM-dd so a UTC+8 midnight-local date isn't shifted to the
        // previous day by toISOString() (matches BookAppointment's fix).
        date: format(date, 'yyyy-MM-dd'),
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      })
      toast.success('Reschedule request sent!')
      onSuccess({ _id: appointment._id, action: 'reschedule' })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reschedule failed')
    } finally {
      setSubmitting(false)
    }
  }, [appointment, date, selectedSlot, onSuccess, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Appointment" size="md">
      {appointment && (
        <div className="space-y-5">
          {/* Current appointment summary */}
          <div className="bg-base-50 border border-base-200 rounded-xl p-3 text-sm space-y-1">
            <p className="text-xs text-gray-400 mb-1">Current appointment</p>
            <p className="font-medium text-base-content">{partyName}</p>
            <p className="text-xs text-gray-500">
              {formatDateLong(appointment.date)} · {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
            </p>
          </div>

          {/* Date picker */}
          <div>
            <label className="field-label">
              New Date <span className="text-error">*</span>
            </label>
            <DatePicker
              selected={date}
              onChange={(d) => setDate(d)}
              filterDate={(d) => !isSaturday(d) && !isSunday(d) && !isHoliday(d)}
              dayClassName={(d) => (isHoliday(d) ? 'ph-holiday-day' : undefined)}
              minDate={new Date()}
              className="field-input"
              placeholderText="Pick a date (Mon – Fri)"
              dateFormat="MMMM d, yyyy"
              isClearable
            />
          </div>

          {/* Time slots */}
          {date && (
            <div>
              <label className="field-label">
                Available Slots <span className="text-error">*</span>
              </label>
              <TimeSlotGrid
                slots={availableSlots}
                selected={selectedSlot}
                onSelect={setSelected}
                loading={loadingSlots}
                ready={!!date}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn btn-outline btn-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!date || !selectedSlot || submitting}
              className="btn btn-primary btn-sm gap-1"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Rescheduling…</>
                : <><RefreshCw size={14} /> Confirm Reschedule</>
              }
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
})

export default RescheduleModal