// src/components/ui/StatusBadge.jsx
import { CheckCircle, Clock, XCircle, Calendar, Slash } from 'lucide-react'
import { STATUS_CLASS } from '@/lib/utils'

const ICONS = {
  pending:     <Clock size={12} />,
  accepted:    <CheckCircle size={12} />,
  completed:   <CheckCircle size={12} />,
  rejected:    <XCircle size={12} />,
  cancelled:   <Slash size={12} />,
  rescheduled: <Calendar size={12} />,
}

export default function StatusBadge({ status, className = '' }) {
  if (!status) return null
  // STATUS_CLASS maps to the roomy, self-contained `.badge-*` pills in
  // index.css. Unknown statuses fall back to a neutral pill that shares the
  // same sizing system (never the cramped DaisyUI `badge badge-ghost`).
  const cls = STATUS_CLASS[status] || 'badge-pill bg-slate-100 text-slate-600'
  return (
    <span className={`${cls} ${className}`.trim()}>
      {ICONS[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}