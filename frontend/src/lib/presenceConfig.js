// src/lib/presenceConfig.js
// Shared presence-status constants.
// Kept in its own file so PresenceBadge.jsx can be a pure component file
// (satisfying react-refresh/only-export-components).

export const PRESENCE_CONFIG = {
  available:  { dot: 'bg-emerald-400', label: 'Available',  text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  in_session: { dot: 'bg-amber-400',   label: 'In Session', text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  away:       { dot: 'bg-slate-400',   label: 'Away',       text: 'text-slate-600',   bg: 'bg-slate-50',    border: 'border-slate-200'   },
  on_leave:   { dot: 'bg-rose-400',    label: 'On Leave',   text: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200'    },
  offline:    { dot: 'bg-slate-300',   label: 'Offline',    text: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-200'   },
}

export const UNAVAILABLE_MESSAGES = {
  in_session: 'The Guidance Counselor is currently in a session.',
  away:       'The Guidance Counselor is currently unavailable.',
  on_leave:   'The Guidance Counselor is on leave today.',
  offline:    'The Guidance Counselor is currently offline.',
}

export const PRESENCE_STATUS_OPTIONS = [
  { value: 'available',  label: 'Available'  },
  { value: 'in_session', label: 'In Session' },
  { value: 'away',       label: 'Away'       },
  { value: 'on_leave',   label: 'On Leave'   },
  { value: 'offline',    label: 'Offline'    },
]

// Online / Away / In Session / Offline are detected automatically — the
// counselor only manually toggles On Leave (and clears it back to Available).
export const PRESENCE_MANUAL_OPTIONS = [
  { value: 'available', label: 'Available',  hint: 'Resume automatic status' },
  { value: 'on_leave',  label: 'On Leave',   hint: 'Appear unavailable until you return' },
]