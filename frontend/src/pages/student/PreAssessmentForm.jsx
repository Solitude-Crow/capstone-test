import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronLeft, Send, AlertTriangle, CheckCircle2, Check,
  Loader2, ClipboardList, BarChart3, Tag, MessageSquare,
  ShieldAlert, Eye, User,
} from 'lucide-react'
import { preAssessmentAPI } from '@/api'
import { useAuthStore } from '@/store/authStore'
import {
  shouldShowPrivacyNotice, canOfferDontRemind, recordPrivacyConsent,
} from '@/lib/privacyConsent'
import WizardSteps from '@/components/ui/WizardSteps'
import PrivacyNotice from '@/components/ui/PrivacyNotice'
import {
  PURPOSE_OF_VISIT_OPTIONS,
  LIKERT_STATEMENTS,
  LIKERT_LABELS,
  CONCERN_CATEGORIES,
  CONCERN_DURATION_OPTIONS,
  MKD_URGENCY_LEVELS,
} from '@/lib/utils'
import toast from 'react-hot-toast'

// ── Step config ───────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Your Information',  icon: User },
  { label: 'Purpose of Visit',  icon: ClipboardList },
  { label: 'Self-Assessment',   icon: BarChart3 },
  { label: 'Concern Details',   icon: Tag },
  { label: 'Your Situation',    icon: MessageSquare },
  { label: 'Urgency & Consent', icon: ShieldAlert },
  { label: 'Review',            icon: Eye },
]

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say', 'Other']

const URGENCY_COLORS = {
  Low:       { border: 'border-sky-400',    bg: 'bg-sky-50',    text: 'text-sky-700',    dot: 'bg-sky-500 border-sky-500' },
  Moderate:  { border: 'border-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500 border-amber-500' },
  High:      { border: 'border-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500 border-orange-500' },
  Immediate: { border: 'border-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500 border-red-500' },
}

// ── Read-only field (prefilled from profile) ──────────────────────────────────
function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
        {value || <span className="text-slate-400">—</span>}
      </div>
    </div>
  )
}

