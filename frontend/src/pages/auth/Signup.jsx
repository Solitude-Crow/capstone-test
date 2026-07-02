// src/pages/auth/Signup.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { BrandLockup } from '@/components/ui/BrandLogo'
import GoogleAuthButton from '@/components/ui/GoogleAuthButton'
import { COURSES, YEAR_LEVELS, isValidEmail } from '@/lib/utils'
import toast from 'react-hot-toast'

const STEPS = ['Role', 'Account', 'Details']

const ROLE_HOME = {
  counselor: '/counselor/dashboard',
  faculty:   '/faculty/dashboard',
  student:   '/student/dashboard',
}

const ROLES = [
  {
    value: 'student',
    label: 'Student',
    desc: 'Book appointments and access counseling services',
  },
  {
    value: 'counselor',
    label: 'Guidance Counselor',
    desc: 'Manage schedules and conduct counseling sessions',
  },
  {
    value: 'faculty',
    label: 'Faculty / Professor',
    desc: 'Refer students to the Guidance Counselor',
  },
]

const DEPARTMENTS = [
  'Education',
  'Information Systems',
  'International Studies',
  'Human Services',
  'other',

]

// ── Password requirements ─────────────────────────────────────────────────────
// These MUST stay in sync with the backend signupValidator (validators.js):
//   .isLength({ min: 8 }) and .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
// If they drift apart, a password that passes here gets rejected server-side
// with a generic "Validation failed" error.
const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters',       test: (p) => p.length >= 8 },
  { key: 'upper',  label: 'One uppercase letter (A–Z)',  test: (p) => /[A-Z]/.test(p) },
  { key: 'lower',  label: 'One lowercase letter (a–z)',  test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number (0–9)',            test: (p) => /\d/.test(p) },
]

const isPasswordValid = (pw = '') => PASSWORD_RULES.every((r) => r.test(pw))

