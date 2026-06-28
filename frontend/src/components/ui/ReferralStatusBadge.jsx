// src/components/ui/ReferralStatusBadge.jsx

const CONFIG = {
  pending:      { label: 'Pending',      bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400'   },
  under_review: { label: 'Under Review', bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-400'  },
  accepted:     { label: 'Accepted',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  scheduled:    { label: 'Scheduled',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  completed:    { label: 'Completed',    bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-500'   },
  rejected:     { label: 'Rejected',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
}

export default function ReferralStatusBadge({ status = 'pending', size = 'sm', className = '' }) {
  const cfg = CONFIG[status] ?? CONFIG.pending
  const sizeClass = size === 'sm'
    ? 'text-xs px-3 min-h-7'
    : size === 'md'
    ? 'text-sm px-3.5 min-h-8'
    : 'text-sm px-4 min-h-9'

  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold leading-none ${sizeClass} ${cfg.bg} ${cfg.border} ${cfg.text} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
