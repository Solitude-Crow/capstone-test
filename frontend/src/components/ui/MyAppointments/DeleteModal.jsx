// src/pages/student/appointments/DeleteModal.jsx
import { useCallback, memo } from 'react'
import { Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { appointmentAPI } from '@/api'
import { formatTime, formatDateLong } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'

const DeleteModal = memo(function DeleteModal({ isOpen, appointment, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      await appointmentAPI.delete(appointment._id)
      toast.success('Appointment deleted')
      onSuccess({ _id: appointment._id, action: 'delete' })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    } finally {
      setSubmitting(false)
    }
  }, [appointment, onSuccess, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Appointment" size="sm">
      {appointment && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to permanently delete this appointment record?
          </p>

          <div className="bg-base-50 border border-base-200 rounded-xl p-3 text-sm space-y-1.5">
            <p className="font-medium text-base-content">{appointment.counselorId?.fullName}</p>
            <p className="text-xs text-gray-500">
              {formatDateLong(appointment.date)} · {formatTime(appointment.startTime)}
            </p>
            <StatusBadge status={appointment.status} />
          </div>

          <div className="alert alert-error text-xs">
            <AlertCircle size={13} />
            This action cannot be undone.
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn btn-outline btn-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-error btn-sm gap-1"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Deleting…</>
                : <><Trash2 size={14} /> Delete</>
              }
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
})

export default DeleteModal