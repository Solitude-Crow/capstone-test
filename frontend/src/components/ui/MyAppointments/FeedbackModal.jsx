// src/pages/student/appointments/FeedbackModal.jsx
import { useState, useEffect, useCallback, memo } from 'react'
import { CheckCircle2, Loader2, Star } from 'lucide-react'
import toast from 'react-hot-toast'

import { appointmentAPI } from '@/api'
import { formatDateLong } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

const FeedbackModal = memo(function FeedbackModal({ isOpen, appointment, onClose, onSuccess }) {
  const [content, setContent]     = useState('')
  const [rating, setRating]       = useState(0)
  const [hovered, setHovered]     = useState(0)
  const [submitting, setSubmitting] = useState(false)

  /* Reset when modal opens */
  useEffect(() => {
    if (isOpen) {
      setContent('')
      setRating(0)
      setHovered(0)
    }
  }, [isOpen, appointment?._id])

  const handleSubmit = useCallback(async () => {
    if (!rating) return toast.error('Please select a rating')
    setSubmitting(true)
    try {
      await appointmentAPI.addFeedback(appointment._id, { content, rating })
      toast.success('Feedback submitted!')
      onSuccess({ _id: appointment._id, action: 'feedback', feedback: { content, rating } })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Feedback failed')
    } finally {
      setSubmitting(false)
    }
  }, [appointment, content, rating, onSuccess, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Leave Feedback" size="sm">
      {appointment && (
        <div className="space-y-4">
          {/* Appointment summary */}
          <div className="bg-base-50 border border-base-200 rounded-xl p-3 text-sm space-y-1">
            <p className="font-medium text-base-content">{appointment.counselorId?.fullName}</p>
            <p className="text-xs text-gray-500">
              {formatDateLong(appointment.date)} · {appointment.type}
            </p>
          </div>

          {/* Star rating */}
          <div>
            <label className="field-label">
              Rating <span className="text-error">*</span>
            </label>
            <div className="flex gap-1.5" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((star) => {
                const on = star <= (hovered || rating)
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    className="transition-transform hover:scale-110 leading-none"
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      size={28}
                      className={on ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-300'}
                    />
                  </button>
                )
              })}
            </div>
            {rating > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="field-label">
              Comment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="field-textarea min-h-20"
              placeholder="Share your experience with this session…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
            />
            <p className="text-xs text-gray-400 text-right mt-1">{content.length}/1000</p>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn btn-outline btn-sm">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !rating}
              className="btn btn-primary btn-sm gap-1"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Submitting…</>
                : <><CheckCircle2 size={14} /> Submit Feedback</>
              }
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
})

export default FeedbackModal