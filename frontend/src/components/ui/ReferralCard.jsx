// src/components/ui/ReferralCard.jsx
// Props:
//   referral              – referral object (populated)
//   viewerRole            – 'faculty' | 'counselor' | 'student'
//   onAccept              – (referral) => void  (counselor only)
//   onReview              – (referral) => void  (counselor only — mark under_review)
//   onReject              – (referral) => void  (counselor only)
//   onConvert             – (referral) => void  (counselor only)
//   onRequestAppointment  – (referral) => void  (faculty only)
//   onDelete              – (referral) => void  (faculty only — completed/rejected)
//   onClick               – () => void

import { Calendar, User, BookOpen, Clock, Tag, AlertTriangle, CalendarDays, Trash2 } from 'lucide-react'
import UrgencyBadge from './UrgencyBadge'
import ReferralStatusBadge from './ReferralStatusBadge'
import StatusBadge from './StatusBadge'
import Avatar from './Avatar'
import { formatDate, formatTime, timeAgo } from '@/lib/utils'

const PRIORITY_LEFT_BORDER = {
  critical: 'border-l-4 border-l-red-500',
  high:     'border-l-4 border-l-orange-400',
  moderate: 'border-l-4 border-l-blue-400',
  low:      '',
}

export default function ReferralCard({
  referral,
  viewerRole = 'counselor',
  onAccept,
  onReview,
  onReject,
  onConvert,
  onRequestAppointment,
  onDelete,
  onClick,
}) {
  // Support both registered (studentId populated) and unregistered (studentSnapshot only)
  const studentData = referral.studentId ?? null
  const snap        = referral.studentSnapshot ?? {}
  const displayName = studentData?.fullName ?? snap.fullName ?? '—'
  const displayCourse = studentData
    ? [studentData.course, studentData.yearLevel].filter(Boolean).join(' · ')
    : [snap.course, snap.yearLevel].filter(Boolean).join(' · ')

  const faculty = referral.facultyId

  const priority  = referral.priorityLevel ?? referral.urgency ?? 'low'
  const leftBorder = PRIORITY_LEFT_BORDER[priority] ?? ''

  // Counselor actions
  const canAct        = viewerRole === 'counselor' && ['pending', 'under_review'].includes(referral.status)
  const canConvert    = viewerRole === 'counselor' && ['pending', 'under_review', 'accepted'].includes(referral.status) && !referral.appointmentId
  const canMarkReview = viewerRole === 'counselor' && referral.status === 'pending' && typeof onReview === 'function'

  // Faculty action: request appointment if referral has no appointment yet and is not closed
  const canRequestAppt = viewerRole === 'faculty'
    && !referral.appointmentId
    && !['rejected', 'completed'].includes(referral.status)
    && typeof onRequestAppointment === 'function'

  // Faculty delete: only completed or rejected referrals
  const canDelete = viewerRole === 'faculty'
    && ['completed', 'rejected'].includes(referral.status)
    && typeof onDelete === 'function'

  const linkedAppt = referral.appointmentId

  const indicators = referral.referralIndicators ?? []
  const displayIndicators = indicators.slice(0, 3)
  const extraCount = indicators.length - displayIndicators.length

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 h-full transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''
      } ${leftBorder}`}
    >
      {/* Unregistered badge */}
      {referral.isUnregisteredStudent && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <AlertTriangle size={11} />
          <span>Unregistered student — no system account</span>
        </div>
      )}

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            name={displayName}
            src={studentData?.profilePic}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{displayName}</p>
            {displayCourse && (
              <p className="text-xs text-slate-500">{displayCourse}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <UrgencyBadge urgency={priority} />
          <ReferralStatusBadge status={referral.status} />
        </div>
      </div>

      {/* Indicators */}
      {displayIndicators.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {displayIndicators.map((ind) => (
            <span
              key={ind}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200"
            >
              <Tag size={9} />
              {ind}
            </span>
          ))}
          {extraCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium border border-slate-200">
              +{extraCount} more
            </span>
          )}
        </div>
      )}

      {/* Observation / reason */}
      <p className="text-sm text-slate-700 line-clamp-2 mb-3">
        {referral.observationDetails ?? referral.reason ?? '—'}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {viewerRole === 'counselor' && faculty && (
          <span className="flex items-center gap-1">
            <User size={11} />
            {faculty.fullName}
            {faculty.department && ` · ${faculty.department}`}
          </span>
        )}
        {referral.category && (
          <span className="flex items-center gap-1">
            <BookOpen size={11} /> {referral.category}
          </span>
        )}
        {referral.preferredDate && (
          <span className="flex items-center gap-1">
            <Calendar size={11} /> Preferred: {formatDate(referral.preferredDate)}
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock size={11} /> {timeAgo(referral.createdAt)}
        </span>
      </div>

      {/* Linked appointment info */}
      {linkedAppt && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
          <CalendarDays size={12} className="text-primary-400 shrink-0" />
          <span>
            Appointment:{' '}
            <span className="font-medium">
              {linkedAppt.date ? formatDate(linkedAppt.date) : '—'}
              {linkedAppt.startTime ? ` at ${formatTime(linkedAppt.startTime)}` : ''}
            </span>
          </span>
          {linkedAppt.status && (
            <span className="ml-auto">
              <StatusBadge status={linkedAppt.status} />
            </span>
          )}
        </div>
      )}

      {/* Counselor actions */}
      {(canAct || canConvert || canMarkReview) && (
        <div
          className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {canMarkReview && (
            <button
              onClick={() => onReview?.(referral)}
              className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors"
            >
              Mark Under Review
            </button>
          )}
          {canAct && (
            <>
              <button
                onClick={() => onAccept?.(referral)}
                className="flex-1 min-w-[80px] px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onReject?.(referral)}
                className="flex-1 min-w-[80px] px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
              >
                Decline
              </button>
            </>
          )}
          {canConvert && (
            <button
              onClick={() => onConvert?.(referral)}
              className="flex-1 min-w-[100px] px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold transition-colors"
            >
              Schedule Appointment
            </button>
          )}
        </div>
      )}

      {/* Faculty actions: request appointment + delete */}
      {(canRequestAppt || canDelete) && (
        <div
          className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          {canRequestAppt && (
            <button
              onClick={() => onRequestAppointment(referral)}
              className="px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <CalendarDays size={13} /> Request Appointment
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(referral)}
              className="ml-auto px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
