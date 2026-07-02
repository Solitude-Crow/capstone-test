// src/pages/counselor/PreAssessmentList.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, AlertTriangle, Eye, Clock, CheckCircle2, Search,
  ArrowDownWideNarrow, ArrowUpNarrowWide, FilterX,
} from 'lucide-react'
import { preAssessmentAPI } from '@/api'
import { formatDate, timeAgo, COURSES, YEAR_LEVELS, CONCERN_CATEGORIES } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'

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

const RISK_LEVELS = ['Low', 'Moderate', 'High', 'Critical']
const CATEGORY_OPTIONS = Object.keys(CONCERN_CATEGORIES)

const EMPTY_FILTERS = {
  course: '', yearLevel: '', riskLevel: '', category: '', startDate: '', endDate: '',
}

const selectCls = 'px-3 py-2 rounded-xl border border-surface-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-300 transition'

export default function PreAssessmentList() {
  const navigate = useNavigate()
  const [assessments, setAssessments] = useState([])
  const [pagination, setPagination]   = useState({ total: 0, pages: 1 })
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort]               = useState('newest')
  const [search, setSearch]           = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters]         = useState(EMPTY_FILTERS)
  const [page, setPage]               = useState(1)
  const [limit, setLimit]             = useState(10)

  // Debounce the student search box
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false

    const params = {
      page,
      limit,
      sort,
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(debouncedSearch      && { search: debouncedSearch }),
      ...(filters.course       && { course: filters.course }),
      ...(filters.yearLevel    && { yearLevel: filters.yearLevel }),
      ...(filters.riskLevel    && { riskLevel: filters.riskLevel }),
      ...(filters.category     && { category: filters.category }),
      ...(filters.startDate    && { startDate: filters.startDate }),
      ...(filters.endDate      && { endDate: filters.endDate }),
    }

    async function fetchAssessments() {
      setLoading(true)
      try {
        const { data } = await preAssessmentAPI.getCounselorAll(params)
        if (!cancelled) {
          setAssessments(data.assessments || [])
          setPagination(data.pagination || { total: 0, pages: 1 })
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAssessments()
    return () => { cancelled = true }
  }, [statusFilter, sort, debouncedSearch, filters, page, limit])

  const setFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }))
    setPage(1)
  }

  const hasActiveFilters =
    debouncedSearch || Object.values(filters).some(Boolean) || statusFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setFilters(EMPTY_FILTERS)
    setStatusFilter('all')
    setPage(1)
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Pre-Assessments</h1>
        <p className="page-subtitle">Review student pre-assessment forms before sessions</p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'submitted', 'reviewed'].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
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

      {/* Search + advanced filters */}
      <div className="card !p-4 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition"
            />
          </div>
          <button
            type="button"
            onClick={() => { setSort((s) => (s === 'newest' ? 'oldest' : 'newest')); setPage(1) }}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-200 bg-white text-xs font-semibold text-slate-600 hover:border-primary-300 transition-colors shrink-0"
          >
            {sort === 'newest'
              ? <><ArrowDownWideNarrow size={14} /> Newest</>
              : <><ArrowUpNarrowWide size={14} /> Oldest</>}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={filters.course} onChange={(e) => setFilter('course', e.target.value)} className={selectCls} aria-label="Filter by course">
            <option value="">All Courses</option>
            {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={filters.yearLevel} onChange={(e) => setFilter('yearLevel', e.target.value)} className={selectCls} aria-label="Filter by year level">
            <option value="">All Year Levels</option>
            {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <select value={filters.riskLevel} onChange={(e) => setFilter('riskLevel', e.target.value)} className={selectCls} aria-label="Filter by risk level">
            <option value="">All Risk Levels</option>
            {RISK_LEVELS.map((r) => <option key={r} value={r}>{r} Risk</option>)}
          </select>

          <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)} className={selectCls} aria-label="Filter by concern category">
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilter('startDate', e.target.value)}
              className={selectCls}
              aria-label="From date"
            />
            <span className="text-xs text-slate-400">–</span>
            <input
              type="date"
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(e) => setFilter('endDate', e.target.value)}
              className={selectCls}
              aria-label="To date"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
            >
              <FilterX size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="card">
          <EmptyState icon={FileText}
            title={hasActiveFilters ? 'No matching pre-assessments' : 'No pre-assessments'}
            description={hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Student pre-assessment forms will appear here once submitted'} />
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
                    {(assessment.studentId?.course || assessment.studentId?.yearLevel) && (
                      <span className="text-xs text-slate-400">
                        {[assessment.studentId.course, assessment.studentId.yearLevel].filter(Boolean).join(' · ')}
                      </span>
                    )}
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

      {/* Pagination */}
      {!loading && pagination.total > 0 && (
        <div className="mt-6">
          <Pagination
            page={page}
            pages={pagination.pages || 1}
            total={pagination.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1) }}
          />
        </div>
      )}
    </div>
  )
}
