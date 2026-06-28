// src/components/ui/PresenceBadge.jsx
// Reusable badge showing a counselor's real-time presence status.
// Used on: dashboards, booking page, counselor profile.
//
// Props:
//   status   – 'available' | 'in_session' | 'away' | 'on_leave' | 'offline'
//   note     – optional counselor status note string
//   size     – 'sm' | 'md' | 'lg'
//   variant  – 'badge' | 'dot' | 'card'

import { PRESENCE_CONFIG, UNAVAILABLE_MESSAGES } from '@/lib/presenceConfig'

export default function PresenceBadge({ status = 'offline', note, size = 'sm', variant = 'badge', className = '' }) {
  const cfg = PRESENCE_CONFIG[status] ?? PRESENCE_CONFIG.offline
  const isAvailable = status === 'available'

  // ── Dot only ──────────────────────────────────────────────────────────────
  if (variant === 'dot') {
    return (
      <span
        className={`inline-block rounded-full flex-shrink-0 ${cfg.dot} ${
          size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-2.5 h-2.5' : 'w-3 h-3'
        } ${className}`}
        title={cfg.label}
      />
    )
  }

  // ── Inline unavailability card ────────────────────────────────────────────
  if (variant === 'card') {
    if (isAvailable) return null
    return (
      <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border} ${className}`}>
        <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <div className="min-w-0">
          <p className={`text-sm font-medium ${cfg.text}`}>
            {UNAVAILABLE_MESSAGES[status] ?? 'The counselor is unavailable.'}
          </p>
          {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
          <p className="text-xs text-slate-400 mt-1">Please choose another date or counselor.</p>
        </div>
      </div>
    )
  }

  // ── Pill badge (default) ──────────────────────────────────────────────────
  const sizeClass =
    size === 'sm' ? 'text-xs px-2 py-0.5'
    : size === 'md' ? 'text-sm px-2.5 py-1'
    : 'text-sm px-3 py-1.5'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClass} ${cfg.bg} ${cfg.border} ${cfg.text} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${
          isAvailable ? 'animate-pulse' : ''
        }`}
      />
      {cfg.label}
    </span>
  )
}