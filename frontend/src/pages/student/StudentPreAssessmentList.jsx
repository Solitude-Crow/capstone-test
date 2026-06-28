// src/pages/student/StudentPreAssessmentList.jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ClipboardList, CalendarDays, BookOpen, Phone, Eye,
  ArrowRight, Sparkles, Search, ChevronRight, CheckCircle2,
} from 'lucide-react'
import { preAssessmentAPI } from '@/api'
import { timeAgo, RISK_LEVEL_CONFIG } from '@/lib/utils'
import EmptyState from '@/components/ui/EmptyState'

// Legacy (old AI submissions) — recommendedAction → display
const ACTION_DISPLAY = {
  book_appointment:  { label: 'Book Appointment',  Icon: CalendarDays, color: 'text-primary-600',  bg: 'bg-primary-50'  },
  self_help:         { label: 'Self-Help',          Icon: BookOpen,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  external_referral: { label: 'Seek Referral',      Icon: Phone,        color: 'text-orange-600',  bg: 'bg-orange-50'  },
  monitor_self:      { label: 'Self-Monitor',        Icon: Eye,          color: 'text-blue-600',    bg: 'bg-blue-50'    },
}

export default function StudentPreAssessmentList() {
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')

  useEffect(() => {
    preAssessmentAPI.getMyAll()
      .then(({ data }) => setAssessments(data.assessments || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = assessments.filter((a) => {
    const term = search.toLowerCase()
    const category = a.assessmentResults?.detectedCategory || a.primaryConcern || ''
    return category.toLowerCase().includes(term)
  })

  return (
    <div className="animate-fade-in max-w-4xl mx-auto px-2 lg:px-6">
      {/* Header */}
      <div className="page-header flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">My Pre-Assessments</h1>
          <p className="page-subtitle">All your submitted pre-assessment forms</p>
        </div>
        <Link
          to="/student/pre-assessment"
          className="btn-primary flex items-center gap-2 border border-primary-600 rounded-xl px-4 py-2 font-semibold shrink-0"
        >
          New Assessment <ArrowRight size={15} />
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by concern…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card py-12">
          <EmptyState
            icon={ClipboardList}
            title={search ? 'No results found' : 'No assessments yet'}
            description={search ? 'Try a different search term' : 'Complete a pre-assessment to get personalized guidance'}
            action={
              !search && (
                <Link to="/student/pre-assessment" className="btn-primary text-sm border border-primary-600 rounded-xl px-4 py-2">
                  Start Now
                </Link>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const ar       = a.assessmentResults
            const riskCfg  = ar?.riskLevel ? RISK_LEVEL_CONFIG[ar.riskLevel] : null
            const category = ar?.detectedCategory || a.primaryConcern || 'Pre-Assessment'

            // Legacy fallback for old AI submissions
            const action  = a.aiRecommendations?.recommendedAction
            const display = action ? ACTION_DISPLAY[action] : null
            const ActionIcon = display?.Icon

            return (
              <div
                key={a._id}
                className="card border border-surface-200 hover:border-primary-200 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(`/student/pre-assessment/${a._id}/detail`)}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${display?.bg || 'bg-primary-50'}`}>
                    {ActionIcon
                      ? <ActionIcon size={18} className={display.color} />
                      : <ClipboardList size={18} className="text-primary-500" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{category}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
                      {riskCfg ? (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${riskCfg.bg} ${riskCfg.color}`}>
                          {riskCfg.label}
                        </span>
                      ) : display ? (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${display.bg} ${display.color}`}>
                          {display.label}
                        </span>
                      ) : null}
                      {(ar?.riskLevel === 'Critical' || a.aiRecommendations?.urgencyFlag) && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-600">
                          Flagged
                        </span>
                      )}
                      {a.appointmentId && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 size={12} /> Linked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-400 transition-colors shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Count footer */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center mt-6 pb-8">
          Showing {filtered.length} of {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}