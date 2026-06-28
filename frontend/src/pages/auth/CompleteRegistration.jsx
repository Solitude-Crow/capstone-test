// src/pages/auth/CompleteRegistration.jsx
// Shown after a first-time Google sign-in: choose a role + role-specific fields.
// The account is only created when this form is submitted.
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Loader2, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { COURSES, YEAR_LEVELS } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { BrandLockup } from '@/components/ui/BrandLogo'
import toast from 'react-hot-toast'

const ROLE_HOME = {
  counselor: '/counselor/dashboard',
  faculty:   '/faculty/dashboard',
  student:   '/student/dashboard',
}

const ROLES = [
  { value: 'student',   label: 'Student',             desc: 'Book appointments and access counseling services' },
  { value: 'counselor', label: 'Guidance Counselor',  desc: 'Manage schedules and conduct counseling sessions' },
  { value: 'faculty',   label: 'Faculty / Professor', desc: 'Refer students to the Guidance Counselor' },
]

const DEPARTMENTS = ['Education', 'Information Systems', 'International Studies', 'Human Services', 'other']

export default function CompleteRegistration() {
  const navigate = useNavigate()
  const { pendingGoogle, googleRegister, isLoading } = useAuthStore()

  const [form, setForm] = useState({
    fullName: pendingGoogle?.profile?.fullName || '',
    role: '',
    studentIDnum: '', yearLevel: '', course: '',
    specialization: '',
    department: '', facultyId: '',
  })

  // Reached without a Google sign-in in progress → back to login.
  if (!pendingGoogle) return <Navigate to="/login" replace />

  const { email, profilePic } = pendingGoogle.profile
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const valid = () => {
    if (form.fullName.trim().length < 2 || !form.role) return false
    if (form.role === 'student')   return !!(form.studentIDnum && form.yearLevel && form.course)
    if (form.role === 'counselor') return !!form.specialization.trim()
    if (form.role === 'faculty')   return !!form.department
    return false
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!valid()) return
    try {
      const data = await googleRegister(form)
      toast.success(`Welcome, ${data.fullName}!`)
      navigate(ROLE_HOME[data.role] ?? '/student/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-100 p-4">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="flex justify-center mb-6">
          <BrandLockup tone="dark" size={34} subtitle="MKD Guidance Office" wordmarkClass="text-lg" />
        </div>

        <div className="card bg-white border border-base-200 shadow-sm">
          <div className="card-body p-6 sm:p-8">
            <h2 className="font-display text-2xl text-base-content">Complete your registration</h2>
            <p className="text-sm text-base-content/50 mt-1 mb-5">
              Just a few more details to finish setting up your account.
            </p>

            {/* Google identity */}
            <div className="flex items-center gap-3 p-3 mb-5 rounded-xl bg-surface-50 border border-surface-200">
              <Avatar name={form.fullName || email} src={profilePic} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{email}</p>
                <p className="text-xs text-slate-500">Signed in with Google · email verified</p>
              </div>
              <Check size={18} className="text-emerald-500 ml-auto shrink-0" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  className="field-input"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  placeholder="Juan dela Cruz"
                  required
                />
              </div>

              <div>
                <label className="field-label">I am a…</label>
                <div className="space-y-2">
                  {ROLES.map(({ value, label, desc }) => {
                    const selected = form.role === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set('role', value)}
                        className={`select-card ${selected ? 'selected' : ''}`}
                      >
                        <span className={`select-check round ${selected ? 'checked' : ''}`}>
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block font-semibold text-sm ${selected ? 'text-primary-600' : 'text-base-content'}`}>{label}</span>
                          <span className="block text-xs text-base-content/50 mt-0.5">{desc}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.role === 'student' && (
                <div className="space-y-4">
                  <div>
                    <label className="field-label">Student ID Number</label>
                    <input
                      type="text"
                      className="field-input"
                      value={form.studentIDnum}
                      onChange={(e) => set('studentIDnum', e.target.value)}
                      placeholder="e.g. 2021-00123"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Year Level</label>
                      <select className="field-select" value={form.yearLevel} onChange={(e) => set('yearLevel', e.target.value)} required>
                        <option value="">Select year</option>
                        {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Course</label>
                      <select className="field-select" value={form.course} onChange={(e) => set('course', e.target.value)} required>
                        <option value="">Select course</option>
                        {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {form.role === 'counselor' && (
                <div>
                  <label className="field-label">Specialization</label>
                  <input
                    type="text"
                    className="field-input"
                    value={form.specialization}
                    onChange={(e) => set('specialization', e.target.value)}
                    placeholder="e.g. Academic and Career Counseling"
                    required
                  />
                </div>
              )}

              {form.role === 'faculty' && (
                <div className="space-y-4">
                  <div>
                    <label className="field-label">Department <span className="text-error">*</span></label>
                    <select className="field-select" value={form.department} onChange={(e) => set('department', e.target.value)} required>
                      <option value="">Select department</option>
                      {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">
                      Faculty ID <span className="text-base-content/40 font-normal ml-1">(optional)</span>
                    </label>
                    <input
                      type="text"
                      className="field-input"
                      value={form.facultyId}
                      onChange={(e) => set('facultyId', e.target.value)}
                      placeholder="e.g. FAC-2024-001"
                    />
                  </div>
                </div>
              )}

              <button type="submit" disabled={isLoading || !valid()} className="btn btn-primary w-full disabled:opacity-50">
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><UserPlus size={16} /> Create Account</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
