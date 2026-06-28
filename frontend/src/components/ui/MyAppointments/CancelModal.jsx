// src/pages/student/appointments/CancelModal.jsx
import { useState, useEffect, useCallback, memo } from 'react'
import { XCircle, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import { appointmentAPI } from '@/api'
import { formatTime, formatDateLong } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

const CancelModal = memo(function CancelModal({ isOpen, appointment, onClose, onSuccess, viewerRole = 'student' }) {
  const [reason, setReason]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  // The student sees the counselor; the counselor sees the student.
  const isCounselor = viewerRole === 'counselor'
  const partyName = isCounselor
    ? (appointment?.studentId?.fullName ?? 'the student')
    : (appointment?.counselorId?.fullName ?? 'the counselor')
  const notifyParty = isCounselor ? 'student' : 'counselor'

  /* Reset reason when modal opens */
  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen, appointment?._id])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      await appointmentAPI.cancel(appointment._id, { reason })
      toast.success('Appointment cancelled')
      onSuccess({ _id: appointment._id, action: 'cancel' })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed')
    } finally {
      setSubmitting(false)
    }
  }, [appointment, reason, onSuccess, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Appointment" size="sm">
      {appointment && (
        <div className="space-y-4">
          {/* Appointment summary */}
          <div className="bg-base-50 border border-base-200 rounded-xl p-3 text-sm space-y-1">
            <p className="font-medium text-base-content">{partyName}</p>
            <p className="text-xs text-gray-500">
              {formatDateLong(appointment.date)} · {formatTime(appointment.startTime)}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="field-label">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="field-textarea min-h-20"
              placeholder={`Let the ${notifyParty} know why you're cancelling…`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="alert alert-warning text-xs">
            <AlertCircle size={13} />
            This action cannot be undone. The {notifyParty} will be notified.
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn btn-outline btn-sm">
              Go Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-error btn-sm gap-1"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Cancelling…</>
                : <><XCircle size={14} /> Confirm Cancel</>
              }
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
})

export default CancelModal