// src/components/ui/AppointmentSourceBadge.jsx
// Shows where an appointment came from: a faculty referral or a direct student
// booking. The source is derived from appointment.referralId — no schema change
// needed. When the referral's faculty is populated, the badge tooltip carries
// the "Referred by …" audit trail.
import { Users, User } from 'lucide-react'

export default function AppointmentSourceBadge({ appointment, showStudentBooking = false }) {
  const referral = appointment?.referralId
  if (referral) {
    const faculty = typeof referral === 'object' ? referral.facultyId : null
    return (
      <span
        className="badge-pill bg-violet-100 text-violet-700"
        title={faculty?.fullName
          ? `Referred by ${faculty.fullName}${faculty.department ? ` (${faculty.department})` : ''}`
          : 'Created from a faculty referral'}
      >
        <Users size={10} /> Faculty Referral
      </span>
    )
  }
  if (!showStudentBooking) return null
  return (
    <span className="badge-pill bg-slate-100 text-slate-600" title="Booked directly by the student">
      <User size={10} /> Student Booking
    </span>
  )
}