// Live checklist shown beneath the password field. Each item turns green once met.
function PasswordRequirements({ value = '' }) {
  return (
    <ul className="mt-2 space-y-1" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value)
        return (
          <li
            key={rule.key}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              ok ? 'text-brand-success' : 'text-base-content/50'
            }`}
          >
            <span
              className={`flex items-center justify-center w-3.5 h-3.5 rounded-full shrink-0 ${
                ok ? 'bg-brand-success text-white' : 'border border-base-content/30'
              }`}
            >
              {ok && <Check size={10} strokeWidth={3} />}
            </span>
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {steps.map((label, i) => {
        const done   = i < current
        const active = i === current
        return (
          <div key={label} className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div
                className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  done   ? 'bg-brand-success text-white' :
                  active ? 'bg-primary-500 text-white wizard-glow' :
                           'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? <Check size={16} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={`text-xs font-semibold hidden sm:block transition-colors ${
                  active ? 'text-primary-600' : done ? 'text-brand-success' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-6 sm:w-10 h-0.5 rounded-full mx-0.5 ${done ? 'bg-brand-success' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Role selection step ───────────────────────────────────────────────────────
function RoleStep({ value, onChange }) {
  return (
    <div className="space-y-3 animate-fade-in">
      <h3 className="font-display text-xl text-base-content mb-4">I am a…</h3>
      {ROLES.map(({ value: v, label, desc }) => {
        const selected = value === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`select-card ${selected ? 'selected' : ''}`}
          >
            <span className={`select-check round ${selected ? 'checked' : ''}`}>
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold text-sm ${selected ? 'text-primary-600' : 'text-base-content'}`}>
                {label}
              </span>
              <span className="block text-xs text-base-content/50 mt-0.5">{desc}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── Account info step ─────────────────────────────────────────────────────────
function AccountStep({ form, onChange, showPass, onTogglePass }) {
  const set = (k, v) => onChange({ ...form, [k]: v })
  const emailInvalid = form.email.length > 0 && !isValidEmail(form.email)
  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="font-display text-xl text-base-content mb-4">Account details</h3>

      <div>
        <label className="field-label">Full Name</label>
        <input
          type="text"
          className="field-input"
          placeholder="Juan dela Cruz"
          value={form.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div>
        <label className="field-label">Email Address</label>
        <input
          type="email"
          className={`field-input ${emailInvalid ? 'field-error' : ''}`}
          placeholder="you@mkd.edu.ph"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          required
          autoComplete="email"
          aria-invalid={emailInvalid}
        />
        {emailInvalid && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-brand-error">
            <AlertCircle size={13} className="shrink-0" />
            Please enter a valid email address.
          </p>
        )}
      </div>

      <div>
        <label className="field-label">Password</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            className="field-input pr-11"
            placeholder="Minimum 8 characters"
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            required
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={onTogglePass}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70 transition-colors"
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <PasswordRequirements value={form.password} />
      </div>
    </div>
  )
}

// ── Role-specific details step ────────────────────────────────────────────────
function DetailsStep({ form, onChange }) {
  const set = (k, v) => onChange({ ...form, [k]: v })

  if (form.role === 'student') {
    return (
      <div className="space-y-4 animate-fade-in">
        <h3 className="font-display text-xl text-base-content mb-4">Student information</h3>

        <div>
          <label className="field-label">Student ID Number</label>
          <input
            type="text"
            className="field-input"
            placeholder="e.g. 2021-00123"
            value={form.studentIDnum}
            onChange={(e) => set('studentIDnum', e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Year Level</label>
            <select
              className="field-select"
              value={form.yearLevel}
              onChange={(e) => set('yearLevel', e.target.value)}
              required
            >
              <option value="">Select year</option>
              {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Course</label>
            <select
              className="field-select"
              value={form.course}
              onChange={(e) => set('course', e.target.value)}
              required
            >
              <option value="">Select course</option>
              {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
    )
  }

  if (form.role === 'counselor') {
    return (
      <div className="space-y-4 animate-fade-in">
        <h3 className="font-display text-xl text-base-content mb-4">Counselor information</h3>
        <div>
          <label className="field-label">Specialization</label>
          <input
            type="text"
            className="field-input"
            placeholder="e.g. Academic and Career Counseling"
            value={form.specialization}
            onChange={(e) => set('specialization', e.target.value)}
            required
          />
        </div>
      </div>
    )
  }

  if (form.role === 'faculty') {
    return (
      <div className="space-y-4 animate-fade-in">
        <h3 className="font-display text-xl text-base-content mb-4">Faculty information</h3>

        <div>
          <label className="field-label">Department <span className="text-error">*</span></label>
          <select
            className="field-select"
            value={form.department}
            onChange={(e) => set('department', e.target.value)}
            required
          >
            <option value="">Select department</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="field-label">
            Faculty ID
            <span className="text-base-content/40 font-normal ml-1">(optional)</span>
          </label>
          <input
            type="text"
            className="field-input"
            placeholder="e.g. FAC-2024-001"
            value={form.facultyId}
            onChange={(e) => set('facultyId', e.target.value)}
          />
        </div>
      </div>
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Signup() {
  const navigate   = useNavigate()
  const { signup, isLoading } = useAuthStore()
  const [step,     setStep]   = useState(0)
  const [showPass, setShowPass] = useState(false)
  // Inline submit failure (e.g. email already registered), cleared on any edit.
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState({
    role: '', fullName: '', email: '', password: '',
    // Student
    studentIDnum: '', yearLevel: '', course: '',
    // Counselor
    specialization: '',
    // Faculty
    department: '', facultyId: '',
  })

  // Wraps setForm so any field edit dismisses a stale submit warning.
  const updateForm = (next) => {
    setForm(next)
    if (submitError) setSubmitError('')
  }

  const goStep = (next) => {
    setSubmitError('')
    setStep(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    try {
      const data = await signup(form)
      toast.success(`Welcome, ${data.fullName}!`)
      navigate(ROLE_HOME[data.role] ?? '/student/dashboard')
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Signup failed. Please check your details and try again.')
    }
  }

  const canNext = () => {
    if (step === 0) return !!form.role
    if (step === 1) return form.fullName && isValidEmail(form.email) && isPasswordValid(form.password)
    // Step 2 — role-specific required fields
    if (form.role === 'student')   return form.studentIDnum && form.yearLevel && form.course
    if (form.role === 'counselor') return !!form.specialization.trim()
    if (form.role === 'faculty')   return !!form.department
    return true
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="w-full max-w-lg animate-slide-up">

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex justify-center mb-4">
            <BrandLockup tone="dark" size={34} subtitle="MKD Guidance Office" wordmarkClass="text-lg" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl text-base-content text-center">Create your account</h2>
          <p className="text-base-content/50 mt-1 text-sm text-center">Join the GAB.AI guidance portal</p>
        </div>

        <StepIndicator steps={STEPS} current={step} />

        {/* Card */}
        <div className="card bg-white border border-base-200 shadow-sm">
          <div className="card-body p-6 sm:p-8">
            {step === 0 && (
              <div className="mb-5">
                <GoogleAuthButton />
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-base-200" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-xs text-base-content/40">or sign up with email</span>
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit}>

              {step === 0 && (
                <RoleStep value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
              )}
              {step === 1 && (
                <AccountStep
                  form={form}
                  onChange={updateForm}
                  showPass={showPass}
                  onTogglePass={() => setShowPass((v) => !v)}
                />
              )}
              {step === 2 && (
                <DetailsStep form={form} onChange={updateForm} />
              )}

              {/* Submit failure warning (e.g. email already registered) */}
              {submitError && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-brand-error"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8 pt-5 border-t border-base-200">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => goStep(step - 1)}
                    className="btn btn-ghost btn-sm gap-1"
                  >
                    <ChevronLeft size={15} /> Back
                  </button>
                ) : (
                  <Link to="/login" className="text-sm text-base-content/50 hover:text-base-content transition-colors">
                    Already have an account?
                  </Link>
                )}

                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    disabled={!canNext()}
                    onClick={() => goStep(step + 1)}
                    className="btn btn-primary btn-sm gap-1"
                  >
                    Continue <ChevronRight size={15} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading || !canNext()}
                    className="btn btn-primary btn-sm gap-1"
                  >
                    {isLoading
                      ? <span className="loading loading-spinner loading-sm" />
                      : <><UserPlus size={15} /> Create Account</>
                    }
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}