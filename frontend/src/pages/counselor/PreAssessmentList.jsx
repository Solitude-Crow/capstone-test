// src/pages/counselor/PreAssessmentList.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, AlertTriangle, Eye, Clock, CheckCircle2 } from 'lucide-react'
import { preAssessmentAPI } from '@/api'
import { formatDate, timeAgo } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'

const URGENCY_COLORS = {
  Low:       'bg-slate-100 text-slate-600',
  Moderate:  'bg-blue-100 text-blue-600',
  High:      'bg-orange-100 text-orange-600',
  Immediate: 'bg-red-100 text-red-600',
  Crisis:    'bg-red-100 text-red-600',
}

const RISK_COLORS = {
  Low:      'bg-slate-100 text-slate-600',
  Moderate: 'bg-amber-100 text-amber-700',
  High:     'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
}

export default function PreAssessmentList() {
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    const params = statusFilter !== 'all' ? { status: statusFilter } : {}

    async function fetchAssessments() {
      setLoading(true)
      try {
        const { data } = await preAssessmentAPI.getCounselorAll({ ...params, limit: 50 })
        if (!cancelled) setAssessments(data.assessments || [])
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAssessments()
    return () => { cancelled = true }
  }, [statusFilter])

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Pre-Assessments</h1>
        <p className="page-subtitle">Review student pre-assessment forms before sessions</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'submitted', 'reviewed'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold capitalize transition-all
              ${statusFilter === s
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-surface-200 text-slate-600 hover:border-primary-300'}`}>
            {s === 'submitted'
              ? <><Clock size={13} /> Unreviewed</>
              : s === 'reviewed'
              ? <><CheckCircle2 size={13} /> Reviewed</>
              : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileText} title="No pre-assessments"
            description="Student pre-assessment forms will appear here once submitted" />
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <div
              key={assessment._id}
              onClick={() => navigate(`/counselor/pre-assessments/${assessment._id}`)}
              className="card-hover cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <Avatar name={assessment.studentId?.fullName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-slate-900 text-sm">{assessment.studentId?.fullName}</p>
                    {assessment.assessmentResults?.riskLevel ? (
                      <span className={`badge-pill ${RISK_COLORS[assessment.assessmentResults.riskLevel]}`}>
                        {assessment.assessmentResults.riskLevel === 'Critical' && <AlertTriangle size={10} />}
                        {assessment.assessmentResults.riskLevel} Risk
                      </span>
                    ) : (
                      <span className={`badge-pill ${URGENCY_COLORS[assessment.urgencyLevel]}`}>
                        {(assessment.urgencyLevel === 'Immediate' || assessment.urgencyLevel === 'Crisis') && <AlertTriangle size={10} />}
                        {assessment.urgencyLevel}
                      </span>
                    )}
                    {assessment.status === 'submitted' ? (
                      <span className="badge-pill bg-amber-100 text-amber-700">
                        <Clock size={10} /> Unreviewed
                      </span>
                    ) : (
                      <span className="badge-pill bg-emerald-100 text-emerald-700">
                        <CheckCircle2 size={10} /> Reviewed
                      </span>
                    )}
                    {(assessment.assessmentResults?.riskLevel === 'Critical' ||
                      assessment.aiRecommendations?.urgencyFlag) && (
                      <span className="badge-pill bg-red-100 text-red-600">
                        <AlertTriangle size={10} /> Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {assessment.assessmentResults?.detectedCategory || assessment.primaryConcern}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                    {assessment.concernDescription}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{timeAgo(assessment.createdAt)}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {assessment.appointmentId && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Appointment</p>
                      <p className="text-xs font-medium text-slate-700">
                        {formatDate(assessment.appointmentId.date)}
                      </p>
                    </div>
                  )}
                  <Eye size={16} className="text-slate-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}