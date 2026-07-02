// src/pages/auth/Login.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { isValidEmail } from '@/lib/utils'
import { BrandLockup } from '@/components/ui/BrandLogo'
import GoogleAuthButton from '@/components/ui/GoogleAuthButton'
import toast from 'react-hot-toast'

const ROLE_HOME = {
  counselor: '/counselor/dashboard',
  faculty:   '/faculty/dashboard',
  student:   '/student/dashboard',
}

export default function Login() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  // Inline auth failure (wrong email/password). Cleared as soon as the user
  // edits either field so the warning never lingers after a correction.
  const [authError, setAuthError] = useState('')

  // Live email-format hint — shown only once the field is non-empty.
  const emailInvalid = form.email.length > 0 && !isValidEmail(form.email)

  const updateField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (authError) setAuthError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    if (!isValidEmail(form.email)) {
      setAuthError('Please enter a valid email address.')
      return
    }
    try {
      const data = await login(form)
      toast.success(`Welcome back, ${data.fullName}!`)
      navigate(ROLE_HOME[data.role] ?? '/student/dashboard')
    } catch (err) {
      // 401 → wrong credentials; show a single inline warning below the fields.
      const status = err.response?.status
      setAuthError(
        status === 401 || status === 400
          ? 'Incorrect email or password. Please try again.'
          : err.response?.data?.message || 'Login failed. Please try again.'
      )
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex w-1/2 bg-navy-500 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-jade-500/20 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="mb-16">
            <BrandLockup tone="light" size={40} subtitle="MKD Guidance Office" wordmarkClass="text-2xl" />
          </div>
          <h1 className="font-display text-5xl text-white leading-tight mb-6">
            Your wellbeing<br />is our priority.
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-sm">
            Access guidance counseling services, schedule appointments, and get the support you need — all in one place.
          </p>
        </div>
        
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-base-100">
        <div className="w-full max-w-md animate-slide-up">

          {/* Mobile logo */}
          <div className="lg:hidden mb-6">
            <BrandLockup tone="dark" size={32} subtitle="MKD Guidance Office" wordmarkClass="text-lg" />
          </div>

          <div className="mb-8">
            <h2 className="font-display text-2xl sm:text-3xl text-base-content">Welcome back</h2>
            <p className="text-base-content/50 mt-1 text-sm">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label className="field-label">Email address</label>
              <input
                type="email"
                className={`field-input ${emailInvalid || authError ? 'field-error' : ''}`}
                placeholder="you@mkd.edu.ph"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                autoComplete="email"
                aria-invalid={emailInvalid || !!authError}
              />
              {emailInvalid && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-brand-error">
                  <AlertCircle size={13} className="shrink-0" />
                  Please enter a valid email address.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="field-label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary font-semibold hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`field-input pr-11 ${authError ? 'field-error' : ''}`}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required
                  autoComplete="current-password"
                  aria-invalid={!!authError}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70 transition-colors"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Auth failure warning (wrong email/password) */}
            {authError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-brand-error"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading
                ? <span className="loading loading-spinner loading-sm" />
                : <><LogIn size={16} /> Sign In</>
              }
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-base-200" /></div>
            <div className="relative flex justify-center">
              <span className="bg-base-100 px-3 text-xs text-base-content/40">or</span>
            </div>
          </div>

          <GoogleAuthButton />

          <p className="mt-6 text-center text-sm text-base-content/50">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}