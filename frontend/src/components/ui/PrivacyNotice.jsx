// src/components/ui/PrivacyNotice.jsx
//
// Reusable Privacy Notice dialog shown before the user submits personal
// information (appointment booking, faculty referral, pre-assessment).
// Explains purpose, data collected, access, retention, and the data
// subject's rights under the Philippine Data Privacy Act of 2012 (RA 10173).
//
// Modes:
//   • gate  (default) – requires the consent checkbox before "I Agree".
//                        Optionally offers a "Don't remind me again" opt-out.
//   • review (readOnly) – informational only; a single "Close" button.
//
// Lucide icons only — no emoji. Accessible: role="dialog", aria-modal,
// Escape to dismiss, body scroll locked while open.

import { useEffect, useRef, useState } from 'react'
import {
  ShieldCheck, X, Target, Database, Lock, Clock, Scale,
  ListChecks, Check, Info,
} from 'lucide-react'

const DATA_COLLECTED = [
  'Name', 'Email', 'Student ID', 'Course', 'Year Level',
  'Faculty Information', 'Appointment Details',
  'Pre-Assessment Responses', 'Referral Information',
]

const RIGHTS = [
  'Be informed about how your data is processed',
  'Access your personal information',
  'Correct inaccurate or outdated data',
  'Restrict or object to processing where applicable',
  'Request deletion, subject to university retention requirements',
  'Request a copy of your data (data portability where applicable)',
  'File a complaint with the National Privacy Commission (NPC)',
]

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
        <span className="w-7 h-7 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
          {Icon && <Icon size={14} className="text-primary-600" />}
        </span>
        {title}
      </h3>
      <div className="text-xs leading-relaxed text-slate-600 pl-9 space-y-2">{children}</div>
    </section>
  )
}

// Inner dialog — mounted fresh each time the notice opens, so consent state
// always starts clean without resetting state inside an effect.
function PrivacyDialog({ onAgree, onClose, canOfferDontRemind, readOnly }) {
  const [consent, setConsent] = useState(false)
  const [dontRemind, setDontRemind] = useState(false)
  const dialogRef = useRef(null)

  // Move focus into the dialog on open (accessibility).
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Lock body scroll + Escape-to-close while open.
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handleAgree = () => {
    if (!readOnly && !consent) return
    onAgree?.({ dontRemind })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-notice-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-slide-up outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} className="text-primary-600" />
            </span>
            <div className="min-w-0">
              <h2 id="privacy-notice-title" className="font-display text-lg text-slate-900 leading-tight">
                Privacy Notice
              </h2>
              <p className="text-xs text-slate-500">Data Privacy Act of 2012 (RA 10173)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close privacy notice"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          <Section icon={Target} title="Purpose">
            <p>
              The information you submit will be used solely by the Guidance Office for
              appointment scheduling, student counseling, pre-assessment review, faculty
              referrals, guidance reports, case documentation, and other authorized university
              guidance services.
            </p>
          </Section>

          <Section icon={Database} title="Data We Collect">
            <div className="flex flex-wrap gap-1.5">
              {DATA_COLLECTED.map((d) => (
                <span
                  key={d}
                  className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600"
                >
                  {d}
                </span>
              ))}
            </div>
          </Section>

          <Section icon={Lock} title="Data Access">
            <p>
              Only authorized Guidance Counselors and authorized college personnel may access
              these records. No personal data will be sold or shared with third parties except
              when required by Philippine law.
            </p>
          </Section>

          <Section icon={Clock} title="Retention">
            <p>
              Personal information is retained only as long as necessary for guidance services,
              legal compliance, university recordkeeping, and institutional reporting. When no
              longer required, records are securely deleted or anonymized.
            </p>
          </Section>

          <Section icon={Scale} title="Your Rights">
            <p className="mb-1">Under the Data Privacy Act of 2012, you have the right to:</p>
            <ul className="space-y-1.5">
              {RIGHTS.map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <ListChecks size={13} className="text-primary-500 mt-0.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary-50 border border-primary-100">
            <Info size={15} className="text-primary-600 mt-0.5 shrink-0" />
            <p className="text-xs text-primary-900 leading-relaxed">
              I understand how my personal information will be used and I voluntarily consent to
              its processing for guidance-related services.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 sm:px-6 py-4 space-y-3">
          {readOnly ? (
            <div className="flex justify-end">
              <button onClick={onClose} className="btn btn-primary btn-sm min-w-[120px] justify-center">
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Required consent */}
              <button
                type="button"
                onClick={() => setConsent((v) => !v)}
                className={`w-full flex items-start gap-3 text-left p-3 rounded-xl border-2 transition-all ${
                  consent ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                    consent ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                  }`}
                >
                  {consent && <Check size={13} strokeWidth={3} className="text-white" />}
                </span>
                <span className={`text-xs leading-snug ${consent ? 'text-emerald-800 font-medium' : 'text-slate-600'}`}>
                  I have read and agree to this Privacy Notice and consent to the processing of my
                  personal information.
                </span>
              </button>

              {/* Optional opt-out — only after enough acknowledgements */}
              {canOfferDontRemind && (
                <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dontRemind}
                    onChange={(e) => setDontRemind(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-400"
                  />
                  <span className="text-xs text-slate-500">Don't remind me again</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={onClose} className="btn btn-outline btn-sm min-w-[90px] justify-center">
                  Cancel
                </button>
                <button
                  onClick={handleAgree}
                  disabled={!consent}
                  className="btn btn-primary btn-sm gap-1.5 min-w-[120px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShieldCheck size={14} /> I Agree
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PrivacyNotice({
  open,
  onAgree,
  onClose,
  canOfferDontRemind = false,
  readOnly = false,
}) {
  if (!open) return null
  return (
    <PrivacyDialog
      onAgree={onAgree}
      onClose={onClose}
      canOfferDontRemind={canOfferDontRemind}
      readOnly={readOnly}
    />
  )
}
