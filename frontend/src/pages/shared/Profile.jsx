// src/pages/shared/Profile.jsx
import { useState, useRef } from 'react'
import {
  Camera, User, Mail, BookOpen, GraduationCap, Building2,
  ShieldCheck, ChevronRight, Pencil, Save, X, Loader2,
  KeyRound, Lock, Eye, EyeOff, Check, Info,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/api'
import { COURSES, YEAR_LEVELS, formatDate } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import PrivacyNotice from '@/components/ui/PrivacyNotice'
import EmailVerifyCard from '@/components/ui/EmailVerifyCard'
import toast from 'react-hot-toast'

const PROFILE_UPDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const PROFILE_UPDATE_MAX = 2

// Live "updates remaining this week", derived from the user's stored counters.
function getProfileUpdateInfo(user) {
  const count = user?.profileUpdateCount || 0
  const start = user?.profileUpdateWindowStart ? new Date(user.profileUpdateWindowStart).getTime() : null
  const now = Date.now()
  if (!start || now - start >= PROFILE_UPDATE_WINDOW_MS) {
    return { remaining: PROFILE_UPDATE_MAX, resetAt: null }
  }
  return {
    remaining: Math.max(0, PROFILE_UPDATE_MAX - count),
    resetAt: new Date(start + PROFILE_UPDATE_WINDOW_MS),
  }
}

// Role → editable detail fields. Email is intentionally absent (read-only).
function fieldConfig(role) {
  const base = [{ key: 'fullName', Icon: User, label: 'Full Name', type: 'text', editable: true }]
  const email = { key: 'email', Icon: Mail, label: 'Email', editable: false }
  if (role === 'student') {
    return [
      ...base, email,
      { key: 'studentIDnum', Icon: BookOpen, label: 'Student ID', type: 'text', editable: true },
      { key: 'course', Icon: GraduationCap, label: 'Course', type: 'select', options: COURSES, editable: true },
      { key: 'yearLevel', Icon: GraduationCap, label: 'Year Level', type: 'select', options: YEAR_LEVELS, editable: true },
    ]
  }
  if (role === 'faculty') {
    return [
      ...base, email,
      { key: 'facultyId', Icon: BookOpen, label: 'Faculty ID', type: 'text', editable: true },
      { key: 'department', Icon: Building2, label: 'Department', type: 'text', editable: true },
    ]
  }
  // counselor
  return [
    ...base, email,
    { key: 'specialization', Icon: BookOpen, label: 'Specialization', type: 'text', editable: true },
  ]
}

function initialForm(user) {
  const out = {}
  for (const f of fieldConfig(user?.role)) {
    if (f.editable) out[f.key] = user?.[f.key] ?? ''
  }
  return out
}

export default function Profile() {
  const { user, setUser, refreshToken } = useAuthStore()
  const fileRef = useRef()

  const [uploading, setUploading] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  // ── Editable details ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [form, setForm] = useState(() => initialForm(user))

  const fields = fieldConfig(user?.role)
  const updateInfo = getProfileUpdateInfo(user)
  const canEdit = updateInfo.remaining > 0

  const startEditing = () => {
    setForm(initialForm(user))
    setEditing(true)
  }
  const cancelEditing = () => {
    setForm(initialForm(user))
    setEditing(false)
  }
  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const { data } = await authAPI.updateMyProfile(form)
      setUser(data)
      if (data.unchanged) toast('No changes to save')
      else toast.success('Profile updated')
      setEditing(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB')

    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const { data } = await authAPI.updateProfile({ profilePic: reader.result })
        setUser(data)
        toast.success('Profile photo updated!')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Upload failed')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Change password ───────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  const pw = pwForm.newPassword
  const pwChecks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /\d/.test(pw),
    match: pw.length > 0 && pw === pwForm.confirmPassword,
  }
  const pwValid =
    pwForm.currentPassword.length > 0 &&
    pwChecks.length && pwChecks.upper && pwChecks.lower && pwChecks.number && pwChecks.match

  const setPw = (key, val) => setPwForm((f) => ({ ...f, [key]: val }))

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!pwValid) return
    setChangingPw(true)
    try {
      const { data } = await authAPI.changePassword(pwForm)
      refreshToken(data.token)
      toast.success(data.message || 'Password changed successfully')
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setShowPw(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <div className="animate-fade-in w-full max-w-xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your account information and security</p>
      </div>

      {/* Avatar */}
      <div className="card mb-3">
        <div className="flex flex-col items-center py-2">
          <div className="relative group mb-2">
            <Avatar name={user?.fullName} src={user?.profilePic} size="xl" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100
                         flex items-center justify-center transition-opacity cursor-pointer"
              aria-label="Change profile photo"
            >
              {uploading ? (
                <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <h2 className="font-display text-xl text-slate-900">{user?.fullName}</h2>
          <p className="text-sm text-slate-500 capitalize mt-0.5">{user?.role}</p>
        </div>
      </div>

      {/* Account details */}
      <div className="card mb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-slate-900">Account Details</h3>
          {!editing ? (
            <button
              onClick={startEditing}
              disabled={!canEdit}
              className="btn btn-outline btn-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title={canEdit ? 'Edit details' : 'Update limit reached for this week'}
            >
              <Pencil size={13} /> Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={cancelEditing} disabled={savingProfile} className="btn btn-ghost btn-sm gap-1">
                <X size={14} /> Cancel
              </button>
              <button onClick={handleSaveProfile} disabled={savingProfile} className="btn btn-primary btn-sm gap-1.5">
                {savingProfile ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save</>}
              </button>
            </div>
          )}
        </div>

        {/* Update-limit indicator */}
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-xl bg-primary-50 border border-primary-100">
          <Info size={14} className="text-primary-600 mt-0.5 shrink-0" />
          <p className="text-xs text-primary-900">
            {updateInfo.remaining > 0 ? (
              <>You have <strong>{updateInfo.remaining}</strong> profile update{updateInfo.remaining === 1 ? '' : 's'} remaining this week.</>
            ) : (
              <>You've used all profile updates this week. You can edit again on <strong>{formatDate(updateInfo.resetAt)}</strong>.</>
            )}
            {' '}Email cannot be changed.
          </p>
        </div>

        <div className="space-y-2">
          {fields.map((field) => (
            <div key={field.key} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200">
              <div className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center flex-shrink-0">
                <field.Icon size={15} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">
                  {field.label}
                  {!field.editable && <span className="ml-1.5 text-[10px] text-slate-400">(read-only)</span>}
                </p>
                {editing && field.editable ? (
                  field.type === 'select' ? (
                    <select
                      value={form[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="field-select mt-1 !py-1.5 text-sm"
                    >
                      <option value="">Select…</option>
                      {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="field-input mt-1 !py-1.5 text-sm"
                      maxLength={field.key === 'fullName' ? 100 : 50}
                    />
                  )
                ) : (
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{user?.[field.key] || '—'}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email verification */}
      <EmailVerifyCard />

      {/* Change password — local accounts only (Google accounts have no password) */}
      {user?.provider !== 'google' && (
      <div className="card mb-3">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={17} className="text-primary-500" />
          <h3 className="font-display text-lg text-slate-900">Change Password</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          For your security, changing your password signs you out of all other devices.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="field-label">Current Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPw ? 'text' : 'password'}
                value={pwForm.currentPassword}
                onChange={(e) => setPw('currentPassword', e.target.value)}
                className="field-input pl-9 pr-10"
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={pwForm.newPassword}
                onChange={(e) => setPw('newPassword', e.target.value)}
                className="field-input"
                placeholder="New password"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="field-label">Confirm New Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={pwForm.confirmPassword}
                onChange={(e) => setPw('confirmPassword', e.target.value)}
                className="field-input"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Live requirements checklist */}
          {(pwForm.newPassword || pwForm.confirmPassword) && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-1 pt-1">
              <PwCheck ok={pwChecks.length} label="At least 8 characters" />
              <PwCheck ok={pwChecks.upper} label="An uppercase letter" />
              <PwCheck ok={pwChecks.lower} label="A lowercase letter" />
              <PwCheck ok={pwChecks.number} label="A number" />
              <PwCheck ok={pwChecks.match} label="Passwords match" />
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={!pwValid || changingPw} className="btn btn-primary btn-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {changingPw ? <><Loader2 size={13} className="animate-spin" /> Updating…</> : <><KeyRound size={13} /> Update Password</>}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Privacy & Data */}
      <div className="card">
        <h3 className="font-display text-lg text-slate-900 mb-3">Privacy &amp; Data</h3>
        <button
          onClick={() => setShowPrivacy(true)}
          className="w-full flex items-center gap-3 p-3 bg-surface-50 rounded-xl border border-surface-200 hover:border-primary-300 hover:bg-primary-50/40 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-white border border-surface-200 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={15} className="text-primary-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">Privacy Notice</p>
            <p className="text-xs text-slate-500 mt-0.5">Review how your information is used (Data Privacy Act of 2012)</p>
          </div>
          <ChevronRight size={16} className="text-slate-400 shrink-0" />
        </button>
      </div>

      <PrivacyNotice open={showPrivacy} readOnly onClose={() => setShowPrivacy(false)} />
    </div>
  )
}

function PwCheck({ ok, label }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
      {ok ? <Check size={13} /> : <X size={13} />}
      {label}
    </span>
  )
}
