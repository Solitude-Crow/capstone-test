// src/components/ui/EmailVerifyCard.jsx
// Profile card: shows email-verification status and runs the OTP verify flow.
import { useState } from 'react'
import { MailCheck, ShieldAlert, Loader2, Send, Check } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/api'
import toast from 'react-hot-toast'

export default function EmailVerifyCard() {
  const { user, setUser } = useAuthStore()
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')

  // ── Already verified ──
  if (user?.emailVerified) {
    return (
      <div className="card mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <MailCheck size={18} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Email verified</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <span className="badge-pill bg-emerald-100 text-emerald-700 ml-auto shrink-0">
            <Check size={12} /> Verified
          </span>
        </div>
      </div>
    )
  }

  const sendCode = async () => {
    setSending(true)
    try {
      const { data } = await authAPI.sendEmailOtp()
      setCodeSent(true)
      toast.success(data.message || 'Verification code sent')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send the code. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const verify = async (e) => {
    e.preventDefault()
    if (code.length < 6) return
    setVerifying(true)
    try {
      const { data } = await authAPI.verifyEmail({ code })
      setUser(data)
      toast.success('Email verified!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="card mb-3">
      <div className="flex items-center gap-2 mb-1">
        <ShieldAlert size={17} className="text-amber-500" />
        <h3 className="font-display text-lg text-slate-900">Verify your email</h3>
        <span className="badge-pill bg-amber-100 text-amber-700 ml-auto">Unverified</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Your email <strong>{user?.email}</strong> isn't verified yet.{' '}
        {codeSent ? 'Enter the 6-digit code we emailed you (expires in 5 minutes).' : 'Send a code to confirm it.'}
      </p>

      {!codeSent ? (
        <button onClick={sendCode} disabled={sending} className="btn btn-primary btn-sm gap-1.5">
          {sending ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> Send verification code</>}
        </button>
      ) : (
        <form onSubmit={verify} className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="field-input tracking-[0.4em] text-center sm:max-w-[180px]"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" disabled={verifying || code.length < 6} className="btn btn-primary btn-sm gap-1.5 disabled:opacity-50">
              {verifying ? <><Loader2 size={13} className="animate-spin" /> Verifying…</> : <><Check size={13} /> Verify</>}
            </button>
            <button type="button" onClick={sendCode} disabled={sending} className="btn btn-ghost btn-sm">
              {sending ? 'Sending…' : 'Resend'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
