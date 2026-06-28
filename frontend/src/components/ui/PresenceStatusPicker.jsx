// src/components/ui/PresenceStatusPicker.jsx
// Counselor-only widget. Drop it anywhere to let the counselor
// change their real-time presence status.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { usePresenceStore } from '@/store/presenceStore'
import { useAuthStore } from '@/store/authStore'
import { PRESENCE_MANUAL_OPTIONS } from '@/lib/presenceConfig'
import PresenceBadge from './PresenceBadge'
import toast from 'react-hot-toast'

export default function PresenceStatusPicker({ className = '' }) {
  const { user, setUser } = useAuthStore()
  const { updateMyStatus } = usePresenceStore()
  const [open,    setOpen]    = useState(false)
  const [note,    setNote]    = useState(user?.presenceNote ?? '')
  const [saving,  setSaving]  = useState(false)

  const current = user?.presenceStatus ?? 'offline'

  const handleSelect = async (status) => {
    setSaving(true)
    try {
      const updated = await updateMyStatus(status, note)
      // Sync the auth store so the sidebar badge stays current
      setUser({ ...user, presenceStatus: updated.presenceStatus, presenceNote: updated.presenceNote })
      toast.success(`Status set to ${PRESENCE_MANUAL_OPTIONS.find((o) => o.value === status)?.label}`)
      setOpen(false)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm"
      >
        <PresenceBadge status={current} size="sm" />
        <span className="text-slate-500 text-xs">▾</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-2 z-40 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-slide-up">
            <div className="p-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">Status note (optional)</p>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Back at 2 PM"
                maxLength={100}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>

            <div className="p-1.5 space-y-0.5">
              {PRESENCE_MANUAL_OPTIONS.map(({ value, label, hint }) => (
                <button
                  key={value}
                  onClick={() => handleSelect(value)}
                  disabled={saving}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                    current === value ? 'bg-primary-50 text-primary-700' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <PresenceBadge status={value} variant="dot" size="md" />
                  <span className="min-w-0">
                    <span className="font-medium block">{label}</span>
                    <span className="text-[11px] text-slate-400 block leading-tight">{hint}</span>
                  </span>
                  {current === value && <span className="ml-auto text-xs text-primary-400 shrink-0">Current</span>}
                  {saving && <Loader2 size={12} className="ml-auto animate-spin text-slate-400 shrink-0" />}
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 leading-snug">
                Online, Away, In Session and Offline update automatically.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}