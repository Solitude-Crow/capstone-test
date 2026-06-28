// src/components/ui/TimeSlotGrid.jsx
import { formatTime } from '@/lib/utils'
import LoadingSpinner from './LoadingSpinner'
import { Clock } from 'lucide-react'

/**
 * Reusable time slot picker.
 * Props:
 *   slots        – array of { startTime, endTime, isBooked? }
 *   selected     – the currently selected slot object
 *   onSelect     – (slot) => void
 *   loading      – bool
 *   ready        – bool (counselor + date chosen)
 */
export default function TimeSlotGrid({ slots = [], selected, onSelect, loading, ready }) {
  if (!ready) {
    return (
      <div className="alert alert-info text-sm">
        <Clock size={16} /> Please select a counselor and date first.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="alert alert-warning text-sm">
        No available slots for the selected date. Please try another date or counselor.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
      {slots.map((slot, i) => {
        const isSelected = selected?.startTime === slot.startTime && selected?.endTime === slot.endTime
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(isSelected ? null : slot)}
            className={`slot-pill ${isSelected ? 'selected' : ''}`}
          >
            <span className="block">{formatTime(slot.startTime)}</span>
            <span className="block text-[10px] opacity-70">to {formatTime(slot.endTime)}</span>
          </button>
        )
      })}
    </div>
  )
}