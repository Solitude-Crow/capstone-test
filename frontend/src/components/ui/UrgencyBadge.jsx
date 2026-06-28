// src/components/ui/UrgencyBadge.jsx
// Reusable urgency level badge for referrals.

const CONFIG = {
  low:      { label: 'Low',      bg: 'bg-slate-100',   text: 'text-slate-600',  border: 'border-slate-200',  dot: 'bg-slate-400'  },
  medium:   { label: 'Moderate', bg: 'bg-blue-50',     text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-400'   },
  moderate: { label: 'Moderate', bg: 'bg-blue-50',     text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-400'   },
  high:     { label: 'High',     bg: 'bg-orange-50',   text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  critical: { label: 'Critical', bg: 'bg-red-50',      text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
}

export default function UrgencyBadge({ urgency = 'low', size = 'sm', className = '' }) {
  const cfg = CONFIG[urgency] ?? CONFIG.low
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