// src/pages/faculty/CreateReferral.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, ChevronLeft, ChevronRight, Loader2, User, Users, AlertTriangle,
  CheckSquare, ClipboardList, ShieldAlert, Eye, CalendarDays,
  Clock, CheckCircle2, Check, Send,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { referralAPI, authAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import {
  REFERRAL_INDICATORS, ACTIONS_TAKEN_OPTIONS, PRIORITY_LEVELS,
  STUDENT_AWARENESS_OPTIONS, COURSES, YEAR_LEVELS, APPOINTMENT_TYPES,
  formatTime,
} from '@/lib/utils'
import {
  shouldShowPrivacyNotice, canOfferDontRemind, recordPrivacyConsent,
} from '@/lib/privacyConsent'
import PageBanner     from '@/components/ui/PageBanner'
import Avatar         from '@/components/ui/Avatar'
import FormField      from '@/components/ui/FormField'
import WizardSteps    from '@/components/ui/WizardSteps'
import ReviewSection, { ReviewRow } from '@/components/ui/ReviewSection'
import PresenceBadge  from '@/components/ui/PresenceBadge'
import PrivacyNotice  from '@/components/ui/PrivacyNotice'

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS_BASE = [
  { id: 'student',    label: 'Student',           icon: Users        },
  { id: 'faculty',    label: 'Your Information',  icon: User         },
  { id: 'indicators', label: 'Indicators',        icon: ClipboardList },
  { id: 'details',    label: 'Details & Actions', icon: CheckSquare  },
  { id: 'priority',   label: 'Priority',          icon: ShieldAlert  },
  { id: 'review',     label: 'Review & Submit',   icon: Eye          },
]
const STEP_APPOINTMENT = { id: 'appointment', label: 'Select Appointment', icon: CalendarDays }

const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-300 placeholder:text-slate-400'
const textareaCls = `${inputCls} resize-none`

// ── Step 1: Student Selection ─────────────────────────────────────────────────
function StepStudent({ form, onChange }) {
  const [query,    setQuery]    = useState('')
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(false)

  const studentType = form.studentType

  // ESLint: setLoading must live inside the async callback, not directly in the effect body
  useEffect(() => {
    if (studentType !== 'registered') return
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await authAPI.getUsersByRole('student')
        setStudents(Array.isArray(data) ? data : [])
      } catch {
        // silently ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [studentType])

  const filtered = query
    ? students.filter((s) =>
        s.fullName.toLowerCase().includes(query.toLowerCase()) ||
        s.studentIDnum?.toLowerCase().includes(query.toLowerCase()) ||
        s.course?.toLowerCase().includes(query.toLowerCase())
      )
    : students

  const setField = (field, val) => onChange({ ...form, [field]: val })
  const setManual = (field, val) => onChange({ ...form, manualStudent: { ...form.manualStudent, [field]: val } })

  return (
    <div className="space-y-5">
      {/* Registered / Unregistered toggle */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { value: 'registered',   label: 'Registered Student',  desc: 'Has a system account' },
          { value: 'unregistered', label: 'Unregistered Student', desc: 'No system account yet' },
        ].map(({ value, label, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => setField('studentType', value)}
            className={`relative flex flex-col items-center gap-1 p-4 sm:p-5 rounded-xl border-2 transition-all text-center ${
              studentType === value
                ? 'border-primary-500 bg-primary-50 shadow-sm'
                : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50/40 bg-white'
            }`}
          >
            {studentType === value && (
              <span className="select-check round checked absolute top-2.5 right-2.5">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
            <span className={`font-semibold text-sm ${studentType === value ? 'text-primary-700' : 'text-slate-800'}`}>{label}</span>
            <span className="text-xs text-slate-500">{desc}</span>
          </button>
        ))}
      </div>

      {studentType === 'registered' ? (
        <>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or course…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-primary-400" />
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filtered.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => setField('selectedStudent', s)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    form.selectedStudent?._id === s._id
                      ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                      : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                  }`}
                >
                  <Avatar name={s.fullName} src={s.profilePic} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{s.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {s.studentIDnum && `ID: ${s.studentIDnum} · `}
                      {s.course}{s.yearLevel && ` · ${s.yearLevel}`}
                    </p>
                  </div>
                  {form.selectedStudent?._id === s._id && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-primary-600">
                      <span className="select-check round checked"><Check size={12} strokeWidth={3} /></span>
                      Selected
                    </span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-slate-400 italic text-center py-6">No students found.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            <AlertTriangle size={13} className="shrink-0" />
            <span>This student has no system account. Their information will be manually recorded.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" required>
              <input type="text" value={form.manualStudent.fullName} onChange={(e) => setManual('fullName', e.target.value)} placeholder="e.g. Juan dela Cruz" className={inputCls} />
            </FormField>
            <FormField label="Student ID Number" hint="optional">
              <input type="text" value={form.manualStudent.studentIDnum} onChange={(e) => setManual('studentIDnum', e.target.value)} placeholder="e.g. 2023-0001" className={inputCls} />
            </FormField>
            <FormField label="Course / Program">
              <select value={form.manualStudent.course} onChange={(e) => setManual('course', e.target.value)} className={inputCls}>
                <option value="">Select course</option>
                {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Year Level">
              <select value={form.manualStudent.yearLevel} onChange={(e) => setManual('yearLevel', e.target.value)} className={inputCls}>
                <option value="">Select year level</option>
                {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </FormField>
            <FormField label="Section" hint="optional">
              <input type="text" value={form.manualStudent.section} onChange={(e) => setManual('section', e.target.value)} placeholder="e.g. A" className={inputCls} />
            </FormField>
            <FormField label="Class Adviser" hint="optional">
              <input type="text" value={form.manualStudent.adviser} onChange={(e) => setManual('adviser', e.target.value)} placeholder="Adviser's full name" className={inputCls} />
            </FormField>
            <FormField label="Email Address" hint="optional">
              <input type="email" value={form.manualStudent.email} onChange={(e) => setManual('email', e.target.value)} placeholder="student@email.com" className={inputCls} />
            </FormField>
            <FormField label="Contact Number" hint="optional">
              <input type="text" value={form.manualStudent.contactNumber} onChange={(e) => setManual('contactNumber', e.target.value)} placeholder="09xxxxxxxxx" className={inputCls} />
            </FormField>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 2: Faculty Information (Section A) ───────────────────────────────────
function StepFaculty({ form, onChange }) {
  const setFaculty = (field, val) => onChange({ ...form, faculty: { ...form.faculty, [field]: val } })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        <User size={13} className="shrink-0 mt-0.5" />
        <span>Auto-populated from your account. Correct any details if needed — all changes are logged.</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Full Name" required>
          <input type="text" value={form.faculty.name} onChange={(e) => setFaculty('name', e.target.value)} className={inputCls} />
        </FormField>
        <FormField label="Position / Designation" hint="optional">
          <input type="text" value={form.faculty.position} onChange={(e) => setFaculty('position', e.target.value)} placeholder="e.g. Instructor I" className={inputCls} />
        </FormField>
        <FormField label="Department" hint="optional">
          <input type="text" value={form.faculty.department} onChange={(e) => setFaculty('department', e.target.value)} placeholder="e.g. BSIS Department" className={inputCls} />
        </FormField>
        <FormField label="Contact Number" hint="optional">
          <input type="text" value={form.faculty.contactNumber} onChange={(e) => setFaculty('contactNumber', e.target.value)} placeholder="09xxxxxxxxx" className={inputCls} />
        </FormField>
        <FormField label="Email Address" required className="sm:col-span-2">
          <input type="email" value={form.faculty.email} onChange={(e) => setFaculty('email', e.target.value)} className={inputCls} />
        </FormField>
      </div>
      <FormField label="Preferred Consultation Date" hint="optional">
        <input
          type="date"
          value={form.preferredDate}
          onChange={(e) => onChange({ ...form, preferredDate: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          className={inputCls}
        />
      </FormField>
    </div>
  )
}

// ── Step 3: Section C — Referral Indicators ───────────────────────────────────
const CATEGORY_COLORS = {
  'Academic':                 { border: 'border-blue-200',   bg: 'bg-blue-50',    dot: 'bg-blue-500'    },
  'Behavioral':               { border: 'border-orange-200', bg: 'bg-orange-50',  dot: 'bg-orange-500'  },
  'Emotional / Psychological':{ border: 'border-violet-200', bg: 'bg-violet-50',  dot: 'bg-violet-500'  },
  'Family / Social':          { border: 'border-amber-200',  bg: 'bg-amber-50',   dot: 'bg-amber-500'   },
  'Wellness / Safety':        { border: 'border-red-200',    bg: 'bg-red-50',     dot: 'bg-red-500'     },
}

function StepIndicators({ form, onChange }) {
  const toggle = (ind) => {
    const next = form.referralIndicators.includes(ind)
      ? form.referralIndicators.filter((i) => i !== ind)
      : [...form.referralIndicators, ind]
    onChange({ ...form, referralIndicators: next })
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">Select all indicators that apply. At least one is required.</p>
      {Object.entries(REFERRAL_INDICATORS).map(([category, indicators]) => {
        const c = CATEGORY_COLORS[category] ?? { border: 'border-slate-200', bg: 'bg-slate-50', dot: 'bg-slate-500' }
        return (
          <div key={category} className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{category}</h4>
            </div>
            <div className="space-y-1">
              {indicators.map((ind) => {
                const checked = form.referralIndicators.includes(ind)
                return (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggle(ind)}
                    className={`w-full flex items-start gap-3 text-left rounded-lg p-2 transition-colors ${checked ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}
                  >
                    <span className={`select-check shrink-0 mt-0.5 ${checked ? 'checked' : ''}`}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <span className={`text-sm leading-snug select-none ${checked ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                      {ind}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <FormField label="Other / Additional Concern" hint="optional">
        <textarea
          value={form.otherConcern}
          onChange={(e) => onChange({ ...form, otherConcern: e.target.value })}
          rows={2}
          placeholder="Describe any additional concern not listed above…"
          className={textareaCls}
        />
      </FormField>
    </div>
  )
}

// ── Step 4: Section D + E — Observation Details & Actions ────────────────────
function StepDetails({ form, onChange }) {
  const charCount = form.observationDetails.length
  const isValid   = charCount >= 50

  const toggleAction = (action) => {
    const next = form.actionsTaken.includes(action)
      ? form.actionsTaken.filter((a) => a !== action)
      : [...form.actionsTaken, action]
    onChange({ ...form, actionsTaken: next })
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Section D — Observation Details <span className="text-red-400">*</span>
          </label>
          <span className={`text-xs font-medium ${charCount < 50 ? 'text-red-500' : 'text-slate-400'}`}>
            {charCount} / 3000{charCount < 50 ? ' (min 50)' : ''}
          </span>
        </div>
        <textarea
          value={form.observationDetails}
          onChange={(e) => onChange({ ...form, observationDetails: e.target.value })}
          rows={5}
          maxLength={3000}
          placeholder="Describe your specific observations of the student's behavior, academic performance, or emotional state…"
          className={`${textareaCls} ${!isValid && charCount > 0 ? 'border-red-300 focus:ring-red-300' : ''}`}
        />
        {!isValid && charCount > 0 && (
          <p className="text-xs text-red-500 mt-1">Please provide at least 50 characters.</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-3">
          Section E — Actions Already Taken
          <span className="font-normal text-slate-400 ml-1">(select all that apply)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {ACTIONS_TAKEN_OPTIONS.map((action) => {
            const checked = form.actionsTaken.includes(action)
            return (
              <button
                key={action}
                type="button"
                onClick={() => toggleAction(action)}
                className={`flex items-center gap-3 text-left rounded-lg p-2 transition-colors ${checked ? 'bg-primary-50' : 'hover:bg-slate-50'}`}
              >
                <span className={`select-check shrink-0 ${checked ? 'checked' : ''}`}>
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className={`text-sm select-none ${checked ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
                  {action}
                </span>
              </button>
            )
          })}
        </div>
        <input
          type="text"
          value={form.otherAction}
          onChange={(e) => onChange({ ...form, otherAction: e.target.value })}
          placeholder="Other action taken (describe briefly)…"
          className={`${inputCls} mt-3`}
        />
      </div>
    </div>
  )
}

// ── Step 5: Section F + G — Priority & Student Awareness ─────────────────────
function StepPriority({ form, onChange }) {
  const isEscalated = ['high', 'critical'].includes(form.priorityLevel)

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-3">
          Section F — Referral Priority <span className="text-red-400">*</span>
        </label>
        <div className="space-y-2">
          {PRIORITY_LEVELS.map((lvl) => {
            const selected = form.priorityLevel === lvl.value
            return (
              <button
                key={lvl.value}
                type="button"
                onClick={() => onChange({ ...form, priorityLevel: lvl.value })}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? `${lvl.bgClass} ${lvl.borderClass}`
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  selected ? `${lvl.textClass} border-current` : 'border-slate-300'
                }`}>
                  {selected && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${selected ? lvl.textClass : 'text-slate-700'}`}>{lvl.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lvl.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
        {isEscalated && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <span>
              <strong>{form.priorityLevel.toUpperCase()} priority</strong> — all counselors will be notified immediately upon submission.
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-3">
          Section G — Student Awareness <span className="text-red-400">*</span>
        </label>
        <div className="space-y-2">
          {STUDENT_AWARENESS_OPTIONS.map((opt) => {
            const selected = form.studentAwareness === opt
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ ...form, studentAwareness: opt })}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all text-sm ${
                  selected
                    ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200 font-medium text-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selected ? 'border-primary-500' : 'border-slate-300'
                }`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                </div>
                {opt}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Step 6: Review & Submit ───────────────────────────────────────────────────
function StepReview({ form, onChange }) {
  const isUnregistered = form.studentType === 'unregistered'
  const s              = isUnregistered ? form.manualStudent : form.selectedStudent
  const priorityInfo   = PRIORITY_LEVELS.find((p) => p.value === form.priorityLevel)

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Please review all details before submitting. This referral cannot be edited after submission.</p>

      <ReviewSection title="Student Information">
        <ReviewRow label="Name" value={s?.fullName} />
        {s?.studentIDnum && <ReviewRow label="Student ID" value={s.studentIDnum} />}
        {(s?.course || s?.yearLevel) && (
          <ReviewRow label="Course" value={[s.course, s.yearLevel].filter(Boolean).join(' · ')} />
        )}
        {isUnregistered && (
          <ReviewRow label="Status" value={<span className="text-amber-600 font-medium text-xs">Unregistered — no system account</span>} />
        )}
      </ReviewSection>

      <ReviewSection title="Referring Faculty (Section A)">
        <ReviewRow label="Name"       value={form.faculty.name} />
        {form.faculty.position   && <ReviewRow label="Position"   value={form.faculty.position} />}
        {form.faculty.department && <ReviewRow label="Department" value={form.faculty.department} />}
        <ReviewRow label="Email" value={form.faculty.email} />
      </ReviewSection>

      {form.referralIndicators.length > 0 && (
        <ReviewSection title="Referral Indicators (Section C)">
          <div className="flex flex-wrap gap-1.5">
            {form.referralIndicators.map((ind) => (
              <span key={ind} className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">{ind}</span>
            ))}
          </div>
          {form.otherConcern && <ReviewRow label="Other" value={form.otherConcern} />}
        </ReviewSection>
      )}

      <ReviewSection title="Observation Details (Section D)">
        <p className="text-sm text-slate-700 leading-relaxed">{form.observationDetails}</p>
      </ReviewSection>

      {(form.actionsTaken.length > 0 || form.otherAction) && (
        <ReviewSection title="Actions Already Taken (Section E)">
          {form.actionsTaken.length > 0 && (
            <ul className="text-sm text-slate-700 space-y-1 list-disc pl-4">
              {form.actionsTaken.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}
          {form.otherAction && <ReviewRow label="Other" value={form.otherAction} />}
        </ReviewSection>
      )}

      <ReviewSection title="Priority & Awareness (Sections F–G)">
        <ReviewRow label="Priority" value={
          <span className={`font-bold text-sm ${priorityInfo?.textClass}`}>{priorityInfo?.label}</span>
        } />
        {form.preferredDate && (
          <ReviewRow label="Preferred Date" value={new Date(form.preferredDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} />
        )}
        {form.studentAwareness && <ReviewRow label="Awareness" value={form.studentAwareness} />}
      </ReviewSection>

      {['high', 'critical'].includes(form.priorityLevel) && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>This referral is <strong>{form.priorityLevel.toUpperCase()}</strong> — all counselors will be notified immediately upon submission.</span>
        </div>
      )}

      {/* Submit mode toggle */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-700 mb-3">After submitting, would you like to:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              value: 'referral_only',
              label: 'Submit Referral Only',
              desc: 'The counselor will review and schedule an appointment',
            },
            {
              value: 'with_appointment',
              label: 'Submit & Request Appointment',
              desc: 'Pick a counselor schedule right now',
            },
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...form, submitMode: value })}
              className={`relative flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all ${
                form.submitMode === value
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-slate-200 hover:border-primary-300 hover:bg-primary-50/40 bg-white'
              }`}
            >
              {form.submitMode === value && (
                <span className="select-check round checked absolute top-2.5 right-2.5">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              <span className="font-semibold text-sm text-slate-900 pr-7">{label}</span>
              <span className="text-xs text-slate-500">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        By submitting, you confirm this information is accurate. The Guidance Counselor and relevant parties will be notified.
      </p>
    </div>
  )
}

// ── Step 7: Request Appointment ───────────────────────────────────────────────
const PRESENCE_LABELS = {
  available:  'Available',
  in_session: 'In Session',
  away:       'Away',
  on_leave:   'On Leave',
  offline:    'Offline',
}

function StepAppointmentRequest({ form, onChange, counselorData, loadingSchedules }) {
  const selected      = form.appointment
  const counselorId   = selected?.counselorId ?? null
  const selectedDate  = selected?.date        ?? null
  const selectedSlot  = selected?.slot        ?? null
  const type          = selected?.type        ?? 'General Inquiry'

  const set = (patch) => onChange({ ...form, appointment: { ...form.appointment, ...patch } })

  const counselorEntry = counselorData.find((d) => d.counselor._id === counselorId)

  // Available dates (have at least one free slot)
  const availableDatesSet = new Set(
    (counselorEntry?.availability ?? [])
      .filter((a) => !a.isHoliday && a.availableSlots.some((s) => !s.isBooked))
      .map((a) => new Date(a.date).toDateString())
  )

  // Slots for the selected date
  const slotsForDate = selectedDate && counselorEntry
    ? (counselorEntry.availability.find((a) => isSameDay(new Date(a.date), selectedDate))
        ?.availableSlots.filter((s) => !s.isBooked) ?? [])
    : []

  const filterDate = (date) => availableDatesSet.has(date.toDateString())

  return (
    <div className="space-y-5">
      {loadingSchedules ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="animate-spin text-primary-400" />
          <span className="ml-2 text-sm text-slate-500">Loading counselor schedules…</span>
        </div>
      ) : counselorData.length === 0 ? (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">No available schedules</p>
            <p className="text-xs mt-0.5 text-amber-600">
              The guidance counselors have not set up their availability yet.
              You can still submit the referral — the counselor will schedule the appointment after reviewing it.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 1. Counselor selection */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Select a Counselor</p>
            <div className="space-y-2">
              {counselorData.map(({ counselor }) => {
                const isSelected = counselorId === counselor._id
                const isUnavailable = ['on_leave', 'offline'].includes(counselor.presenceStatus)
                return (
                  <button
                    key={counselor._id}
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => set({ counselorId: counselor._id, date: null, slot: null })}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                        : isUnavailable
                          ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                          : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
                    }`}
                  >
                    <Avatar name={counselor.fullName} src={counselor.profilePic} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{counselor.fullName}</p>
                      {counselor.specialization && (
                        <p className="text-xs text-slate-500 truncate">{counselor.specialization}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <PresenceBadge status={counselor.presenceStatus} />
                      {isUnavailable && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{PRESENCE_LABELS[counselor.presenceStatus]}</p>
                      )}
                    </div>
                    {isSelected && <CheckCircle2 size={16} className="text-primary-500 shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Date picker */}
          {counselorId && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Select a Date</p>
              {availableDatesSet.size === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <AlertTriangle size={13} className="shrink-0" />
                  This counselor has no available dates in the next 30 days.
                </div>
              ) : (
                <DatePicker
                  selected={selectedDate}
                  onChange={(d) => set({ date: d, slot: null })}
                  filterDate={filterDate}
                  minDate={new Date()}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Click to choose an available date"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  calendarClassName="shadow-xl border-slate-200"
                  inline
                />
              )}
            </div>
          )}

          {/* 3. Time slot picker */}
          {selectedDate && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Select a Time Slot</p>
              {slotsForDate.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <AlertTriangle size={13} className="shrink-0" />
                  No available slots on this date. Please choose another date.
                </div>
              ) : (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
                  {slotsForDate.map((slot, i) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => set({ slot: isSelected ? null : slot })}
                        className={`flex flex-col items-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200 text-primary-700'
                            : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Clock size={12} className="mb-1 opacity-70" />
                        <span>{formatTime(slot.startTime)}</span>
                        <span className="opacity-60">– {formatTime(slot.endTime)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. Appointment type */}
          {selectedSlot && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Appointment Type</p>
              <select
                value={type}
                onChange={(e) => set({ type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Summary */}
          {selectedSlot && counselorEntry && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <p className="font-semibold">Appointment Request Summary</p>
              <p>Counselor: <span className="font-medium">{counselorEntry.counselor.fullName}</span></p>
              <p>Date: <span className="font-medium">{selectedDate?.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span></p>
              <p>Time: <span className="font-medium">{formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}</span></p>
              <p>Type: <span className="font-medium">{type}</span></p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Initial form state ────────────────────────────────────────────────────────
const INITIAL_FORM = {
  studentType:     'registered',
  selectedStudent: null,
  manualStudent:   { fullName: '', studentIDnum: '', course: '', yearLevel: '', section: '', adviser: '', email: '', contactNumber: '' },
  faculty:         { name: '', position: '', department: '', contactNumber: '', email: '' },
  referralIndicators: [],
  otherConcern:       '',
  observationDetails: '',
  actionsTaken:       [],
  otherAction:        '',
  priorityLevel:      'low',
  studentAwareness:   '',
  preferredDate:      '',
  submitMode:         'referral_only', // 'referral_only' | 'with_appointment'
  appointment:        { counselorId: null, date: null, slot: null, type: 'General Inquiry' },
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CreateReferral() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step,             setStep]             = useState(0)
  const [form,             setForm]             = useState(INITIAL_FORM)
  const [submitting,       setSubmitting]       = useState(false)
  const [counselorData,    setCounselorData]    = useState([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [showPrivacy,      setShowPrivacy]      = useState(false)

  const STEPS = form.submitMode === 'with_appointment'
    ? [...STEPS_BASE, STEP_APPOINTMENT]
    : STEPS_BASE

  const isLastStep   = step === STEPS.length - 1
  const isReviewStep = step === STEPS_BASE.length - 1

  // Pre-populate faculty info from auth on mount
  useEffect(() => {
    if (!user) return
    setForm((f) => ({
      ...f,
      faculty: {
        name:          user.fullName      ?? '',
        position:      user.position      ?? '',
        department:    user.department    ?? '',
        contactNumber: user.contactNumber ?? '',
        email:         user.email         ?? '',
      },
    }))
  }, [user])

  // Load counselor schedules when reaching the appointment step
  useEffect(() => {
    if (step !== STEPS_BASE.length) return
    if (counselorData.length > 0 || loadingSchedules) return
    const load = async () => {
      setLoadingSchedules(true)
      try {
        const today     = new Date().toISOString().split('T')[0]
        const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { data } = await referralAPI.getCounselorSchedules({ startDate: today, endDate: nextMonth })
        setCounselorData(data)
      } catch {
        setCounselorData([]) // let the empty-state UI handle messaging
      } finally {
        setLoadingSchedules(false)
      }
    }
    load()
  }, [step, counselorData.length, loadingSchedules])

  const canNext = useCallback(() => {
    switch (step) {
      case 0: return form.studentType === 'registered'
        ? !!form.selectedStudent
        : form.manualStudent.fullName.trim().length > 0
      case 1: return form.faculty.name.trim().length > 0 && form.faculty.email.trim().length > 0
      case 2: return form.referralIndicators.length > 0
      case 3: return form.observationDetails.trim().length >= 50
      case 4: return !!form.studentAwareness
      case 5: return true // review step — always can proceed (submit or continue to appt)
      case 6: {
        const appt = form.appointment
        return !!(appt?.counselorId && appt?.date && appt?.slot)
      }
      default: return true
    }
  }, [step, form])

  // Gate submission behind the Privacy Notice (skipped if the user opted out).
  const handleSubmit = () => {
    if (shouldShowPrivacyNotice(user)) setShowPrivacy(true)
    else submitReferral()
  }

  const handlePrivacyAgree = ({ dontRemind }) => {
    recordPrivacyConsent(user, { dontRemind })
    setShowPrivacy(false)
    submitReferral()
  }

  const submitReferral = async () => {
    setSubmitting(true)
    try {
      const isUnregistered = form.studentType === 'unregistered'
      const { data: newReferral } = await referralAPI.create({
        studentId:               isUnregistered ? undefined : form.selectedStudent._id,
        isUnregisteredStudent:   isUnregistered,
        facultySnapshotOverride: form.faculty,
        studentSnapshot:         isUnregistered
          ? form.manualStudent
          : { section: form.manualStudent.section, adviser: form.manualStudent.adviser, contactNumber: form.manualStudent.contactNumber },
        referralIndicators: form.referralIndicators,
        otherConcern:       form.otherConcern    || undefined,
        observationDetails: form.observationDetails,
        actionsTaken:       form.actionsTaken,
        otherAction:        form.otherAction     || undefined,
        priorityLevel:      form.priorityLevel,
        studentAwareness:   form.studentAwareness,
        preferredDate:      form.preferredDate   || undefined,
      })

      if (form.submitMode === 'with_appointment') {
        const { appointment } = form
        await referralAPI.requestAppointment(newReferral._id, {
          counselorId: appointment.counselorId,
          date:        appointment.date.toISOString(),
          startTime:   appointment.slot.startTime,
          endTime:     appointment.slot.endTime,
          type:        appointment.type,
        })
        toast.success('Referral submitted and appointment requested!')
      } else {
        toast.success('Referral submitted successfully.')
      }
      navigate('/faculty/referrals')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to submit referral')
    } finally {
      setSubmitting(false)
    }
  }

  const stepComponents = [
    <StepStudent           key="student"      form={form} onChange={setForm} />,
    <StepFaculty           key="faculty"      form={form} onChange={setForm} />,
    <StepIndicators        key="indicators"   form={form} onChange={setForm} />,
    <StepDetails           key="details"      form={form} onChange={setForm} />,
    <StepPriority          key="priority"     form={form} onChange={setForm} />,
    <StepReview            key="review"       form={form} onChange={setForm} />,
    <StepAppointmentRequest
      key="appointment"
      form={form}
      onChange={setForm}
      counselorData={counselorData}
      loadingSchedules={loadingSchedules}
    />,
  ]

  const submitLabel = form.submitMode === 'with_appointment'
    ? 'Submit & Request Appointment'
    : 'Submit Referral'

  return (
    <>
      <PageBanner
        title="New Faculty Referral"
        subtitle="Mindanao Kokusai Daigaku — Guidance &amp; Counseling Office"
      />

      <div className="container-md">
        <WizardSteps steps={STEPS} current={step} />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 lg:p-10">
          <div className="mb-6 pb-5 border-b border-slate-100">
            <p className="text-lg font-display font-semibold text-slate-900">{STEPS[step].label}</p>
            <p className="text-xs text-slate-500 mt-0.5">Step {step + 1} of {STEPS.length}</p>
          </div>

          {stepComponents[step]}

          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => step === 0 ? navigate(-1) : setStep(step - 1)}
              className="btn btn-outline gap-1.5 min-w-[120px] justify-center"
            >
              <ChevronLeft size={16} /> {step === 0 ? 'Cancel' : 'Back'}
            </button>

            {isLastStep ? (
              <button
                type="button"
                disabled={submitting || !canNext()}
                onClick={handleSubmit}
                className="btn btn-primary gap-2 min-w-[160px] justify-center disabled:opacity-60"
              >
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                  : <><Send size={16} /> {submitLabel}</>}
              </button>
            ) : isReviewStep && form.submitMode === 'referral_only' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="btn btn-primary gap-2 min-w-[160px] justify-center disabled:opacity-60"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : <><Send size={16} /> Submit Referral</>}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canNext()}
                onClick={() => setStep(step + 1)}
                className="btn btn-primary gap-1.5 min-w-[140px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <PrivacyNotice
        open={showPrivacy}
        canOfferDontRemind={canOfferDontRemind(user)}
        onAgree={handlePrivacyAgree}
        onClose={() => setShowPrivacy(false)}
      />
    </>
  )
}
