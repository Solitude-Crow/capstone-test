// src/pages/auth/ForgotPassword.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle2, Send } from 'lucide-react'
import { authAPI } from '@/api'
import { BrandLockup } from '@/components/ui/BrandLogo'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await authAPI.forgotPassword({ email: email.trim() })
      setSent(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="flex justify-center mb-6">
          <BrandLockup tone="dark" size={34} subtitle="MKD Guidance Office" wordmarkClass="text-lg" />
        </div>

        <div className="card bg-white border border-base-200 shadow-sm">
          <div className="card-body p-6 sm:p-8">
            {sent ? (
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <h2 className="font-display text-xl text-base-content mb-2">Check your email</h2>
                <p className="text-sm text-base-content/60 mb-6">
                  If an account exists for <strong>{email}</strong>, we've sent a password reset link.
                  It expires in 1 hour.
                </p>
                <Link to="/login" className="btn btn-outline btn-sm gap-1.5">
                  <ArrowLeft size={14} /> Back to login
                </Link>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl text-base-content">Forgot password?</h2>
                <p className="text-sm text-base-content/50 mt-1 mb-6">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="field-label">Email address</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="field-input pl-9"
                        placeholder="you@mkd.edu.ph"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn btn-primary w-full">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <><Send size={15} /> Send reset link</>}
                  </button>
                </form>
                <p className="mt-6 text-center text-sm text-base-content/50">
                  Remembered it?{' '}
                  <Link to="/login" className="text-primary font-semibold hover:underline">Back to login</Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
