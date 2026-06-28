// src/pages/auth/ResetPassword.jsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Lock, Eye, EyeOff, Loader2, CheckCircle2, Check, X, KeyRound, ArrowLeft,
} from 'lucide-react'
import { authAPI } from '@/api'
import { BrandLockup } from '@/components/ui/BrandLogo'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const uid = params.get('uid')
  const token = params.get('token')

  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    match: pw.length > 0 && pw === confirm,
  }
  const valid = checks.length && checks.upper && checks.lower && checks.number && checks.match

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    try {
      await authAPI.resetPassword({ uid, token, newPassword: pw, confirmPassword: confirm })
      setDone(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  // ── Missing / malformed link ──
  if (!uid || !token) {
    return (
      <AuthCard>
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <X size={28} className="text-red-500" />
          </div>
          <h2 className="font-display text-xl text-base-content mb-2">Invalid reset link</h2>
          <p className="text-sm text-base-content/60 mb-6">
            This link is missing information or malformed. Please request a new one.
          </p>
          <Link to="/forgot-password" className="btn btn-primary btn-sm">Request new link</Link>
        </div>
      </AuthCard>
    )
  }

  // ── Success ──
  if (done) {
    return (
      <AuthCard>
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-emerald-500" />
          </div>
          <h2 className="font-display text-xl text-base-content mb-2">Password reset</h2>
          <p className="text-sm text-base-content/60 mb-6">
            Your password has been updated and all other sessions were signed out. You can now log in.
          </p>
          <Link to="/login" className="btn btn-primary btn-sm gap-1.5"><ArrowLeft size={14} /> Back to login</Link>
        </div>
      </AuthCard>
    )
  }

  // ── Form ──
  return (
    <AuthCard>
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={18} className="text-primary-500" />
        <h2 className="font-display text-2xl text-base-content">Reset password</h2>
      </div>
      <p className="text-sm text-base-content/50 mt-1 mb-6">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="field-label">New password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="field-input pl-9 pr-10"
              placeholder="New password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div>
          <label className="field-label">Confirm new password</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field-input"
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />
        </div>

        {(pw || confirm) && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
            <Req ok={checks.length} label="At least 8 characters" />
            <Req ok={checks.upper} label="An uppercase letter" />
            <Req ok={checks.lower} label="A lowercase letter" />
            <Req ok={checks.number} label="A number" />
            <Req ok={checks.match} label="Passwords match" />
          </div>
        )}

        <button type="submit" disabled={!valid || loading} className="btn btn-primary w-full mt-2 disabled:opacity-50">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <><KeyRound size={15} /> Reset password</>}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-base-content/50">
        <Link to="/login" className="text-primary font-semibold hover:underline">Back to login</Link>
      </p>
    </AuthCard>
  )
}

function AuthCard({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-center mb-6">
          <BrandLockup tone="dark" size={34} subtitle="MKD Guidance Office" wordmarkClass="text-lg" />
        </div>
        <div className="card bg-white border border-base-200 shadow-sm">
          <div className="card-body p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  )
}

function Req({ ok, label }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
      {ok ? <Check size={13} /> : <X size={13} />}
      {label}
    </span>
  )
}