// ── Checkbox pill ─────────────────────────────────────────────────────────────
function CheckPill({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`px-3.5 py-3 rounded-xl border-2 text-sm text-left transition-all duration-150 w-full flex items-center gap-2.5
        ${checked
          ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold shadow-sm'
          : 'border-slate-200 text-slate-600 hover:border-primary-300 hover:bg-primary-50/40'}`}
    >
      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
        ${checked ? 'border-primary-500 bg-primary-500' : 'border-slate-300 bg-white'}`}>
        {checked && <Check size={13} strokeWidth={3} className="text-white" />}
      </span>
      <span className="leading-snug">{label}</span>
    </button>
  )
}

// ── Likert radio row ──────────────────────────────────────────────────────────
function LikertRow({ statement, index, value, onChange }) {
  return (
    <div className="pb-5 border-b border-slate-100 last:border-0 last:pb-0">
      <p className="text-sm font-medium text-slate-700 mb-3">
        <span className="text-primary-500 font-bold mr-1.5">{index + 1}.</span>
        {statement}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((score) => {
          const isSelected = value === score
          const colors =
            score <= 2 ? { sel: 'border-emerald-400 bg-emerald-50 text-emerald-700', hover: 'hover:border-emerald-300' } :
            score === 3 ? { sel: 'border-amber-400 bg-amber-50 text-amber-700', hover: 'hover:border-amber-300' } :
                          { sel: 'border-red-400 bg-red-50 text-red-700', hover: 'hover:border-red-300' }
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              className={`p-2 rounded-xl border-2 text-center transition-all duration-150
                ${isSelected
                  ? colors.sel + ' font-semibold'
                  : `border-slate-200 text-slate-500 ${colors.hover} hover:bg-slate-50`}`}
            >
              <span className="block text-xs font-bold">{score}</span>
              <span className="block text-[9px] leading-tight mt-0.5">{LIKERT_LABELS[score]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PreAssessmentForm() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  const [form, setForm] = useState({
    // Step 0: Student Information (fields not stored on the profile)
    studentInfo: { section: '', age: '', gender: '', contactNumber: '' },

    // Step 1: Purpose of Visit
    purposeOfVisit: [],
    purposeOfVisitOther: '',

    // Step 2: Likert Self-Assessment
    likertResponses: LIKERT_STATEMENTS.map((statement) => ({ statement, score: 0 })),

    // Step 3: Concern Categories
    concernCategories: [],
    concernCategoryOther: '',

    // Step 4: Open-Ended
    concernDescription: '',
    concernDuration: '',
    expectedAssistance: '',

    // Step 5: Urgency + Consent
    urgencyLevel: '',
    consentAccuracy: false,
    consentUsage: false,
  })

  // ── Field helpers ─────────────────────────────────────────────────────────
  const updateStudentInfo = (key, value) =>
    setForm((f) => ({ ...f, studentInfo: { ...f.studentInfo, [key]: value } }))

  const togglePurpose = (opt) =>
    setForm((f) => ({
      ...f,
      purposeOfVisit: f.purposeOfVisit.includes(opt)
        ? f.purposeOfVisit.filter((x) => x !== opt)
        : [...f.purposeOfVisit, opt],
    }))

  const toggleCategory = (cat) =>
    setForm((f) => ({
      ...f,
      concernCategories: f.concernCategories.includes(cat)
        ? f.concernCategories.filter((x) => x !== cat)
        : [...f.concernCategories, cat],
    }))

  const setLikert = (index, score) =>
    setForm((f) => ({
      ...f,
      likertResponses: f.likertResponses.map((r, i) =>
        i === index ? { ...r, score } : r
      ),
    }))

  // ── Validation per step ───────────────────────────────────────────────────
  const canNext = () => {
    switch (step) {
      case 0: {
        const si = form.studentInfo
        const age = Number(si.age)
        return (
          si.section.trim() !== '' &&
          si.gender.trim() !== '' &&
          si.age !== '' && Number.isFinite(age) && age >= 10 && age <= 120 &&
          si.contactNumber.trim().length >= 7
        )
      }
      case 1: return form.purposeOfVisit.length > 0
      case 2: return form.likertResponses.every((r) => r.score > 0)
      case 3: return form.concernCategories.length > 0
      case 4: return form.concernDescription.trim().length >= 10 && form.concernDuration !== ''
      case 5: return form.urgencyLevel !== '' && form.consentAccuracy && form.consentUsage
      default: return true
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  // Gate submission behind the Privacy Notice (skipped if the user opted out).
  const handleSubmit = () => {
    if (shouldShowPrivacyNotice(user)) setShowPrivacy(true)
    else submitForm()
  }

  const handlePrivacyAgree = ({ dontRemind }) => {
    recordPrivacyConsent(user, { dontRemind })
    setShowPrivacy(false)
    submitForm()
  }

  const submitForm = async () => {
    setSubmitting(true)
    try {
      const age = Number(form.studentInfo.age)
      const payload = {
        studentInfo: {
          section:       form.studentInfo.section.trim(),
          age:           Number.isFinite(age) ? age : undefined,
          gender:        form.studentInfo.gender,
          contactNumber: form.studentInfo.contactNumber.trim(),
        },
        purposeOfVisit:       form.purposeOfVisit,
        purposeOfVisitOther:  form.purposeOfVisitOther,
        likertResponses:      form.likertResponses,
        concernCategories:    form.concernCategories,
        concernCategoryOther: form.concernCategoryOther,
        concernDescription:   form.concernDescription,
        concernDuration:      form.concernDuration,
        expectedAssistance:   form.expectedAssistance,
        urgencyLevel:         form.urgencyLevel,
        consentGiven:         form.consentAccuracy && form.consentUsage,
      }

      const { data } = await preAssessmentAPI.submit(payload)
      navigate('/student/pre-assessment/results', {
        replace: true,
        state: {
          preAssessmentId:   data.preAssessmentId,
          assessmentResults: data.assessmentResults,
          aiRecommendations: data.aiRecommendations,
          urgencyLevel:      form.urgencyLevel,
          purposeOfVisit:    form.purposeOfVisit,
        },
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition'

  return (
    <div className="animate-fade-in container-md">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
          Student Pre-Assessment Form
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Mindanao Kokusai Daigaku — Guidance Office
        </p>
      </div>

      {/* Confidentiality notice */}
      <div className="mb-6 p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <AlertTriangle size={16} className="text-brand-info mt-0.5 shrink-0" />
        <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
          <strong>Confidential:</strong> The information provided in this form shall be treated with
          strict confidentiality and will only be accessed by authorized Guidance Office personnel.
          Completion of this form does not replace professional counseling.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 lg:p-10">
        <WizardSteps steps={STEPS} current={step} />

        {/* ── Step 0: Student Information ── */}
        {step === 0 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="font-display text-xl text-slate-900">A. Student Information</h2>
              <p className="text-sm text-slate-500 mt-1">
                Please confirm your details below and complete the remaining fields.
              </p>
            </div>

            {/* Prefilled from profile (read-only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadOnlyField label="Full Name" value={user?.fullName} />
              <ReadOnlyField label="Student ID Number" value={user?.studentIDnum} />
              <ReadOnlyField label="Program / Course" value={user?.course} />
              <ReadOnlyField label="Year Level" value={user?.yearLevel} />
              <ReadOnlyField label="Email Address" value={user?.email} />
            </div>

            {/* Collected here */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Section</label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. BSIS-3A"
                  value={form.studentInfo.section}
                  onChange={(e) => updateStudentInfo('section', e.target.value)}
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Age</label>
                <input
                  type="number"
                  min={10}
                  max={120}
                  className={inputCls}
                  placeholder="e.g. 20"
                  value={form.studentInfo.age}
                  onChange={(e) => updateStudentInfo('age', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Gender</label>
                <select
                  className={inputCls}
                  value={form.studentInfo.gender}
                  onChange={(e) => updateStudentInfo('gender', e.target.value)}
                >
                  <option value="">Select…</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Number</label>
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="e.g. 0917 123 4567"
                  value={form.studentInfo.contactNumber}
                  onChange={(e) => updateStudentInfo('contactNumber', e.target.value)}
                  maxLength={30}
                />
              </div>
            </div>
            {!canNext() && (
              <p className="text-xs text-amber-600">
                Please complete Section, Age (10–120), Gender, and a valid Contact Number to continue.
              </p>
            )}
          </div>
        )}

        {/* ── Step 1: Purpose of Visit ── */}
        {step === 1 && (
          <div className="animate-fade-in space-y-5">
            <div>
              <h2 className="font-display text-xl text-slate-900">B. Purpose of Visit</h2>
              <p className="text-sm text-slate-500 mt-1">
                What best describes the reason for seeking guidance services? (Check all that apply)
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {PURPOSE_OF_VISIT_OPTIONS.filter((o) => o !== 'Others').map((opt) => (
                <CheckPill
                  key={opt}
                  label={opt}
                  checked={form.purposeOfVisit.includes(opt)}
                  onChange={() => togglePurpose(opt)}
                />
              ))}
            </div>
            <div>
              <CheckPill
                label="Others"
                checked={form.purposeOfVisit.includes('Others')}
                onChange={() => togglePurpose('Others')}
              />
              {form.purposeOfVisit.includes('Others') && (
                <input
                  type="text"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder="Please specify..."
                  value={form.purposeOfVisitOther}
                  onChange={(e) => setForm((f) => ({ ...f, purposeOfVisitOther: e.target.value }))}
                  maxLength={200}
                />
              )}
            </div>
            {form.purposeOfVisit.length === 0 && (
              <p className="text-xs text-amber-600">Please select at least one option to continue.</p>
            )}
          </div>
        )}

        {/* ── Step 2: Likert Self-Assessment ── */}
        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="font-display text-xl text-slate-900">C. Self-Assessment of Current Concerns</h2>
              <p className="text-sm text-slate-500 mt-1">
                Please indicate how much each statement applies to you.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className="px-2 py-1 bg-slate-100 rounded-lg">
                    <strong>{n}</strong> = {LIKERT_LABELS[n]}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-5">
              {form.likertResponses.map((r, i) => (
                <LikertRow
                  key={i}
                  index={i}
                  statement={r.statement}
                  value={r.score}
                  onChange={(score) => setLikert(i, score)}
                />
              ))}
            </div>
            {!form.likertResponses.every((r) => r.score > 0) && (
              <p className="text-xs text-amber-600">Please respond to all statements to continue.</p>
            )}
          </div>
        )}

        {/* ── Step 3: Concern Categories ── */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="font-display text-xl text-slate-900">D. Concern Categories</h2>
              <p className="text-sm text-slate-500 mt-1">
                Select the concerns that best describe your situation. (Check all that apply)
              </p>
            </div>
            {Object.entries(CONCERN_CATEGORIES).map(([group, items]) => (
              <div key={group}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{group}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {items.map((item) => (
                    <CheckPill
                      key={item}
                      label={item}
                      checked={form.concernCategories.includes(item)}
                      onChange={() => toggleCategory(item)}
                    />
                  ))}
                  {group === 'Others' && (
                    <div className="col-span-full">
                      {form.concernCategories.some((c) => CONCERN_CATEGORIES.Others.includes(c)) && (
                        <input
                          type="text"
                          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                          placeholder="Other concern (optional)..."
                          value={form.concernCategoryOther}
                          onChange={(e) => setForm((f) => ({ ...f, concernCategoryOther: e.target.value }))}
                          maxLength={200}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {form.concernCategories.length === 0 && (
              <p className="text-xs text-amber-600">Please select at least one concern category to continue.</p>
            )}
          </div>
        )}

        {/* ── Step 4: Open-Ended ── */}
        {step === 4 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <h2 className="font-display text-xl text-slate-900">E. Open-Ended Questions</h2>
            </div>

            {/* Concern description */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                1. Briefly describe your concern.
              </label>
              <textarea
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition min-h-[120px]"
                rows={5}
                placeholder="Please describe what you're going through in your own words..."
                value={form.concernDescription}
                onChange={(e) => setForm((f) => ({ ...f, concernDescription: e.target.value }))}
                maxLength={2000}
              />
              <p className={`text-xs mt-1 ${form.concernDescription.length < 10 ? 'text-red-400' : 'text-slate-400'}`}>
                {form.concernDescription.length} / 2000 characters
              </p>
            </div>

            {/* Concern duration */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                2. How long have you been experiencing this concern?
              </label>
              <div className="space-y-2">
                {CONCERN_DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, concernDuration: opt }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all
                      ${form.concernDuration === opt
                        ? 'border-primary-400 bg-primary-50 text-primary-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:border-primary-300 hover:bg-primary-50/30'}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center
                        ${form.concernDuration === opt ? 'border-primary-500 bg-primary-500' : 'border-slate-300'}`}>
                        {form.concernDuration === opt && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      {opt}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Expected assistance */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                3. What kind of assistance do you expect from the Guidance Office?
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </label>
              <textarea
                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition min-h-[90px]"
                rows={3}
                placeholder="Describe what kind of help or support you are hoping to receive..."
                value={form.expectedAssistance}
                onChange={(e) => setForm((f) => ({ ...f, expectedAssistance: e.target.value }))}
                maxLength={1000}
              />
            </div>
          </div>
        )}

        {/* ── Step 5: Urgency + Consent ── */}
        {step === 5 && (
          <div className="animate-fade-in space-y-7">
            {/* Urgency */}
            <div>
              <h2 className="font-display text-xl text-slate-900">F. Urgency Assessment</h2>
              <p className="text-sm text-slate-500 mt-1 mb-4">How urgent do you believe your concern is?</p>
              <div className="space-y-3">
                {MKD_URGENCY_LEVELS.map(({ value, label, description }) => {
                  const c = URGENCY_COLORS[value]
                  const sel = form.urgencyLevel === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, urgencyLevel: value }))}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all
                        ${sel ? `${c.border} ${c.bg}` : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center
                          ${sel ? c.dot : 'border-slate-300'}`}>
                          {sel && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <div>
                          <p className={`text-sm font-semibold ${sel ? c.text : 'text-slate-700'}`}>{label}</p>
                          <p className="text-xs text-slate-500">{description}</p>
                        </div>
                        {value === 'Immediate' && (
                          <AlertTriangle size={15} className="text-red-500 ml-auto shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Consent */}
            <div>
              <h2 className="font-display text-xl text-slate-900 mb-4">G. Consent</h2>

              {/* Student-facing disclaimer */}
              <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-800 mb-1.5">Important Notice</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  The information generated by this pre-assessment is intended only to assist the
                  Guidance Office in understanding your concerns and preparing for counseling sessions.
                  The results are suggestive in nature and should be interpreted with discretion. They
                  do not constitute professional counseling, diagnosis, treatment, or psychological
                  evaluation. Only a qualified Guidance Counselor can properly assess your situation
                  and provide appropriate guidance based on a complete understanding of your circumstances.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    key: 'consentAccuracy',
                    label: 'I certify that the information provided is accurate to the best of my knowledge.',
                  },
                  {
                    key: 'consentUsage',
                    label: 'I understand that the information will only be used for counseling and guidance purposes.',
                  },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all
                      ${form[key]
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <span className="flex items-start gap-3">
                      <span className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0
                        ${form[key] ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                        {form[key] && <CheckCircle2 size={12} className="text-white" />}
                      </span>
                      <span className={`text-sm ${form[key] ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>
                        {label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {(!form.consentAccuracy || !form.consentUsage) && form.urgencyLevel && (
                <p className="text-xs text-amber-600 mt-2">
                  Both consent items must be acknowledged before submission.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 6: Review ── */}
        {step === 6 && (
          <div className="animate-fade-in space-y-5">
            <h2 className="font-display text-xl text-slate-900">Review & Submit</h2>

            {/* Student Information */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Student Information</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <p className="text-slate-600">Name: <span className="text-slate-800 font-medium">{user?.fullName || '—'}</span></p>
                <p className="text-slate-600">Student ID: <span className="text-slate-800 font-medium">{user?.studentIDnum || '—'}</span></p>
                <p className="text-slate-600">Course: <span className="text-slate-800 font-medium">{user?.course || '—'}</span></p>
                <p className="text-slate-600">Year &amp; Section: <span className="text-slate-800 font-medium">{user?.yearLevel || '—'} {form.studentInfo.section}</span></p>
                <p className="text-slate-600">Age: <span className="text-slate-800 font-medium">{form.studentInfo.age || '—'}</span></p>
                <p className="text-slate-600">Gender: <span className="text-slate-800 font-medium">{form.studentInfo.gender || '—'}</span></p>
                <p className="text-slate-600">Contact: <span className="text-slate-800 font-medium">{form.studentInfo.contactNumber || '—'}</span></p>
                <p className="text-slate-600">Email: <span className="text-slate-800 font-medium">{user?.email || '—'}</span></p>
              </div>
            </div>

            {/* Purpose of Visit */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Purpose of Visit</p>
              <div className="flex flex-wrap gap-1.5">
                {form.purposeOfVisit.map((p) => (
                  <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 font-medium">{p}</span>
                ))}
                {form.purposeOfVisitOther && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 font-medium">{form.purposeOfVisitOther}</span>
                )}
              </div>
            </div>

            {/* Self-Assessment */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-3 font-semibold uppercase tracking-wide">Self-Assessment (Likert Scale)</p>
              <div className="space-y-1.5">
                {form.likertResponses.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-600 flex-1">{i + 1}. {r.statement}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0
                      ${r.score >= 4 ? 'bg-red-100 text-red-700' : r.score === 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {r.score} – {LIKERT_LABELS[r.score]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Concern Categories */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Concern Categories</p>
              <div className="flex flex-wrap gap-1.5">
                {form.concernCategories.map((c) => (
                  <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-medium">{c}</span>
                ))}
              </div>
            </div>

            {/* Open-ended */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wide">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{form.concernDescription}</p>
              {form.concernDuration && (
                <p className="text-xs text-slate-500 mt-2">Duration: <strong>{form.concernDuration}</strong></p>
              )}
              {form.expectedAssistance && (
                <p className="text-xs text-slate-500 mt-1">Expected assistance: {form.expectedAssistance}</p>
              )}
            </div>

            {/* Urgency */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">Urgency Level</p>
              <p className="text-sm font-semibold text-slate-800">{form.urgencyLevel}</p>
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Reminder:</strong> After submitting, the system will generate
                preliminary suggestive insights to assist your counselor. These are informational only
                and do not constitute professional counseling, diagnosis, or evaluation.
              </p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between gap-3 mt-10 pt-6 border-t border-slate-100">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="btn btn-outline gap-1.5 min-w-[120px] justify-center">
              <ChevronLeft size={16} /> Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button
              disabled={!canNext()}
              onClick={() => setStep(step + 1)}
              className="btn btn-primary gap-1.5 min-w-[140px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canNext()}
              className="btn btn-primary gap-1.5 min-w-[160px] justify-center disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
              ) : (
                <><Send size={16} /> Submit Form</>
              )}
            </button>
          )}
        </div>
      </div>

      <PrivacyNotice
        open={showPrivacy}
        canOfferDontRemind={canOfferDontRemind(user)}
        onAgree={handlePrivacyAgree}
        onClose={() => setShowPrivacy(false)}
      />
    </div>
  )
}
